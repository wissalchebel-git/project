const { exec, execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const { spawn } = require('child_process');
require('dotenv').config();

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

// Helper function to execute commands using spawn with better configuration
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
      if (code === 0) {
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

// Configure Git user if not already configured
const configureGitUser = async (localRepoPath) => {
  try {
    // Check if user.name is configured
    try {
      await executeCommand('git', ['config', 'user.name'], { cwd: localRepoPath });
    } catch (error) {
      // If not configured, set a default
      await executeCommand('git', ['config', 'user.name', 'Security Scanner Bot'], { cwd: localRepoPath });
    }
    
    // Check if user.email is configured
    try {
      await executeCommand('git', ['config', 'user.email'], { cwd: localRepoPath });
    } catch (error) {
      // If not configured, set a default
      await executeCommand('git', ['config', 'user.email', 'security-bot@wissal-scanner.com'], { cwd: localRepoPath });
    }
  } catch (error) {
    console.warn('Failed to configure git user:', error.message);
  }
};

// Prepare cloned repo for analysis 
const prepareRepoForAnalysis = async (clientRepoPath, analysisRepoId) => {
  const analysisRepoPath = path.join(CLONE_DIR, `client-scan-${analysisRepoId}`);
  
  try {
    // 1. Create analysis directory
    if (fs.existsSync(analysisRepoPath)) {
      fs.rmSync(analysisRepoPath, { recursive: true, force: true });
    }
    fs.mkdirSync(analysisRepoPath, { recursive: true });
    
    // 2. Copy client code to analysis directory (excluding .git)
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
    
    copyRecursive(clientRepoPath, analysisRepoPath);
    console.log(`✅ Client code copied to analysis directory: ${analysisRepoPath}`);
    
    // 3. Initialize new git repo for analysis
    await executeCommand('git', ['init'], { cwd: analysisRepoPath });
    await configureGitUser(analysisRepoPath);
    
    // 4. Create main branch
    await executeCommand('git', ['checkout', '-b', 'main'], { cwd: analysisRepoPath });
    
    return analysisRepoPath;
    
  } catch (error) {
    console.error('Failed to prepare repo for analysis:', error);
    throw error;
  }
};

// Add .gitlab-ci.yml from /config folder
const addCIConfig = (localRepoPath) => {
  const sourceCI = path.join(__dirname, '../config/.gitlab-ci.yml');
  const destCI = path.join(localRepoPath, '.gitlab-ci.yml');
  
  if (!fs.existsSync(sourceCI)) {
    throw new Error('.gitlab-ci.yml template not found in /config');
  }
  
  fs.copyFileSync(sourceCI, destCI);
  console.log(`✅ Copied .gitlab-ci.yml to ${destCI}`);
};

// Commit all files including client code and CI config
const commitAllFiles = async (localRepoPath) => {
  try {
    await executeCommand('git', ['add', '.'], { cwd: localRepoPath });
    await executeCommand('git', ['commit', '-m', 'Add client code and CI config for security analysis'], { cwd: localRepoPath });
    console.log('✅ All files committed successfully');
  } catch (error) {
    console.error('Git commit failed:', error);
    throw error;
  }
};

// Push repo to GitLab
const pushRepo = async (localRepoPath, gitlabRepoUrl) => {
  const GITLAB_API_TOKEN = process.env.GITLAB_API_TOKEN;
  
  if (!GITLAB_API_TOKEN) {
    throw new Error('GITLAB_API_TOKEN environment variable is not set');
  }
  
  const gitlabRepoUrlWithToken = gitlabRepoUrl.replace(
    'https://',
    `https://oauth2:${GITLAB_API_TOKEN}@`
  );
  
  try {
    // Add GitLab remote
    await executeCommand('git', ['remote', 'add', 'origin', gitlabRepoUrlWithToken], { 
      cwd: localRepoPath 
    });
    
    // Push to GitLab
    await executeCommand('git', ['push', '-u', 'origin', 'main'], { 
      cwd: localRepoPath 
    });
    
    console.log('✅ Repository pushed to GitLab successfully');
  } catch (error) {
    console.error('Git push failed:', error);
    throw error;
  }
};

// Workflow complet d'analyse
const analyzeClientRepository = async (req, res) => {
  const { repoUrl, token } = req.body;
  
  try {
    // 1. Clone client repository
    const projectName = path.basename(repoUrl, '.git');
    const clientRepoPath = path.join(CLONE_DIR, projectName);
    
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
    
    // Clone client repo
    await new Promise((resolve, reject) => {
      exec(`git clone ${finalRepoUrl} ${clientRepoPath}`, (err, stdout, stderr) => {
        if (err) {
          console.error('Git clone error:', stderr);
          reject(new Error(`Git clone failed: ${stderr}`));
        } else {
          console.log('✅ Client repository cloned successfully');
          resolve();
        }
      });
    });
    
    // 2. Create analysis repository ID
    const analysisRepoId = Date.now();
    
    // 3. Create GitLab project for analysis
    const gitlabProject = await createGitLabProject(`client-scan-${analysisRepoId}`);
    console.log(`✅ GitLab analysis project created: ${gitlabProject.web_url}`);
    
    // 4. Prepare analysis repository
    const analysisRepoPath = await prepareRepoForAnalysis(clientRepoPath, analysisRepoId);
    
    // 5. Add CI configuration
    addCIConfig(analysisRepoPath);
    
    // 6. Commit all files
    await commitAllFiles(analysisRepoPath);
    
    // 7. Push to GitLab
    await pushRepo(analysisRepoPath, gitlabProject.http_url_to_repo);
    
    // 8. Cleanup client repo (optional)
    fs.rmSync(clientRepoPath, { recursive: true, force: true });
    
    return res.status(200).json({
      success: true,
      message: 'Client repository analysis setup completed successfully',
      analysisRepo: {
        id: analysisRepoId,
        url: gitlabProject.web_url,
        pipelineUrl: `${gitlabProject.web_url}/-/pipelines`
      }
    });
    
  } catch (error) {
    console.error('Analysis setup failed:', error);
    return res.status(500).json({
      success: false,
      error: 'Analysis setup failed',
      details: error.message
    });
  }
};

module.exports = {
  cloneRepository,       
  createGitLabProject,     
  addCIConfig,             
  commitAllFiles,         
  pushRepo,
  prepareRepoForAnalysis, 
  analyzeClientRepository, 
  CLONE_DIR                
};