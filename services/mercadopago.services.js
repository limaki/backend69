const { MercadoPagoConfig, Preference, Payment } = require('mercadopago');
const Anuncio = require('../models/Anuncio');

const client = new MercadoPagoConfig({
  accessToken: 'APP_USR-5996841789439800-080317-341bc3c475da11c053048b13f74cf16c-2592571951',
});

const preferenceService = new Preference(client);
const paymentService = new Payment(client);
const crearPreferenciaDeVerificacion = async (anuncioId, alias) => {
  const body = {
    items: [
      {
        title: `Verificación de anuncio — ${alias}`,
        quantity: 1,
        unit_price: 100,
      },
    ],
    metadata: {
      anuncioId: anuncioId,
    },
    back_urls: {
      success: `https://crochii-upkm.vercel.app/anuncios/${anuncioId}`,
      failure: `https://tusitio.com/pago-fallido`,
    },
    auto_return: 'approved',
    notification_url: 'https://fine-shoes-thank.loca.lt/api/webhook/webhook' 
  };
  console.log('🔧 Preferencia a crear:', body);

  const response = await preferenceService.create({ body });
  return response.init_point; 
};

const procesarPagoAprobado = async (paymentId) => {
  const payment = await paymentService.get({ id: paymentId });
  const status = payment.status;
  console.log('🧪 Metadata recibida:', payment.metadata);

  if (status === 'approved') {
    const anuncioId = payment.metadata?.anuncioId;

    if (!anuncioId) {
      console.warn('⚠️ No se encontró anuncioId en metadata');
      console.warn('🧪 Metadata recibida:', payment.metadata);
      return;
    }

    await Anuncio.findByIdAndUpdate(anuncioId, {
      verificado: true,
      verificadoHasta: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    });

    console.log(`✅ Anuncio ${anuncioId} verificado correctamente`);
  }
};

console.log(process.env.MP_ACCESS_TOKEN)

module.exports = {
  crearPreferenciaDeVerificacion,
  procesarPagoAprobado,
};
