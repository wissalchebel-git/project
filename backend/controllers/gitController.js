const { exec, execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const axios = require('axios');
require('dotenv').config();

const CLONE_DIR = path.join(__dirname, '..', 'cloned-repos');

if (!fs.existsSync(CLONE_DIR)) {
  fs.mkdirSync(CLONE_DIR, { recursive: true });
}

const cloneRepository = (req, res) => {
  //console.log("🔍 Incoming request body:", req.body); 
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

// Initialize git repo if not already initialized
const initGitRepo = (localRepoPath) => {
  const gitDir = path.join(localRepoPath, '.git');
  if (!fs.existsSync(gitDir)) {
    execSync('/usr/bin/sh -c "git init"', { cwd: localRepoPath });
    execSync('/usr/bin/sh -c "git checkout -b main"', { cwd: localRepoPath }); 
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
};

// Commit .gitlab-ci.yml
const commitCIConfig = (localRepoPath) => {
  execSync('/usr/bin/sh -c "git add .gitlab-ci.yml"', { cwd: localRepoPath});
  execSync('/usr/bin/sh -c "git commit -m "Add CI config""', { cwd: localRepoPath});
};

// Push repo to GitLab
const pushRepo = (localRepoPath, gitlabRepoUrl) => {
  const GITLAB_API_TOKEN = process.env.GITLAB_API_TOKEN;

  const gitlabRepoUrlWithToken = gitlabRepoUrl.replace(
    'https://',
    `https://oauth2:${GITLAB_API_TOKEN}@`
  );

  execSync(`/usr/bin/sh -c "git remote add gitlab ${gitlabRepoUrlWithToken}"`, {   
    cwd: localRepoPath});
  execSync(`/usr/bin/sh -c "git push gitlab main"`, {   
    cwd: localRepoPath });
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
