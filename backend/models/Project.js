const mongoose = require('mongoose');

const projectSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    unique: true
  },
  gitlabProjectId: { // This will store the numerical ID from GitLab
    type: Number,
    required: true,
    unique: true
  },
  gitlabProjectUrl: {
    type: String,
    required: true
  },
  
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('Project', projectSchema);