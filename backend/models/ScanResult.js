const mongoose = require('mongoose');

const scanResultSchema = new mongoose.Schema({
  project: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Project',
    required: true
  },
  tool: {
    type: String,
    enum: ['SonarQube', 'Trivy', 'OWASP', 'GitLab CI Initiator', 'GitLeaks', 'Automated Scan'], 
    required: true
  },
  issues: [{ // General issues (e.g., code smells, minor findings)
    type: String
  }],
  vulnerabilities: [{ // Structured vulnerability details
    name: String,
    description: String,
    severity: {
      type: String,
      enum: ['None', 'Low', 'Medium', 'High', 'Critical'],
      required: true
    },
    cve: String,
    // Add more fields relevant to vulnerabilities (e.g., CWE, location, solution)
    // Example for SonarQube/OWASP:
    ruleId: String,
    type: String, // e.g., 'BUG', 'VULNERABILITY', 'CODE_SMELL'
    component: String, // File path
    line: Number, // Line number
    // Example for Trivy:
    packageName: String,
    installedVersion: String,
    fixedVersion: String,
    // Source URL for findings in tool's UI (e.g., SonarQube link to issue)
    sourceUrl: String
  }],
  score: { // Overall score for this specific scan (e.g., quality gate status, vulnerability score)
    type: Number,
    min: 0,
    max: 100,
    default: 100
  },
  severity: { // Overall severity of findings for this specific scan
    type: String,
    enum: ['None', 'Low', 'Medium', 'High', 'Critical'],
    required: true
  },
  // Add specific fields if a tool has a unique summary (e.g., SonarQube Quality Gate Status)
  reportUrl: String, // Link to the full report in the tool (e.g., SonarQube dashboard, GitLab report)
  // Store the GitLab pipeline ID for traceability
  gitlabPipelineId: Number,
  gitlabJobId: Number,
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('ScanResult', scanResultSchema);
