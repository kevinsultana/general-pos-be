import midtransClient from 'midtrans-client';

/**
 * Mendapatkan instance Midtrans Snap yang tervalidasi
 * @returns {midtransClient.Snap}
 */
export const getSnapInstance = () => {
  const serverKey = (process.env.MIDTRANS_SERVER_KEY || '').replace(/['"]+/g, '').trim();
  const clientKey = (process.env.MIDTRANS_CLIENT_KEY || '').replace(/['"]+/g, '').trim();

  if (!serverKey) {
    throw new Error(
      'MIDTRANS_SERVER_KEY belum dikonfigurasi di file environment (.env).'
    );
  }

  // Default adalah Sandbox (isProduction: false)
  // Hanya aktif ke Production jika MIDTRANS_IS_PRODUCTION bernilai 'true' dan key tidak berawalan 'SB-'
  const isProduction =
    process.env.MIDTRANS_IS_PRODUCTION === 'true' &&
    !serverKey.startsWith('SB-');

  return new midtransClient.Snap({
    isProduction,
    serverKey,
    clientKey,
  });
};

/**
 * Instance Snap aktif
 */
export const snap = {
  createTransaction: async (parameter) => {
    const snapInstance = getSnapInstance();
    return await snapInstance.createTransaction(parameter);
  },
  transaction: {
    status: async (orderId) => {
      const snapInstance = getSnapInstance();
      return await snapInstance.transaction.status(orderId);
    },
    notification: async (notificationJson) => {
      const snapInstance = getSnapInstance();
      return await snapInstance.transaction.notification(notificationJson);
    },
  },
};

export default {
  getSnapInstance,
  snap,
};
