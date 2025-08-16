const Anuncio = require('../models/Anuncio');
const AnuncioService = require('../services/anuncios.services');
const { crearPreferenciaDeVerificacion } = require('../services/mercadopago.services');
const { uploadBuffer, deleteFile } = require('../utils/gridfs');

// Mapear las fotos con URLs
const withFotosUrl = (a) => ({
  ...a,
  fotos: Array.isArray(a.fotos)
    ? a.fotos.map(f => `/api/images/${f}`)
    : []
});

// Crear anuncio
exports.crearAnuncio = async (req, res) => {
  try {
    const {
      alias, edad, provincia, zona, contacto, genero, etnia, descripcion
    } = req.body;

    if (!alias || !edad || !provincia || !zona) {
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

    // Subir imágenes a GridFS (pueden venir varias en req.files)
    let fotos = [];
    if (req.files && req.files.length > 0) {
      fotos = await Promise.all(req.files.map(f => uploadBuffer(f)));
    }

    const nuevoAnuncio = await Anuncio.create({
      alias,
      edad,
      provincia,
      zona,
      contacto,
      genero,
      etnia,
      descripcion,
      atencion,
      fotos, // ✅ array de ObjectId
      userId: req.user.id,
      verificado: false,
      verificadoHasta: null
    });

    return res.status(201).json({
      _id: nuevoAnuncio._id,
      ...nuevoAnuncio.toObject(),
      fotos: nuevoAnuncio.fotos.map(f => `/api/images/${f}`)
    });
  } catch (err) {
    console.error('Error en crearAnuncio:', err);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
};

// Actualizar anuncio
exports.actualizarAnuncio = async (req, res) => {
  try {
    const anuncio = await Anuncio.findById(req.params.id);
    if (!anuncio) return res.status(404).json({ error: 'Anuncio no encontrado' });
    if (anuncio.userId.toString() !== req.user.id) {
      return res.status(403).json({ error: 'No autorizado' });
    }

    // -------- Campos simples --------
    const { alias, edad, provincia, zona, contacto, genero, etnia, descripcion, removeImage } = req.body;

    if (alias != null) anuncio.alias = String(alias);
    if (edad != null) anuncio.edad = Number(edad);
    if (provincia != null) anuncio.provincia = String(provincia);
    if (zona != null) anuncio.zona = String(zona);
    if (contacto != null) anuncio.contacto = String(contacto);
    if (genero != null) anuncio.genero = String(genero);
    if (etnia != null) anuncio.etnia = String(etnia);
    if (descripcion != null) anuncio.descripcion = String(descripcion);

    // atencion: array o JSON
    if (req.body.atencion !== undefined) {
      try {
        anuncio.atencion = Array.isArray(req.body.atencion)
          ? req.body.atencion
          : JSON.parse(req.body.atencion || '[]');
      } catch { /* deja lo existente si falla */ }
    }

    // -------- FOTOS (array) --------
    if (!Array.isArray(anuncio.fotos)) anuncio.fotos = [];

    // 1) Normalizar "fotosExistentes" desde el front (ids o rutas)
    let fotosExistentesIds = null;
    const parsePosibleJson = (v) => {
      if (typeof v === 'string') {
        try { return JSON.parse(v); } catch { return null; }
      }
      return v;
    };
    const rawExistentes = parsePosibleJson(req.body.fotosExistentes);
    if (Array.isArray(rawExistentes)) {
      fotosExistentesIds = rawExistentes
        .map(x => {
          const s = String(x ?? '');
          const m = s.match(/\/api\/images\/([^\/?#]+)/);
          return m ? m[1] : s;
        })
        .filter(Boolean)
        .map(String);
    }

    if (fotosExistentesIds) {
      // eliminar del storage las que ya no están en la lista
      const aEliminar = anuncio.fotos.filter(f => !fotosExistentesIds.includes(String(f)));
      for (const f of aEliminar) {
        try { await deleteFile(f); } catch {}
      }
      anuncio.fotos = fotosExistentesIds;
    }

    // 2) removeImage: borra todas si lo piden explícitamente
    if (removeImage === 'true' || removeImage === true) {
      for (const f of anuncio.fotos) {
        try { await deleteFile(f); } catch {}
      }
      anuncio.fotos = [];
    }

    // 3) Normalizar archivos subidos (single/fields/any)
    const incoming = [];
    if (req.file) incoming.push(req.file);                                       // single('foto')
    if (Array.isArray(req.files)) incoming.push(...req.files);                   // any()
    else if (req.files && typeof req.files === 'object') {
      Object.values(req.files).forEach(arr => Array.isArray(arr) && incoming.push(...arr)); // fields()
    }

    // 4) Subir solo imágenes a storage y anexarlas
    const nuevasSubidas = [];
    for (const f of incoming) {
      if (!f || !/^image\//.test(f.mimetype || '')) continue; // ignora no-imágenes
      const id = await uploadBuffer(f); // devuelve ObjectId/filename
      nuevasSubidas.push(id);
    }
    if (nuevasSubidas.length) {
      anuncio.fotos.push(...nuevasSubidas);
    }

    await anuncio.save();

    // 5) Respuesta con URLs listas
    const obj = anuncio.toObject();
    const fotosUrl = Array.isArray(obj.fotos) ? obj.fotos.map(f => `/api/images/${f}`) : [];
    return res.json({
      mensaje: 'Anuncio actualizado correctamente',
      anuncio: { ...obj, fotos: fotosUrl }
    });
  } catch (e) {
    console.error('Error al actualizar anuncio:', e);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
};



// Obtener todos los anuncios
exports.obtenerAnuncios = async (_req, res) => {
  try {
    const anuncios = await Anuncio.find()
      .sort({ verificado: -1, creadoEn: -1 }) 
      .lean();

    res.json(anuncios.map(withFotosUrl));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Obtener por ID
exports.obtenerAnuncioPorId = async (req, res) => {
  try {
    const anuncio = await Anuncio.findById(req.params.id).lean();
    if (!anuncio) return res.status(404).json({ error: 'No encontrado' });
    res.json(withFotosUrl(anuncio));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Obtener único del usuario
exports.obtenerMiAnuncio = async (req, res) => {
  try {
    const anuncio = await Anuncio.findOne({ userId: req.user.id })
      .select('verificado userId alias provincia zona descripcion fotos')
      .lean();

    if (!anuncio) {
      return res.status(404).json({ error: 'No tienes anuncio creado' });
    }

    res.json(withFotosUrl(anuncio));
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al obtener anuncio' });
  }
};

// Obtener lista del usuario
exports.obtenerMisAnuncios = async (req, res) => {
  try {
    const anuncios = await Anuncio.find({ userId: req.user.id }).sort({ creadoEn: -1 }).lean();
    res.json(anuncios.map(withFotosUrl));
  } catch (err) {
    res.status(500).json({ message: 'Error al obtener tus anuncios', error: err.message });
  }
};

// Eliminar anuncio
exports.eliminarAnuncio = async (req, res) => {
  try {
    const anuncio = await Anuncio.findById(req.params.id);
    if (!anuncio) return res.status(404).json({ error: 'No encontrado' });
    if (anuncio.userId.toString() !== req.user.id) {
      return res.status(403).json({ error: 'No autorizado' });
    }

    if (anuncio.fotos && anuncio.fotos.length > 0) {
      for (const f of anuncio.fotos) {
        try { await deleteFile(f); } catch {}
      }
    }

    await anuncio.deleteOne();
    res.json({ mensaje: 'Anuncio eliminado' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Filtrar anuncios
exports.filtrarAnuncios = async (req, res) => {
  try {
    const filtros = req.body ?? {};
    const query = {};

    if (filtros.genero) query.genero = filtros.genero;
    if (filtros.etnia) query.etnia = filtros.etnia;

    if (filtros.provincia) query.provincia = filtros.provincia;
    if (filtros.zona) query.zona = filtros.zona;

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
    res.json(anuncios.map(withFotosUrl));
  } catch (err) {
    res.status(500).json({ error: 'Error al filtrar anuncios' });
  }
};

// Generar link de pago
exports.generarLinkDePago = async (req, res) => {
  try {
    const anuncioId = req.params.id;
    const anuncio = await Anuncio.findById(anuncioId);
    if (!anuncio) return res.status(404).json({ error: 'Anuncio no encontrado' });

    const link = await crearPreferenciaDeVerificacion(anuncioId, anuncio.alias || 'Anuncio');
    res.json({ link });
  } catch (err) {
    console.error('❌ Error al generar link de pago:', err.message);
    res.status(500).json({ error: 'Error al generar link de pago' });
  }
};
