const ScanResult = require("../models/ScanResult");
const Recommendation = require("../models/Recommendation");
const Project = require("../models/Project");
const mongoose = require('mongoose');
const { validationResult } = require("express-validator"); 

// Controller to save recommendations
const saveRecommendations = async (req, res) => {
  try {
    const recommendationsData = req.body;
    let projectObjectId;
    let actualProjectName; // To store the resolved project name

    // Determine project ID and name
    if (recommendationsData.project && mongoose.Types.ObjectId.isValid(recommendationsData.project)) {
      // Case 1: 'project' field is a valid MongoDB ObjectId
      projectObjectId = recommendationsData.project;
      const project = await Project.findById(projectObjectId);
      if (!project) {
        return res.status(404).json({ success: false, error: `Project with ID ${projectObjectId} not found.` });
      }
      actualProjectName = project.name; // Get name from database
    } else if (recommendationsData.project_name || recommendationsData.project) {
      // Case 2: 'project_name' is provided, or 'project' is a string that might be a name
      const incomingProjectName = recommendationsData.project_name || recommendationsData.project;
      let project = await Project.findOne({ name: incomingProjectName });

      if (project) {
        projectObjectId = project._id;
        actualProjectName = project.name;
        console.log(`✅ Found existing project by name: ${actualProjectName}`);
      } else {
        // Create new project if not found
        const newProject = await Project.create({
          name: incomingProjectName,
          gitlabProjectId: recommendationsData.gitlabProjectId || 'N/A' // Use gitlabProjectId if available
        });
        projectObjectId = newProject._id;
        actualProjectName = newProject.name;
        console.log(`✅ Created new project by name: ${newProject.name}`);
      }
    } else {
      return res.status(400).json({
        success: false,
        error: 'Project ID or Project Name is required to save recommendations.'
      });
    }

    // Prepare the data for the Recommendation model
    const newRecommendation = new Recommendation({
      project: projectObjectId,
      project_name: actualProjectName, // Use the resolved project name
      scan_date: recommendationsData.scan_date || new Date(), // Default to now if not provided
      overall_security_posture: recommendationsData.overall_security_posture,
      total_vulnerabilities: recommendationsData.total_vulnerabilities,
      recommendations: recommendationsData.recommendations,
      summary: recommendationsData.summary,
      error: recommendationsData.error, // Save error if present from the fallback
    });

    const savedRecommendation = await newRecommendation.save();
    console.log(`💡 Saved ${savedRecommendation.recommendations.length} recommendations for project ${actualProjectName} (${projectObjectId})`);

    res.status(201).json({
      success: true,
      message: 'Recommendations received and saved successfully',
      recommendationId: savedRecommendation._id, // Return the ID of the saved Recommendation document
      projectId: savedRecommendation.project // Return the linked project ID
    });
  } catch (err) {
    console.error('❌ Error saving recommendations:', err);
    res.status(500).json({
      success: false,
      error: 'Failed to save recommendations',
      details: err.message,
    });
  }
};

const getAllRecommendations = async (req, res) => {
  try {
    let { projectId } = req.query; // Get projectId from query parameters (can be undefined)

    let targetProjectId = null;
    let fetchedReport = null; // This will hold the single Recommendation document we decide to send back

    if (projectId) {
      // Case 1: A projectId is provided in the query string (e.g., from a specific project's page)

      // 1. Validate the format of the projectId
      if (!mongoose.Types.ObjectId.isValid(projectId)) {
        return res.status(400).json({ success: false, error: 'Invalid projectId format. Must be a valid MongoDB ObjectId.' });
      }

      // 2. Use the provided logic to check if the Project actually exists
      const existingProject = await Project.findById(projectId);
      if (!existingProject) {
        // If the projectId is valid in format but doesn't correspond to an existing project
        return res.status(404).json({ success: false, message: `Project with ID ${projectId} not found.` });
      }

      // If validation and existence check pass, set it as the target
      targetProjectId = projectId;

      // Now, find the latest recommendation report associated with this specific project
      fetchedReport = await Recommendation.findOne({ project: targetProjectId })
        .populate('project', 'name gitlabProjectId') // Populate project details
        .sort({ scan_date: -1, createdAt: -1 }); // Get the very latest report for this project

    } else {
      // Case 2: No projectId provided, so find the latest overall recommendation across ALL projects

      fetchedReport = await Recommendation.findOne()
        .populate('project', 'name gitlabProjectId')
        .sort({ scan_date: -1, createdAt: -1 }); // Sort to get the most recent Recommendation document overall

      if (fetchedReport) {
        // If a latest overall report is found, use its project ID as the target
        targetProjectId = fetchedReport.project._id;
        console.log(`💡 No projectId provided, serving recommendations for latest project: ${fetchedReport.project.name} (${targetProjectId})`);
      } else {
        // If no Recommendation documents exist in the entire database
        return res.status(200).json({ success: true, count: 0, recommendations: [], message: 'No recommendations found in the database.' });
      }
    }

    // After determining `fetchedReport` (either by specific projectId or latest overall)
    if (fetchedReport) {
      // If a Recommendation report document was found, send its details
      return res.json({
        success: true,
        count: fetchedReport.recommendations ? fetchedReport.recommendations.length : 0,
        overall_security_posture: fetchedReport.overall_security_posture,
        total_vulnerabilities: fetchedReport.total_vulnerabilities,
        summary: fetchedReport.summary,
        recommendations: fetchedReport.recommendations || [], // Ensure it's an array, even if empty
        message: `Recommendations for project "${fetchedReport.project.name}" (latest scan) fetched successfully.`,
        projectId: fetchedReport.project._id.toString(), // Convert ObjectId to string for frontend
        projectName: fetchedReport.project.name,
        scanDate: fetchedReport.scan_date // Send the scan date
      });
    } else {
      // This path is reached if a valid projectId was provided, but no Recommendation documents
      // are linked to that particular project (i.e., the project exists, but has no scans/reports).
      // The `Project.findById` check above handles cases where the projectId itself doesn't exist.
      return res.status(200).json({ success: true, count: 0, recommendations: [], message: `No recommendations found for project ID: ${projectId}.` });
    }

  } catch (err) {
    console.error('Failed to fetch recommendations:', err);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch recommendations due to a server error.',
      details: err.message,
    });
  }
};


// Controller to get recommendations by a specific projectId (from URL parameter)
const getRecommendationsByProjectId = async (req, res) => {
  try {
    const { projectId } = req.params; // Get projectId from URL parameter

    if (!mongoose.Types.ObjectId.isValid(projectId)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid Project ID format.',
      });
    }

    const recommendations = await Recommendation.find({ project: projectId })
      .populate('project', 'name gitlabProjectId') // Populate project details
      .sort({ scan_date: -1, createdAt: -1 });

    if (!recommendations || recommendations.length === 0) {
      return res.status(404).json({
        success: false,
        message: `No recommendations found for project ID: ${projectId}`,
      });
    }

    res.json({
      success: true,
      count: recommendations.length,
      recommendations: recommendations,
    });
  } catch (err) {
    console.error('Error fetching recommendations by project ID:', err);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch recommendations by project ID',
      details: err.message,
    });
  }
};



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



// --- Main function to receive and save scan results, and process recommendations ---
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
    projectName, // Expected from CI payload
    gitlabProjectId, // Expected from CI payload (GitLab's native numeric ID)
    recommendations // <--- NEW: Expect recommendations directly from the pipeline payload
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
      // Optionally update project name/gitlabProjectId if they changed in the CI payload
      if (projectName && existingProject.name !== projectName) {
        existingProject.name = projectName;
        await existingProject.save();
        console.log(`✅ Updated project name for ${existingProject._id} to ${projectName}`);
      }
      if (gitlabProjectId && existingProject.gitlabProjectId !== gitlabProjectId) {
        existingProject.gitlabProjectId = gitlabProjectId;
        await existingProject.save();
        console.log(`✅ Updated gitlabProjectId for ${existingProject._id} to ${gitlabProjectId}`);
      }
    }

    // Now existingProject is guaranteed to be a valid Mongoose document
    const overallSeverity = calculateOverallSeverity(vulnerabilities); // Still useful for ScanResult document

    const newScanResult = new ScanResult({
      project: existingProject._id, // Link to the actual Project ObjectId
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

    let recommendationsSavedCount = 0;
    // --- Process received recommendations ---
    if (recommendations) {
        // Prepare the recommendations payload to match what saveRecommendations expects
        // It's important that 'recommendations' here holds the entire object
        // that your Python script outputs, which includes project_name, summary etc.
        const recommendationPayload = {
            ...recommendations, // Spread the incoming recommendations object
            project: existingProject._id, // Ensure the correct MongoDB Project ID is linked
            project_name: existingProject.name, // Ensure project name is consistent
            scan_date: recommendations.scan_date || new Date().toISOString() // Use provided date or current
        };

        // Call the saveRecommendations function (from recommendationController)
        // Note: saveRecommendations expects req, res arguments.
        // We need to simulate this or refactor saveRecommendations to be a utility.
        // The safest way is to call the underlying logic directly, or
        // if saveRecommendations is small, inline it.
        // For now, let's make a direct call to the Recommendation model.

        const newRecommendationDoc = new Recommendation(recommendationPayload);
        const savedRec = await newRecommendationDoc.save();
        recommendationsSavedCount = savedRec.recommendations.length; // Count the actual recommendations
        console.log(`💡 Saved ${recommendationsSavedCount} recommendations received from pipeline for project ${existingProject._id}`);

        
    }


    res.status(201).json({
      success: true,
      message: `Scan result from ${tool} saved successfully`,
      resultId: newScanResult._id,
      recommendationsSaved: recommendationsSavedCount // Report how many recommendations were saved
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
    // Handle multiple project IDs if 'All' is selected in Grafana or multiple values are passed
    if (projectId && typeof projectId === 'string' && projectId.includes(',')) {
      const projectIdsArray = projectId.split(',').filter(id => mongoose.Types.ObjectId.isValid(id));
      if (projectIdsArray.length > 0) {
        query.project = { $in: projectIdsArray };
      }
    }


    // 2. Filtrage par nom d'outil (si fourni)
    // IMPORTANT: If tool is "All" from Grafana, it might come as an empty string or not present.
    // If multiple tools are selected, it comes as a comma-separated string (e.g., "Trivy,OWASP ZAP").
    // We need to handle this to query for multiple tools using $in.
    if (tool) {
      const toolsArray = tool.split(',').map(t => t.trim());
      if (toolsArray.length > 1) { // If multiple tools selected (e.g., "Trivy,OWASP ZAP")
        query.tool = { $in: toolsArray };
      } else { // Single tool selected
        query.tool = tool;
      }
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
    if (!mongoose.Types.ObjectId.isValid(scanResultId)) { // Validate ID
      return res.status(400).json({ success: false, error: 'Invalid scanResultId provided.' });
    }
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

        let query = { tool: "Automated Scan" }; // Changed "Rapport Agrégé" to "Automated Scan" as per your pipeline
        if (projectId && mongoose.Types.ObjectId.isValid(projectId)) {
            query.project = projectId;
        }
        // Handle multiple project IDs if 'All' is selected in Grafana or multiple values are passed
        if (projectId && typeof projectId === 'string' && projectId.includes(',')) {
          const projectIdsArray = projectId.split(',').filter(id => mongoose.Types.ObjectId.isValid(id));
          if (projectIdsArray.length > 0) {
            query.project = { $in: projectIdsArray };
          } else {
            // If "All" or invalid IDs, remove project filter to query all projects
            delete query.project;
          }
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

        // Return the object directly
        res.json(latestScan);

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
        // Handle multiple project IDs if 'All' is selected in Grafana or multiple values are passed
        if (projectId && typeof projectId === 'string') {
          const projectIdsArray = projectId.split(',').filter(id => mongoose.Types.ObjectId.isValid(id));
          if (projectIdsArray.length > 0) {
            query.project = { $in: projectIdsArray };
          }
        } else if (projectId && mongoose.Types.ObjectId.isValid(projectId)) {
          query.project = projectId;
        }


        // Handle multiple tool names if 'All' is selected in Grafana or multiple values are passed
        if (tool) {
            const toolsArray = tool.split(',').map(t => t.trim());
            if (toolsArray.length > 1) { // If multiple tools selected (e.g., "Trivy,OWASP ZAP")
                query.tool = { $in: toolsArray };
            } else { // Single tool selected
                query.tool = tool;
            }
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
            project_name: scan.project ? scan.project.name : 'N/A', // If populated
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

// --- NEW FUNCTION: Get all projects for Grafana dropdown ---
const getAllProjects = async (req, res) => {
  try {
    const projects = await Project.find({}); // Fetch all projects

    // Format for Grafana Query Variable: { text: "Project Name", value: "Project ID" }
    const formattedProjects = projects.map(project => ({
      text: project.name, // Display name in dropdown
      value: project._id.toString() // Actual ID to filter data
    }));

    res.json(formattedProjects); // Return the array directly, Grafana expects this for query variables
  } catch (err) {
    console.error('❌ Failed to fetch all projects:', err);
    res.status(500).json({ success: false, error: 'Failed to fetch projects', details: err.message });
  }
};


module.exports = {
  saveRecommendations,
  getAllRecommendations,
  getRecommendationsByProjectId,
  receiveAndProcessScanResults,
  getScanResults,
  getScanResultById,
  getLatestAggregatedScanResult,
  getScanResultsForTrends,
  getRecommendationsByScanResultId,
  getAllProjects, 
};