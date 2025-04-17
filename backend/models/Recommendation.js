const mongoose = require('mongoose');

const recommendationSchema = new mongoose.Schema({
  project: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Project',
    required: true
  },
  relatedScan: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ScanResult'
  },
  title: {
    type: String,
    required: true
  },
  description: String,
  toolSuggested: {
    type: String,
    enum: ['Trivy', 'OWASP', 'SonarQube', 'GitLab SAST', 'Other']
  },
  severity: {
    type: String,
    enum: ['low', 'medium', 'high'],
    default: 'low'
  },
  status: {
    type: String,
    enum: ['pending', 'accepted', 'dismissed', 'implemented'],
    default: 'pending'
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('Recommendation', recommendationSchema);
