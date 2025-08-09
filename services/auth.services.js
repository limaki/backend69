// services/authService.js
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const User = require('../models/User');

const SECRET = process.env.JWT_SECRET || 'secreto';

function generarToken(usuario) {
  return jwt.sign(
    { id: usuario._id, role: usuario.role },
    SECRET,
    { expiresIn: '7d' }
  );
}

async function registrarUsuario(data) {
  const { nombre, apellido, telefono, email, password } = data;

  const usuarioExistente = await User.findOne({ email });
  if (usuarioExistente) {
    throw new Error('El email ya está registrado');
  }

  const nuevoUsuario = new User({
    nombre,
    apellido,
    telefono,
    email,
    password, // ⚠️ sin hashear, el pre('save') lo hará
    role: 'user'
  });

  await nuevoUsuario.save();

  const token = generarToken(nuevoUsuario);

  return {
    token,
    userId: nuevoUsuario._id,
    role: nuevoUsuario.role
  };
}


async function loguearUsuario(data) {
  const { email, password } = data;

  const usuario = await User.findOne({ email });
  if (!usuario) {
    throw new Error('Credenciales inválidas');
  }

  const esValido = await bcrypt.compare(password, usuario.password);
  if (!esValido) {
    throw new Error('Credenciales inválidas');
  }

  const token = generarToken(usuario);

  return {
    token,
    userId: usuario._id,
    role: usuario.role
  };
}

module.exports = {
  registrarUsuario,
  loguearUsuario
};
