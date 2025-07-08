const express = require('express');
const router = express.Router();
const reportController = require('../controllers/reportController');

// Route pour recevoir et traiter les résultats de scan (POST)
// C'est l'endpoint que vos jobs GitLab CI appellent pour envoyer les rapports
router.post('/scan-results', reportController.receiveAndProcessScanResults);

// Route pour récupérer TOUS les projets (GET)
// Utilisé par Grafana pour peupler le dropdown de sélection de projet.
// Calls reportController.getAllProjects (your new function for listing projects)
router.get('/projects', reportController.getAllProjects); 

// Route pour récupérer tous les résultats de scan (GET)
// Supporte le filtrage par projectId et/ou tool via les paramètres de requête (query parameters)
// Exemple: /api/reports/scan-results?projectId=65c...&tool=Trivy
// This is the route that was missing and caused "Route not found" for your 3rd Grafana panel.
router.get('/scan-results', reportController.getScanResults); 

// Route pour récupérer le DERNIER rapport agrégé (GET)
// Idéal pour le tableau de bord principal de Grafana affichant l'état actuel.
// Supporte le filtrage optionnel par projectId.
// Exemple: /api/reports/aggregated-scan-results/latest?projectId=65c...
router.get('/aggregated-scan-results/latest', reportController.getLatestAggregatedScanResult);

// Route pour récupérer les résultats de scan spécifiquement pour les tendances (GET)
// Renvoie des données formatées pour les graphiques de séries temporelles de Grafana.
// Supporte le filtrage par projectId et/ou tool, et la limite du nombre de résultats.
// Exemple: /api/reports/scan-results/trends?tool=Trivy&limit=10
router.get('/scan-results/trends', reportController.getScanResultsForTrends);

// Route pour récupérer un résultat de scan spécifique par son ID (GET)
// Exemple: /api/reports/scan-results/65c...
router.get('/scan-results/:id', reportController.getScanResultById);

// Recommendation routes
// POST route to receive recommendations
router.post('/recommendations', reportController.saveRecommendations); 

// GET route to fetch recommendations by project ID (from URL param)
router.get('/recommendations/:projectId', reportController.getRecommendationsByProjectId);

// GET route to fetch all recommendations (with optional projectId filter via query param)
router.get('/recommendations', reportController.getAllRecommendations);

module.exports = router;