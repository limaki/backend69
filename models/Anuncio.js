const mongoose = require('mongoose');

const anuncioSchema = new mongoose.Schema({
  alias:      { type: String, required: true },
  edad:       { type: Number, required: true },
  zona:       { type: String, required: true },
  descripcion:{ type: String, required: true },
   //foto:       { type: String}, O `imagen` si usás ese nombre en el backend
  foto: { type: mongoose.Schema.Types.ObjectId, default: null },
  contacto:   { type: String, required: true },
  verificado: { type: Boolean, default: false, required: true },
  verificadoHasta: { type: Date, default: null },
  genero:     { type: String, required: true },
  etnia:      { type: String, required: true },
  atencion:   [String],
  userId:     { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  creadoEn:   { type: Date, default: Date.now }
});

module.exports = mongoose.model('Anuncio', anuncioSchema);
