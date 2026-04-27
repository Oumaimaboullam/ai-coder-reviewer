import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { CheckCircle, ArrowRight, Crown } from 'lucide-react';

const PaymentSuccess = () => {
  const { refreshUser } = useAuth();

  useEffect(() => {
    // Rafraîchir les informations utilisateur pour mettre à jour le statut premium
    refreshUser();
  }, [refreshUser]);

  return (
    <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center py-12 px-4">
      <div className="max-w-md w-full text-center">
        <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
          <CheckCircle className="h-10 w-10 text-green-600" />
        </div>
        
        <h1 className="text-3xl font-bold mb-4">Paiement réussi !</h1>
        <p className="text-muted-foreground mb-8">
          Félicitations ! Votre compte Premium est maintenant actif. 
          Profitez d'analyses illimitées et de toutes les fonctionnalités premium.
        </p>

        <div className="bg-amber-50 border border-amber-200 rounded-xl p-6 mb-8">
          <div className="flex items-center justify-center space-x-2 mb-2">
            <Crown className="h-6 w-6 text-amber-600" />
            <span className="text-xl font-bold text-amber-800">Premium</span>
          </div>
          <p className="text-amber-700">
            Accès illimité aux analyses de code
          </p>
        </div>

        <div className="space-y-3">
          <Link
            to="/dashboard"
            className="w-full flex items-center justify-center space-x-2 px-6 py-3 bg-primary text-primary-foreground rounded-lg font-medium hover:bg-primary/90"
          >
            <span>Aller au tableau de bord</span>
            <ArrowRight className="h-5 w-5" />
          </Link>
          <Link
            to="/analyze"
            className="w-full flex items-center justify-center space-x-2 px-6 py-3 border rounded-lg font-medium hover:bg-accent"
          >
            <span>Nouvelle analyse</span>
          </Link>
        </div>
      </div>
    </div>
  );
};

export default PaymentSuccess;
