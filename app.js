// app.js
require('dotenv').config();

// 👉 resolver DNS priorizando IPv4 (evita lentitud en SRV en algunos entornos)
try {
  require('dns').setDefaultResultOrder('ipv4first');
} catch {}

const express = require('express');
const cors = require('cors');
const compression = require('compression');
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

/* -------------------------- Middlewares de performance -------------------------- */
app.disable('x-powered-by');            // menos info expuesta
app.set('etag', 'strong');              // caching condicional correcto
app.use(compression());                 // gzip/brotli
app.use(cors({
  origin: true,
  credentials: true,
  maxAge: 86400,                        // cachea preflight 24h
}));
app.use(express.json({ limit: '1mb' }));                // evita payloads enormes
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

/* ------------------------------------- Rutas ----------------------------------- */
app.use('/api/images', imagesRoutes);   // GridFS
app.use('/api/anuncios', anunciosRoutes);
app.use('/api/usuarios', usuarioRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/webhook', mpRoutes);

// Healthcheck ultrarrápido
app.get('/health', (_req, res) => res.json({ ok: true }));

/* --------------------- Cron: desverificar vencidos (cada minuto) ---------------- */
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

/* --------------------------------- Arranque ------------------------------------ */
(async () => {
  try {
    // 1) Conectar a Mongo con pool “caliente”
    await connect(); // lee MONGODB_URI || MONGO_URI adentro con opciones recomendadas

    // 2) Warm-up: tocamos una consulta ligera para “calentar” el pool e índices
    //    (no esperes la promesa; que ocurra en background)
    (async () => {
      try {
        await Anuncio.find({}, { _id: 1 }).sort({ creadoEn: -1 }).limit(1).lean();
      } catch (e) {
        // sin ruido si falla en frío
      }
    })();

    const PORT = process.env.PORT || 3000;

    // 3) Levantar HTTP después de la conexión
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`Servidor corriendo en http://localhost:${PORT}`);

      // 4) Warm-up HTTP local: golpeamos /health para que el runtime/jit/route cache se “active”
      try {
        const url = `http://127.0.0.1:${PORT}/health`;
        // Node 18+ trae fetch global
        fetch(url).catch(() => {});
      } catch {}
    });

    // 5) Keep-alive suave cada 5 min para que Render/Atlas no “enfríen” el pool
    setInterval(async () => {
      try {
        await Anuncio.estimatedDocumentCount(); // más liviano que countDocuments
      } catch {}
    }, 5 * 60 * 1000);

  } catch (err) {
    console.error('❌ Error al iniciar:', err.message);
    process.exit(1);
  }
})();
