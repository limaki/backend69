const mongoose = require('mongoose');

const anuncioSchema = new mongoose.Schema({
  alias:      { type: String, required: true },
  edad:       { type: Number, required: true },
  provincia:  { type: String, required: true }, // NUEVO CAMPO
  zona:       { type: String, required: true },
  descripcion:{ type: String, required: true },
  fotos: [{ type: String }] ,
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
