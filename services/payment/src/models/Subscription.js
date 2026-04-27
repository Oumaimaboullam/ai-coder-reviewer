/**
 * Modèle d'Abonnement pour MongoDB
 * Stocke les informations de souscription Stripe
 */
const mongoose = require('mongoose');

const subscriptionSchema = new mongoose.Schema({
  // Relation utilisateur
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    index: true
  },

  // Identifiants Stripe
  stripeCustomerId: {
    type: String,
    required: true,
    index: true
  },
  stripeSubscriptionId: {
    type: String,
    required: true,
    unique: true
  },

  // Plan d'abonnement
  plan: {
    type: String,
    enum: ['free', 'monthly', 'annual', 'lifetime'],
    required: true
  },

  // Prix
  price: {
    type: Number, // en centimes
    required: true
  },
  currency: {
    type: String,
    default: 'eur'
  },

  // Statut
  status: {
    type: String,
    enum: ['active', 'cancelled', 'past_due', 'unpaid', 'paused'],
    default: 'active'
  },

  // Cycle de facturation
  billingCycle: {
    currentPeriodStart: {
      type: Date,
      required: true
    },
    currentPeriodEnd: {
      type: Date,
      required: true
    },
    renewalDate: {
      type: Date,
      required: true
    }
  },

  // Annulation
  cancelledAt: {
    type: Date,
    default: null
  },
  cancelAtPeriodEnd: {
    type: Boolean,
    default: false
  },

  // Historique des paiements (référence aux invoices)
  invoices: [{
    stripeInvoiceId: String,
    amount: Number,
    status: String,
    paidAt: Date,
    pdfUrl: String
  }]
}, {
  timestamps: true,
  toJSON: {
    transform: function(doc, ret) {
      delete ret.__v;
      return ret;
    }
  }
});

// Index
subscriptionSchema.index({ userId: 1, status: 1 });
subscriptionSchema.index({ stripeSubscriptionId: 1 });

/**
 * Méthode pour vérifier si l'abonnement est actif
 * Un abonnement annulé avec cancelAtPeriodEnd reste actif jusqu'à la fin de la période
 */
subscriptionSchema.methods.isActive = function() {
  return this.status === 'active' && 
         this.billingCycle.currentPeriodEnd > new Date();
};

/**
 * Méthode pour annuler l'abonnement (cancel_at_period_end)
 * L'abonnement reste actif jusqu'à la fin de la période en cours
 */
subscriptionSchema.methods.cancel = async function() {
  this.cancelAtPeriodEnd = true;
  this.cancelledAt = new Date();
  // Le status reste 'active' jusqu'à la fin de la période
  // Il passera à 'cancelled' via le webhook customer.subscription.deleted
  await this.save();
  return this;
};

/**
 * Méthode statique pour trouver l'abonnement actif d'un utilisateur
 */
subscriptionSchema.statics.findActiveByUserId = async function(userId) {
  return await this.findOne({
    userId,
    status: 'active',
    'billingCycle.currentPeriodEnd': { $gt: new Date() }
  });
};

const Subscription = mongoose.model('Subscription', subscriptionSchema);

module.exports = Subscription;
