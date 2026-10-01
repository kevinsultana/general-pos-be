import midtransClient from 'midtrans-client';

const serverKey = (process.env.MIDTRANS_SERVER_KEY || '').trim();
const clientKey = (process.env.MIDTRANS_CLIENT_KEY || '').trim();

// Deteksi otomatis jika menggunakan kunci Production (awalan 'Mid-') vs Sandbox (awalan 'SB-Mid-')
const isProduction =
  process.env.MIDTRANS_IS_PRODUCTION === 'true' ||
  (serverKey.startsWith('Mid-') && !serverKey.startsWith('SB-'));

/**
 * Inisialisasi Service Midtrans Snap Client
 */
export const snap = new midtransClient.Snap({
  isProduction,
  serverKey: serverKey || 'SB-Mid-server-xxxxxxx',
  clientKey: clientKey || 'SB-Mid-client-xxxxxxx',
});

export default snap;
