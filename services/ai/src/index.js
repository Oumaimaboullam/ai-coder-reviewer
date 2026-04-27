/**
 * Service AI - AI Code Reviewer
 * Port: 3003
 * 
 * Responsabilités:
 * - Intégration avec OpenRouter (IA cloud)
 * - Fallback sur CodeAnalyzer (analyse statique locale)
 * - Analyse intelligente du code
 * - Traitement asynchrone des demandes d'analyse
 * - Publication des résultats via RabbitMQ
 */

const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
require('dotenv').config();

const rabbitmq = require('./config/rabbitmq');
const aiRoutes = require('./routes/ai');
const aiService = require('./services/aiService');

const app = express();
const PORT = process.env.PORT || 3003;

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(morgan('dev'));

// Health check
app.get('/health', async (req, res) => {
  const aiHealth = await aiService.checkHealth();
  
  res.json({
    status: 'ok',
    service: 'ai-service',
    ai: aiHealth,
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// Routes
app.use('/ai', aiRoutes);

// 404
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: 'Route non trouvée'
  });
});

// Gestion des erreurs
app.use((err, req, res, next) => {
  console.error('[ERROR] Erreur:', err.message);
  res.status(500).json({
    success: false,
    error: process.env.NODE_ENV === 'production' 
      ? 'Erreur serveur' 
      : err.message
  });
});

/**
 * Consommateur d'événements RabbitMQ
 * Traite les demandes d'analyse de code de manière asynchrone
 */
const setupEventConsumers = async () => {
  await rabbitmq.consume('ai-service-queue', async (event) => {
    console.log(' Demande d\'analyse reçue:', event);
    console.log(' Structure de l\'événement:', {
      hasEvent: !!event.event,
      hasType: !!event.type,
      eventValue: event.event,
      typeValue: event.type,
      keys: Object.keys(event)
    });

    // Traiter les événements d'analyse (avec ou sans champ event/type)
    if (event.analysisId && event.userId && event.code && event.language) {
      console.log('[INFO] Condition vérifiée, traitement de l\'analyse...');
      const { analysisId, userId, code, language, context } = event;
      console.log(' Données extraites:', { analysisId, userId, language, hasCode: !!code, hasContext: !!context });

      try {
        console.log(`[INFO] Traitement de l'analyse ${analysisId}...`);

        // Appeler Ollama pour analyser le code
        const result = await aiService.analyzeCode(code, language, context);

        // Publier l'événement de complétion
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

        console.log(`[INFO] Analyse ${analysisId} complétée (score: ${result.score}/10)`);

      } catch (error) {
        console.error(`[ERROR] Erreur analyse ${analysisId}:`, error.message);

        // Publier l'événement d'échec
        await rabbitmq.publishEvent('app-events', 'analysis.failed', {
          event: 'analysis.failed',
          analysisId,
          userId,
          errorMessage: error.message,
          timestamp: new Date().toISOString()
        });
      }
    } else {
      console.log('[INFO] Condition non vérifiée, événement ignoré');
      console.log(' event.event:', event.event);
      console.log(' event.type:', event.type);
    }
  });
};

// Démarrage
const startServer = async () => {
  try {
    // Vérifier la configuration OpenRouter
    if (!process.env.OPENROUTER_API_KEY || process.env.OPENROUTER_API_KEY === 'your_openrouter_api_key_here') {
      console.warn('[WARN] OPENROUTER_API_KEY non configurée ou valeur par défaut utilisée');
    }

    // Vérifier la connexion AI
    const health = await aiService.checkHealth();
    if (health.status !== 'ok') {
      console.error('[ERROR] Connexion AI échouée:', health.error);
      process.exit(1);
    }
    console.log('[INFO] Service AI (OpenRouter) prêt');

    // Connexion RabbitMQ
    await rabbitmq.connect();
    await setupEventConsumers();

    app.listen(PORT, () => {
      console.log(`[INFO] AI Service démarré sur le port ${PORT}`);
      console.log(`[INFO] Modèle principal: ${aiService.MODEL}`);
    });
  } catch (error) {
    console.error('[ERROR] Erreur démarrage serveur:', error.message);
    process.exit(1);
  }
};

// Arrêt gracieux
process.on('SIGTERM', async () => {
  console.log('[INFO] SIGTERM reçu, arrêt gracieux...');
  await rabbitmq.close();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('[INFO] SIGINT reçu, arrêt gracieux...');
  await rabbitmq.close();
  process.exit(0);
});

startServer();
