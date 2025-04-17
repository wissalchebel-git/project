const mongoose = require('mongoose');

const ScanResultSchema = new mongoose.Schema({
  projectName: { type: String, required: true },
  scanDate: { type: Date, default: Date.now },
  score: { type: Number, required: true },
  toolsUsed: [{ type: String }],
  vulnerabilities: [{
    name: String,
    severity: String,
    description: String,
    recommendation: String
  }],
  owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
});

module.exports = mongoose.model('ScanResult', ScanResultSchema);
