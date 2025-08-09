const mongoose = require('mongoose');

let bucket;

async function connect() {
  const uri = process.env.MONGODB_URI || process.env.MONGO_URI;
  if (!uri) throw new Error('Falta MONGODB_URI/MONGO_URI en .env');

  await mongoose.connect(uri);
  bucket = new mongoose.mongo.GridFSBucket(mongoose.connection.db, { bucketName: 'uploads' });
  console.log('✅ Mongo conectado');
}

function getBucket() {
  if (!bucket) throw new Error('GridFS no inicializado');
  return bucket;
}

module.exports = { connect, getBucket };
