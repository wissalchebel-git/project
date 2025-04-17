const jwt = require("jsonwebtoken");

const authMiddleware = (req, res, next) => {
  const token = req.header("Authorization")?.split(" ")[1]; // Bearer <token>

  if (!token) {
    return res.status(401).json({ message: "Access denied. No token provided." });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded; // Attach the user payload to the request
    next();
  } catch (err) {
    return res.status(400).json({ message: "Invalid token." });
  }
};

module.exports = authMiddleware;

