const express = require('express');
const router = express.Router();
const anuncioController = require('../controllers/anuncioController');
const authMiddleware = require('../middlewares/authMiddleware');
const { generarLinkDePago } = require('../controllers/anuncioController');
const upload = require('../middlewares/uploads');


router.post(  '/',
authMiddleware,
upload.array('fotos', 10), 
anuncioController.crearAnuncio);
router.post('/crear-pago/:id', authMiddleware, generarLinkDePago);
router.get('/', anuncioController.obtenerAnuncios);
router.get('/mis-anuncios', authMiddleware, anuncioController.obtenerMisAnuncios);
router.post('/filtrar', anuncioController.filtrarAnuncios);
router.get('/:id', anuncioController.obtenerAnuncioPorId);
router.put('/:id', authMiddleware, upload.array('fotos', 10), anuncioController.actualizarAnuncio);
router.delete('/:id', authMiddleware, anuncioController.eliminarAnuncio);


module.exports = router;