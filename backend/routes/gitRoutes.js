// routes/gitRoutes.js

const express = require('express');
const router = express.Router();
const gitController = require('../controllers/gitController');

router.post('/', gitController.cloneRepository);

module.exports = router;
