/**
 * Routes pour le service de paiement
 * Gère les abonnements Stripe et les webhooks
 */
const express = require('express');
const { body, validationResult } = require('express-validator');
const axios = require('axios');
const Subscription = require('../models/Subscription');
const stripeService = require('../services/stripeService');
const rabbitmq = require('../config/rabbitmq');

const router = express.Router();

// Configuration
const AUTH_SERVICE_URL = process.env.AUTH_SERVICE_URL || 'http://localhost:3001';
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';

/**
 * Middleware pour vérifier le token JWT
 */
const verifyToken = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        error: 'Token d\'authentification requis'
      });
    }

    const token = authHeader.split(' ')[1];

    try {
      const response = await axios.get(`${AUTH_SERVICE_URL}/auth/me`, {
        headers: { Authorization: `Bearer ${token}` },
        timeout: 5000
      });

      req.user = response.data.user;
      next();
    } catch (error) {
      if (error.response) {
        return res.status(error.response.status).json(error.response.data);
      }
      throw error;
    }
  } catch (error) {
    console.error('[ERROR] Erreur vérification token:', error.message);
    return res.status(401).json({
      success: false,
      error: 'Token invalide'
    });
  }
};

/**
 * @route   POST /payment/create-checkout
 * @desc    Créer une session de checkout Stripe
 * @access  Private
 */
router.post('/create-checkout', verifyToken, [
  body('plan')
    .isIn(['monthly', 'annual', 'lifetime'])
    .withMessage('Plan invalide (monthly, annual, lifetime)'),
  body('successUrl')
    .optional()
    .isURL(),
  body('cancelUrl')
    .optional()
    .isURL()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array().map(e => ({ field: e.path, message: e.msg }))
      });
    }

    const user = req.user;
    const { plan, successUrl, cancelUrl } = req.body;

    // Vérifier si l'utilisateur a déjà un abonnement actif
    console.log(`[INFO] Vérification abonnement pour utilisateur ${user.id}`);
    const existingSubscription = await Subscription.findActiveByUserId(user.id);
    console.log('[INFO] Abonnement existant:', existingSubscription ? 'OUI' : 'NON');
    
    if (existingSubscription) {
      console.log(`[INFO] ERREUR 400: Utilisateur ${user.id} a déjà un abonnement actif`);
      return res.status(400).json({
        success: false,
        error: 'Vous avez déjà un abonnement actif',
        subscription: {
          plan: existingSubscription.plan,
          status: existingSubscription.status,
          currentPeriodEnd: existingSubscription.billingCycle.currentPeriodEnd
        }
      });
    }

    // Créer ou récupérer le client Stripe
    // Note: stripeCustomerId n'est pas stocké dans le user model,
    // donc on crée toujours un nouveau client Stripe si nécessaire
    const stripeCustomerId = await stripeService.createCustomer(user);

    // Créer la session de checkout avec userId dans les metadata
    const session = await stripeService.createCheckoutSession(
      stripeCustomerId,
      plan,
      successUrl || `${FRONTEND_URL}/payment/success`,
      cancelUrl || `${FRONTEND_URL}/payment/cancel`,
      user.id
    );

    res.json({
      success: true,
      data: {
        sessionId: session.id,
        checkoutUrl: session.url
      }
    });

  } catch (error) {
    console.error('[ERROR] Erreur création checkout:', error.message);
    res.status(500).json({
      success: false,
      error: 'Erreur lors de la création de la session de paiement'
    });
  }
});

/**
 * @route   POST /payment/webhook
 * @desc    Webhook Stripe pour les événements de paiement
 * @access  Public (vérifié par signature Stripe)
 */
router.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  try {
    const signature = req.headers['stripe-signature'];
    
    if (!signature) {
      return res.status(400).json({ error: 'Signature manquante' });
    }

    // Vérifier et décoder l'événement
    let event;
    try {
      event = stripeService.constructWebhookEvent(req.body, signature);
    } catch (error) {
      console.error('[ERROR] Webhook signature invalide:', error.message);
      return res.status(400).json({ error: 'Signature invalide' });
    }

    console.log('[INFO] Webhook Stripe reçu: ${event.type}');

    // Traiter les événements
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object;
        
        // Récupérer les détails de l'abonnement
        if (session.subscription) {
          const subscription = await stripeService.getSubscription(session.subscription);
          
          // Créer l'abonnement en base
          const newSubscription = new Subscription({
            userId: session.metadata.userId,
            stripeCustomerId: session.customer,
            stripeSubscriptionId: session.subscription,
            plan: session.metadata.plan,
            price: subscription.items.data[0].price.unit_amount,
            currency: subscription.currency,
            status: 'active',
            billingCycle: {
              currentPeriodStart: new Date(subscription.current_period_start * 1000),
              currentPeriodEnd: new Date(subscription.current_period_end * 1000),
              renewalDate: new Date(subscription.current_period_end * 1000)
            }
          });

          await newSubscription.save();

          // Publier l'événement
          await rabbitmq.publishEvent('payment-events', 'subscription.created', {
            event: 'subscription.created',
            userId: session.metadata.userId,
            subscriptionId: newSubscription._id,
            plan: session.metadata.plan,
            timestamp: new Date().toISOString()
          });

          console.log('[INFO] Abonnement créé pour ${session.customer}');
        }
        break;
      }

      case 'customer.subscription.updated': {
        const subscription = event.data.object;
        
        await Subscription.findOneAndUpdate(
          { stripeSubscriptionId: subscription.id },
          {
            status: subscription.status,
            'billingCycle.currentPeriodStart': new Date(subscription.current_period_start * 1000),
            'billingCycle.currentPeriodEnd': new Date(subscription.current_period_end * 1000),
            'billingCycle.renewalDate': new Date(subscription.current_period_end * 1000),
            cancelAtPeriodEnd: subscription.cancel_at_period_end
          }
        );

        await rabbitmq.publishEvent('payment-events', 'subscription.updated', {
          event: 'subscription.updated',
          stripeSubscriptionId: subscription.id,
          status: subscription.status,
          timestamp: new Date().toISOString()
        });

        console.log('[INFO] Abonnement ${subscription.id} mis à jour');
        break;
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object;
        
        await Subscription.findOneAndUpdate(
          { stripeSubscriptionId: subscription.id },
          {
            status: 'cancelled',
            cancelledAt: new Date()
          }
        );

        await rabbitmq.publishEvent('payment-events', 'subscription.cancelled', {
          event: 'subscription.cancelled',
          stripeSubscriptionId: subscription.id,
          timestamp: new Date().toISOString()
        });

        console.log('[INFO] Abonnement ${subscription.id} annulé');
        break;
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object;
        
        console.log('[INFO] ️ Paiement échoué pour ${invoice.customer}');
        
        await rabbitmq.publishEvent('payment-events', 'payment.failed', {
          event: 'payment.failed',
          stripeCustomerId: invoice.customer,
          invoiceId: invoice.id,
          timestamp: new Date().toISOString()
        });
        break;
      }

      case 'invoice.paid': {
        const invoice = event.data.object;
        
        // Ajouter la facture à l'abonnement
        await Subscription.findOneAndUpdate(
          { stripeCustomerId: invoice.customer },
          {
            $push: {
              invoices: {
                stripeInvoiceId: invoice.id,
                amount: invoice.amount_paid,
                status: 'paid',
                paidAt: new Date(),
                pdfUrl: invoice.invoice_pdf
              }
            }
          }
        );

        console.log('[INFO] Facture ${invoice.id} payée');
        break;
      }
    }

    res.json({ received: true });

  } catch (error) {
    console.error('[ERROR] Erreur webhook:', error.message);
    res.status(500).json({ error: 'Erreur traitement webhook' });
  }
});

/**
 * @route   GET /payment/subscription
 * @desc    Récupérer les informations de l'abonnement
 * @access  Private
 */
router.get('/subscription', verifyToken, async (req, res) => {
  try {
    const user = req.user;

    const subscription = await Subscription.findOne({ userId: user.id })
      .sort({ createdAt: -1 });

    if (!subscription) {
      return res.json({
        success: true,
        data: {
          hasSubscription: false,
          plan: 'free',
          isPremium: user.isPremium
        }
      });
    }

    res.json({
      success: true,
      data: {
        hasSubscription: true,
        plan: subscription.plan,
        status: subscription.status,
        isActive: subscription.isActive(),
        currentPeriodStart: subscription.billingCycle.currentPeriodStart,
        currentPeriodEnd: subscription.billingCycle.currentPeriodEnd,
        renewalDate: subscription.billingCycle.renewalDate,
        cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
        cancelledAt: subscription.cancelledAt
      }
    });

  } catch (error) {
    console.error('[ERROR] Erreur récupération abonnement:', error.message);
    res.status(500).json({
      success: false,
      error: 'Erreur serveur'
    });
  }
});

/**
 * @route   DELETE /payment/cancel-subscription
 * @desc    Annuler l'abonnement
 * @access  Private
 */
router.delete('/cancel-subscription', verifyToken, async (req, res) => {
  try {
    const user = req.user;

    const subscription = await Subscription.findActiveByUserId(user.id);
    if (!subscription) {
      return res.status(404).json({
        success: false,
        error: 'Aucun abonnement actif trouvé'
      });
    }

    // Annuler chez Stripe
    await stripeService.cancelSubscription(subscription.stripeSubscriptionId);

    // Mettre à jour en base
    await subscription.cancel();

    // Publier l'événement
    await rabbitmq.publishEvent('payment-events', 'subscription.cancelled', {
      event: 'subscription.cancelled',
      userId: user.id,
      subscriptionId: subscription._id,
      timestamp: new Date().toISOString()
    });

    res.json({
      success: true,
      message: 'Abonnement annulé avec succès',
      data: {
        cancelAtPeriodEnd: true,
        currentPeriodEnd: subscription.billingCycle.currentPeriodEnd
      }
    });

  } catch (error) {
    console.error('[ERROR] Erreur annulation abonnement:', error.message);
    res.status(500).json({
      success: false,
      error: 'Erreur lors de l\'annulation'
    });
  }
});

/**
 * @route   GET /payment/invoices
 * @desc    Récupérer l'historique des factures
 * @access  Private
 */
router.get('/invoices', verifyToken, async (req, res) => {
  try {
    const user = req.user;

    const subscription = await Subscription.findOne({ userId: user.id })
      .sort({ createdAt: -1 });

    if (!subscription) {
      return res.json({
        success: true,
        data: {
          invoices: []
        }
      });
    }

    // Récupérer les factures depuis Stripe
    const invoices = await stripeService.getInvoices(subscription.stripeCustomerId);

    res.json({
      success: true,
      data: {
        invoices
      }
    });

  } catch (error) {
    console.error('[ERROR] Erreur récupération factures:', error.message);
    res.status(500).json({
      success: false,
      error: 'Erreur serveur'
    });
  }
});

/**
 * @route   POST /payment/portal
 * @desc    Créer une session du portail client Stripe
 * @access  Private
 */
router.post('/portal', verifyToken, async (req, res) => {
  try {
    const user = req.user;

    const subscription = await Subscription.findOne({ userId: user.id });
    if (!subscription) {
      return res.status(404).json({
        success: false,
        error: 'Aucun abonnement trouvé'
      });
    }

    const portalUrl = await stripeService.createCustomerPortal(
      subscription.stripeCustomerId,
      `${FRONTEND_URL}/dashboard`
    );

    res.json({
      success: true,
      data: {
        portalUrl
      }
    });

  } catch (error) {
    console.error('[ERROR] Erreur création portail:', error.message);
    res.status(500).json({
      success: false,
      error: 'Erreur serveur'
    });
  }
});

module.exports = router;
