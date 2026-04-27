/**
 * Service d'Authentification - AI Code Reviewer
 * Port: 3001
 * 
 * Responsabilités:
 * - Gestion des utilisateurs (CRUD)
 * - Authentification JWT (access + refresh tokens)
 * - Hachage des mots de passe avec bcrypt
 * - Publication d'événements RabbitMQ
 */

const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
require('dotenv').config();

const connectDB = require('./config/database');
const rabbitmq = require('./config/rabbitmq');
const authRoutes = require('./routes/auth');
const User = require('./models/User');

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(morgan('dev'));

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'auth-service',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// Routes
app.use('/auth', authRoutes);

// Gestion des erreurs 404
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: 'Route non trouvée'
  });
});

// Gestion spécifique des erreurs JSON parsing
app.use((err, req, res, next) => {
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    return res.status(400).json({
      success: false,
      error: 'JSON invalide',
      details: err.message
    });
  }
  next();
});

// Gestion globale des erreurs
app.use((err, req, res, next) => {
  console.error('[ERROR] Erreur générale:', err.message);
  console.error('[ERROR] Stack:', err.stack);
  res.status(500).json({
    success: false,
    error: process.env.NODE_ENV === 'production' 
      ? 'Erreur serveur' 
      : err.message
  });
});

// Démarrage du serveur
const startServer = async () => {
  try {
    // Connexion à MongoDB
    await connectDB();
    
    // Connexion à RabbitMQ (optionnel, ne bloque pas le démarrage)
    rabbitmq.connect().then(async () => {
      // Consumer pour les événements de paiement (mise à jour premium)
      await rabbitmq.consume('auth-payment-events', async (data) => {
        console.log(' Événement paiement reçu:', data.event);
        
        if (data.event === 'subscription.created' && data.userId) {
          try {
            await User.findByIdAndUpdate(data.userId, {
              isPremium: true,
              premiumStartDate: new Date(),
              creditsRemaining: 999999 // Crédits illimités pour premium
            });
            console.log('[INFO] Utilisateur ${data.userId} passé en Premium');
          } catch (error) {
            console.error('[ERROR] Erreur mise à jour premium pour ${data.userId}:', error.message);
          }
        }
        
        if (data.event === 'subscription.cancelled' && data.userId) {
          try {
            await User.findByIdAndUpdate(data.userId, {
              isPremium: false,
              creditsRemaining: 5 // Retour au plan gratuit
            });
            console.log('[INFO] Utilisateur ${data.userId} repassé en Free');
          } catch (error) {
            console.error('[ERROR] Erreur retrait premium pour ${data.userId}:', error.message);
          }
        }
      });

      // Consumer générique pour les événements d'app
      await rabbitmq.setupConsumer('auth-service-events', 'app-events', 'user.*');
      console.log('[INFO] Consumers RabbitMQ démarrés');
    }).catch(err => {
      console.warn('RabbitMQ non disponible, le service continue sans messaging');
    });

    app.listen(PORT, () => {
      console.log('[INFO] Auth Service démarré sur le port ${PORT}');
      console.log('[INFO] Documentation: http://localhost:${PORT}/auth');
    });
  } catch (error) {
    console.error('[ERROR] Erreur démarrage serveur:', error.message);
    process.exit(1);
  }
};

// Gestion gracieuse de l'arrêt
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
