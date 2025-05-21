const express = require("express");
const router = express.Router();
const authController = require("../controllers/authController");
const auth = require("../middleware/authMiddleware");  

router.get('/', (req, res) => {
    res.send('Auth route works');
  });
  
// Register User
router.post("/register", authController.registerUser);

// Login User
router.post("/login", authController.loginUser);

// Get Profile
router.get("/profile", authController.getProfile);

module.exports = router;

