// controllers/gitController.js

const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');

const cloneRepository = (req, res) => {
  const repoUrl = req.body.repoUrl;

  // Validate the repo URL
  if (!repoUrl || !repoUrl.startsWith("https://github.com/")) {
    return res.status(400).json({ error: "Invalid or missing repoUrl" });
  }

  const projectName = repoUrl.split('/').pop().replace('.git', '');
  const timestamp = Date.now();
  const targetDir = path.join('/opt/projects', `${projectName}-${timestamp}`);

  // Ensure the target directory does not already exist
  if (fs.existsSync(targetDir)) {
    return res.status(409).json({ error: "Directory already exists" });
  }

  // Run the git clone command
   exec(`/usr/bin/git clone ${repoUrl} ${targetDir}`, (err, stdout, stderr) => {
    if (err) {
      console.error("Git error:", stderr);
      return res.status(500).json({ error: "Git clone failed", details: stderr });
    }

    return res.status(200).json({
      message: `Repository cloned successfully into ${targetDir}`,
      path: targetDir
    });
  });
};

module.exports = { cloneRepository };
