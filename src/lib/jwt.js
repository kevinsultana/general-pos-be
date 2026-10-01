import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '1d';

// [C-2] Fatal startup validation — server tidak boleh berjalan tanpa JWT_SECRET yang kuat
if (!JWT_SECRET || JWT_SECRET.length < 32) {
  throw new Error(
    '[FATAL] JWT_SECRET harus diset di environment dan minimal 32 karakter!\n' +
    'Generate dengan perintah: openssl rand -hex 32\n' +
    'Lalu tambahkan ke file .env: JWT_SECRET="hasil-generate-di-sini"'
  );
}

/**
 * Generate JSON Web Token
 * @param {object} payload - Data payload yang akan disematkan ke dalam token
 * @returns {string} Signed JWT token string
 */
export const generateToken = (payload) => {
  return jwt.sign(payload, JWT_SECRET, {
    expiresIn: JWT_EXPIRES_IN,
  });
};

/**
 * Verifikasi validitas JSON Web Token
 * @param {string} token - JWT token string
 * @returns {object} Decoded token payload
 */
export const verifyToken = (token) => {
  return jwt.verify(token, JWT_SECRET);
};

export default {
  generateToken,
  verifyToken,
};
