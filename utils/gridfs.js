// utils/gridfs.js
const { Readable } = require('stream');
const { ObjectId } = require('mongodb');
const { getBucket } = require('../config/db');

function uploadBuffer(file) {
  return new Promise((resolve, reject) => {
    const up = getBucket().openUploadStream(file.originalname, { contentType: file.mimetype });
    Readable.from(file.buffer).pipe(up)
      .on('error', reject)
      .on('finish', () => resolve(up.id)); // ObjectId
  });
}

async function deleteFile(id) {
  if (!id) return;
  await getBucket().delete(new ObjectId(id));
}

function streamFile(id, res) {
  let _id;
  try { _id = new ObjectId(id); } catch { return res.sendStatus(400); }
  const dl = getBucket().openDownloadStream(_id);
  dl.on('file', f => {
    res.set('Content-Type', f?.contentType || 'application/octet-stream');
    res.set('Cache-Control', 'public, max-age=31536000, immutable');
  });
  dl.on('error', () => res.sendStatus(404));
  dl.pipe(res);
}

module.exports = { uploadBuffer, deleteFile, streamFile };
