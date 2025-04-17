const mongoose = require('mongoose');

const scanResultSchema = new mongoose.Schema({
  project: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Project',
    required: true
  },
  tool: {
    type: String,
    enum: ['SonarQube', 'Trivy', 'OWASP'],
    required: true
  },
  issues: [{
    type: String
  }],
  vulnerabilities: [{
    name: String,
    description: String,
    severity: {
      type: String,
      enum: ['low', 'medium', 'high', 'critical'],
      default: 'low'
    },
    cve: String
  }],
  score: {
    type: Number,
    min: 0,
    max: 100,
    default: 100
  },
  severity: {
    type: String,
    enum: ['low', 'medium', 'high', 'critical'],
    default: 'low'
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('ScanResult', scanResultSchema);

