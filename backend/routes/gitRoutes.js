// routes/gitRoutes.js

const express = require('express');
const router = express.Router();
const { cloneRepository } = require('../controllers/gitController');

router.post('/', cloneRepository);

module.exports = router;
