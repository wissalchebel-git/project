const ScanResult = require("../models/ScanResult");
const Recommendation = require("../models/Recommendation");
const { validationResult } = require("express-validator");

// Create a new scan result and auto-generate recommendations
const createScanResult = async (req, res) => {
  const { scanId, vulnerability, score, userId } = req.body;

  // Validate the request body
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    // Create the scan result
    const scanResult = new ScanResult({
      scanId,
      vulnerability,
      score,
      userId,
    });

    await scanResult.save();

    // Auto-generate recommendations based on the scan result
    const recommendations = await generateRecommendations(scanResult);

    // Send response with the scan result and recommendations
    res.status(201).json({ scanResult, recommendations });
  } catch (error) {
    console.error(error); // Log the error for better debugging
    res.status(500).json({ message: "Server error", error });
  }
};

// Generate recommendations based on the scan result rules
const generateRecommendations = async (scanResult) => {
  const recommendations = [];

  // Define the rules for generating recommendations based on score and vulnerability
  if (scanResult.score < 5) {
    recommendations.push(
      new Recommendation({
        description: "Improve security score by reviewing configurations.",
        scanResultId: scanResult._id,
      })
    );
  }

  if (scanResult.vulnerability === "high") {
    recommendations.push(
      new Recommendation({
        description: "Critical vulnerability detected. Patch immediately!",
        scanResultId: scanResult._id,
      })
    );
  }

  if (recommendations.length > 0) {
    // Save the recommendations
    await Recommendation.insertMany(recommendations);
  }

  return recommendations;
};

// Get all scan results
const getAllScanResults = async (req, res) => {
  try {
    const scanResults = await ScanResult.find().populate("userId", "name email");
    res.status(200).json(scanResults);
  } catch (error) {
    console.error(error); // Log the error for better debugging
    res.status(500).json({ message: "Server error", error });
  }
};

// Get a specific scan result by ID
const getScanResultById = async (req, res) => {
  const { id } = req.params;

  try {
    const scanResult = await ScanResult.findById(id).populate("userId", "name email");
    if (!scanResult) {
      return res.status(404).json({ message: "Scan result not found" });
    }
    res.status(200).json(scanResult);
  } catch (error) {
    console.error(error); // Log the error for better debugging
    res.status(500).json({ message: "Server error", error });
  }
};

// Get recommendations based on scan result
const getRecommendationsByScanResult = async (req, res) => {
  const { scanResultId } = req.params;

  try {
    const recommendations = await Recommendation.find({ scanResultId }).populate("scanResultId", "vulnerability score");
    if (recommendations.length === 0) {
      return res.status(404).json({ message: "No recommendations found for this scan result" });
    }
    res.status(200).json(recommendations);
  } catch (error) {
    console.error(error); // Log the error for better debugging
    res.status(500).json({ message: "Server error", error });
  }
};


const updateScanResult = async (req, res) => {
  const { id } = req.params;
  const { vulnerability, score, userId } = req.body;

  try {
    // Find the scan result by ID
    const scanResult = await ScanResult.findById(id);

    if (!scanResult) {
      return res.status(404).json({ message: "Scan result not found" });
    }

    // Update the fields
    scanResult.vulnerability = vulnerability || scanResult.vulnerability;
    scanResult.score = score || scanResult.score;
    scanResult.userId = userId || scanResult.userId;

    await scanResult.save();

    res.status(200).json(scanResult);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error", error });
  }
};

const deleteScanResult = async (req, res) => {
  const { id } = req.params;

  try {
    // Find and remove the scan result by ID
    const scanResult = await ScanResult.findByIdAndDelete(id);

    if (!scanResult) {
      return res.status(404).json({ message: "Scan result not found" });
    }

    // Optionally, you can delete recommendations related to this scan result
    await Recommendation.deleteMany({ scanResultId: id });

    res.status(200).json({ message: "Scan result deleted successfully" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error", error });
  }
};

const addRecommendationToScanResult = async (req, res) => {
  const { scanResultId } = req.params;
  const { description } = req.body;

  try {
    // Find the scan result by ID
    const scanResult = await ScanResult.findById(scanResultId);

    if (!scanResult) {
      return res.status(404).json({ message: "Scan result not found" });
    }

    // Create a new recommendation
    const recommendation = new Recommendation({
      description,
      scanResultId,
    });

    await recommendation.save();

    // Optionally, you can update the scan result to reference the new recommendation
    scanResult.recommendations.push(recommendation._id);
    await scanResult.save();

    res.status(201).json(recommendation);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error", error });
  }
};

module.exports = {
  createScanResult,
  getAllScanResults,
  getScanResultById,
  getRecommendationsByScanResult,
  updateScanResult,
  deleteScanResult,
  addRecommendationToScanResult
};
