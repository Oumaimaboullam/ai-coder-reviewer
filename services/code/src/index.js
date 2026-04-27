/**
 * Service de Code - AI Code Reviewer
 * Port: 3002
 * 
 * Responsabilités:
 * - Gestion des soumissions de code
 * - Stockage des analyses en base de données
 * - Historique et statistiques utilisateur
 * - Consommation des événements RabbitMQ
 */

const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
require('dotenv').config();

const connectDB = require('./config/database');
const rabbitmq = require('./config/rabbitmq');
const codeRoutes = require('./routes/code');
const Analysis = require('./models/Analysis');

const app = express();
const PORT = process.env.PORT || 3002;

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(morgan('dev'));

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'code-service',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// Routes
app.use('/code', codeRoutes);

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
 * Met à jour le statut des analyses lorsqu'elles sont complétées ou échouées
 */
const setupEventConsumers = async () => {
  // Consommer les événements d'analyse complétée
  await rabbitmq.consume('code-service-queue', async (event) => {
    console.log(' Événement reçu:', event);

    if (event.type === 'analysis.completed' || event.event === 'analysis.completed') {
      try {
        const { analysisId, result, tokensUsed, executionTime } = event;
        
        await Analysis.findByIdAndUpdate(analysisId, {
          status: 'completed',
          result,
          tokensUsed,
          executionTime,
          updatedAt: new Date()
        });

        console.log('[INFO] Analyse ${analysisId} marquée comme complétée');
      } catch (error) {
        console.error('[ERROR] Erreur mise à jour analyse complétée:', error.message);
      }
    }

    if (event.type === 'analysis.failed' || event.event === 'analysis.failed') {
      try {
        const { analysisId, errorMessage } = event;
        
        await Analysis.findByIdAndUpdate(analysisId, {
          status: 'failed',
          errorMessage,
          updatedAt: new Date()
        });

        console.log('[INFO] Analyse ${analysisId} marquée comme échouée');
      } catch (error) {
        console.error('[ERROR] Erreur mise à jour analyse échouée:', error.message);
      }
    }
  });
};

// Démarrage
const startServer = async () => {
  try {
    await connectDB();
    await rabbitmq.connect();
    await setupEventConsumers();

    app.listen(PORT, () => {
      console.log('[INFO] Code Service démarré sur le port ${PORT}');
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
