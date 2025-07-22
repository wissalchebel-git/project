require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const errorHandler = require('./middleware/errorHandler');
const reportRoutes = require('./routes/reporttRoutes');
const authRoutes = require('./routes/authRoutes');
const userRoutes = require('./routes/userRoutes');
const gitRoutes = require('./routes/gitRoutes');
const session = require('express-session');
const cors = require('cors');
const bodyParser = require('body-parser');
const client = require('prom-client');
const dotenv = require('dotenv');


dotenv.config();

const app = express();
app.use(express.json()); // to parse JSON body

mongoose.connect(process.env.MONGO_URI).then(() => console.log('MongoDB connected')) 
  .catch(err => console.error('MongoDB connection error:', err));


// Session store
const memoryStore = new session.MemoryStore();
app.use(session({
  secret: process.env.SESSION_SECRET || 'some secret',
  resave: false,
  saveUninitialized: true,
  store: memoryStore
}));

// Body parsers
app.use(express.json());
app.use(bodyParser.json());

// CORS
app.use(cors({
  origin: ['https://security-portal', 'http://security-portal', 'http://localhost:4200','https://101e-197-27-238-33.ngrok-free.app'],
  credentials: true
}));


//  route for testing
app.get('/', (req, res) => {
  res.send('Hello, your server is running!');
});

app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/reports', reportRoutes); 
app.use('/api/git', gitRoutes);
// Error handling middleware
app.use(errorHandler);

// Basic health check
app.get('/health', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Server is running',
    timestamp: new Date().toISOString()
  });
});

// Global error handler
app.use((error, req, res, next) => {
  console.error('Global Error Handler:', error);
  
  if (res.headersSent) {
    return next(error);
  }
  
  res.status(500).json({
    success: false,
    error: 'Internal server error',
    details: process.env.NODE_ENV === 'development' ? error.message : 'Contact administrator'
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    error: 'Route not found',
    path: req.originalUrl
  });
});


// ✅ Simule une erreur API
app.post('/api-error', (req, res) => {
  apiErrorTotal.inc();
  res.send('Erreur API incrémentée.');
});

// ✅ Simule recommandations générées
app.post('/recommendations', express.json(), (req, res) => {
  const { count } = req.body;
  if (count) {
      recommendationGenerated.inc(count);
  } else {
      recommendationGenerated.inc();
  }
  res.send('Recommandations comptées.');
});

// Start the server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📊 Health check: http://localhost:${PORT}/health`);
  console.log(`🔧 GitLab API health: http://localhost:${PORT}/api/git/health`);
});
