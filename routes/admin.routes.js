const express = require('express');
const router = express.Router();
const auth = require('../middlewares/authMiddleware');
const checkRole = require('../middlewares/roleMiddleware'); 
const adminCtrl = require('../controllers/admin.controller');

router.get('/dashboard', adminCtrl.dashboard);

router.get('/usuarios', adminCtrl.usuarios);

router.put('/promover/:userId', adminCtrl.promoverAAdmin);

module.exports = router;
