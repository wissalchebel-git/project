const mongoose = require('mongoose');

const scanResultSchema = new mongoose.Schema({
  project: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Project',
    required: true
  },
  tool: {
    type: String,
    enum: ['SonarQube', 'Trivy', 'OWASP ZAP', 'GitLab CI Initiator', 'OWASP Dependency Check', 'Automated Scan'],
    
    required: true
  },
 
  vulnerabilities: [{ // Structured vulnerability details
    name: String,
    description: String,
    severity: {
      type: String,
      enum: ['None', 'Low', 'Medium', 'High', 'Critical'],
      required: true
    },
    cve: String,
    ruleId: String,
    type: String, // e.g., 'BUG', 'VULNERABILITY', 'CODE_SMELL', 'N/A' from Trivy
    component: String, // File path
    line: Number, // Line number
    packageName: String,
    installedVersion: String,
    fixedVersion: String,
    source: String, // 'Trivy', 'SonarQube', 'OWASP ZAP', etc. - good to have
    sourceUrl: String, // Link to the finding in the tool's UI (e.g., SonarQube issue link)
    // You can add a mixed type for truly tool-specific raw data if needed
    // rawToolData: mongoose.Schema.Types.Mixed
  }],
  score: { // Overall score for this specific scan (e.g., quality gate status, vulnerability score)
    type: Number,
    min: 0,
    max: 100,
    default: 100
  },
  severity: { // Overall severity of findings for this specific scan (highest severity found)
    type: String,
    enum: ['None', 'Low', 'Medium', 'High', 'Critical'],
    required: true
  },
  reportUrl: String, // Link to the full report in the tool (e.g., SonarQube dashboard, GitLab report)
  gitlabPipelineId: Number,
  gitlabJobId: Number,
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('ScanResult', scanResultSchema);
