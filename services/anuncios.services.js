const Anuncio = require('../models/Anuncio');

async function getAnunciosByUser(userId) {
  return await Anuncio.find({ userId });
}

module.exports = {
  getAnunciosByUser
};
