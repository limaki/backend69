// app.js
require('dotenv').config();

const express = require('express');
const cors = require('cors');
const cron = require('node-cron');

const { connect } = require('./config/db');
const imagesRoutes = require('./routes/images.routes');
const usuarioRoutes = require('./routes/auth');
const anunciosRoutes = require('./routes/anuncios');
const adminRoutes = require('./routes/admin.routes');
const mpRoutes = require('./routes/mp.routes');
const Anuncio = require('./models/Anuncio');

console.log('DB URI:', process.env.MONGODB_URI || process.env.MONGO_URI);

const app = express();

// Middlewares
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Rutas
app.use('/api/images', imagesRoutes);          // servir imágenes GridFS
app.use('/api/anuncios', anunciosRoutes);
app.use('/api/usuarios', usuarioRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/webhook', mpRoutes);             // webhook MP (si tenés más endpoints, montalos explícitos)

// ❌ Si ya usás GridFS, no sirvas /uploads ni crees la carpeta
// app.use('/uploads', express.static('uploads'));

// Cron: desverificar vencidos (cada minuto)
cron.schedule('*/1 * * * *', async () => {
  try {
    const result = await Anuncio.updateMany(
      { verificado: true, verificadoHasta: { $lt: new Date() } },
      { verificado: false }
    );
    if (result.modifiedCount > 0) {
      console.log(`🔄 Se desverificaron ${result.modifiedCount} anuncios`);
    }
  } catch (e) {
    console.error('Cron error:', e.message);
  }
});

// Healthcheck
app.get('/health', (_, res) => res.json({ ok: true }));

// Arranque
(async () => {
  try {
    await connect(); // lee MONGODB_URI || MONGO_URI adentro
    const PORT = process.env.PORT || 3000;
    app.listen(PORT, '0.0.0.0', () =>
      console.log(`Servidor corriendo en http://localhost:${PORT}`)
    );
  } catch (err) {
    console.error('❌ Error al iniciar:', err.message);
    process.exit(1);
  }
})();
