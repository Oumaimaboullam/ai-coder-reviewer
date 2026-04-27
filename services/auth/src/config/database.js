/**
 * Configuration de la connexion MongoDB pour le service d'authentification
 * Utilise Mongoose pour la modélisation des données
 */
const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGODB_URI, {
      // Options de connexion recommandées pour MongoDB
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    });

    console.log('[INFO] MongoDB connectée: ${conn.connection.host}');
    return conn;
  } catch (error) {
    console.error('[ERROR] Erreur de connexion MongoDB:', error.message);
    process.exit(1);
  }
};

module.exports = connectDB;
