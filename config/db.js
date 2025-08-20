// config/db.js
const mongoose = require('mongoose');

// Forzar resolución DNS IPv4 primero (acelera SRV en varios hostings)
try {
  require('dns').setDefaultResultOrder('ipv4first');
} catch {}

let isConnected = false;
let bucket = null;

/**
 * Conecta a Mongo (una sola vez) y deja el pool “caliente”.
 * También inicializa GridFSBucket en { bucketName: 'uploads' }.
 */
async function connect() {
  if (isConnected && bucket) return; // ya conectado e inicializado

  const uri = process.env.MONGODB_URI || process.env.MONGO_URI;
  if (!uri) throw new Error('Falta MONGODB_URI/MONGO_URI en .env');

  const isProd = process.env.NODE_ENV === 'production';

  // Ajustes clave para “primer request rápido”
  await mongoose.connect(uri, {
    serverSelectionTimeoutMS: 5000, // falla rápido si no encuentra primary
    socketTimeoutMS: 45000,

    // Pool de conexiones: mantener algunas listas
    maxPoolSize: 20,
    minPoolSize: 2,                // 🔥 evita el “arranque frío”
    maxIdleTimeMS: 30000,

    // En algunos entornos acelera la resolución SRV/DNS
    family: 4,

    // En prod no construyas/verifiques índices en cada boot
    autoIndex: !isProd,
  });

  isConnected = true;

  // Inicializar GridFS una vez que tenemos db lista
  const db = mongoose.connection.db;
  bucket = new mongoose.mongo.GridFSBucket(db, { bucketName: 'uploads' });

  // Warm-up suave: ping y listamos 1 archivo para “despertar” el bucket
  try {
    await db.command({ ping: 1 });
    // no esperamos a que termine; solo dispara la iteración
    bucket.find({}, { limit: 1 }).toArray().catch(() => {});
  } catch {}

  console.log('✅ Mongo conectado y GridFS listo');
}

/**
 * Devuelve el bucket de GridFS inicializado.
 */
function getBucket() {
  if (!bucket) throw new Error('GridFS no inicializado (llamá a connect() primero)');
  return bucket;
}

module.exports = { connect, getBucket };
