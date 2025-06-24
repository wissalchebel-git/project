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

const analyzeClientRepository = async (req, res) => {
  const { repoUrl, token } = req.body;

   let clientRepoPath; // Declare outside try for cleanup in catch
  let analysisTempPath; // Declare outside try for cleanup in catch
  let projectDoc; // Declare outside try for access in catch


  try {
    // 1. Clone client repository (still local for initial access to code)
    const projectName = path.basename(repoUrl, '.git');
    clientRepoPath = path.join(CLONE_DIR, projectName); // Assign here

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
          throw error; // Re-throw if max retries reached
        }
        console.log(`Retrying clone in 5 seconds...`);
        await new Promise(res => setTimeout(res, 5000)); // Wait before retrying
      }
    }

    // 2. Create analysis repository ID (This is generally not needed if GitLab provides one)
    // We will use `gitlabProject.id` for everything related to the GitLab project.

     // 3. Create GitLab project for analysis
    const gitlabProjectName = `client-scan-${Date.now()}`; // Unique name
    const gitlabProject = await createGitLabProject(gitlabProjectName);
    console.log(`✅ GitLab project created: ${gitlabProject.web_url}`);
    // Assuming you also meant to create the analysis project with the same name/ID
    console.log(`✅ GitLab analysis project created: ${gitlabProject.web_url}`);

    // --- NEW LOGIC: Save / Link GitLab Project to your MongoDB Project model ---
    try {
      // Check if a Project document with this GitLab ID already exists
      projectDoc = await Project.findOne({ gitlabProjectId: gitlabProject.id });

      if (!projectDoc) {
        // If not, create a new Project document
        projectDoc = new Project({
          name: gitlabProject.name, // Use the name generated for GitLab
          gitlabProjectId: gitlabProject.id, // Store the numerical GitLab ID
          gitlabProjectUrl: gitlabProject.web_url, // Store the GitLab project URL
          originalRepoUrl: repoUrl // Store the original repo URL for reference
        });
        await projectDoc.save();
        console.log(`✅ MongoDB Project document created with ID: ${projectDoc._id}`);
      } else {
        console.log(`ℹ️ MongoDB Project document already exists for GitLab ID: ${gitlabProject.id}`);
      }
    } catch (projectDbError) {
      console.error('❌ Failed to create/find MongoDB Project document:', projectDbError);
      return res.status(500).json({
        success: false,
        error: 'Failed to manage project in database',
        details: projectDbError.message
      });
    }
    // 4. Prepare analysis repository locally (copy files to a temp directory)
    analysisTempPath = path.join(CLONE_DIR, `client-scan-temp-${Date.now()}`); 
    await prepareRepoForAnalysis(clientRepoPath, analysisTempPath); 
    console.log(`✅ Client code copied to temporary analysis directory: ${analysisTempPath}`);

    // 5. Upload all prepared files and CI config to the remote GitLab project via API
    await uploadFilesToGitLabProject(analysisTempPath, gitlabProject.id);
    console.log('✅ All files uploaded and committed to GitLab successfully via API.');


    // 6. Cleanup local temporary repo and client repo
    if (analysisTempPath && fs.existsSync(analysisTempPath)) {
      fs.rmSync(analysisTempPath, { recursive: true, force: true });
    }
    if (clientRepoPath && fs.existsSync(clientRepoPath)) {
      fs.rmSync(clientRepoPath, { recursive: true, force: true });
    }
    console.log('✅ Local temporary files cleaned up.');

    // --- NEW LOGIC: Save Initial Scan Result (now using correct IDs and enums) ---
    try {
      const initialScanResult = new ScanResult({
        project: projectDoc._id, // Use the MongoDB ObjectId from your Project document
        tool: 'GitLab CI Initiator', // Now a valid enum value in your updated schema
        severity: 'None', // Default severity for an initiation record
        issues: [], // No issues/vulnerabilities at this initial stage
        vulnerabilities: [],
        score: 100 // Starting with a perfect score
      });
      await initialScanResult.save();
      console.log('✅ Initial scan result (CI Initiator) saved successfully.');
    } catch (saveError) {
      console.error('❌ Failed to save initial scan result:', saveError);
      // If saving the initial scan result fails, you might still want to
      // return a success for the GitLab setup, or fail the entire request.
      // For now, it's just a log, but consider the impact.
      // throw saveError; // Uncomment if you want this error to stop the main flow
    }
    // --- END NEW LOGIC ---

    return res.status(200).json({
       success: true,
      message: 'Client repository analysis setup completed successfully',
      analysisRepo: {
        id: gitlabProject.id, // GitLab's numerical ID
        name: gitlabProject.name,
        url: gitlabProject.web_url,
        pipelineUrl: `${gitlabProject.web_url}/-/pipelines`
      },
      mongoProjectId: projectDoc._id // Send this back to the caller
    });

  } catch (err) {
    console.error('❌ Analysis setup failed:', err);

    // Ensure cleanup even on failure
    if (analysisTempPath && fs.existsSync(analysisTempPath)) {
      fs.rmSync(analysisTempPath, { recursive: true, force: true });
    }
    if (clientRepoPath && fs.existsSync(clientRepoPath)) {
      fs.rmSync(clientRepoPath, { recursive: true, force: true });
    }

    // If the project was created in GitLab but saving to DB failed,
    // you might want to log this specifically or consider GitLab cleanup.
    if (projectDoc && projectDoc.gitlabProjectId) {
      console.warn(`⚠️ GitLab project ${projectDoc.gitlabProjectUrl} was created, but subsequent DB operations failed.`);
    }

    res.status(500).json({
      success: false,
      error: 'Analysis setup failed',
      details: err.message
    });
  }
};


module.exports = {
  cloneRepository,       
  createGitLabProject,     
  prepareRepoForAnalysis, 
  analyzeClientRepository, 
  CLONE_DIR                
};