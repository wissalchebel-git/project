const express = require("express");
const router = express.Router();
const reportController = require("../controllers/reportController");
const authMiddleware = require("../middleware/authMiddleware");
const { body } = require("express-validator");

console.log("MIDDLEWARE:", authMiddleware); 
console.log("CONTROLLER:", reportController);

// Create a new scan result and auto-generate recommendations
router.post("/scan-results",authMiddleware,
  [
    body("scanId").not().isEmpty().withMessage("Scan ID is required."),
    body("vulnerability").not().isEmpty().withMessage("Vulnerability is required."),
    body("score").isNumeric().withMessage("Score must be a number."),
    body("userId").not().isEmpty().withMessage("User ID is required."),
  ],
  reportController.createScanResult 
);

// Get all scan results
router.get("/scan-results", authMiddleware, reportController.getAllScanResults);

// Get scan result by ID
router.get("/scan-results/:id", authMiddleware, reportController.getScanResultById);

// Get recommendations by scan result ID
router.get("/scan-results/:scanResultId/recommendations", authMiddleware, reportController.getRecommendationsByScanResult); // Fixed the method name

// Update scan result
router.put("/scan-results/:id", authMiddleware, reportController.updateScanResult);

// Delete scan result
router.delete("/scan-results/:id", authMiddleware, reportController.deleteScanResult);

// Add recommendation to a scan result
router.post(
  "/scan-results/:scanResultId/recommendations",
  authMiddleware,
  reportController.addRecommendationToScanResult
);

module.exports = router;
