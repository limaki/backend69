const { MercadoPagoConfig, Preference } = require('mercadopago');

const client = new MercadoPagoConfig({
  accessToken: 'TU_ACCESS_TOKEN_AQUI',
});

const preferenceService = new Preference(client);

async function crearPreferencia() {
  try {
    const response = await preferenceService.create({
      body: {
        items: [
          {
            title: `Verificación de anuncio ID ${anuncioId}`,
            description: `Verificación del anuncio con ID ${anuncioId}, alias: ${alias}`,
            quantity: 1,
            unit_price: 100,
          },
        ],
        metadata: {
          anuncioId: anuncioId,
        },
        payer: {
          name: 'Usuario',
          surname: 'Verificado',
          email: `comprador${Math.floor(Math.random() * 100000)}@test.com`,
          identification: {
            type: 'DNI',
            number: '12345678'
          }
        },
        back_urls: {
          success: `https://tusitio.com/pago-exitoso/${anuncioId}`,
          failure: `https://tusitio.com/pago-fallido`,
        },
        auto_return: 'approved',
        },
    });

    console.log('✅ URL para pagar:', response.init_point);
  } catch (err) {
    console.error('❌ Error al crear preferencia:', err.message);
  }
}

crearPreferencia();
