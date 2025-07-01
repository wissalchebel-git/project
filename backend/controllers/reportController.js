const ScanResult = require("../models/ScanResult");
const Recommendation = require("../models/Recommendation");
const Project = require("../models/Project"); 
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

  // Destructure fields, using default empty arrays for optional ones
  const {
    project: projectId, // Rename to avoid conflict with `project` object
    tool,
    // issues, // Removed as per model change, add back if needed
    vulnerabilities,
    score,
    reportUrl,
    gitlabPipelineId,
    gitlabJobId,
    sonarqubeReportUrl // If you are sending this in the payload, include it
  } = req.body;

  // Basic validation (more detailed can be added with express-validator)
  if (!projectId || !tool) {
    return res.status(400).json({
      success: false,
      error: 'Missing required fields: project (MongoDB ObjectId) and tool.',
      received: req.body
    });
  }

  try {
    // 1. Verify Project Exists
    const existingProject = await Project.findById(projectId);
    if (!existingProject) {
      return res.status(404).json({
        success: false,
        error: `Project with ID ${projectId} not found in database. Cannot save scan result.`,
        receivedProjectId: projectId
      });
    }

    // 2. Calculate overall severity if not provided or to ensure consistency
    const overallSeverity = calculateOverallSeverity(vulnerabilities);


    // 3. Create and Save the Scan Result
    const newScanResult = new ScanResult({
      project: projectId,
      tool: tool,
      severity: overallSeverity, // Use calculated or provided overall severity
      score: score || 100, // Default to 100 if no score provided
      vulnerabilities: vulnerabilities || [],
      reportUrl: reportUrl || sonarqubeReportUrl, // Use sonarqubeReportUrl if reportUrl is missing
      gitlabPipelineId: gitlabPipelineId,
      gitlabJobId: gitlabJobId,
    });

    await newScanResult.save();
    console.log(`✅ Scan result from ${tool} saved successfully for project ${projectId}: ${newScanResult._id}`);

    // 4. Generate Recommendations (if applicable)
    // This logic should be here, after the scan result is saved
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
    // Mongoose validation errors vs. other errors
    const validationErrors = err.name === 'ValidationError' ?
      Object.keys(err.errors).map(key => err.errors[key].message).join(', ') :
      err.message;

    res.status(500).json({
      success: false,
      error: 'Failed to save and process scan result',
      details: validationErrors,
      received: req.body // Include request body for debugging
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


// --- Get all scan results (potentially with filters/pagination) ---
const getScanResults = async (req, res) => {
  try {
    // Example of filtering by project ID, if provided
    const { projectId } = req.query; // Expecting projectId as a query parameter
    let query = {};
    if (projectId && mongoose.Types.ObjectId.isValid(projectId)) {
      query.project = projectId;
    }

    const results = await ScanResult.find(query)
                                    .populate('project', 'name gitlabProjectId') // Populate project details
                                    .sort({ createdAt: -1 });

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

// --- Other exports, if needed ---
module.exports = {
  receiveAndProcessScanResults,
  getScanResults,
  getScanResultById,
  getRecommendationsByScanResultId,
  // ... other report-related functions if they map to this controller
};
