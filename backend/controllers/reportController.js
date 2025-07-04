const ScanResult = require("../models/ScanResult");
const Recommendation = require("../models/Recommendation");
const Project = require("../models/Project"); 
const mongoose = require('mongoose');
const { validationResult } = require("express-validator"); // Keep this if you want validation

// --- Helper function to calculate overall severity for a scan result ---
const calculateOverallSeverity = (vulnerabilities) => {
  if (!vulnerabilities || vulnerabilities.length === 0) {
    return 'None';
  }

  const severityOrder = { 'Critical': 5, 'High': 4, 'Medium': 3, 'Low': 2, 'None': 1 };
  let maxSeverity = 'None';

  for (const vuln of vulnerabilities) {
    if (severityOrder[vuln.severity] > severityOrder[maxSeverity]) {
      maxSeverity = vuln.severity;
    }
  }
  return maxSeverity;
};


// --- Main function to receive and save scan results, and generate recommendations ---
const receiveAndProcessScanResults = async (req, res) => {
  console.log('Received POST to /api/reports/scan-results. Request Body:', JSON.stringify(req.body, null, 2));

  const {
    project: projectId, // This is the _id coming from CI
    tool,
    vulnerabilities,
    score,
    reportUrl,
    gitlabPipelineId,
    gitlabJobId,
    sonarqubeReportUrl,
    projectName, // <--- Add this if your CI sends it
    gitlabProjectId // <--- Add this if your CI sends it (GitLab's native numeric ID)
  } = req.body;

  if (!projectId || !tool) {
    return res.status(400).json({
      success: false,
      error: 'Missing required fields: project (MongoDB ObjectId) and tool.',
      received: req.body
    });
  }

  try {
    let existingProject = null;

    // First, try to find the project by the _id provided by the CI
    if (mongoose.Types.ObjectId.isValid(projectId)) { // Always validate ObjectId format
        existingProject = await Project.findById(projectId);
    }
    
    // If not found by the provided _id, try to find by gitlabProjectId if it exists
    // This is good if the CI sends its native GitLab Project ID along with the _id
    if (!existingProject && gitlabProjectId) {
        existingProject = await Project.findOne({ gitlabProjectId: gitlabProjectId });
    }

    // If still no project found, create a new one
    if (!existingProject) {
      console.log(`ℹ️ Project with ID ${projectId} (or GitLab ID ${gitlabProjectId}) not found. Creating new project...`);
      existingProject = new Project({
        _id: mongoose.Types.ObjectId.isValid(projectId) ? projectId : new mongoose.Types.ObjectId(), // Use provided _id if valid, otherwise generate new
        name: projectName || `Project-${projectId || gitlabProjectId || 'Unknown'}`, // Use projectName from payload if available
        gitlabProjectId: gitlabProjectId, // Save GitLab's native ID
        description: `Auto-created from CI pipeline for project ID: ${gitlabProjectId}`,
        // Add any other default fields for a new project here
      });
      await existingProject.save();
      console.log(`✅ New Project created: ${existingProject._id} (Name: ${existingProject.name})`);
    } else {
      console.log(`✅ Found existing project: ${existingProject._id} (Name: ${existingProject.name})`);
    }

    // Now existingProject is guaranteed to be a valid Mongoose document
    const overallSeverity = calculateOverallSeverity(vulnerabilities);

    const newScanResult = new ScanResult({
      project: existingProject._id, 
      tool: tool,
      severity: overallSeverity,
      score: score || 100,
      vulnerabilities: vulnerabilities || [],
      reportUrl: reportUrl || sonarqubeReportUrl,
      gitlabPipelineId: gitlabPipelineId,
      gitlabJobId: gitlabJobId,
    });

    await newScanResult.save();
    console.log(`✅ Scan result from ${tool} saved successfully for project ${existingProject._id}: ${newScanResult._id}`);

    const generatedRecs = await generateRecommendations(newScanResult);
    console.log(`💡 Generated ${generatedRecs.length} recommendations for scan result ${newScanResult._id}`);

    res.status(201).json({
      success: true,
      message: `Scan result from ${tool} saved successfully`,
      resultId: newScanResult._id,
      recommendationsGenerated: generatedRecs.length
    });

  } catch (err) {
    console.error('❌ Failed to save and process scan result:', err);
    const validationErrors = err.name === 'ValidationError' ?
      Object.keys(err.errors).map(key => err.errors[key].message).join(', ') :
      err.message;

    res.status(500).json({
      success: false,
      error: 'Failed to save and process scan result',
      details: validationErrors,
      received: req.body
    });
  }
};


// --- Recommendation Generation Logic ---
const generateRecommendations = async (scanResult) => {
  const recommendations = [];

  // Rule 1: High/Critical Vulnerabilities Found
  const criticalOrHighVulns = scanResult.vulnerabilities.filter(
    v => v.severity === 'Critical' || v.severity === 'High'
  );
  if (criticalOrHighVulns.length > 0) {
    recommendations.push(
      new Recommendation({
        project: scanResult.project,
        relatedScan: scanResult._id,
        title: `Immediate Action: ${criticalOrHighVulns.length} Critical/High Vulnerabilities Detected`,
        description: `Review and patch the following critical/high vulnerabilities found by ${scanResult.tool}: ${criticalOrHighVulns.map(v => v.name).join(', ')}. Refer to the full report for details.`,
        toolSuggested: 'Other', // General recommendation
        severity: 'high',
        status: 'pending'
      })
    );
  }

  // Rule 2: Outdated Dependencies (if from Trivy/Dependency-Check with fixed versions)
  const outdatedDependencies = scanResult.vulnerabilities.filter(
    v => v.packageName && v.fixedVersion && (scanResult.tool === 'Trivy' || scanResult.tool === 'OWASP Dependency Check')
  );
  if (outdatedDependencies.length > 0) {
    recommendations.push(
      new Recommendation({
        project: scanResult.project,
        relatedScan: scanResult._id,
        title: `${outdatedDependencies.length} Outdated Dependencies Identified`,
        description: `Update the following dependencies to their fixed versions: ${outdatedDependencies.map(v => `${v.packageName} (${v.installedVersion} -> ${v.fixedVersion})`).join(', ')}.`,
        toolSuggested: 'Trivy', // Or 'OWASP Dependency Check'
        severity: 'medium',
        status: 'pending'
      })
    );
  }

  // Rule 3: Low Score (e.g., SonarQube Quality Gate Failure)
  if (scanResult.score && scanResult.score < 80) { // Example threshold
    recommendations.push(
      new Recommendation({
        project: scanResult.project,
        relatedScan: scanResult._id,
        title: `Low Scan Score: ${scanResult.score}%`,
        description: `The overall security/quality score is low. Review findings from ${scanResult.tool} to improve code quality and security posture.`,
        toolSuggested: scanResult.tool === 'SonarQube' ? 'SonarQube' : 'Other',
        severity: 'medium',
        status: 'pending'
      })
    );
  }

  // Rule 4: Missing Tools (More complex, would need project configuration)
  // This rule would typically involve checking a project's "expected tools"
  // from the Project model and comparing them to what's actually reported.
  // For simplicity, we'll omit complex "missing tool" logic here,
  // as it requires knowing what tools *should* have run.
  // A simpler way: If "Rapport Agrégé" is missing, suggest running a comprehensive scan.

  if (recommendations.length > 0) {
    // Save the recommendations to the database
    await Recommendation.insertMany(recommendations);
  }

  return recommendations;
};

const saveScanResult = async (req, res) => {
  console.log('Received POST to /scan-results. Request Body:', req.body);

  const { project, tool, severity, score, issues, vulnerabilities, reportUrl, gitlabPipelineId, gitlabJobId } = req.body;

  if (!project || !tool || !severity) {
    return res.status(400).json({
      success: false,
      error: 'Missing required fields: project (MongoDB ObjectId), tool, and overall severity.',
      received: req.body
    });
  }

  try {
    const existingProject = await Project.findById(project);
    if (!existingProject) {
      return res.status(404).json({
        success: false,
        error: `Project with ID ${project} not found in database. Cannot save scan result.`
      });
    }

    const newResult = new ScanResult({
      project: project,
      tool: tool,
      severity: severity,
      score: score,
      issues: issues || [],
      vulnerabilities: vulnerabilities || [],
      reportUrl: reportUrl,
      gitlabPipelineId: gitlabPipelineId,
      gitlabJobId: gitlabJobId
    });

    await newResult.save();
    console.log(`✅ Scan result from ${tool} saved successfully for project ${project}: ${newResult._id}`);

    res.status(201).json({
      success: true,
      message: `Scan result from ${tool} saved successfully`,
      resultId: newResult._id
    });

  } catch (err) {
    console.error('❌ Failed to save scan result:', err);
    const validationErrors = err.errors ? Object.keys(err.errors).map(key => err.errors[key].message).join(', ') : err.message;

    res.status(500).json({
      success: false,
      error: 'Failed to save scan result',
      details: validationErrors
    });
  }
};
// --- Get all scan results (potentially with filters/pagination) ---
const getScanResults = async (req, res) => {
  try {
    // Récupérer les paramètres de requête : projectId et tool
    const { projectId, tool } = req.query; // Expecting projectId and tool as query parameters

    let query = {}; // Initialiser l'objet de requête vide

    // 1. Filtrage par ID de projet (si fourni et valide)
    if (projectId && mongoose.Types.ObjectId.isValid(projectId)) {
      query.project = projectId;
    }

    // 2. Filtrage par nom d'outil (si fourni)
    if (tool) {
      query.tool = tool; // Exemple: "Trivy", "OWASP ZAP", "Automated Scan"
    }

    // Exécuter la requête Mongoose avec les filtres dynamiques
    const results = await ScanResult.find(query)
      .populate('project', 'name gitlabProjectId') // Populate project details
      .sort({ createdAt: -1 }); // Trier par date de création, du plus récent au plus ancien

    res.json({
      success: true,
      count: results.length,
      results: results
    });
  } catch (err) {
    console.error('Failed to fetch scan results:', err);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch scan results',
      details: err.message
    });
  }
};

// --- Get a single scan result by ID ---
const getScanResultById = async (req, res) => {
  try {
    const result = await ScanResult.findById(req.params.id).populate('project', 'name gitlabProjectId');
    if (!result) {
      return res.status(404).json({
        success: false,
        error: 'Scan result not found'
      });
    }
    res.json({
      success: true,
      result: result
    });
  } catch (err) {
    console.error('Failed to fetch scan result:', err);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch scan result',
      details: err.message
    });
  }
};

// --- Get recommendations for a specific scan result ---
const getRecommendationsByScanResultId = async (req, res) => {
  try {
    const { scanResultId } = req.params;
    const recommendations = await Recommendation.find({ relatedScan: scanResultId }).populate('project', 'name');
    if (recommendations.length === 0) {
      return res.status(404).json({ success: false, message: "No recommendations found for this scan result." });
    }
    res.json({ success: true, recommendations });
  } catch (err) {
    console.error('Failed to fetch recommendations:', err);
    res.status(500).json({ success: false, error: 'Failed to fetch recommendations', details: err.message });
  }
};

// --- Get the LATEST aggregated scan result for Grafana dashboard ---
const getLatestAggregatedScanResult = async (req, res) => {
    try {
        const { projectId } = req.query; // Optionnel: filtrer par ID de projet

        let query = { tool: "Rapport Agrégé" }; // Chercher spécifiquement les rapports agrégés
        if (projectId && mongoose.Types.ObjectId.isValid(projectId)) {
            query.project = projectId;
        }

        const latestScan = await ScanResult.findOne(query)
                                           .sort({ createdAt: -1 }) // Le plus récent d'abord
                                           .populate('project', 'name gitlabProjectId')
                                           .lean(); // Utilisez .lean() pour obtenir un objet JS simple et non un document Mongoose

        if (!latestScan) {
            return res.status(404).json({
                success: false,
                message: projectId ? `No aggregated scan results found for project ID ${projectId}.` : "No aggregated scan results found."
            });
        }

        // --- Important pour Grafana ---
        // Si Grafana attend un tableau, même pour une seule entrée,
        // vous pouvez envelopper le résultat.
        // Ou si Grafana veut un objet unique, laissez-le tel quel.
        // Pour les plugins JSON, un objet est souvent suffisant pour des "Stat Panels"
        // et un tableau pour des "Table Panels" si vous utilisez `$.vulnerabilities`.

        // Option 1: Retourner directement l'objet du dernier scan (bon pour Stat, etc.)
        res.json(latestScan); // Grafana accèdera à des chemins comme $.severity, $.vulnerabilities

        // Option 2 (si Grafana attend spécifiquement un tableau à la racine pour certaines visualisations)
        // res.json([latestScan]); // Moins commun pour ce cas, mais possible.

    } catch (err) {
        console.error('❌ Failed to fetch latest aggregated scan result for Grafana:', err);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch latest aggregated scan result',
            details: err.message
        });
    }
};


// --- Get Scan Results for Time-Series Data (for Grafana Trends) ---
const getScanResultsForTrends = async (req, res) => {
    try {
        const { projectId, tool, limit } = req.query; // projectId et tool comme filtres optionnels, limit pour le nombre de résultats

        let query = {};
        if (projectId && mongoose.Types.ObjectId.isValid(projectId)) {
            query.project = projectId;
        }
        if (tool) {
            query.tool = tool; // Ex: "Trivy", "OWASP ZAP", "Automated Scan"
        }

        // Récupérer les scans triés par date de création (du plus récent au plus ancien)
        // Limiter le nombre de résultats si 'limit' est spécifié
        const scans = await ScanResult.find(query)
                                     .sort({ createdAt: -1 })
                                     .limit(parseInt(limit) || 0) // Convertir en nombre, 0 signifie pas de limite
                                     .lean(); // Retourne des objets JS purs, plus légers

        // Formater les données pour Grafana (souvent un tableau d'objets avec un champ 'time' et des champs de métriques)
        // Pour les graphiques de temps, Grafana aime un champ "time" et ensuite les valeurs.
        const formattedResults = scans.map(scan => ({
            time: scan.createdAt.getTime(), // Timestamp en millisecondes
            severity_critical: scan.vulnerabilities.filter(v => v.severity === 'Critical').length,
            severity_high: scan.vulnerabilities.filter(v => v.severity === 'High').length,
            severity_medium: scan.vulnerabilities.filter(v => v.severity === 'Medium').length,
            severity_low: scan.vulnerabilities.filter(v => v.severity === 'Low').length,
            severity_none: scan.vulnerabilities.filter(v => v.severity === 'None').length,
            total_vulnerabilities: scan.vulnerabilities.length,
            overall_severity_text: scan.severity, // Texte de sévérité globale
            report_url: scan.reportUrl, // URL du rapport spécifique
            pipeline_id: scan.gitlabPipelineId,
            job_id: scan.gitlabJobId,
            tool_name: scan.tool,
            project_name: scan.project ? scan.project.name : 'N/A', // Si populé
            // ... toute autre métrique utile pour les graphiques
        }));

        res.json(formattedResults);

    } catch (err) {
        console.error('❌ Failed to fetch scan results for trends:', err);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch scan results for trends',
            details: err.message
        });
    }
};


module.exports = {
  receiveAndProcessScanResults,
  getScanResults,
  getScanResultById,
  getLatestAggregatedScanResult,
  getLatestAggregatedScanResult,
  getScanResultsForTrends,
  getRecommendationsByScanResultId,
  // ... other report-related functions if they map to this controller
};
