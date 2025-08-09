const Anuncio = require('../models/Anuncio');
const User = require('../models/User');

exports.dashboard = async (req, res) => {
  try {
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    const [usuarios, anuncios, verificados, activosHoy] = await Promise.all([
      User.countDocuments(),
      Anuncio.countDocuments(),
      Anuncio.countDocuments({ verificado: true }),
      Anuncio.countDocuments({ creadoEn: { $gte: startOfToday } }),
    ]);

    res.json({ usuarios, anuncios, verificados, activosHoy });
  } catch (err) {
    console.error('dashboard error', err);
    res.status(500).json({ error: 'Error obteniendo métricas' });
  }
};

exports.usuarios = async (req, res) => {
  try {
    // Podés paginar luego con ?page=&limit=
    const users = await User.find({}, 'nombre apellido email telefono role').sort({ nombre: 1 });
    res.json(users);
  } catch (err) {
    console.error('usuarios error', err);
    res.status(500).json({ error: 'Error listando usuarios' });
  }
};

exports.promoverAAdmin = async (req, res) => {
  try {
    const { userId } = req.params;
    const updated = await User.findByIdAndUpdate(
      userId,
      { role: 'admin' },
      { new: true }
    ).select('nombre apellido email role');

    if (!updated) return res.status(404).json({ error: 'Usuario no encontrado' });
    res.json({ ok: true, user: updated });
  } catch (err) {
    console.error('promover error', err);
    res.status(500).json({ error: 'Error promoviendo usuario' });
  }
};
