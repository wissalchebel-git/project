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
 
  vulnerabilities: [{ // This array will hold the actual parsed vulnerabilities
        name: { type: String },
        description: { type: String },
        severity: { type: String },
        cve: { type: String },
        packageName: { type: String },
        installedVersion: { type: String },
        fixedVersion: { type: String },
        type: { type: String },
        source: { type: String }, // e.g., "Trivy", "OWASP Dependency Check", "OWASP ZAP"
        // ... any other relevant fields you extract
    }],
  score: { // Overall score for this specific scan (e.g., quality gate status, vulnerability score)
    type: Number,
    min: 0,
    max: 100,
    default: 100
  },
  severity: { // Overall severity of findings for this specific scan (highest severity found)
    type: String,
    enum: ['None', 'Info','Low', 'Medium', 'High', 'Critical', 'Unknown'],
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
