/**
 * Service Stripe pour la gestion des paiements
 * Gère les abonnements, les webhooks et la facturation
 */
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

// Cache des Price IDs Stripe pour éviter de recréer des prix à chaque checkout
const priceCache = {};

// Configuration des prix (en centimes)
const PRICES = {
  monthly: {
    amount: 9900, // 99 MAD en centimes
    name: 'Premium Mensuel',
    description: 'Accès illimité à l\'analyse de code'
  },
  annual: {
    amount: 99000, // 990 MAD en centimes
    name: 'Premium Annuel',
    description: 'Accès illimité à l\'analyse de code - économie de 17% (2 mois gratuits)'
  },
  lifetime: {
    amount: 299900, // 2999 MAD en centimes
    name: 'Premium À Vie',
    description: 'Accès illimité à vie à l\'analyse de code'
  }
};

/**
 * Créer un client Stripe
 * @param {Object} user - Utilisateur (email, nom)
 * @returns {Promise<string>} ID du client Stripe
 */
const createCustomer = async (user) => {
  try {
    const customer = await stripe.customers.create({
      email: user.email,
      name: `${user.firstName} ${user.lastName}`,
      metadata: {
        userId: user.id
      }
    });

    console.log('[INFO] Client Stripe créé: ${customer.id}');
    return customer.id;
  } catch (error) {
    console.error('[ERROR] Erreur création client Stripe:', error.message);
    throw error;
  }
};

/**
 * Créer une session de checkout Stripe
 * @param {string} customerId - ID du client Stripe
 * @param {string} plan - Plan choisi (monthly, annual, lifetime)
 * @param {string} successUrl - URL de redirection après succès
 * @param {string} cancelUrl - URL de redirection après annulation
 * @returns {Promise<Object>} Session de checkout
 */
const createCheckoutSession = async (customerId, plan, successUrl, cancelUrl, userId) => {
  try {
    const priceConfig = PRICES[plan];
    if (!priceConfig) {
      throw new Error('Plan invalide');
    }

    // Utiliser un prix caché ou en créer un nouveau
    let priceId = priceCache[plan];
    if (!priceId) {
      const price = await stripe.prices.create({
        unit_amount: priceConfig.amount,
        currency: 'mad',
        product_data: {
          name: priceConfig.name
        },
        recurring: plan === 'lifetime' ? undefined : {
          interval: plan === 'monthly' ? 'month' : 'year'
        }
      });
      priceId = price.id;
      priceCache[plan] = priceId;
    }

    const sessionConfig = {
      customer: customerId,
      payment_method_types: ['card'],
      line_items: [{
        price: priceId,
        quantity: 1
      }],
      mode: plan === 'lifetime' ? 'payment' : 'subscription',
      success_url: successUrl,
      cancel_url: cancelUrl,
      metadata: {
        plan,
        userId: userId || ''
      }
    };

    const session = await stripe.checkout.sessions.create(sessionConfig);

    console.log('[INFO] Session checkout créée: ${session.id}');
    return session;
  } catch (error) {
    console.error('[ERROR] Erreur création session checkout:', error.message);
    throw error;
  }
};

/**
 * Récupérer les détails d'un abonnement
 * @param {string} subscriptionId - ID de l'abonnement Stripe
 * @returns {Promise<Object>} Détails de l'abonnement
 */
const getSubscription = async (subscriptionId) => {
  try {
    const subscription = await stripe.subscriptions.retrieve(subscriptionId);
    return subscription;
  } catch (error) {
    console.error('[ERROR] Erreur récupération abonnement:', error.message);
    throw error;
  }
};

/**
 * Annuler un abonnement
 * @param {string} subscriptionId - ID de l'abonnement Stripe
 * @returns {Promise<Object>} Abonnement annulé
 */
const cancelSubscription = async (subscriptionId) => {
  try {
    const subscription = await stripe.subscriptions.update(subscriptionId, {
      cancel_at_period_end: true
    });

    console.log('[INFO] Abonnement ${subscriptionId} marqué pour annulation');
    return subscription;
  } catch (error) {
    console.error('[ERROR] Erreur annulation abonnement:', error.message);
    throw error;
  }
};

/**
 * Réactiver un abonnement annulé
 * @param {string} subscriptionId - ID de l'abonnement Stripe
 * @returns {Promise<Object>} Abonnement réactivé
 */
const reactivateSubscription = async (subscriptionId) => {
  try {
    const subscription = await stripe.subscriptions.update(subscriptionId, {
      cancel_at_period_end: false
    });

    console.log('[INFO] Abonnement ${subscriptionId} réactivé');
    return subscription;
  } catch (error) {
    console.error('[ERROR] Erreur réactivation abonnement:', error.message);
    throw error;
  }
};

/**
 * Récupérer les factures d'un client
 * @param {string} customerId - ID du client Stripe
 * @returns {Promise<Array>} Liste des factures
 */
const getInvoices = async (customerId) => {
  try {
    const invoices = await stripe.invoices.list({
      customer: customerId,
      limit: 100
    });

    return invoices.data.map(invoice => ({
      id: invoice.id,
      amount: invoice.amount_due,
      status: invoice.status,
      paidAt: invoice.status === 'paid' ? new Date(invoice.status_transitions.paid_at * 1000) : null,
      pdfUrl: invoice.invoice_pdf,
      createdAt: new Date(invoice.created * 1000)
    }));
  } catch (error) {
    console.error('[ERROR] Erreur récupération factures:', error.message);
    throw error;
  }
};

/**
 * Vérifier la signature d'un webhook Stripe
 * @param {string} payload - Corps de la requête
 * @param {string} signature - Signature Stripe
 * @returns {Object} Événement décodé
 */
const constructWebhookEvent = (payload, signature) => {
  try {
    const event = stripe.webhooks.constructEvent(
      payload,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET
    );
    return event;
  } catch (error) {
    console.error('[ERROR] Erreur vérification webhook:', error.message);
    throw error;
  }
};

/**
 * Créer un portail client Stripe
 * @param {string} customerId - ID du client Stripe
 * @param {string} returnUrl - URL de retour
 * @returns {Promise<string>} URL du portail
 */
const createCustomerPortal = async (customerId, returnUrl) => {
  try {
    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: returnUrl
    });

    return session.url;
  } catch (error) {
    console.error('[ERROR] Erreur création portail client:', error.message);
    throw error;
  }
};

module.exports = {
  createCustomer,
  createCheckoutSession,
  getSubscription,
  cancelSubscription,
  reactivateSubscription,
  getInvoices,
  constructWebhookEvent,
  createCustomerPortal,
  PRICES
};
