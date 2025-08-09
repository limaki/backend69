const express = require('express');
const router = express.Router();
const { streamFile } = require('../utils/gridfs');

router.get('/:id', (req, res) => streamFile(req.params.id, res));

module.exports = router;