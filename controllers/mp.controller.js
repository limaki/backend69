const { MercadoPagoConfig, Payment } = require('mercadopago');
const Anuncio = require('../models/Anuncio');

// Configuración de cliente de MercadoPago (SDK moderno v2.80+)
const client = new MercadoPagoConfig({
  accessToken: process.env.MP_ACCESS_TOKEN || 'APP_USR-5996841789439800-080317-341bc3c475da11c053048b13f74cf16c-2592571951'
});

// Instancia de servicio de pagos
const paymentService = new Payment(client);

// Webhook handler
exports.recibirWebhook = async (req, res) => {
  try {
    const { type, data } = req.body;
    console.log('📬 Webhook recibido:', JSON.stringify(req.body, null, 2));

    if (type === 'payment' && data?.id) {
      console.log(`🔍 Buscando pago con ID: ${data.id}`);
      const payment = await paymentService.get({ id: data.id });

      const status = payment.status;
      const metadata = payment.metadata;

      console.log('🧪 Estado del pago:', status);
      console.log('🧪 Metadata recibida:', metadata);

      if (status === 'approved') {
        const anuncioId = metadata?.anuncio_id;

        if (!anuncioId) {
          console.warn('⚠️ No se encontró anuncioId en metadata');
          return res.sendStatus(400);
        }

        const result = await Anuncio.findByIdAndUpdate(anuncioId, {
          verificado: true,
           //verificadoHasta: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), 7 días
           verificadoHasta: new Date(Date.now() + 2 * 60 * 1000)
        });

        if (result) {
          console.log(`✅ Anuncio ${anuncioId} verificado correctamente`);
        } else {
          console.warn(`⚠️ No se encontró anuncio con ID ${anuncioId} en la base de datos`);
        }
      }
    }

    res.sendStatus(200);
  } catch (err) {
    console.error('❌ Error al procesar webhook:', err.message);
    res.sendStatus(500);
  }
};
