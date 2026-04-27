/**
 * Routes d'authentification pour le service Auth
 * Gère l'inscription, la connexion, le refresh token et la déconnexion
 */
const express = require('express');
const bcrypt = require('bcryptjs');
const { body, validationResult } = require('express-validator');
const User = require('../models/User');
const { generateTokenPair, verifyRefreshToken, hashRefreshToken } = require('../utils/jwt');
const rabbitmq = require('../config/rabbitmq');

const router = express.Router();

/**
 * @route   POST /auth/register
 * @desc    Inscription d'un nouvel utilisateur
 * @access  Public
 */
router.post('/register', [
  body('email')
    .isEmail().withMessage('Email invalide')
    .normalizeEmail()
    .trim(),
  body('password')
    .isLength({ min: 8 }).withMessage('Le mot de passe doit faire au moins 8 caractères')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .withMessage('Le mot de passe doit contenir une majuscule, une minuscule et un chiffre'),
  body('firstName')
    .trim()
    .notEmpty().withMessage('Le prénom est requis')
    .isLength({ max: 50 }).withMessage('Le prénom ne peut dépasser 50 caractères'),
  body('lastName')
    .trim()
    .notEmpty().withMessage('Le nom est requis')
    .isLength({ max: 50 }).withMessage('Le nom ne peut dépasser 50 caractères')
], async (req, res) => {
  try {
    // Validation des entrées
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array().map(e => ({ field: e.path, message: e.msg }))
      });
    }

    const { email, password, firstName, lastName } = req.body;

    // Vérifier si l'email existe déjà
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        error: 'Cet email est déjà utilisé'
      });
    }

    // Hasher le mot de passe avec bcrypt (coût 10)
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    // Créer l'utilisateur
    const user = new User({
      email,
      passwordHash,
      firstName,
      lastName
    });

    await user.save();

    // Générer les tokens JWT
    const tokens = generateTokenPair(user);

    // Stocker le hash du refresh token
    const refreshTokenHash = hashRefreshToken(tokens.refreshToken);
    user.refreshTokens.push({
      token: refreshTokenHash,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 jours
    });
    await user.save();

    // Publier l'événement user.created (non bloquant)
    rabbitmq.publishEvent('auth-events', 'user.created', {
      userId: user._id.toString(),
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      isPremium: user.isPremium,
      timestamp: new Date().toISOString()
    }).catch(console.error);

    console.log('[INFO] Utilisateur créé: ${email}');

    res.status(201).json({
      success: true,
      message: 'Compte créé avec succès',
      user: {
        id: user._id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        isPremium: user.isPremium,
        creditsRemaining: user.creditsRemaining
      },
      tokens
    });

  } catch (error) {
    console.error('[ERROR] Erreur inscription:', error.message);
    res.status(500).json({
      success: false,
      error: 'Erreur serveur lors de l\'inscription'
    });
  }
});

/**
 * @route   POST /auth/login
 * @desc    Connexion d'un utilisateur existant
 * @access  Public
 */
router.post('/login', [
  body('email')
    .isEmail().withMessage('Email invalide')
    .normalizeEmail(),
  body('password')
    .notEmpty().withMessage('Le mot de passe est requis')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array().map(e => ({ field: e.path, message: e.msg }))
      });
    }

    const { email, password } = req.body;

    // Rechercher l'utilisateur
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({
        success: false,
        error: 'Email ou mot de passe incorrect'
      });
    }

    // Vérifier si le compte est supprimé (soft delete)
    if (user.deletedAt) {
      return res.status(401).json({
        success: false,
        error: 'Ce compte a été désactivé'
      });
    }

    // Vérifier le mot de passe
    const isValidPassword = await bcrypt.compare(password, user.passwordHash);
    if (!isValidPassword) {
      return res.status(401).json({
        success: false,
        error: 'Email ou mot de passe incorrect'
      });
    }

    // Vérifier et réinitialiser les crédits si nécessaire
    await user.checkAndResetCredits();

    // Mettre à jour la date de dernière connexion
    user.lastLoginAt = new Date();
    await user.save();

    // Générer les tokens
    const tokens = generateTokenPair(user);

    // Stocker le refresh token
    const refreshTokenHash = hashRefreshToken(tokens.refreshToken);
    user.refreshTokens.push({
      token: refreshTokenHash,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
    });
    await user.save();

    // Publier l'événement user.login (non bloquant)
    rabbitmq.publishEvent('auth-events', 'user.login', {
      userId: user._id.toString(),
      email: user.email,
      timestamp: new Date().toISOString()
    }).catch(console.error);

    console.log('[INFO] Connexion réussie: ${email}');

    res.json({
      success: true,
      message: 'Connexion réussie',
      user: {
        id: user._id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        isPremium: user.isPremium,
        creditsRemaining: user.creditsRemaining,
        premiumEndDate: user.premiumEndDate
      },
      tokens
    });

  } catch (error) {
    console.error('[ERROR] Erreur connexion:', error.message);
    res.status(500).json({
      success: false,
      error: 'Erreur serveur lors de la connexion'
    });
  }
});

/**
 * @route   POST /auth/refresh
 * @desc    Renouveler l'access token avec un refresh token
 * @access  Public (nécessite refresh token valide)
 */
router.post('/refresh', async (req, res) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(400).json({
        success: false,
        error: 'Refresh token requis'
      });
    }

    // Vérifier le refresh token
    let decoded;
    try {
      decoded = verifyRefreshToken(refreshToken);
    } catch (error) {
      return res.status(401).json({
        success: false,
        error: error.message
      });
    }

    // Vérifier si le token existe en base (révocation)
    const user = await User.findById(decoded.userId);
    if (!user) {
      return res.status(401).json({
        success: false,
        error: 'Utilisateur non trouvé'
      });
    }

    const refreshTokenHash = hashRefreshToken(refreshToken);
    const tokenExists = user.refreshTokens.some(t => t.token === refreshTokenHash);

    if (!tokenExists) {
      return res.status(401).json({
        success: false,
        error: 'Refresh token révoqué ou invalide'
      });
    }

    // Générer une nouvelle paire de tokens
    const tokens = generateTokenPair(user);

    // Remplacer l'ancien refresh token par le nouveau
    user.refreshTokens = user.refreshTokens.filter(t => t.token !== refreshTokenHash);
    user.refreshTokens.push({
      token: hashRefreshToken(tokens.refreshToken),
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
    });
    await user.save();

    res.json({
      success: true,
      tokens
    });

  } catch (error) {
    console.error('[ERROR] Erreur refresh token:', error.message);
    res.status(500).json({
      success: false,
      error: 'Erreur serveur'
    });
  }
});

/**
 * @route   POST /auth/logout
 * @desc    Déconnexion - révoque le refresh token
 * @access  Private
 */
router.post('/logout', async (req, res) => {
  try {
    const { refreshToken } = req.body;
    const authHeader = req.headers.authorization;

    // Récupérer l'userId du token d'accès s'il existe
    let userId = null;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const accessToken = authHeader.split(' ')[1];
      try {
        const decoded = require('../utils/jwt').verifyAccessToken(accessToken);
        userId = decoded.userId;
      } catch (e) {
        // Token expiré, on continue quand même
      }
    }

    // Si un refresh token est fourni, le révoquer
    if (refreshToken) {
      try {
        const decoded = verifyRefreshToken(refreshToken);
        const user = await User.findById(decoded.userId);
        if (user) {
          const refreshTokenHash = hashRefreshToken(refreshToken);
          user.refreshTokens = user.refreshTokens.filter(t => t.token !== refreshTokenHash);
          await user.save();
        }
      } catch (e) {
        // Ignorer les erreurs de token invalide
      }
    }

    // Publier l'événement user.logout (non bloquant)
    if (userId) {
      rabbitmq.publishEvent('auth-events', 'user.logout', {
        userId,
        timestamp: new Date().toISOString()
      }).catch(console.error);
    }

    res.json({
      success: true,
      message: 'Déconnexion réussie'
    });

  } catch (error) {
    console.error('[ERROR] Erreur logout:', error.message);
    res.status(500).json({
      success: false,
      error: 'Erreur serveur'
    });
  }
});

/**
 * @route   GET /auth/me
 * @desc    Récupérer les informations de l'utilisateur connecté
 * @access  Private
 */
router.get('/me', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        error: 'Token d\'authentification requis'
      });
    }

    const token = authHeader.split(' ')[1];
    const decoded = require('../utils/jwt').verifyAccessToken(token);

    const user = await User.findById(decoded.userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'Utilisateur non trouvé'
      });
    }

    // Vérifier les crédits
    await user.checkAndResetCredits();

    res.json({
      success: true,
      user: {
        id: user._id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        isPremium: user.isPremium,
        creditsRemaining: user.creditsRemaining,
        premiumStartDate: user.premiumStartDate,
        premiumEndDate: user.premiumEndDate,
        preferences: user.preferences
      }
    });

  } catch (error) {
    if (error.message === 'Token expiré' || error.message === 'Token invalide') {
      return res.status(401).json({
        success: false,
        error: error.message
      });
    }
    console.error('[ERROR] Erreur récupération profil:', error.message);
    res.status(500).json({
      success: false,
      error: 'Erreur serveur'
    });
  }
});

/**
 * @route   PUT /auth/profile
 * @desc    Mettre à jour le profil utilisateur
 * @access  Private
 */
router.put('/profile', [
  body('firstName').optional().trim().isLength({ max: 50 }),
  body('lastName').optional().trim().isLength({ max: 50 }),
  body('preferences').optional().isObject()
], async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        error: 'Token d\'authentification requis'
      });
    }

    const token = authHeader.split(' ')[1];
    const decoded = require('../utils/jwt').verifyAccessToken(token);

    const user = await User.findById(decoded.userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'Utilisateur non trouvé'
      });
    }

    const { firstName, lastName, preferences } = req.body;

    if (firstName) user.firstName = firstName;
    if (lastName) user.lastName = lastName;
    if (preferences) {
      user.preferences = { ...user.preferences, ...preferences };
    }

    await user.save();

    // Publier l'événement user.updated (non bloquant)
    rabbitmq.publishEvent('auth-events', 'user.updated', {
      userId: user._id.toString(),
      timestamp: new Date().toISOString()
    }).catch(console.error);

    res.json({
      success: true,
      message: 'Profil mis à jour',
      user: {
        id: user._id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        preferences: user.preferences
      }
    });

  } catch (error) {
    console.error('[ERROR] Erreur mise à jour profil:', error.message);
    res.status(500).json({
      success: false,
      error: 'Erreur serveur'
    });
  }
});

/**
 * @route   DELETE /auth/delete-account
 * @desc    Supprimer le compte utilisateur (soft delete)
 * @access  Private
 */
router.delete('/delete-account', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        error: 'Token d\'authentification requis'
      });
    }

    const token = authHeader.split(' ')[1];
    const decoded = require('../utils/jwt').verifyAccessToken(token);

    const user = await User.findById(decoded.userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'Utilisateur non trouvé'
      });
    }

    // Soft delete
    user.deletedAt = new Date();
    user.refreshTokens = []; // Révoquer tous les tokens
    await user.save();

    // Publier l'événement user.deleted (non bloquant)
    rabbitmq.publishEvent('auth-events', 'user.deleted', {
      userId: user._id.toString(),
      timestamp: new Date().toISOString()
    }).catch(console.error);

    res.json({
      success: true,
      message: 'Compte supprimé avec succès'
    });

  } catch (error) {
    console.error('[ERROR] Erreur suppression compte:', error.message);
    res.status(500).json({
      success: false,
      error: 'Erreur serveur'
    });
  }
});

/**
 * @route   PUT /auth/use-credit
 * @desc    Décrémenter les crédits d'un utilisateur (appelé par le code service)
 * @access  Private (inter-service)
 */
router.put('/use-credit', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        error: 'Token d\'authentification requis'
      });
    }

    const { userId, amount } = req.body;
    if (!userId || !amount) {
      return res.status(400).json({
        success: false,
        error: 'userId et amount sont requis'
      });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'Utilisateur non trouvé'
      });
    }

    const success = await user.useCredits(amount);
    if (!success) {
      return res.status(403).json({
        success: false,
        error: 'Crédits insuffisants'
      });
    }

    res.json({
      success: true,
      creditsRemaining: user.creditsRemaining
    });

  } catch (error) {
    console.error('[ERROR] Erreur décrémentation crédits:', error.message);
    res.status(500).json({
      success: false,
      error: 'Erreur serveur'
    });
  }
});

module.exports = router;
