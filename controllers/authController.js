const { registrarUsuario, loguearUsuario } = require('../services/auth.services');

exports.register = async (req, res) => {
  try {
    const result = await registrarUsuario(req.body);
    res.status(201).json(result);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

exports.login = async (req, res) => {
  try {
    const { token, userId, role } = await loguearUsuario(req.body);

    res.status(200).json({
      token,
      userId,
      role 
    });
  } catch (error) {
    res.status(401).json({ message: error.message });
  }
};

