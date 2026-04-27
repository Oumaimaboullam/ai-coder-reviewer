import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { 
  Code2, 
  Sparkles, 
  Shield, 
  Zap, 
  ArrowRight,
  Star
} from 'lucide-react';

const Home = () => {
  const { isAuthenticated } = useAuth();

  const features = [
    {
      icon: Sparkles,
      title: 'Analyse IA Intelligente',
      description: 'Notre IA analyse votre code en profondeur pour détecter les erreurs, les vulnérabilités et suggérer des améliorations.',
    },
    {
      icon: Shield,
      title: 'Détection de Sécurité',
      description: 'Identifiez les failles de sécurité critiques avant qu\'elles ne causent des problèmes en production.',
    },
    {
      icon: Zap,
      title: 'Optimisation Performance',
      description: 'Recevez des suggestions pour optimiser la performance et la lisibilité de votre code.',
    },
  ];

  const supportedLanguages = [
    'JavaScript', 'TypeScript', 'Python', 'Java', 'Go', 
    'Rust', 'PHP', 'C++', 'C#', 'Ruby', 'SQL'
  ];

  return (
    <div className="min-h-screen">
      {/* Hero Section */}
      <section className="relative overflow-hidden bg-gradient-to-b from-primary/5 to-background py-20 sm:py-32">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <div className="inline-flex items-center space-x-2 px-4 py-2 rounded-full bg-primary/10 text-primary text-sm font-medium mb-8">
              <Sparkles className="h-4 w-4" />
              <span>Propulsé par OpenAI GPT-4</span>
            </div>
            
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight mb-6">
              Analysez votre code avec
              <span className="text-primary"> l'intelligence artificielle</span>
            </h1>
            
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto mb-10">
              Détectez les erreurs, les vulnérabilités de sécurité et recevez des suggestions 
              d'amélioration pour écrire un code de meilleure qualité.
            </p>
            
            <div className="flex flex-col sm:flex-row items-center justify-center space-y-4 sm:space-y-0 sm:space-x-4">
              {isAuthenticated ? (
                <Link
                  to="/analyze"
                  className="inline-flex items-center space-x-2 px-8 py-4 bg-primary text-primary-foreground rounded-lg font-medium hover:bg-primary/90 transition-colors"
                >
                  <Code2 className="h-5 w-5" />
                  <span>Commencer une analyse</span>
                </Link>
              ) : (
                <>
                  <Link
                    to="/register"
                    className="inline-flex items-center space-x-2 px-8 py-4 bg-primary text-primary-foreground rounded-lg font-medium hover:bg-primary/90 transition-colors"
                  >
                    <span>Essayer gratuitement</span>
                    <ArrowRight className="h-5 w-5" />
                  </Link>
                  <Link
                    to="/pricing"
                    className="inline-flex items-center space-x-2 px-8 py-4 border rounded-lg font-medium hover:bg-accent transition-colors"
                  >
                    <span>Voir les tarifs</span>
                  </Link>
                </>
              )}
            </div>
            
            <p className="mt-4 text-sm text-muted-foreground">
              5 analyses gratuites par mois. Aucune carte de crédit requise.
            </p>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold mb-4">Pourquoi choisir AI Code Reviewer ?</h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              Notre plateforme combine l'intelligence artificielle de pointe avec les meilleures pratiques 
              de développement pour vous aider à écrire du code de qualité.
            </p>
          </div>
          
          <div className="grid md:grid-cols-3 gap-8">
            {features.map((feature, index) => (
              <div
                key={index}
                className="p-8 rounded-2xl bg-card border hover:shadow-lg transition-shadow"
              >
                <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-6">
                  <feature.icon className="h-6 w-6 text-primary" />
                </div>
                <h3 className="text-xl font-semibold mb-3">{feature.title}</h3>
                <p className="text-muted-foreground">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Languages Section */}
      <section className="py-20 bg-muted/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold mb-4">Langages supportés</h2>
            <p className="text-muted-foreground">
              Analysez du code dans plus de 15 langages de programmation différents.
            </p>
          </div>
          
          <div className="flex flex-wrap justify-center gap-4">
            {supportedLanguages.map((lang) => (
              <span
                key={lang}
                className="px-4 py-2 bg-card border rounded-full text-sm font-medium"
              >
                {lang}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold mb-4">Comment ça marche ?</h2>
          </div>
          
          <div className="grid md:grid-cols-4 gap-8">
            {[
              { step: '1', title: 'Collez votre code', desc: 'Copiez-collez votre code dans l\'éditeur' },
              { step: '2', title: 'Sélectionnez le langage', desc: 'Choisissez le langage de programmation' },
              { step: '3', title: 'Lancez l\'analyse', desc: 'Notre IA analyse votre code en quelques secondes' },
              { step: '4', title: 'Recevez les résultats', desc: 'Consultez le score et les suggestions' },
            ].map((item, index) => (
              <div key={index} className="text-center">
                <div className="w-12 h-12 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xl font-bold mx-auto mb-4">
                  {item.step}
                </div>
                <h3 className="font-semibold mb-2">{item.title}</h3>
                <p className="text-sm text-muted-foreground">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing CTA */}
      <section className="py-20 bg-primary text-primary-foreground">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl font-bold mb-4">Prêt à améliorer votre code ?</h2>
          <p className="text-primary-foreground/80 mb-8">
            Commencez gratuitement avec 5 analyses par mois, ou passez Premium pour des analyses illimitées.
          </p>
          
          <div className="flex flex-col sm:flex-row items-center justify-center space-y-4 sm:space-y-0 sm:space-x-4">
            <Link
              to="/pricing"
              className="inline-flex items-center space-x-2 px-8 py-4 bg-white text-primary rounded-lg font-medium hover:bg-white/90 transition-colors"
            >
              <Star className="h-5 w-5" />
              <span>Voir les tarifs</span>
            </Link>
            {!isAuthenticated && (
              <Link
                to="/register"
                className="inline-flex items-center space-x-2 px-8 py-4 border border-white/30 rounded-lg font-medium hover:bg-white/10 transition-colors"
              >
                <span>Créer un compte gratuit</span>
              </Link>
            )}
          </div>
        </div>
      </section>
    </div>
  );
};

export default Home;
