require('dotenv').config();
const express = require('express');
const connectDB = require('./config/db');
const mongoose = require('mongoose');
const getKeycloak = require('./keycloak/keycloak-config');
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

mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
}).then(() => console.log('MongoDB connected'))
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
  origin: ['https://security-portal', 'http://security-portal'],
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
app.use('//api/git/analyse', gitRoutes);
app.use('//api/git/gitlab-push', gitRoutes);
app.use('/scan-results', gitRoutes);
app.use('/api/gitlab', gitRoutes); 
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


//  Register Prometheus
const register = new client.Registry();
client.collectDefaultMetrics({ register });

// Création des métriques
// Vulnérabilités par sévérité
const vulnCritical = new client.Gauge({
  name: 'security_vuln_critical_total',
  help: 'Nombre de vulnérabilités critiques détectées',
});
const vulnHigh = new client.Gauge({
  name: 'security_vuln_high_total',
  help: 'Nombre de vulnérabilités hautes détectées',
});
const vulnMedium = new client.Gauge({
  name: 'security_vuln_medium_total',
  help: 'Nombre de vulnérabilités moyennes détectées',
});
const vulnLow = new client.Gauge({
  name: 'security_vuln_low_total',
  help: 'Nombre de vulnérabilités faibles détectées',
});

// Durée du dernier scan
const scanDuration = new client.Gauge({
  name: 'scan_duration_seconds',
  help: 'Durée du dernier scan en secondes',
});

// Compteurs de scans
const scanSuccess = new client.Counter({
  name: 'scan_success_total',
  help: 'Nombre total de scans réussis',
});
const scanFailed = new client.Counter({
  name: 'scan_failed_total',
  help: 'Nombre total de scans échoués',
});

// Timestamp du dernier scan
const lastScanTimestamp = new client.Gauge({
  name: 'last_scan_timestamp',
  help: 'Timestamp Unix du dernier scan',
});

// Erreurs API
const apiErrorTotal = new client.Counter({
  name: 'api_error_total',
  help: 'Nombre total d\'erreurs API rencontrées',
});

// Recommandations générées
const recommendationGenerated = new client.Counter({
  name: 'recommendation_generated_total',
  help: 'Total des recommandations générées',
});

// Enregistrer toutes les métriques
register.registerMetric(vulnCritical);
register.registerMetric(vulnHigh);
register.registerMetric(vulnMedium);
register.registerMetric(vulnLow);
register.registerMetric(scanDuration);
register.registerMetric(scanSuccess);
register.registerMetric(scanFailed);
register.registerMetric(lastScanTimestamp);
register.registerMetric(apiErrorTotal);
register.registerMetric(recommendationGenerated);

// /metrics pour Prometheus
app.get('/metrics', async (req, res) => {
  res.setHeader('Content-Type', register.contentType);
  res.send(await register.metrics());
});

// ✅ Simule MAJ des métriques
app.post('/update-scan', express.json(), (req, res) => {
  const { critical, high, medium, low, duration, success, failed } = req.body;

  if (critical !== undefined) vulnCritical.set(critical);
  if (high !== undefined) vulnHigh.set(high);
  if (medium !== undefined) vulnMedium.set(medium);
  if (low !== undefined) vulnLow.set(low);
  if (duration !== undefined) scanDuration.set(duration);

  lastScanTimestamp.set(Date.now() / 1000);  // Timestamp Unix

  if (success) scanSuccess.inc();  // Incrémente de +1
  if (failed) scanFailed.inc();

  res.send('Métriques de scan mises à jour.');
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
