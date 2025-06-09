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
    // Use full path for git command
    const fullCommand = command === 'git' ? '/usr/bin/git' : command;
    console.log(`Executing: ${fullCommand} ${args.join(' ')} in ${options.cwd || 'current directory'}`);
    
    const child = spawn(fullCommand, args, {
      ...options,
      stdio: ['ignore', 'pipe', 'pipe'], // Explicitly set stdio
      env: { ...process.env, ...options.env } // Ensure environment variables are passed
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
      await executeCommand('git', ['config', 'user.name', 'Automated Bot'], { cwd: localRepoPath });
    }
    
    // Check if user.email is configured
    try {
      await executeCommand('git', ['config', 'user.email'], { cwd: localRepoPath });
    } catch (error) {
      // If not configured, set a default
      await executeCommand('git', ['config', 'user.email', 'bot@example.com'], { cwd: localRepoPath });
    }
  } catch (error) {
    console.warn('Failed to configure git user:', error.message);
    // Don't throw here, as this is not critical
  }
};

const initGitRepo = async (localRepoPath) => {
  const gitDir = path.join(localRepoPath, '.git');
  if (!fs.existsSync(gitDir)) {
    try {
      await executeCommand('git', ['init'], { cwd: localRepoPath });
      await configureGitUser(localRepoPath);
      
      // Check if we're already on main branch, if not create it
      try {
        const currentBranch = await executeCommand('git', ['branch', '--show-current'], { cwd: localRepoPath });
        if (currentBranch.trim() !== 'main') {
          await executeCommand('git', ['checkout', '-b', 'main'], { cwd: localRepoPath });
        }
      } catch (error) {
        // If branch command fails, try creating main branch anyway
        await executeCommand('git', ['checkout', '-b', 'main'], { cwd: localRepoPath });
      }
    } catch (error) {
      console.error('Git init failed:', error);
      throw error;
    }
  } else {
    // Even if git is already initialized, make sure user is configured
    await configureGitUser(localRepoPath);
  }
};

// Add .gitlab-ci.yml from /config folder
const addCIConfig = (localRepoPath) => {
  const sourceCI = path.join(__dirname, '../config/.gitlab-ci.yml');
  const destCI = path.join(localRepoPath, '.gitlab-ci.yml');
  
  // Ensure the target directory exists
  if (!fs.existsSync(localRepoPath)) {
    fs.mkdirSync(localRepoPath, { recursive: true });
  }
  
  if (!fs.existsSync(sourceCI)) {
    throw new Error('.gitlab-ci.yml template not found in /config');
  }
  
  fs.copyFileSync(sourceCI, destCI);
  console.log(`✅ Copied .gitlab-ci.yml to ${destCI}`);
};

// Commit .gitlab-ci.yml
const commitCIConfig = async (localRepoPath) => {
  try {
    await executeCommand('git', ['add', '.gitlab-ci.yml'], { cwd: localRepoPath });
    await executeCommand('git', ['commit', '-m', 'Add CI config'], { cwd: localRepoPath });
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
    // Check if remote already exists
    try {
      await executeCommand('git', ['remote', 'get-url', 'gitlab'], { cwd: localRepoPath });
      // If it exists, remove it first
      await executeCommand('git', ['remote', 'remove', 'gitlab'], { cwd: localRepoPath });
    } catch (error) {
      // Remote doesn't exist, which is fine
    }
    
    await executeCommand('git', ['remote', 'add', 'gitlab', gitlabRepoUrlWithToken], { 
      cwd: localRepoPath 
    });
    await executeCommand('git', ['push', 'gitlab', 'main'], { 
      cwd: localRepoPath 
    });
  } catch (error) {
    console.error('Git push failed:', error);
    throw error;
  }
};

module.exports = {
  cloneRepository,       
  createGitLabProject,     
  addCIConfig,             
  commitCIConfig,         
  pushRepo,
  initGitRepo,
  CLONE_DIR                
};