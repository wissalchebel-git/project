const express = require('express');
const dotenv = require('dotenv');
const connectDB = require('./config/db');
const getKeycloak = require('./keycloak/keycloak-config');
const errorHandler = require('./middleware/errorHandler');
const reportRoutes = require('./routes/reporttRoutes');
const authRoutes = require('./routes/authRoutes');
const userRoutes = require('./routes/userRoutes');
const session = require('express-session');
const cors = require("cors");
const bodyParser = require("body-parser");
require("dotenv").config();

// Load environment variables
dotenv.config();

// Connect to the database
connectDB();

// Create Express app
const app = express();

// Session store
const memoryStore = new session.MemoryStore();
app.use(session({
  secret: process.env.SESSION_SECRET || 'some secret',
  resave: false,
  saveUninitialized: true,
  store: memoryStore
}));

// Parse JSON bodies
app.use(express.json());

// Setup Keycloak middleware
//const keycloak = getKeycloak({ store: memoryStore });
//app.use(keycloak.middleware());

// Routes
//app.use('/api/security-reports', keycloak.protect(), reportRoutes);
//app.use('/api/auth', authRoutes); // No protection here
//app.use('/api/users', keycloak.protect(), userRoutes);

// Middleware
app.use(cors());
app.use(bodyParser.json());

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/reports", reportRoutes);

// Global error handler
app.use(errorHandler);

// Start the server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));

