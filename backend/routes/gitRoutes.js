// routes/gitRoutes.js

const express = require('express');
const router = express.Router();
const gitController = require('../controllers/gitController');
const path = require('path');
const { execSync } = require('child_process');
const { CLONE_DIR } = require('../controllers/gitController');
const ScanResult = require('../models/ScanResult');


router.post('/', gitController.cloneRepository);
router.post('/gitlab-push', async (req, res, next) => {
  try {
    const { repoUrl, token } = req.body;
    const projectName = `client-scan-${Date.now()}`;
    const targetDir = path.join(CLONE_DIR, projectName);

    // Step 1: Create GitLab project
    const project = await gitController.createGitLabProject(projectName);
    const gitlabRepoUrl = project.http_url_to_repo;

    // Step 3: Add CI config and push
  
    await gitController.initGitRepo(targetDir);
    gitController.addCIConfig(targetDir);
    await gitController.commitCIConfig(targetDir);
    await gitController.pushRepo(targetDir, gitlabRepoUrl);

    res.json({ message: ' CI configured, pushed to GitLab!', gitlabUrl: project.web_url });
  } catch (err) {
    console.error(err);
    next(err);
  }
});

router.post('/scan-results', async (req, res) => {
  try {
    const newResult = new ScanResult(req.body);
    await newResult.save();
    res.status(201).json({ message: 'Scan result saved successfully' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to save scan result', details: err.message });
  }
});

  

module.exports = router;
