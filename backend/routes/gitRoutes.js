// routes/gitRoutes.js

const express = require('express');
const router = express.Router();
const gitController = require('../controllers/gitController');
const path = require('path');
const { execSync } = require('child_process');
const { CLONE_DIR } = require('../controllers/gitController');
const ScanResult = require('../models/ScanResult');

// Clone repository only
router.post('/', gitController.cloneRepository);

// Complete analysis workflow 
router.post('/analyze', gitController.analyzeClientRepository);

// Legacy GitLab push endpoint 
router.post('/gitlab-push', async (req, res, next) => {
  try {
    const { repoUrl, token, clientRepoName } = req.body;
    
    if (!clientRepoName) {
      return res.status(400).json({ error: 'clientRepoName is required' });
    }
    
    const analysisRepoId = Date.now();
    const clientRepoPath = path.join(CLONE_DIR, clientRepoName);
    
    // Check if client repo exists
    if (!require('fs').existsSync(clientRepoPath)) {
      return res.status(404).json({ 
        error: 'Client repository not found. Please clone it first using POST /' 
      });
    }

    // Step 1: Create GitLab project for analysis
    const project = await gitController.createGitLabProject(`client-scan-${analysisRepoId}`);
    const gitlabRepoUrl = project.http_url_to_repo;
    console.log(`✅ GitLab project created: ${project.web_url}`);

    // Step 2: Prepare analysis repository
    const analysisRepoPath = await gitController.prepareRepoForAnalysis(clientRepoPath, analysisRepoId);
    
    // Step 3: Add CI config
    gitController.addCIConfig(analysisRepoPath);
    
    // Step 4: Commit all files
    await gitController.commitAllFiles(analysisRepoPath);
    
    // Step 5: Push to GitLab
    await gitController.pushRepo(analysisRepoPath, gitlabRepoUrl);

    res.json({ 
      success: true,
      message: 'Client code analyzed and pushed to GitLab successfully!', 
      analysisRepo: {
        id: analysisRepoId,
        url: project.web_url,
        pipelineUrl: `${project.web_url}/-/pipelines`
      }
    });
  } catch (err) {
    console.error('GitLab push workflow failed:', err);
    res.status(500).json({ 
      success: false,
      error: 'GitLab push workflow failed', 
      details: err.message 
    });
  }
});

// Alternative: Direct analysis from URL (RECOMMENDED)
router.post('/analyze-from-url', async (req, res, next) => {
  try {
    const { repoUrl, token } = req.body;
    
    if (!repoUrl) {
      return res.status(400).json({ error: 'repoUrl is required' });
    }
    
    // Use the complete workflow function
    const result = await gitController.analyzeClientRepository({ body: { repoUrl, token } }, res);
    
    // Note: analyzeClientRepository already sends the response
    
  } catch (err) {
    console.error('Analysis from URL failed:', err);
    res.status(500).json({ 
      success: false,
      error: 'Analysis from URL failed', 
      details: err.message 
    });
  }
});

// Save scan results from GitLab CI pipeline
router.post('/scan-results', async (req, res) => {
  try {
    const newResult = new ScanResult(req.body);
    await newResult.save();
    res.status(201).json({ 
      success: true,
      message: 'Scan result saved successfully',
      resultId: newResult._id
    });
  } catch (err) {
    console.error('Failed to save scan result:', err);
    res.status(500).json({ 
      success: false,
      error: 'Failed to save scan result', 
      details: err.message 
    });
  }
});

// Get scan results
router.get('/scan-results', async (req, res) => {
  try {
    const results = await ScanResult.find().sort({ createdAt: -1 });
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
});

// Get specific scan result by ID
router.get('/scan-results/:id', async (req, res) => {
  try {
    const result = await ScanResult.findById(req.params.id);
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
});

module.exports = router;