import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'omnipos-super-secret-jwt-key-default-dev';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';

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
