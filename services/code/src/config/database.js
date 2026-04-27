/**
 * Configuration MongoDB pour le service de code
 */
const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGODB_URI, {
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    });

    console.log('[INFO] MongoDB Code Service connectée: ${conn.connection.host}');
    return conn;
  } catch (error) {
    console.error('[ERROR] Erreur connexion MongoDB:', error.message);
    process.exit(1);
  }
};

module.exports = connectDB;
