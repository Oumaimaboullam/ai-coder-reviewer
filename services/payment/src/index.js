/**
 * Service de Paiement - AI Code Reviewer
 * Port: 3004
 * 
 * Responsabilités:
 * - Intégration avec Stripe API
 * - Gestion des abonnements
 * - Webhooks Stripe
 * - Facturation
 */

const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
require('dotenv').config();

const connectDB = require('./config/database');
const rabbitmq = require('./config/rabbitmq');
const paymentRoutes = require('./routes/payment');

const app = express();
const PORT = process.env.PORT || 3004;

// Middleware
app.use(cors());
// Note: express.raw() pour le webhook Stripe est géré directement dans les routes
app.use(express.json({ limit: '10mb' }));
app.use(morgan('dev'));

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'payment-service',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// Routes
app.use('/payment', paymentRoutes);

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

// Démarrage
const startServer = async () => {
  try {
    // Vérifier les clés Stripe
    if (!process.env.STRIPE_SECRET_KEY) {
      console.error('[ERROR] STRIPE_SECRET_KEY non définie');
      process.exit(1);
    }
    if (!process.env.STRIPE_WEBHOOK_SECRET) {
      console.warn('️ STRIPE_WEBHOOK_SECRET non définie - les webhooks ne fonctionneront pas');
    }

    await connectDB();
    await rabbitmq.connect();

    app.listen(PORT, () => {
      console.log('[INFO] Payment Service démarré sur le port ${PORT}');
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
