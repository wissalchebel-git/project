const express = require("express");
const router = express.Router();
const userController = require("../controllers/userController");
const authMiddleware = require("../middleware/authMiddleware");

// Get user profile (ensure authenticated)
router.get("/profile", authMiddleware, userController.getProfile);

// Update user profile (ensure authenticated)
router.put("/profile", authMiddleware, userController.updateProfile);

module.exports = router;
