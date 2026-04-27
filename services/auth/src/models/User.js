/**
 * Modèle Utilisateur pour MongoDB
 * Gère les données d'authentification et le profil utilisateur
 */
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  // Informations d'authentification
  email: {
    type: String,
    required: [true, 'L\'email est requis'],
    unique: true,
    lowercase: true,
    trim: true,
    match: [/^\S+@\S+\.\S+$/, 'Format d\'email invalide']
  },
  passwordHash: {
    type: String,
    required: [true, 'Le mot de passe est requis'],
    minlength: [60, 'Hash invalide']
  },

  // Profil utilisateur
  firstName: {
    type: String,
    required: [true, 'Le prénom est requis'],
    trim: true,
    maxlength: [50, 'Le prénom ne peut dépasser 50 caractères']
  },
  lastName: {
    type: String,
    required: [true, 'Le nom est requis'],
    trim: true,
    maxlength: [50, 'Le nom ne peut dépasser 50 caractères']
  },
  avatar: {
    type: String,
    default: null
  },

  // Statut d'abonnement
  isPremium: {
    type: Boolean,
    default: false
  },
  premiumStartDate: {
    type: Date,
    default: null
  },
  premiumEndDate: {
    type: Date,
    default: null
  },
  subscriptionId: {
    type: String,
    default: null
  },

  // Système de crédits (freemium)
  creditsRemaining: {
    type: Number,
    default: 5,
    min: 0,
    max: 999999
  },
  creditsResetDate: {
    type: Date,
    default: () => {
      const date = new Date();
      date.setMonth(date.getMonth() + 1);
      return date;
    }
  },

  // Tokens de rafraîchissement (pour la déconnexion à distance)
  refreshTokens: [{
    token: String,
    createdAt: { type: Date, default: Date.now },
    expiresAt: Date
  }],

  // Préférences utilisateur
  preferences: {
    emailNotifications: { type: Boolean, default: true },
    darkMode: { type: Boolean, default: false },
    language: { type: String, default: 'fr' }
  },

  // Audit
  lastLoginAt: {
    type: Date,
    default: null
  },
  deletedAt: {
    type: Date,
    default: null
  }
}, {
  timestamps: true, // Ajoute createdAt et updatedAt automatiquement
  toJSON: {
    transform: function(doc, ret) {
      delete ret.passwordHash;
      delete ret.refreshTokens;
      delete ret.__v;
      return ret;
    }
  }
});

// Index pour améliorer les performances
userSchema.index({ email: 1 });
userSchema.index({ isPremium: 1 });
userSchema.index({ creditsResetDate: 1 });

/**
 * Méthode pour vérifier si les crédits doivent être réinitialisés
 * Appelée automatiquement lors de la récupération d'un utilisateur
 */
userSchema.methods.checkAndResetCredits = async function() {
  const now = new Date();
  if (now > this.creditsResetDate && !this.isPremium) {
    this.creditsRemaining = 5;
    this.creditsResetDate = new Date(now.setMonth(now.getMonth() + 1));
    await this.save();
  }
  return this;
};

/**
 * Méthode pour utiliser des crédits
 */
userSchema.methods.useCredits = async function(amount = 1) {
  if (this.isPremium) return true; // Premium = illimité
  
  if (this.creditsRemaining >= amount) {
    this.creditsRemaining -= amount;
    await this.save();
    return true;
  }
  return false;
};

/**
 * Méthode pour activer le statut premium
 */
userSchema.methods.activatePremium = async function(subscriptionId, endDate) {
  this.isPremium = true;
  this.subscriptionId = subscriptionId;
  this.premiumStartDate = new Date();
  this.premiumEndDate = endDate;
  await this.save();
  return this;
};

/**
 * Méthode pour désactiver le statut premium
 */
userSchema.methods.deactivatePremium = async function() {
  this.isPremium = false;
  this.subscriptionId = null;
  this.premiumEndDate = null;
  // Réinitialise les crédits pour le mode gratuit
  this.creditsRemaining = 5;
  await this.save();
  return this;
};

const User = mongoose.model('User', userSchema);

module.exports = User;
