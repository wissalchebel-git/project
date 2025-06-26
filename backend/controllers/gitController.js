const { exec, execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const { spawn } = require('child_process');
require('dotenv').config();
const Project = require('../models/Project');
const ScanResult = require('../models/ScanResult');
const CLONE_DIR = path.join(__dirname, '..', 'cloned-repos');

if (!fs.existsSync(CLONE_DIR)) {
  fs.mkdirSync(CLONE_DIR, { recursive: true });
}

const cloneRepository = (req, res) => {
  const { repoUrl, token } = req.body;

  if (!repoUrl) {
    return res.status(400).json({ error: 'Missing repoUrl' });
  }
  if (!repoUrl.startsWith('https://github.com/') && !repoUrl.startsWith('https://gitlab.com/')) {
    return res.status(400).json({ error: 'repoUrl must start with GitHub or GitLab URL' });
  }

  const projectName = path.basename(repoUrl, '.git');
  const targetDir = path.join(CLONE_DIR, projectName);

  // Remove existing directory if exists
  if (fs.existsSync(targetDir)) {
    try {
      fs.rmSync(targetDir, { recursive: true, force: true });
    } catch (err) {
      return res.status(500).json({ error: 'Failed to clean old directory', details: err.message });
    }
  }

  // Prepare authenticated repo URL if token is provided
  let finalRepoUrl = repoUrl;
  if (token) {
    try {
      const url = new URL(repoUrl);
      url.username = 'oauth2';
      url.password = token;
      finalRepoUrl = url.toString();
    } catch (err) {
      return res.status(400).json({ error: 'Invalid repo URL format' });
    }
  }

  // Clone
  exec(`git clone ${finalRepoUrl} ${targetDir}`, (err, stdout, stderr) => {
    if (err) {
      console.error('Git error:', stderr);
      return res.status(500).json({ error: 'Git clone failed', details: stderr });
    }

    return res.status(200).json({
      message: 'Repository cloned successfully',
      path: targetDir
    });
  });
};

// Create GitLab project
const createGitLabProject = async (projectName, namespaceId = null) => {
  const GITLAB_API_TOKEN = process.env.GITLAB_API_TOKEN;
  const url = 'https://gitlab.com/api/v4/projects';

  const data = {
    name: projectName,
    visibility: 'private',
    ...(namespaceId && { namespace_id: namespaceId }),
  };

  try {
    const res = await axios.post(url, data, {
      headers: {
        'PRIVATE-TOKEN': GITLAB_API_TOKEN,
      },
    });

    console.log(`✅ GitLab project created: ${res.data.web_url}`);
    return res.data;
  } catch (error) {
    console.error('❌ Failed to create GitLab project:', error.response?.data || error.message);
    throw error;
  }
};
// Delete GitLab project (for cleanup on failures)
const deleteGitLabProject = async (projectId) => {
  const GITLAB_API_TOKEN = process.env.GITLAB_API_TOKEN;
  const url = `https://gitlab.com/api/v4/projects/${projectId}`;

  try {
    await axios.delete(url, {
      headers: {
        'PRIVATE-TOKEN': GITLAB_API_TOKEN,
      },
    });
    console.log(`✅ GitLab project ${projectId} deleted successfully`);
  } catch (error) {
    console.error(`❌ Failed to delete GitLab project ${projectId}:`, error.response?.data || error.message);
    throw error;
  }
};
// Configure Git user if not already configured
const configureGitUser = async (localRepoPath) => {
  try {
    // Check if user.name is configured
    try {
      await executeCommand('git', ['config', 'user.name'], { cwd: localRepoPath, ignoreExitCode: true }); // Add ignoreExitCode option
      console.log('✅ Git user.name already configured.');
    } catch (error) {
      if (error.message.includes('No error details') || error.message.includes('Command failed with exit code 1')) { // Check for specific error message
        console.log('Git user.name not configured, setting it now...');
        await executeCommand('git', ['config', 'user.name', 'Security Scanner Bot'], { cwd: localRepoPath });
      } else {
        throw error; // Re-throw if it's an unexpected error
      }
    }
    
    // Check if user.email is configured
    try {
      await executeCommand('git', ['config', 'user.email'], { cwd: localRepoPath, ignoreExitCode: true }); // Add ignoreExitCode option
      console.log('✅ Git user.email already configured.');
    } catch (error) {
      if (error.message.includes('No error details') || error.message.includes('Command failed with exit code 1')) { // Check for specific error message
        console.log('Git user.email not configured, setting it now...');
        await executeCommand('git', ['config', 'user.email', 'security-bot@wissal-scanner.com'], { cwd: localRepoPath });
      } else {
        throw error; // Re-throw if it's an unexpected error
      }
    }
  } catch (error) {
    console.warn('Failed to configure git user (unrecoverable):', error.message);
    // Depending on your requirements, you might want to throw here if it's critical
  }
};

// helper
const executeCommand = (command, args, options = {}) => {
  return new Promise((resolve, reject) => {
    console.log(`Executing: ${command} ${args.join(' ')} in ${options.cwd || 'current directory'}`);
    
    const child = spawn(command, args, {
      ...options,
      stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env, ...options.env }
    });
    
    let stdout = '';
    let stderr = '';
    
    if (child.stdout) {
      child.stdout.on('data', (data) => {
        stdout += data.toString();
      });
    }
    
    if (child.stderr) {
      child.stderr.on('data', (data) => {
        stderr += data.toString();
      });
    }
    
    child.on('close', (code) => {
      if (code === 0 || options.ignoreExitCode) { // Allow ignoring exit code for specific checks
        console.log(`✅ Command succeeded: ${command} ${args.join(' ')}`);
        resolve(stdout.trim());
      } else {
        console.error(`❌ Command failed with exit code ${code}: ${command} ${args.join(' ')}`);
        console.error(`stderr: ${stderr}`);
        reject(new Error(`Command failed with exit code ${code}: ${stderr || 'No error details'}`));
      }
    });
    
    child.on('error', (error) => {
      console.error(`❌ Command error: ${command} ${args.join(' ')}`, error);
      reject(error);
    });
  });
};

// Prepare cloned repo for analysis 
// just handle local copying and return the path
const prepareRepoForAnalysis = async (clientRepoPath, targetAnalysisPath) => { 

  try {
    // 1. Create a temporary analysis directory
    if (fs.existsSync(targetAnalysisPath)) { 
      fs.rmSync(targetAnalysisPath, { recursive: true, force: true });
    }
    fs.mkdirSync(targetAnalysisPath, { recursive: true }); 

    // 2. Copy client code to temporary analysis directory (excluding .git)
    const copyRecursive = (src, dest) => {
      const entries = fs.readdirSync(src, { withFileTypes: true });

      for (const entry of entries) {
        const srcPath = path.join(src, entry.name);
        const destPath = path.join(dest, entry.name);

        // Skip .git directory from client repo
        if (entry.name === '.git') {
          continue;
        }

        if (entry.isDirectory()) {
          fs.mkdirSync(destPath, { recursive: true });
          copyRecursive(srcPath, destPath);
        } else {
          fs.copyFileSync(srcPath, destPath);
        }
      }
    };

    copyRecursive(clientRepoPath, targetAnalysisPath); 
    console.log(`✅ Client code copied to temporary analysis directory: ${targetAnalysisPath}`);

    return targetAnalysisPath; // Return the path to the locally prepared files
  } catch (error) {
    console.error('Failed to prepare repo for analysis:', error);
    throw error;
  }
};

const uploadFilesToGitLabProject = async (localTempPath, projectId) => {
  const GITLAB_API_TOKEN = process.env.GITLAB_API_TOKEN;
  if (!GITLAB_API_TOKEN) {
    throw new Error('GITLAB_API_TOKEN environment variable is not set');
  }

  const actions = [];
  const existingFiles = new Set(); // Keep track of files we've already added an action for

  // Function to recursively get all files and their paths
  const getFiles = (dir, filesList = []) => {
    const files = fs.readdirSync(dir);

    files.forEach(file => {
      const filePath = path.join(dir, file);
      const stat = fs.statSync(filePath);

      if (stat.isDirectory()) {
        getFiles(filePath, filesList);
      } else {
        filesList.push(filePath);
      }
    });
    return filesList;
  };

  // 1. First, process the .gitlab-ci.yml from your config folder
  const sourceCI = path.join(__dirname, '../config/.gitlab-ci.yml');
  if (!fs.existsSync(sourceCI)) {
    throw new Error('.gitlab-ci.yml template not found in /config');
  }
  const ciContent = fs.readFileSync(sourceCI, 'utf8');
  actions.push({
    action: 'create', // Use 'create' if you are sure it's a new project or you want to overwrite
    file_path: '.gitlab-ci.yml',
    content: ciContent,
    encoding: 'text',
  });
  existingFiles.add('.gitlab-ci.yml'); // Mark .gitlab-ci.yml as handled
  console.log(`✅ Prepared .gitlab-ci.yml from config for upload.`);

  // 2. Then, add client code files, ensuring no duplicates
  const clientFiles = getFiles(localTempPath);
  for (const filePath of clientFiles) {
    const relativePath = path.relative(localTempPath, filePath);

    // Skip if we've already added an action for this file (e.g., .gitlab-ci.yml)
    if (existingFiles.has(relativePath)) {
      console.log(`Skipping duplicate file: ${relativePath}`);
      continue;
    }

    const fileContent = fs.readFileSync(filePath); // Read as buffer for potential binary
    
    actions.push({
      action: 'create', // Assuming these are new files or we want to overwrite
      file_path: relativePath,
      content: fileContent.toString('base64'),
      encoding: 'base64',
    });
    existingFiles.add(relativePath); // Add to set of handled files
  }
  console.log(`✅ Prepared ${actions.length} files (including CI config) for upload.`);


  // Commit all changes in one go
  try {
    await axios.post(`https://gitlab.com/api/v4/projects/${projectId}/repository/commits`, {
      branch: 'master', 
      commit_message: 'Add client code and CI config for security analysis',
      actions: actions,
      start_branch: 'master' 
    }, {
      headers: {
        'PRIVATE-TOKEN': GITLAB_API_TOKEN,
        'Content-Type': 'application/json'
      }
    });
    console.log('✅ All files uploaded and committed to GitLab successfully via API.');
  } catch (error) {
    console.error('❌ Failed to upload files to GitLab project via API:', error.response?.data || error.message);
    throw error;
  }
};
// Workflow complet d'analyse
// Add CI/CD variable to GitLab project
const addGitLabProjectVariable = async (projectId, key, value, isProtected = false, isMasked = false) => {
  const GITLAB_API_TOKEN = process.env.GITLAB_API_TOKEN;
  const url = `https://gitlab.com/api/v4/projects/${projectId}/variables`;

  const data = {
    key,
    value,
    protected: isProtected,
    masked: isMasked,
  };

  try {
    const response = await axios.post(url, data, {
      headers: {
        'PRIVATE-TOKEN': GITLAB_API_TOKEN,
      },
    });
    console.log(`✅ Variable ${key} added to GitLab project ${projectId}`);
    return response.data;
  } catch (error) {
    console.error(`❌ Failed to add variable ${key} to project ${projectId}:`, error.response?.data || error.message);
    throw error;
  }
};


// Setup CI/CD variables for a GitLab project
const setupCICDVariables = async (gitlabProjectId, mongoProjectId) => {
  console.log('⚙️ Setting up CI/CD variables for the GitLab project...');
  
  const variablesToAdd = [
    {
      key: 'SONAR_TOKEN',
      value: process.env.SONAR_TOKEN_FOR_GITLAB_CI,
      protected: true,
      masked: true,
      required: true,
      errorMessage: 'SONAR_TOKEN_FOR_GITLAB_CI environment variable is not set in backend.'
    },
    {
      key: 'MONGO_PROJECT_ID',
      value: mongoProjectId.toString(),
      protected: false,
      masked: false,
      required: true,
      errorMessage: 'MONGO_PROJECT_ID is required but not provided.'
    },
    {
      key: 'BACKEND_URL',
      value: process.env.BACKEND_API_URL || 'http://localhost:5000/api/git/scan-results',
      protected: false,
      masked: false,
      required: false,
      errorMessage: 'BACKEND_URL could not be determined.'
    },
    {
      key: 'ZAP_API_KEY',
      value: process.env.ZAP_API_KEY,
      protected: true,
      masked: true,
      required: true,
      errorMessage: 'ZAP_API_KEY variable is not set in backend.'
    }
  ];

  // Validate required variables
  for (const variable of variablesToAdd) {
    if (variable.required && !variable.value) {
      throw new Error(variable.errorMessage);
    }
  }

  // Add variables sequentially to avoid rate limiting
  for (const variable of variablesToAdd) {
    if (variable.value) {
      try {
        await addGitLabProjectVariable(
          gitlabProjectId,
          variable.key,
          variable.value,
          variable.protected,
          variable.masked
        );
        console.log(`✅ ${variable.key} added to GitLab project variables.`);
      } catch (error) {
        console.error(`❌ Failed to add ${variable.key}:`, error.message);
        throw new Error(`Failed to configure ${variable.key} variable: ${error.message}`);
      }
    } else {
      console.warn(`⚠️ Skipping ${variable.key} - value not provided`);
    }
  }
};
const analyzeClientRepository = async (req, res) => {
  const { repoUrl, token } = req.body;

  let clientRepoPath;
  let analysisTempPath;
  let projectDoc;
  let gitlabProject;

  try {
    // 1. Clone client repository
    const projectName = path.basename(repoUrl, '.git');
    clientRepoPath = path.join(CLONE_DIR, projectName);

    // Remove existing directory if exists
    if (fs.existsSync(clientRepoPath)) {
      fs.rmSync(clientRepoPath, { recursive: true, force: true });
    }

    // Prepare authenticated repo URL if token is provided
    let finalRepoUrl = repoUrl;
    if (token) {
      const url = new URL(repoUrl);
      url.username = 'oauth2';
      url.password = token;
      finalRepoUrl = url.toString();
    }

    // Clone client repo with retry logic
    const maxRetries = 3;
    let retries = 0;
    let cloneSuccess = false;

    while (retries < maxRetries && !cloneSuccess) {
      try {
        await new Promise((resolve, reject) => {
          exec(`git clone ${finalRepoUrl} ${clientRepoPath}`, (err, stdout, stderr) => {
            if (err) {
              console.error(`Git clone error (attempt ${retries + 1}/${maxRetries}):`, stderr);
              reject(new Error(`Git clone failed: ${stderr}`));
            } else {
              console.log('✅ Client repository cloned successfully');
              cloneSuccess = true;
              resolve();
            }
          });
        });
      } catch (error) {
        retries++;
        if (retries >= maxRetries) {
          throw error;
        }
        console.log(`Retrying clone in 5 seconds...`);
        await new Promise(res => setTimeout(res, 5000));
      }
    }

    // 2. Create GitLab project for analysis
    const gitlabProjectName = `client-scan-${Date.now()}`;
    gitlabProject = await createGitLabProject(gitlabProjectName);  // Store in variable for cleanup
    console.log(`✅ GitLab project created: ${gitlabProject.web_url}`);

    // 3. Save/Link GitLab Project to MongoDB
    try {
      projectDoc = await Project.findOne({ gitlabProjectId: gitlabProject.id });

      if (!projectDoc) {
        projectDoc = new Project({
          name: gitlabProject.name,
          gitlabProjectId: gitlabProject.id,
          gitlabProjectUrl: gitlabProject.web_url,
          originalRepoUrl: repoUrl
        });
        await projectDoc.save();
        console.log(`✅ MongoDB Project document created with ID: ${projectDoc._id}`);
      } else {
        console.log(`ℹ️ MongoDB Project document already exists for GitLab ID: ${gitlabProject.id}`);
      }
    } catch (projectDbError) {
      console.error('❌ Failed to create/find MongoDB Project document:', projectDbError);
      
      // Clean up GitLab project if MongoDB entry fails
      if (gitlabProject && gitlabProject.id) {
        try {
          await deleteGitLabProject(gitlabProject.id);
          console.log('✅ GitLab project cleaned up after MongoDB failure');
        } catch (cleanupError) {
          console.warn(`⚠️ Failed to cleanup GitLab project ${gitlabProject.id}: ${cleanupError.message}`);
        }
      }
      
      return res.status(500).json({
        success: false,
        error: 'Failed to manage project in database',
        details: projectDbError.message
      });
    }

    // 4. Setup CI/CD variables
    try {
      await setupCICDVariables(gitlabProject.id, projectDoc._id);
      console.log('✅ All CI/CD variables configured successfully');
    } catch (variableSetupError) {
      console.error('❌ Failed to set GitLab CI/CD variables:', variableSetupError.message);
      
      // Clean up both GitLab project and MongoDB document
      if (gitlabProject && gitlabProject.id) {
        try {
          await deleteGitLabProject(gitlabProject.id);
          console.log('✅ GitLab project cleaned up after variable setup failure');
        } catch (cleanupError) {
          console.warn(`⚠️ Failed to cleanup GitLab project ${gitlabProject.id}: ${cleanupError.message}`);
        }
      }
      
      if (projectDoc && projectDoc._id) {
        try {
          await Project.findByIdAndDelete(projectDoc._id);
          console.log('✅ MongoDB project document cleaned up');
        } catch (cleanupError) {
          console.warn(`⚠️ Failed to cleanup MongoDB document ${projectDoc._id}: ${cleanupError.message}`);
        }
      }
      
      return res.status(500).json({
        success: false,
        error: 'Failed to configure GitLab CI/CD variables for the project.',
        details: variableSetupError.message
      });
    }

    // 5. Prepare analysis repository locally
    analysisTempPath = path.join(CLONE_DIR, `client-scan-temp-${Date.now()}`);
    await prepareRepoForAnalysis(clientRepoPath, analysisTempPath);
    console.log(`✅ Client code copied to temporary analysis directory: ${analysisTempPath}`);

    // 6. Upload files to GitLab project
    await uploadFilesToGitLabProject(analysisTempPath, gitlabProject.id);
    console.log('✅ All files uploaded and committed to GitLab successfully via API.');

    // 7. Save initial scan result
    try {
      const initialScanResult = new ScanResult({
        project: projectDoc._id,
        tool: 'GitLab CI Initiator',
        severity: 'None',
        issues: [],
        vulnerabilities: [],
        score: 100
      });
      await initialScanResult.save();
      console.log('✅ Initial scan result (CI Initiator) saved successfully.');
    } catch (saveError) {
      console.error('❌ Failed to save initial scan result:', saveError);
      // Don't fail the entire process for this
    }

    // 8. Cleanup local files
    if (analysisTempPath && fs.existsSync(analysisTempPath)) {
      fs.rmSync(analysisTempPath, { recursive: true, force: true });
    }
    if (clientRepoPath && fs.existsSync(clientRepoPath)) {
      fs.rmSync(clientRepoPath, { recursive: true, force: true });
    }
    console.log('✅ Local temporary files cleaned up.');

    return res.status(200).json({
      success: true,
      message: 'Client repository analysis setup completed successfully',
      analysisRepo: {
        id: gitlabProject.id,
        name: gitlabProject.name,
        url: gitlabProject.web_url,
        pipelineUrl: `${gitlabProject.web_url}/-/pipelines`
      },
      mongoProjectId: projectDoc._id
    });

  } catch (err) {
    console.error('❌ Analysis setup failed:', err);

    // Comprehensive cleanup on failure
    if (analysisTempPath && fs.existsSync(analysisTempPath)) {
      fs.rmSync(analysisTempPath, { recursive: true, force: true });
    }
    if (clientRepoPath && fs.existsSync(clientRepoPath)) {
      fs.rmSync(clientRepoPath, { recursive: true, force: true });
    }

    // Clean up GitLab project if it was created
    if (gitlabProject && gitlabProject.id) {
      try {
        await deleteGitLabProject(gitlabProject.id);
        console.log('✅ GitLab project cleaned up after failure');
      } catch (cleanupError) {
        console.warn(`⚠️ GitLab project ${gitlabProject.web_url} was created but cleanup failed. Manual cleanup may be required.`);
      }
    }

    // Clean up MongoDB document if it was created
    if (projectDoc && projectDoc._id && !projectDoc.isNew) {
      try {
        await Project.findByIdAndDelete(projectDoc._id);
        console.log('✅ MongoDB project document cleaned up');
      } catch (cleanupError) {
        console.warn(`⚠️ Failed to cleanup MongoDB document: ${cleanupError.message}`);
      }
    }

    res.status(500).json({
      success: false,
      error: 'Analysis setup failed',
      details: err.message
    });
  }
};

// API endpoint to add variables (can be called internally or externally)
const addProjectVariable = async (req, res) => {
  const { projectId, key, value, protected: isProtected = false, masked: isMasked = false } = req.body;

  if (!projectId || !key || value === undefined) {
    return res.status(400).json({
      success: false,
      error: 'Missing required parameters: projectId, key, and value are required'
    });
  }

  try {
    const result = await addGitLabProjectVariable(projectId, key, value, isProtected, isMasked);
    res.status(200).json({
      success: true,
      message: `Variable ${key} added successfully to project ${projectId}`,
      data: result
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to add project variable',
      details: error.message
    });
  }
};


// --- Scan Results API Handlers ---
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

const getScanResults = async (req, res) => {
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
};

const getScanResultById = async (req, res) => {
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
};

// Update your module.exports in controllers/gitController.js
module.exports = {
  analyzeClientRepository,
  addProjectVariable,
  createGitLabProject,
  deleteGitLabProject,
  addGitLabProjectVariable,
  setupCICDVariables,
  CLONE_DIR, 
  prepareRepoForAnalysis, 
  uploadFilesToGitLabProject, 
  saveScanResult, 
  getScanResults, 
  getScanResultById, 
  cloneRepository 
};

