/**
 * Utilitaires pour la gestion des tokens JWT
 * Génération et validation des access tokens et refresh tokens
 */
const jwt = require('jsonwebtoken');
const crypto = require('crypto');

// Configuration des durées de token
const ACCESS_TOKEN_EXPIRY = '15m';
const REFRESH_TOKEN_EXPIRY = '7d';

/**
 * Génère un access token JWT
 * @param {Object} payload - Données à inclure dans le token
 * @returns {string} Access token signé
 */
const generateAccessToken = (payload) => {
  return jwt.sign(
    {
      userId: payload.userId,
      email: payload.email,
      isPremium: payload.isPremium,
      type: 'access'
    },
    process.env.JWT_SECRET,
    { expiresIn: ACCESS_TOKEN_EXPIRY }
  );
};

/**
 * Génère un refresh token JWT
 * @param {Object} payload - Données à inclure dans le token
 * @returns {string} Refresh token signé
 */
const generateRefreshToken = (payload) => {
  return jwt.sign(
    {
      userId: payload.userId,
      type: 'refresh'
    },
    process.env.JWT_REFRESH_SECRET,
    { expiresIn: REFRESH_TOKEN_EXPIRY }
  );
};

/**
 * Génère une paire de tokens (access + refresh)
 * @param {Object} user - Objet utilisateur
 * @returns {Object} Paires de tokens et métadonnées
 */
const generateTokenPair = (user) => {
  const payload = {
    userId: user._id.toString(),
    email: user.email,
    isPremium: user.isPremium
  };

  const accessToken = generateAccessToken(payload);
  const refreshToken = generateRefreshToken(payload);

  // Calcul de l'expiration pour le frontend
  const decoded = jwt.decode(accessToken);
  const expiresIn = decoded.exp - Math.floor(Date.now() / 1000);

  return {
    accessToken,
    refreshToken,
    expiresIn
  };
};

/**
 * Vérifie et décode un access token
 * @param {string} token - Token JWT à vérifier
 * @returns {Object} Payload décodé
 * @throws {Error} Si le token est invalide ou expiré
 */
const verifyAccessToken = (token) => {
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (decoded.type !== 'access') {
      throw new Error('Token type invalide');
    }
    return decoded;
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      throw new Error('Token expiré');
    }
    throw new Error('Token invalide');
  }
};

/**
 * Vérifie et décode un refresh token
 * @param {string} token - Refresh token à vérifier
 * @returns {Object} Payload décodé
 * @throws {Error} Si le token est invalide ou expiré
 */
const verifyRefreshToken = (token) => {
  try {
    const decoded = jwt.verify(token, process.env.JWT_REFRESH_SECRET);
    if (decoded.type !== 'refresh') {
      throw new Error('Token type invalide');
    }
    return decoded;
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      throw new Error('Refresh token expiré');
    }
    throw new Error('Refresh token invalide');
  }
};

/**
 * Hash un refresh token pour le stockage sécurisé en base
 * @param {string} token - Token à hasher
 * @returns {string} Token hashé
 */
const hashRefreshToken = (token) => {
  return crypto.createHash('sha256').update(token).digest('hex');
};

module.exports = {
  generateAccessToken,
  generateRefreshToken,
  generateTokenPair,
  verifyAccessToken,
  verifyRefreshToken,
  hashRefreshToken,
  ACCESS_TOKEN_EXPIRY,
  REFRESH_TOKEN_EXPIRY
};
