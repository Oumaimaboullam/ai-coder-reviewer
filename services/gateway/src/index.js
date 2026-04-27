/**
 * API Gateway - AI Code Reviewer
 * Port: 3000
 * 
 * Responsabilités:
 * - Point d'entrée unique pour tous les services
 * - Routage des requêtes vers les microservices
 * - Rate limiting global
 * - Validation JWT (optionnel, peut être délégué aux services)
 * - Documentation Swagger
 * - CORS et sécurité
 */

const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { createProxyMiddleware } = require('http-proxy-middleware');
const swaggerUi = require('swagger-ui-express');
const YAML = require('yamljs');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// URLs des services
const SERVICES = {
  auth: process.env.AUTH_SERVICE_URL || 'http://localhost:3001',
  code: process.env.CODE_SERVICE_URL || 'http://localhost:3002',
  ai: process.env.AI_SERVICE_URL || 'http://localhost:3003',
  payment: process.env.PAYMENT_SERVICE_URL || 'http://localhost:3004'
};

// Middleware de sécurité
app.use(helmet({
  contentSecurityPolicy: false // Désactivé pour Swagger UI
}));

// CORS
app.use(cors({
  origin: [
    'http://localhost:5173',
    'http://localhost:5174',
    process.env.FRONTEND_URL
  ].filter(Boolean),
  credentials: true
}));

// Logging
app.use(morgan('combined'));

// Note: Ne PAS utiliser express.json() ici car le gateway est un proxy.
// Le parsing JSON par le gateway consomme le body et empêche sa transmission aux microservices.

// Rate limiting global
const globalLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 100, // 100 requêtes par minute par IP
  message: {
    success: false,
    error: 'Trop de requêtes, veuillez réessayer plus tard'
  },
  standardHeaders: true,
  legacyHeaders: false
});
app.use(globalLimiter);

// Rate limiting spécifique pour l'authentification
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // 10 tentatives
  message: {
    success: false,
    error: 'Trop de tentatives de connexion, veuillez réessayer plus tard'
  }
});

// Documentation Swagger
const swaggerDocument = YAML.load(path.join(__dirname, '../swagger.yaml'));
app.use('/docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'api-gateway',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    services: SERVICES
  });
});

// Routes racine
app.get('/', (req, res) => {
  res.json({
    name: 'AI Code Reviewer API',
    version: '1.0.0',
    documentation: '/docs',
    health: '/health'
  });
});

// Configuration des proxys vers les microservices

// Auth Service (avec rate limiting)
app.use('/api/auth', authLimiter, createProxyMiddleware({
  target: SERVICES.auth,
  changeOrigin: true,
  pathRewrite: {
    '^/api/auth': '/auth'
  },
  timeout: 30000, // 30 secondes
  proxyTimeout: 30000, // 30 secondes
  onError: (err, req, res) => {
    console.error('[ERROR] Erreur proxy Auth:', err.message);
    res.status(503).json({
      success: false,
      error: 'Service d\'authentification indisponible'
    });
  }
}));

// Code Service
app.use('/api/code', createProxyMiddleware({
  target: SERVICES.code,
  changeOrigin: true,
  pathRewrite: {
    '^/api/code': '/code'
  },
  onError: (err, req, res) => {
    console.error('[ERROR] Erreur proxy Code:', err.message);
    res.status(503).json({
      success: false,
      error: 'Service de code indisponible'
    });
  }
}));

// AI Service
app.use('/api/ai', createProxyMiddleware({
  target: SERVICES.ai,
  changeOrigin: true,
  pathRewrite: {
    '^/api/ai': '/ai'
  },
  timeout: 300000, // 5 minutes
  proxyTimeout: 300000, // 5 minutes
  onError: (err, req, res) => {
    console.error('[ERROR] Erreur proxy AI:', err.message);
    res.status(503).json({
      success: false,
      error: 'Service AI indisponible'
    });
  }
}));

// Payment Service
app.use('/api/payment', createProxyMiddleware({
  target: SERVICES.payment,
  changeOrigin: true,
  pathRewrite: {
    '^/api/payment': '/payment'
  },
  onError: (err, req, res) => {
    console.error('[ERROR] Erreur proxy Payment:', err.message);
    res.status(503).json({
      success: false,
      error: 'Service de paiement indisponible'
    });
  }
}));

// 404
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: 'Route non trouvée',
    path: req.path
  });
});

// Gestion globale des erreurs
app.use((err, req, res, next) => {
  console.error('[ERROR] Erreur Gateway:', err.message);
  res.status(500).json({
    success: false,
    error: process.env.NODE_ENV === 'production' 
      ? 'Erreur serveur' 
      : err.message
  });
});

// Démarrage
app.listen(PORT, () => {
  console.log('[INFO] API Gateway démarrée sur le port ${PORT}');
  console.log('[INFO] Documentation: http://localhost:${PORT}/docs');
  console.log('[INFO] Auth Service: ${SERVICES.auth}');
  console.log('[INFO] Code Service: ${SERVICES.code}');
  console.log('[INFO] AI Service: ${SERVICES.ai}');
  console.log('[INFO] Payment Service: ${SERVICES.payment}');
});

module.exports = app;
