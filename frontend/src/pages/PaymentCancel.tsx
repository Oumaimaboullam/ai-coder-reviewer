import { Link } from 'react-router-dom';
import { XCircle, ArrowLeft, HelpCircle } from 'lucide-react';

const PaymentCancel = () => {
  return (
    <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center py-12 px-4">
      <div className="max-w-md w-full text-center">
        <div className="w-20 h-20 bg-yellow-100 rounded-full flex items-center justify-center mx-auto mb-6">
          <XCircle className="h-10 w-10 text-yellow-600" />
        </div>
        
        <h1 className="text-3xl font-bold mb-4">Paiement annulé</h1>
        <p className="text-muted-foreground mb-8">
          Le paiement a été annulé. Votre compte reste sur le plan gratuit 
          avec 5 analyses par mois.
        </p>

        <div className="space-y-3">
          <Link
            to="/pricing"
            className="w-full flex items-center justify-center space-x-2 px-6 py-3 bg-primary text-primary-foreground rounded-lg font-medium hover:bg-primary/90"
          >
            <span>Retour aux tarifs</span>
          </Link>
          <Link
            to="/dashboard"
            className="w-full flex items-center justify-center space-x-2 px-6 py-3 border rounded-lg font-medium hover:bg-accent"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Tableau de bord</span>
          </Link>
        </div>

        <div className="mt-8 p-4 bg-muted rounded-lg">
          <div className="flex items-center justify-center space-x-2 text-muted-foreground">
            <HelpCircle className="h-4 w-4" />
            <span className="text-sm">Besoin d'aide ?</span>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Contactez-nous à{' '}
            <a href="mailto:support@aicodereviewer.com" className="text-primary hover:underline">
              support@aicodereviewer.com
            </a>
          </p>
        </div>
      </div>
    </div>
  );
};

export default PaymentCancel;
