// routes/gitRoutes.js
const express = require('express');
const router = express.Router();
const {
  analyzeClientRepository,
  addProjectVariable,
  createGitLabProject,
  deleteGitLabProject,
  addGitLabProjectVariable,
  setupCICDVariables,
  cloneRepository,
  saveScanResult, 
  getScanResults, 
  getScanResultById, 
} = require('../controllers/gitController'); 


router.post('/', cloneRepository);

// Save scan results from GitLab CI pipeline
router.post('/scan-results', saveScanResult); // Moved logic to controller

// Get scan results (all)
router.get('/scan-results', getScanResults); // Moved logic to controller

// Get specific scan result by ID
router.get('/scan-results/:id', getScanResultById); // Moved logic to controller


// Middleware for request validation
const validateAnalyzeRequest = (req, res, next) => {
  const { repoUrl } = req.body;
  
  if (!repoUrl) {
    return res.status(400).json({
      success: false,
      error: 'Repository URL is required'
    });
  }
  
  // Basic URL validation
  try {
    new URL(repoUrl);
  } catch (error) {
    return res.status(400).json({
      success: false,
      error: 'Invalid repository URL format'
    });
  }
  
  next();
};

const validateVariableRequest = (req, res, next) => {
  const { projectId, key, value } = req.body;
  
  if (!projectId || !key || value === undefined) {
    return res.status(400).json({
      success: false,
      error: 'Missing required parameters: projectId, key, and value are required'
    });
  }
  
  // Validate projectId is a number (GitLab project IDs are numeric)
  if (isNaN(parseInt(projectId))) {
    return res.status(400).json({
      success: false,
      error: 'projectId must be a valid number'
    });
  }
  
  // Validate key format (GitLab variable names should be valid)
  if (!/^[A-Z][A-Z0-9_]*$/.test(key)) {
    return res.status(400).json({
      success: false,
      error: 'Variable key must start with a letter and contain only uppercase letters, numbers, and underscores'
    });
  }
  
  next();
};

// Environment variables validation middleware
const validateEnvironment = (req, res, next) => {
  const requiredEnvVars = ['GITLAB_API_TOKEN'];
  const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);
  
  if (missingVars.length > 0) {
    return res.status(500).json({
      success: false,
      error: 'Server configuration error',
      details: `Missing required environment variables: ${missingVars.join(', ')}`
    });
  }
  
  next();
};

/**
 * @route POST /api/git/analyze
 * @desc Analyze client repository by cloning, creating GitLab project, and setting up CI/CD
 * @body {string} repoUrl - The repository URL to analyze
 * @body {string} [token] - Optional authentication token for private repositories
 * @returns {object} Analysis setup result with GitLab project details
 */
router.post('/analyze', validateEnvironment, validateAnalyzeRequest, analyzeClientRepository);

/**
 * @route POST /api/git/add-variable
 * @desc Add a CI/CD variable to a GitLab project
 * @body {number} projectId - GitLab project ID
 * @body {string} key - Variable name (uppercase, letters, numbers, underscores)
 * @body {string} value - Variable value
 * @body {boolean} [protected=false] - Whether the variable is protected
 * @body {boolean} [masked=false] - Whether the variable value is masked in logs
 * @returns {object} Success result with variable details
 */
router.post('/add-variable', validateEnvironment, validateVariableRequest, addProjectVariable);

/**
 * @route POST /api/git/create-project
 * @desc Create a new GitLab project
 * @body {string} name - Project name
 * @body {number} [namespaceId] - Optional namespace ID for the project
 * @returns {object} Created project details
 */
router.post('/create-project', validateEnvironment, async (req, res) => {
  const { name, namespaceId } = req.body;
  
  if (!name) {
    return res.status(400).json({
      success: false,
      error: 'Project name is required'
    });
  }
  
  try {
    const project = await createGitLabProject(name, namespaceId);
    res.status(200).json({
      success: true,
      message: 'GitLab project created successfully',
      project
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to create GitLab project',
      details: error.message
    });
  }
});

/**
 * @route DELETE /api/git/delete-project/:projectId
 * @desc Delete a GitLab project
 * @param {number} projectId - GitLab project ID to delete
 * @returns {object} Deletion result
 */
router.delete('/delete-project/:projectId', validateEnvironment, async (req, res) => {
  const { projectId } = req.params;
  
  if (!projectId || isNaN(parseInt(projectId))) {
    return res.status(400).json({
      success: false,
      error: 'Valid project ID is required'
    });
  }
  
  try {
    await deleteGitLabProject(parseInt(projectId));
    res.status(200).json({
      success: true,
      message: `GitLab project ${projectId} deleted successfully`
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to delete GitLab project',
      details: error.message
    });
  }
});

/**
 * @route POST /api/git/setup-variables/:projectId
 * @desc Setup standard CI/CD variables for a project
 * @param {number} projectId - GitLab project ID
 * @body {string} mongoProjectId - MongoDB project ID
 * @returns {object} Setup result
 */
router.post('/setup-variables/:projectId', validateEnvironment, async (req, res) => {
  const { projectId } = req.params;
  const { mongoProjectId } = req.body;
  
  if (!projectId || isNaN(parseInt(projectId))) {
    return res.status(400).json({
      success: false,
      error: 'Valid project ID is required'
    });
  }
  
  if (!mongoProjectId) {
    return res.status(400).json({
      success: false,
      error: 'MongoDB project ID is required'
    });
  }
  
  try {
    await setupCICDVariables(parseInt(projectId), mongoProjectId);
    res.status(200).json({
      success: true,
      message: 'CI/CD variables setup completed successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to setup CI/CD variables',
      details: error.message
    });
  }
});

/**
 * @route GET /api/git/health
 * @desc Health check endpoint to verify GitLab API connectivity
 * @returns {object} Health status
 */
router.get('/health', validateEnvironment, async (req, res) => {
  try {
    // Test GitLab API connectivity
    const axios = require('axios');
    const response = await axios.get('https://gitlab.com/api/v4/user', {
      headers: {
        'PRIVATE-TOKEN': process.env.GITLAB_API_TOKEN,
      },
      timeout: 5000
    });
    
    res.status(200).json({
      success: true,
      message: 'GitLab API connection successful',
      user: response.data.username,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'GitLab API connection failed',
      details: error.response?.data || error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Error handling middleware for this router
router.use((error, req, res, next) => {
  console.error('GitLab Router Error:', error);
  
  if (res.headersSent) {
    return next(error);
  }
  
  res.status(500).json({
    success: false,
    error: 'Internal server error in GitLab operations',
    details: process.env.NODE_ENV === 'development' ? error.message : 'Contact administrator'
  });
});

module.exports = router;
