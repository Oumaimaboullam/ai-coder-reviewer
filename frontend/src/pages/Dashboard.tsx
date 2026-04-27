import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { codeApi } from '../utils/api';
import { UserStats, AnalysisSummary } from '../types';
import { 
  Code2, 
  TrendingUp, 
  AlertCircle, 
  CheckCircle, 
  Clock, 
  Crown,
  Plus,
  ArrowRight,
  BarChart3
} from 'lucide-react';

const Dashboard = () => {
  const { user } = useAuth();
  const [stats, setStats] = useState<UserStats | null>(null);
  const [recentAnalyses, setRecentAnalyses] = useState<AnalysisSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [statsRes, historyRes] = await Promise.all([
          codeApi.getStats(),
          codeApi.getHistory({ limit: 5 }),
        ]);
        setStats(statsRes.data.data);
        setRecentAnalyses(historyRes.data.data.analyses);
      } catch (error) {
        console.error('Error fetching dashboard data:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, []);

  if (isLoading) {
    return (
      <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold">
          Bonjour, {user?.firstName} !
        </h1>
        <p className="text-muted-foreground mt-1">
          Voici un aperçu de votre activité
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {/* Total Analyses */}
        <div className="bg-card border rounded-xl p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Total analyses</p>
              <p className="text-3xl font-bold mt-1">{stats?.totalAnalyses || 0}</p>
            </div>
            <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center">
              <Code2 className="h-6 w-6 text-primary" />
            </div>
          </div>
        </div>

        {/* Average Score */}
        <div className="bg-card border rounded-xl p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Score moyen</p>
              <p className="text-3xl font-bold mt-1">
                {stats?.averageScore?.toFixed(1) || '0.0'}/10
              </p>
            </div>
            <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center">
              <TrendingUp className="h-6 w-6 text-green-600" />
            </div>
          </div>
        </div>

        {/* Errors Found */}
        <div className="bg-card border rounded-xl p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Erreurs trouvées</p>
              <p className="text-3xl font-bold mt-1">{stats?.totalErrors || 0}</p>
            </div>
            <div className="w-12 h-12 bg-red-100 rounded-xl flex items-center justify-center">
              <AlertCircle className="h-6 w-6 text-red-600" />
            </div>
n          </div>
        </div>

        {/* Credits / Premium */}
        <div className="bg-card border rounded-xl p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">
                {user?.isPremium ? 'Abonnement' : 'Crédits restants'}
              </p>
              <p className="text-3xl font-bold mt-1">
                {user?.isPremium ? (
                  <span className="flex items-center text-amber-600">
                    <Crown className="h-6 w-6 mr-1" />
                    Premium
                  </span>
                ) : (
                  stats?.creditsRemaining || 0
                )}
              </p>
            </div>
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
              user?.isPremium ? 'bg-amber-100' : 'bg-blue-100'
            }`}>
              {user?.isPremium ? (
                <Crown className="h-6 w-6 text-amber-600" />
              ) : (
                <BarChart3 className="h-6 w-6 text-blue-600" />
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Main Content Grid */}
      <div className="grid lg:grid-cols-3 gap-8">
        {/* Recent Analyses */}
        <div className="lg:col-span-2">
          <div className="bg-card border rounded-xl">
            <div className="p-6 border-b flex items-center justify-between">
              <h2 className="text-lg font-semibold">Analyses récentes</h2>
              <Link
                to="/history"
                className="text-sm text-primary hover:underline flex items-center"
              >
                Voir tout
                <ArrowRight className="h-4 w-4 ml-1" />
              </Link>
            </div>
            
            <div className="divide-y">
              {recentAnalyses.length === 0 ? (
                <div className="p-8 text-center">
                  <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
                    <Code2 className="h-8 w-8 text-muted-foreground" />
                  </div>
                  <h3 className="text-lg font-medium mb-2">Aucune analyse encore</h3>
                  <p className="text-muted-foreground mb-4">
                    Commencez par analyser votre premier code
                  </p>
                  <Link
                    to="/analyze"
                    className="inline-flex items-center space-x-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg"
                  >
                    <Plus className="h-4 w-4" />
                    <span>Nouvelle analyse</span>
                  </Link>
                </div>
              ) : (
                recentAnalyses.map((analysis) => (
                  <Link
                    key={analysis.id}
                    to={`/analysis/${analysis.id}`}
                    className="p-4 flex items-center justify-between hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-center space-x-4">
                      <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                        analysis.status === 'completed'
                          ? analysis.score && analysis.score >= 7
                            ? 'bg-green-100'
                            : analysis.score && analysis.score >= 4
                            ? 'bg-yellow-100'
                            : 'bg-red-100'
                          : 'bg-muted'
                      }`}>
                        {analysis.status === 'completed' ? (
                          <CheckCircle className={`h-5 w-5 ${
                            analysis.score && analysis.score >= 7
                              ? 'text-green-600'
                              : analysis.score && analysis.score >= 4
                              ? 'text-yellow-600'
                              : 'text-red-600'
                          }`} />
                        ) : (
                          <Clock className="h-5 w-5 text-muted-foreground" />
                        )}
                      </div>
                      <div>
                        <p className="font-medium">
                          {analysis.fileName || `Analyse ${analysis.language}`}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {new Date(analysis.createdAt).toLocaleDateString('fr-FR')}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      {analysis.status === 'completed' && analysis.score !== undefined && (
                        <p className={`font-bold ${
                          analysis.score >= 7
                            ? 'text-green-600'
                            : analysis.score >= 4
                            ? 'text-yellow-600'
                            : 'text-red-600'
                        }`}>
                          {analysis.score}/10
                        </p>
                      )}
                      <p className="text-sm text-muted-foreground">
                        {analysis.errorsCount} erreurs
                      </p>
                    </div>
                  </Link>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Quick Action */}
          <div className="bg-primary text-primary-foreground rounded-xl p-6">
            <h3 className="text-lg font-semibold mb-2">Nouvelle analyse</h3>
            <p className="text-primary-foreground/80 text-sm mb-4">
              Analysez votre code maintenant et recevez des suggestions d'amélioration.
            </p>
            <Link
              to="/analyze"
              className="inline-flex items-center space-x-2 px-4 py-2 bg-white text-primary rounded-lg font-medium hover:bg-white/90"
            >
              <Plus className="h-4 w-4" />
              <span>Commencer</span>
            </Link>
          </div>

          {/* Languages Used */}
          {stats?.languages && stats.languages.length > 0 && (
            <div className="bg-card border rounded-xl p-6">
              <h3 className="text-lg font-semibold mb-4">Langages utilisés</h3>
              <div className="flex flex-wrap gap-2">
                {stats.languages.map((lang) => (
                  <span
                    key={lang}
                    className="px-3 py-1 bg-secondary rounded-full text-sm"
                  >
                    {lang}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Upgrade CTA */}
          {!user?.isPremium && (
            <div className="bg-gradient-to-br from-amber-500 to-amber-600 text-white rounded-xl p-6">
              <h3 className="text-lg font-semibold mb-2">Passez Premium</h3>
              <p className="text-white/80 text-sm mb-4">
                Analyses illimitées, rapports détaillés et support prioritaire.
              </p>
              <Link
                to="/pricing"
                className="inline-flex items-center space-x-2 px-4 py-2 bg-white text-amber-600 rounded-lg font-medium hover:bg-white/90"
              >
                <Crown className="h-4 w-4" />
                <span>Voir les offres</span>
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
