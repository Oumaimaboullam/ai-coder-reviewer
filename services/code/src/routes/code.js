/**
 * Routes pour la gestion du code et des analyses
 * Gère la soumission, l'historique et les statistiques
 */
const express = require('express');
const { body, query, validationResult } = require('express-validator');
const axios = require('axios');
const Analysis = require('../models/Analysis');
const rabbitmq = require('../config/rabbitmq');

const router = express.Router();

// Configuration
const AI_SERVICE_URL = process.env.AI_SERVICE_URL || 'http://localhost:3003';
const AUTH_SERVICE_URL = process.env.AUTH_SERVICE_URL || 'http://localhost:3001';

/**
 * Middleware pour vérifier le token JWT
 * Appelle le service d'authentification pour valider le token
 */
const verifyToken = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        error: 'Token d\'authentification requis'
      });
    }

    const token = authHeader.split(' ')[1];

    // Appeler le service d'authentification pour vérifier le token
    // Note: En production, on pourrait utiliser une cache Redis pour éviter les appels répétés
    try {
      const response = await axios.get(`${AUTH_SERVICE_URL}/auth/me`, {
        headers: { Authorization: `Bearer ${token}` },
        timeout: 5000
      });

      req.user = response.data.user;
      next();
    } catch (error) {
      if (error.response) {
        return res.status(error.response.status).json(error.response.data);
      }
      throw error;
    }
  } catch (error) {
    console.error('[ERROR] Erreur vérification token:', error.message);
    return res.status(401).json({
      success: false,
      error: 'Token invalide'
    });
  }
};

/**
 * @route   POST /code/submit
 * @desc    Soumettre du code pour analyse
 * @access  Private
 */
router.post('/submit', verifyToken, [
  body('code')
    .isLength({ min: 10, max: 50000 })
    .withMessage('Le code doit faire entre 10 et 50000 caractères'),
  body('language')
    .isIn(['javascript', 'typescript', 'python', 'java', 'go', 'rust', 'php', 'cpp', 'csharp', 'ruby', 'swift', 'kotlin', 'sql', 'html', 'css', 'json', 'yaml', 'xml', 'shell', 'other'])
    .withMessage('Langage non supporté'),
  body('fileName')
    .optional()
    .isString()
    .trim()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array().map(e => ({ field: e.path, message: e.msg }))
      });
    }

    const { code, language, fileName, context } = req.body;
    const user = req.user;

    // Vérifier les crédits (pour les utilisateurs non premium)
    if (!user.isPremium && user.creditsRemaining < 1) {
      return res.status(403).json({
        success: false,
        error: 'Crédits insuffisants',
        message: 'Vous avez épuisé vos analyses gratuites. Passez Premium pour des analyses illimitées.',
        upgradeUrl: '/payment/upgrade'
      });
    }

    // Créer l'enregistrement d'analyse
    const analysis = new Analysis({
      userId: user.id,
      code,
      language,
      fileName: fileName || null,
      status: 'pending',
      creditsUsed: user.isPremium ? 0 : 1
    });

    try {
      await analysis.save();
    } catch (saveError) {
      console.error('[ERROR] Erreur sauvegarde MongoDB:', saveError.message);
      throw saveError;
    }

    // Décrémenter les crédits de l'utilisateur (non premium uniquement)
    if (!user.isPremium) {
      try {
        await axios.put(`${AUTH_SERVICE_URL}/auth/use-credit`, 
          { userId: user.id, amount: 1 },
          { headers: { Authorization: req.headers.authorization } }
        );
      } catch (creditError) {
        console.warn('️ Erreur décrémentation crédits:', creditError.message);
        // Ne pas bloquer l'analyse si la décrémentation échoue
      }
    }

    // Publier l'événement analysis.submitted pour le service AI
    await rabbitmq.publishEvent('app-events', 'analysis.submitted', {
      analysisId: analysis._id.toString(),
      userId: user.id,
      code,
      language,
      fileName,
      context,
      isPremium: user.isPremium,
      timestamp: new Date().toISOString()
    });

    console.log('[INFO] Analyse soumise: ${analysis._id} par ${user.email}');

    // Répondre immédiatement (traitement asynchrone)
    res.status(202).json({
      success: true,
      message: 'Analyse en cours de traitement',
      analysisId: analysis._id,
      status: 'pending',
      estimatedTime: '5-10 secondes'
    });

  } catch (error) {
    console.error('[ERROR] Erreur soumission code:', error.message);
    res.status(500).json({
      success: false,
      error: 'Erreur serveur lors de la soumission'
    });
  }
});

/**
 * @route   GET /code/history
 * @desc    Récupérer l'historique des analyses
 * @access  Private
 */
router.get('/history', verifyToken, [
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .toInt()
    .withMessage('Limit doit être entre 1 et 100'),
  query('offset')
    .optional()
    .isInt({ min: 0 })
    .toInt()
    .withMessage('Offset doit être positif'),
  query('status')
    .optional()
    .isIn(['pending', 'processing', 'completed', 'failed']),
  query('language')
    .optional()
    .isString()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array()
      });
    }

    const user = req.user;
    const limit = req.query.limit || 20;
    const offset = req.query.offset || 0;
    const status = req.query.status;
    const language = req.query.language;

    // Construire le filtre (renommé pour éviter le shadowing avec l'import 'query')
    const filter = { userId: user.id };
    if (status) filter.status = status;
    if (language) filter.language = language;

    // Récupérer les analyses
    const analyses = await Analysis.find(filter)
      .sort({ createdAt: -1 })
      .skip(offset)
      .limit(limit)
      .select('-code'); // Ne pas renvoyer le code complet pour économiser la bande passante

    const total = await Analysis.countDocuments(filter);

    res.json({
      success: true,
      data: {
        analyses: analyses.map(a => ({
          id: a._id,
          language: a.language,
          fileName: a.fileName,
          status: a.status,
          score: a.result?.score,
          errorsCount: a.result?.errors?.length || 0,
          warningsCount: a.result?.warnings?.length || 0,
          createdAt: a.createdAt,
          executionTime: a.executionTime
        })),
        pagination: {
          total,
          limit,
          offset,
          hasMore: offset + limit < total
        }
      }
    });

  } catch (error) {
    console.error('[ERROR] Erreur récupération historique:', error.message);
    res.status(500).json({
      success: false,
      error: 'Erreur serveur'
    });
  }
});

/**
 * @route   GET /code/analysis/:id
 * @desc    Récupérer le détail d'une analyse
 * @access  Private
 */
router.get('/analysis/:id', verifyToken, async (req, res) => {
  try {
    const user = req.user;
    const analysisId = req.params.id;

    // Vérifier que l'ID est valide
    if (!analysisId.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({
        success: false,
        error: 'ID d\'analyse invalide'
      });
    }

    const analysis = await Analysis.findById(analysisId);

    if (!analysis) {
      return res.status(404).json({
        success: false,
        error: 'Analyse non trouvée'
      });
    }

    // Vérifier que l'analyse appartient à l'utilisateur
    if (analysis.userId.toString() !== user.id) {
      return res.status(403).json({
        success: false,
        error: 'Accès non autorisé'
      });
    }

    res.json({
      success: true,
      data: analysis
    });

  } catch (error) {
    console.error('[ERROR] Erreur récupération analyse:', error.message);
    res.status(500).json({
      success: false,
      error: 'Erreur serveur'
    });
  }
});

/**
 * @route   DELETE /code/analysis/:id
 * @desc    Supprimer une analyse
 * @access  Private
 */
router.delete('/analysis/:id', verifyToken, async (req, res) => {
  try {
    const user = req.user;
    const analysisId = req.params.id;

    const analysis = await Analysis.findById(analysisId);

    if (!analysis) {
      return res.status(404).json({
        success: false,
        error: 'Analyse non trouvée'
      });
    }

    if (analysis.userId.toString() !== user.id) {
      return res.status(403).json({
        success: false,
        error: 'Accès non autorisé'
      });
    }

    await Analysis.findByIdAndDelete(analysisId);

    // Publier l'événement analysis.deleted
    await rabbitmq.publishEvent('code-events', 'analysis.deleted', {
      analysisId,
      userId: user.id,
      timestamp: new Date().toISOString()
    });

    res.json({
      success: true,
      message: 'Analyse supprimée avec succès'
    });

  } catch (error) {
    console.error('[ERROR] Erreur suppression analyse:', error.message);
    res.status(500).json({
      success: false,
      error: 'Erreur serveur'
    });
  }
});

/**
 * @route   GET /code/stats
 * @desc    Récupérer les statistiques de l'utilisateur
 * @access  Private
 */
router.get('/stats', verifyToken, async (req, res) => {
  try {
    const user = req.user;

    // Statistiques générales
    const stats = await Analysis.getUserStats(user.id);

    // Distribution par langage
    const languageDistribution = await Analysis.getLanguageDistribution(user.id);

    // Analyses récentes (30 derniers jours)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const recentAnalyses = await Analysis.countDocuments({
      userId: user.id,
      createdAt: { $gte: thirtyDaysAgo }
    });

    res.json({
      success: true,
      data: {
        ...stats,
        languageDistribution: languageDistribution.map(l => ({
          language: l._id,
          count: l.count
        })),
        recentAnalyses,
        creditsRemaining: user.creditsRemaining,
        isPremium: user.isPremium
      }
    });

  } catch (error) {
    console.error('[ERROR] Erreur récupération statistiques:', error.message);
    res.status(500).json({
      success: false,
      error: 'Erreur serveur'
    });
  }
});

/**
 * @route   GET /code/languages
 * @desc    Récupérer la liste des langages supportés
 * @access  Public
 */
router.get('/languages', (req, res) => {
  const languages = [
    { id: 'javascript', name: 'JavaScript', extension: '.js', icon: '' },
    { id: 'typescript', name: 'TypeScript', extension: '.ts', icon: '' },
    { id: 'python', name: 'Python', extension: '.py', icon: '' },
    { id: 'java', name: 'Java', extension: '.java', icon: '' },
    { id: 'go', name: 'Go', extension: '.go', icon: '' },
    { id: 'rust', name: 'Rust', extension: '.rs', icon: '' },
    { id: 'php', name: 'PHP', extension: '.php', icon: '' },
    { id: 'cpp', name: 'C++', extension: '.cpp', icon: '' },
    { id: 'csharp', name: 'C#', extension: '.cs', icon: '' },
    { id: 'ruby', name: 'Ruby', extension: '.rb', icon: '' },
    { id: 'swift', name: 'Swift', extension: '.swift', icon: '' },
    { id: 'kotlin', name: 'Kotlin', extension: '.kt', icon: '🟣' },
    { id: 'sql', name: 'SQL', extension: '.sql', icon: '️' },
    { id: 'html', name: 'HTML', extension: '.html', icon: '' },
    { id: 'css', name: 'CSS', extension: '.css', icon: '' },
    { id: 'json', name: 'JSON', extension: '.json', icon: '' },
    { id: 'yaml', name: 'YAML', extension: '.yaml', icon: '' },
    { id: 'xml', name: 'XML', extension: '.xml', icon: '' },
    { id: 'shell', name: 'Shell/Bash', extension: '.sh', icon: '' },
    { id: 'other', name: 'Autre', extension: '', icon: '' }
  ];

  res.json({
    success: true,
    data: languages
  });
});

module.exports = router;
