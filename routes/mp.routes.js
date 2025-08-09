const express = require('express');
const router = express.Router();
const { recibirWebhook } = require('../controllers/mp.controller');

router.post('/webhook', recibirWebhook);

module.exports = router;
