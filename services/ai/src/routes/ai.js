/**
 * Routes pour le service AI
 * Permet d'analyser du code directement via l'API
 */
const express = require('express');
const { body, validationResult } = require('express-validator');
const aiService = require('../services/aiService');
const rabbitmq = require('../config/rabbitmq');

const router = express.Router();

/**
 * @route   POST /ai/analyze
 * @desc    Analyser du code via OpenRouter (endpoint direct)
 * @access  Private (nécessite validation via gateway)
 */
router.post('/analyze', [
  body('code')
    .isLength({ min: 10, max: 50000 })
    .withMessage('Le code doit faire entre 10 et 50000 caractères'),
  body('language')
    .isIn(aiService.getSupportedLanguages())
    .withMessage('Langage non supporté'),
  body('context')
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

    const { code, language, context, analysisId, userId } = req.body;

    console.log(`[INFO] Analyse demandée pour ${language} (${code.length} caractères)`);

    // Appeler le service Ollama
    const result = await aiService.analyzeCode(code, language, context);

    // Si analysisId est fourni, publier l'événement de complétion
    if (analysisId) {
      await rabbitmq.publishEvent('app-events', 'analysis.completed', {
        event: 'analysis.completed',
        analysisId,
        userId,
        result: {
          score: result.score,
          scoreBreakdown: result.scoreBreakdown,
          errors: result.errors,
          warnings: result.warnings,
          suggestions: result.suggestions,
          securityIssues: result.securityIssues,
          summary: result.summary
        },
        tokensUsed: result.tokensUsed,
        executionTime: result.executionTime,
        timestamp: new Date().toISOString()
      });
    }

    res.json({
      success: true,
      data: result
    });

  } catch (error) {
    console.error('[ERROR] Erreur analyse:', error.message);
    
    // Publier l'événement d'échec si analysisId est fourni
    if (req.body.analysisId) {
      await rabbitmq.publishEvent('app-events', 'analysis.failed', {
        event: 'analysis.failed',
        analysisId: req.body.analysisId,
        userId: req.body.userId,
        errorMessage: error.message,
        timestamp: new Date().toISOString()
      });
    }

    res.status(500).json({
      success: false,
      error: 'Erreur lors de l\'analyse du code',
      message: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * @route   GET /ai/languages
 * @desc    Récupérer la liste des langages supportés
 * @access  Public
 */
router.get('/languages', (req, res) => {
  const languages = aiService.getSupportedLanguages();
  
  res.json({
    success: true,
    data: {
      languages,
      model: aiService.MODEL
    }
  });
});

/**
 * @route   GET /ai/health
 * @desc    Vérifier l'état du service AI (OpenRouter)
 * @access  Public
 */
router.get('/health', async (req, res) => {
  const health = await aiService.checkHealth();
  
  res.status(health.status === 'ok' ? 200 : 503).json({
    success: health.status === 'ok',
    data: health
  });
});

module.exports = router;
