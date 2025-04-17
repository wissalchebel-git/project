// controllers/scanResultController.js
const ScanResult = require('../models/ScanResult');
const Recommendation = require('../models/Recommendation');

exports.getAllScanResults = async (req, res) => {
  try {
    const results = await ScanResult.find().populate('recommendations');
    res.json(results);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
};

exports.getScanResultById = async (req, res) => {
  try {
    const result = await ScanResult.findById(req.params.id).populate('recommendations');
    if (!result) return res.status(404).json({ error: 'Not found' });
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
};

exports.createScanResult = async (req, res) => {
  try {
    const { projectName, vulnerabilities, score } = req.body;

    const scanResult = new ScanResult({ projectName, vulnerabilities, score });
    await scanResult.save();

    // Generate recommendations based on the result
    const generatedRecommendations = generateRecommendations(vulnerabilities);
    const recommendations = await Recommendation.insertMany(
      generatedRecommendations.map(text => ({ text, scanResult: scanResult._id }))
    );

    scanResult.recommendations = recommendations.map(r => r._id);
    await scanResult.save();

    res.status(201).json(scanResult);
  } catch (error) {
    res.status(500).json({ error: 'Error creating scan result' });
  }
};

// Basic logic for generating recommendations based on keywords
function generateRecommendations(vulnerabilities) {
  const recommendations = [];

  vulnerabilities.forEach(vuln => {
    if (vuln.toLowerCase().includes('xss')) {
      recommendations.push('Sanitize all user inputs to prevent XSS.');
    }
    if (vuln.toLowerCase().includes('sql')) {
      recommendations.push('Use parameterized queries to prevent SQL injection.');
    }
    if (vuln.toLowerCase().includes('csrf')) {
      recommendations.push('Implement CSRF tokens for secure form submissions.');
    }
  });

  return [...new Set(recommendations)];
}
