const Anuncio = require('../models/Anuncio');
const AnuncioService = require('../services/anuncios.services');
const { crearPreferenciaDeVerificacion } = require('../services/mercadopago.services');
const { uploadBuffer, deleteFile } = require('../utils/gridfs');

const withFotoUrl = (a) => ({
  ...a,
  fotoUrl: a.foto ? `/api/images/${a.foto}` : null,
});

// Crear anuncio
exports.crearAnuncio = async (req, res) => {
  try {
    const {
      alias, edad, zona, contacto, genero, etnia, descripcion
    } = req.body;

    if (!alias || !edad || !zona) {
      return res.status(400).json({ error: 'Faltan campos obligatorios' });
    }

    // Parse seguro de 'atencion'
    let atencion = [];
    if (req.body.atencion) {
      try {
        atencion = Array.isArray(req.body.atencion)
          ? req.body.atencion
          : JSON.parse(req.body.atencion);
      } catch {
        atencion = [];
      }
    }

    // Subir imagen a GridFS (opcional)
    let foto = null;
    if (req.file) {
      foto = await uploadBuffer(req.file); // ObjectId
    }

    const nuevoAnuncio = await Anuncio.create({
      alias,
      edad,
      zona,
      contacto,
      genero,
      etnia,
      descripcion,
      atencion,
      foto,                 // ObjectId o null
      userId: req.user.id,
      verificado: false,
      verificadoHasta: null
    });

    return res.status(201).json({
      _id: nuevoAnuncio._id,
      ...nuevoAnuncio.toObject(),
      fotoUrl: nuevoAnuncio.foto ? `/api/images/${nuevoAnuncio.foto}` : null
    });
  } catch (err) {
    console.error('Error en crearAnuncio:', err);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
};
exports.actualizarAnuncio = async (req, res) => {
  try {
    const { alias, edad, zona, contacto, genero, etnia, descripcion, removeImage } = req.body;

    if (!alias || !edad || !zona) {
      return res.status(400).json({ error: 'Faltan campos obligatorios' });
    }

    const anuncio = await Anuncio.findById(req.params.id);
    if (!anuncio) return res.status(404).json({ error: 'Anuncio no encontrado' });

    if (anuncio.userId.toString() !== req.user.id) {
      return res.status(403).json({ error: 'No autorizado para editar este anuncio' });
    }

    // Campos básicos
    anuncio.alias = alias;
    anuncio.edad = edad;
    anuncio.zona = zona;
    anuncio.contacto = contacto;
    anuncio.genero = genero;
    anuncio.etnia = etnia;
    anuncio.descripcion = descripcion;

    // Parse seguro de 'atencion'
    if (req.body.atencion !== undefined) {
      try {
        anuncio.atencion = Array.isArray(req.body.atencion)
          ? req.body.atencion
          : JSON.parse(req.body.atencion);
      } catch {
        // si viene malformado, no lo piso
        console.warn('Campo "atencion" malformado, no se actualiza');
      }
    }

    // Quitar imagen si lo piden explícitamente
    if (removeImage === 'true' || removeImage === true) {
      if (anuncio.foto) {
        await deleteFile(anuncio.foto);
        anuncio.foto = null;
      }
    }

    // Reemplazar imagen si adjuntan nueva
    if (req.file) {
      const nueva = await uploadBuffer(req.file);
      if (anuncio.foto) {
        await deleteFile(anuncio.foto); // borro la anterior
      }
      anuncio.foto = nueva;
    }

    await anuncio.save();

    return res.json({
      mensaje: 'Anuncio actualizado correctamente',
      anuncio: {
        ...anuncio.toObject(),
        fotoUrl: anuncio.foto ? `/api/images/${anuncio.foto}` : null
      }
    });
  } catch (err) {
    console.error('Error al actualizar anuncio:', err);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
};
// Obtener todos los anuncios
exports.obtenerAnuncios = async (_req, res) => {
  try {
    const anuncios = await Anuncio.find()
      .sort({ verificado: -1, creadoEn: -1 }) 
      .lean();

    res.json(anuncios.map(withFotoUrl));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};


// GET /api/anuncios/:id
exports.obtenerAnuncioPorId = async (req, res) => {
  try {
    const anuncio = await Anuncio.findById(req.params.id).lean();
    if (!anuncio) return res.status(404).json({ error: 'No encontrado' });
    res.json(withFotoUrl(anuncio));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// GET /api/anuncios/mio  (si lo usás) ó /api/anuncios/mis-anuncios (lista)
exports.obtenerMiAnuncio = async (req, res) => {
  try {
    const anuncio = await Anuncio.findOne({ userId: req.user.id }).lean();

    if (!anuncio) {
      return res.status(404).json({ error: 'No tienes anuncio creado' });
    }

    res.json({
      ...withFotoUrl(anuncio),
      verificado: anuncio.verificado // 👈 incluimos explícitamente el estado
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al obtener anuncio' });
  }
};


// GET /api/anuncios/mis-anuncios (lista del usuario autenticado)
exports.obtenerMisAnuncios = async (req, res) => {
  try {
    const anuncios = await Anuncio.find({ userId: req.user.id }).sort({ creadoEn: -1 }).lean();
    res.json(anuncios.map(withFotoUrl));
  } catch (err) {
    res.status(500).json({ message: 'Error al obtener tus anuncios', error: err.message });
  }
};

// DELETE /api/anuncios/:id
exports.eliminarAnuncio = async (req, res) => {
  try {
    const anuncio = await Anuncio.findById(req.params.id);
    if (!anuncio) return res.status(404).json({ error: 'No encontrado' });
    if (anuncio.userId.toString() !== req.user.id) {
      return res.status(403).json({ error: 'No autorizado' });
    }

    // si tenía imagen en GridFS, la borro
    if (anuncio.foto) {
      try { await deleteFile(anuncio.foto); } catch { /* ignorar si ya no existe */ }
    }

    await anuncio.deleteOne();
    res.json({ mensaje: 'Anuncio eliminado' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// POST /api/anuncios/filtrar
exports.filtrarAnuncios = async (req, res) => {
  try {
    const filtros = req.body ?? {};
    const query = {};

    if (filtros.genero) query.genero = filtros.genero;
    if (filtros.etnia) query.etnia = filtros.etnia;

    if (filtros.zona) {
      // acepta string o array
      if (Array.isArray(filtros.zona)) {
        query.zona = { $in: filtros.zona };
      } else {
        query.zona = { $regex: String(filtros.zona), $options: 'i' };
      }
    }

    if (filtros.verificado === true) query.verificado = true;

    if (Array.isArray(filtros.atencion) && filtros.atencion.length > 0) {
      query.atencion = { $in: filtros.atencion };
    }

    if (filtros.edadMin != null || filtros.edadMax != null) {
      query.edad = {};
      if (filtros.edadMin != null) query.edad.$gte = Number(filtros.edadMin);
      if (filtros.edadMax != null) query.edad.$lte = Number(filtros.edadMax);
    }

    const anuncios = await Anuncio.find(query).sort({ creadoEn: -1 }).lean();
    res.json(anuncios.map(withFotoUrl));
  } catch (err) {
    res.status(500).json({ error: 'Error al filtrar anuncios' });
  }
};

// Generar link de pago para verificación
exports.generarLinkDePago = async (req, res) => {
  try {
    const anuncioId = req.params.id;
    const anuncio = await Anuncio.findById(anuncioId);
    if (!anuncio) return res.status(404).json({ error: 'Anuncio no encontrado' });

    const link = await crearPreferenciaDeVerificacion(anuncioId, anuncio.alias || anuncio.titulo || 'Anuncio');
    res.json({ link });
  } catch (err) {
    console.error('❌ Error al generar link de pago:', err.message);
    res.status(500).json({ error: 'Error al generar link de pago' });
  }
};
