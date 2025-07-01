const express = require("express");
const router = express.Router();
const reportController = require("../controllers/reportController");
const authMiddleware = require("../middleware/authMiddleware");
const { body } = require("express-validator");

// --- Routes for Scan Results & Recommendations ---

// POST: Receive a new scan result and process it (save, generate recommendations)
// This is the endpoint your GitLab CI `curl` command will hit.
router.post("/scan-results",
  // No express-validator body validation here, as the payload is dynamic
  // You can add validation for required fields inside the controller.
  // Consider removing authMiddleware if this endpoint is only hit by internal CI.
  // If it's public, add strong authentication (e.g., API key, JWT token validation).
  reportController.receiveAndProcessScanResults
);

// GET: Get all scan results (with optional projectId query filter)
router.get("/scan-results", authMiddleware, reportController.getScanResults);

// GET: Get a specific scan result by ID
router.get("/scan-results/:id", authMiddleware, reportController.getScanResultById);

// GET: Get recommendations for a specific scan result ID
router.get("/scan-results/:scanResultId/recommendations", authMiddleware, reportController.getRecommendationsByScanResultId);

// You can keep or remove the following if they are not part of your core workflow for now:
// router.put("/scan-results/:id", authMiddleware, reportController.updateScanResult);
// router.delete("/scan-results/:id", authMiddleware, reportController.deleteScanResult);

module.exports = router;
