import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { paymentApi } from '../utils/api';
import { Check, Crown, Loader2, Sparkles, Zap } from 'lucide-react';

const Pricing = () => {
  const navigate = useNavigate();
  const { user, isAuthenticated } = useAuth();
  const [isLoading, setIsLoading] = useState<string | null>(null);

  const plans = [
    {
      id: 'free',
      name: 'Gratuit',
      description: 'Pour découvrir la plateforme',
      price: 0,
      period: '',
      icon: Sparkles,
      features: [
        '5 analyses par mois',
        'Support de 15+ langages',
        'Résultats détaillés',
        'Historique des analyses',
      ],
      cta: 'Commencer gratuitement',
      popular: false,
    },
    {
      id: 'monthly',
      name: 'Premium Mensuel',
      description: 'Pour les développeurs actifs',
      price: 99,
      period: '/mois',
      icon: Zap,
      features: [
        'Analyses illimitées',
        'Support de 15+ langages',
        'Résultats détaillés',
        'Historique illimité',
        'Support prioritaire',
        'Rapports PDF',
      ],
      cta: 'Choisir mensuel',
      popular: false,
    },
    {
      id: 'annual',
      name: 'Premium Annuel',
      description: 'Le meilleur rapport qualité-prix',
      price: 990,
      period: '/an',
      icon: Crown,
      features: [
        'Analyses illimitées',
        'Support de 15+ langages',
        'Résultats détaillés',
        'Historique illimité',
        'Support prioritaire',
        'Rapports PDF',
        'Économisez 17% (équivalent à 2 mois gratuits)',
      ],
      cta: 'Choisir annuel',
      popular: true,
    },
  ];

  const handleSubscribe = async (planId: string) => {
    console.log('handleSubscribe appelé avec planId:', planId);
    console.log('isAuthenticated:', isAuthenticated);
    
    if (planId === 'free') {
      console.log('Plan gratuit sélectionné');
      if (!isAuthenticated) {
        console.log('Non authentifié, redirection vers /register');
        navigate('/register');
      }
      return;
    }

    if (!isAuthenticated) {
      console.log('Non authentifié, redirection vers /register');
      navigate('/register');
      return;
    }

    console.log('Début du processus de paiement pour le plan:', planId);
    setIsLoading(planId);

    try {
      console.log('Appel API de paiement...');
      const response = await paymentApi.createCheckout({
        plan: planId as 'monthly' | 'annual',
      });

      console.log('Réponse API reçue:', response);
      console.log('URL de checkout:', response.data.data.checkoutUrl);

      // Rediriger vers Stripe Checkout
      console.log('Redirection vers Stripe Checkout...');
      window.location.href = response.data.data.checkoutUrl;
    } catch (error: any) {
      console.error('Error creating checkout:', error);
      console.error('Détails de l\'erreur:', error.response?.data || error.message);
      
      // Afficher l'erreur détaillée pour le debugging
      if (error.response?.data) {
        console.error('Réponse serveur complète:', error.response.data);
        const errorMsg = error.response.data.error || JSON.stringify(error.response.data);
        alert(`Erreur: ${errorMsg}`);
      } else {
        alert('Erreur lors de la création du paiement. Veuillez réessayer.');
      }
    } finally {
      setIsLoading(null);
    }
  };

  const isCurrentPlan = (planId: string) => {
    if (planId === 'free') return !user?.isPremium;
    return false; // Simplifié - à adapter selon les besoins
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
      {/* Header */}
      <div className="text-center mb-16">
        <h1 className="text-4xl font-bold mb-4">Choisissez votre plan</h1>
        <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
          Commencez gratuitement et passez à Premium quand vous êtes prêt.
          Annulation possible à tout moment.
        </p>
      </div>

      {/* Pricing Cards */}
      <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto">
        {plans.map((plan) => (
          <div
            key={plan.id}
            className={`relative rounded-2xl border p-8 ${
              plan.popular
                ? 'border-primary shadow-lg scale-105'
                : 'border-border'
            }`}
          >
            {plan.popular && (
              <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                <span className="px-4 py-1 bg-primary text-primary-foreground text-sm font-medium rounded-full">
                  Le plus populaire
                </span>
              </div>
            )}

            <div className="text-center mb-8">
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center mx-auto mb-4 ${
                plan.popular ? 'bg-primary' : 'bg-muted'
              }`}>
                <plan.icon className={`h-6 w-6 ${plan.popular ? 'text-primary-foreground' : 'text-muted-foreground'}`} />
              </div>
              <h3 className="text-xl font-semibold">{plan.name}</h3>
              <p className="text-muted-foreground text-sm mt-1">{plan.description}</p>
              <div className="mt-4">
                <span className="text-4xl font-bold">{plan.price === 0 ? 'Gratuit' : `${plan.price}DH`}</span>
                {plan.period && (
                  <span className="text-muted-foreground">{plan.period}</span>
                )}
              </div>
            </div>

            <ul className="space-y-4 mb-8">
              {plan.features.map((feature, index) => (
                <li key={index} className="flex items-center space-x-3">
                  <Check className="h-5 w-5 text-green-500 flex-shrink-0" />
                  <span className="text-sm">{feature}</span>
                </li>
              ))}
            </ul>

            <button
              onClick={() => handleSubscribe(plan.id)}
              disabled={isLoading === plan.id || isCurrentPlan(plan.id)}
              className={`w-full py-3 px-4 rounded-lg font-medium transition-colors ${
                plan.popular
                  ? 'bg-primary text-primary-foreground hover:bg-primary/90'
                  : 'border hover:bg-accent'
              } ${isCurrentPlan(plan.id) ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              {isLoading === plan.id ? (
                <span className="flex items-center justify-center space-x-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Chargement...</span>
                </span>
              ) : isCurrentPlan(plan.id) ? (
                'Plan actuel'
              ) : (
                plan.cta
              )}
            </button>
          </div>
        ))}
      </div>

      {/* FAQ */}
      <div className="max-w-3xl mx-auto mt-20">
        <h2 className="text-2xl font-bold text-center mb-8">Questions fréquentes</h2>
        <div className="space-y-6">
          {[
            {
              q: 'Puis-je changer de plan à tout moment ?',
              a: 'Oui, vous pouvez passer du plan gratuit à Premium à tout moment. Vous pouvez également annuler votre abonnement Premium quand vous voulez.',
            },
            {
              q: 'Comment fonctionnent les crédits ?',
              a: 'Avec le plan gratuit, vous recevez 5 crédits par mois. Chaque analyse utilise 1 crédit. Les crédits sont réinitialisés chaque mois.',
            },
            {
              q: 'Quels moyens de paiement acceptez-vous ?',
              a: 'Nous acceptons toutes les cartes de crédit principales via Stripe, notre partenaire de paiement sécurisé.',
            },
            {
              q: 'Mes données sont-elles sécurisées ?',
              a: 'Absolument. Votre code n\'est stocké que si vous le souhaitez, et toutes les communications sont chiffrées avec HTTPS.',
            },
          ].map((faq, index) => (
            <div key={index} className="border-b pb-6">
              <h3 className="font-semibold mb-2">{faq.q}</h3>
              <p className="text-muted-foreground">{faq.a}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default Pricing;
