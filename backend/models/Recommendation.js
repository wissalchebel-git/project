// models/Recommendation.js
const mongoose = require('mongoose');

// --- Sub-Schemas for nested objects ---

// Schema for individual affected vulnerabilities
const affectedVulnerabilitySchema = new mongoose.Schema({
  name: { type: String, required: true },
  severity: { type: String, required: true },
  source: { type: String, required: true },
  cve: { type: String },
  description: { type: String },
  package_name: { type: String },
  installed_version: { type: String },
  fixed_version: { type: String },
}, { _id: false }); // Prevents Mongoose from adding an _id to each subdocument

// Schema for individual affected dependencies
const affectedDependencySchema = new mongoose.Schema({
  package_name: { type: String, required: true },
  installed_version: { type: String, required: true },
  fixed_version: { type: String },
  cve: { type: String },
  vulnerability_name: { type: String }, // Keep this if your data has it
  source: { type: String },
  severity: { type: String },
}, { _id: false });

// Schema for a single security recommendation item (e.g., "High/Critical Vulnerabilities")
const singleRecommendationSchema = new mongoose.Schema({
  id: { type: String, required: true }, // 'id' should be unique per report, not globally unique
  type: { type: String, required: true },
  severity_level: { type: String, required: true }, // e.g., 'Critical/High', 'Medium'
  priority: {
    type: String,
    enum: ['Immediate', 'High', 'Medium', 'Low', 'None'],
    required: true
  },
  summary: { type: String, required: true },
  description: { type: String, required: true },
  action_items: { type: [String], default: [] }, // Array of strings
  affected_vulnerabilities: { type: [affectedVulnerabilitySchema], default: [] },
  affected_dependencies: { type: [affectedDependencySchema], default: [] },
  links: {
    sonarqube_report: { type: String }
    // Add other links here if your data includes them
  }
}, { _id: false }); // Prevents Mongoose from adding an _id to each single recommendation object in the array

// --- Main Recommendation Schema ---

const RecommendationSchema = new mongoose.Schema({
  project: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Project', // References your Project model
    required: true,
  },
  project_name: {
    type: String,
    required: true,
  },
  scan_date: {
    type: Date,
    default: Date.now, // Sets default to current date/time on creation if not provided
    required: true, // If scan_date is always generated, ensure it's required
  },
  overall_security_posture: {
    type: String,
  
    enum: ['NONE', 'N/A', 'CRITICAL', 'HIGH', 'MEDIUM', 'LOW','None', 'Info','Low', 'Medium', 'High', 'Critical', 'Unknown'],
    default: 'N/A', // A more neutral default if no posture is provided
    required: true, // Ensure this is present
  },
  total_vulnerabilities: {
    type: Number,
    default: 0,
  },
  // This is the core 'recommendations' array, using the sub-schema
  recommendations: {
    type: [singleRecommendationSchema], // Array of objects conforming to singleRecommendationSchema
    default: [],
  },
  summary: { // Summary of counts from the recommendations
    critical_count: { type: Number, default: 0 },
    high_count: { type: Number, default: 0 },
    medium_count: { type: Number, default: 0 },
    low_count: { type: Number, default: 0 },
    total_recommendations: { type: Number, default: 0 },
  },
  error: { type: String }, // For storing any errors during scan processing/generation
}, { timestamps: true }); // Adds `createdAt` and `updatedAt` fields automatically

// Create the Mongoose model
const Recommendation = mongoose.model('Recommendation', RecommendationSchema);

module.exports = Recommendation;