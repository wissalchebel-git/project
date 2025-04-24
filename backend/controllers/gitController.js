// controllers/gitController.js

const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');
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


    // ✅ Convert container path to relative path for frontend
    //const relativePath = path.relative(path.join(__dirname, '..'), targetDir);

    return res.status(200).json({
      message: 'Repository cloned successfully',
      path: targetDir
    });
  });
};

module.exports = { cloneRepository };
