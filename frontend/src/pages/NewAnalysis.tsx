import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { codeApi } from '../utils/api';
import { Language } from '../types';
import { 
  Code2, 
  Loader2, 
  FileCode, 
  AlertCircle,
  CheckCircle,
  Sparkles
} from 'lucide-react';

const NewAnalysis = () => {
  const navigate = useNavigate();
  const { user, refreshUser } = useAuth();
  const [code, setCode] = useState('');
  const [language, setLanguage] = useState('javascript');
  const [fileName, setFileName] = useState('');
  const [context, setContext] = useState('');
  const [languages, setLanguages] = useState<Language[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<any>(null);

  useEffect(() => {
    const fetchLanguages = async () => {
      try {
        const response = await codeApi.getLanguages();
        setLanguages(response.data.data);
      } catch (error) {
        console.error('Error fetching languages:', error);
      }
    };
    fetchLanguages();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setResult(null);

    // Validation
    if (code.length < 10) {
      setError('Le code doit contenir au moins 10 caractères');
      return;
    }

    if (!user?.isPremium && (user?.creditsRemaining || 0) < 1) {
      setError('Vous n\'avez plus de crédits. Passez Premium pour des analyses illimitées.');
      return;
    }

    setIsLoading(true);

    try {
      // Soumettre l'analyse
      const submitResponse = await codeApi.submit({
        code,
        language,
        fileName: fileName || undefined,
        context: context || undefined,
      });

      const analysisId = submitResponse.data.analysisId;

      // Attendre un peu puis récupérer le résultat
      setIsAnalyzing(true);
      
      // Polling pour récupérer le résultat
      let attempts = 0;
      const maxAttempts = 30;
      
      const pollInterval = setInterval(async () => {
        attempts++;
        
        try {
          const analysisResponse = await codeApi.getAnalysis(analysisId);
          const analysis = analysisResponse.data.data;
          
          if (analysis.status === 'completed') {
            clearInterval(pollInterval);
            setResult(analysis);
            setIsAnalyzing(false);
            setIsLoading(false);
            refreshUser(); // Mettre à jour les crédits
          } else if (analysis.status === 'failed') {
            clearInterval(pollInterval);
            setError(analysis.errorMessage || 'L\'analyse a échoué');
            setIsAnalyzing(false);
            setIsLoading(false);
          }
          
          if (attempts >= maxAttempts) {
            clearInterval(pollInterval);
            setError('L\'analyse prend plus de temps que prévu. Consultez votre historique plus tard.');
            setIsAnalyzing(false);
            setIsLoading(false);
            navigate('/history');
          }
        } catch (error) {
          console.error('Error polling analysis:', error);
        }
      }, 2000);

    } catch (error: any) {
      setError(error.response?.data?.error || 'Erreur lors de la soumission');
      setIsLoading(false);
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 7) return 'text-green-600';
    if (score >= 4) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getScoreBg = (score: number) => {
    if (score >= 7) return 'bg-green-100';
    if (score >= 4) return 'bg-yellow-100';
    return 'bg-red-100';
  };

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">Nouvelle analyse</h1>
        <p className="text-muted-foreground mt-1">
          Collez votre code ci-dessous pour l'analyser
        </p>
      </div>

      {error && (
        <div className="mb-6 p-4 rounded-lg bg-red-50 text-red-600 flex items-center">
          <AlertCircle className="h-5 w-5 mr-2" />
          {error}
        </div>
      )}

      <div className="grid lg:grid-cols-2 gap-8">
        {/* Input Form */}
        <div>
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Language & Filename */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-2">
                  Langage
                </label>
                <select
                  value={language}
                  onChange={(e) => setLanguage(e.target.value)}
                  className="w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                >
                  {languages.map((lang) => (
                    <option key={lang.id} value={lang.id}>
                      {lang.icon} {lang.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">
                  Nom du fichier (optionnel)
                </label>
                <div className="relative">
                  <FileCode className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                  <input
                    type="text"
                    value={fileName}
                    onChange={(e) => setFileName(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 border rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                    placeholder="mon-fichier.js"
                  />
                </div>
              </div>
            </div>

            {/* Code Editor */}
            <div>
              <label className="block text-sm font-medium mb-2">
                Code à analyser
              </label>
              <textarea
                value={code}
                onChange={(e) => setCode(e.target.value)}
                className="w-full h-80 px-4 py-3 border rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent code-editor font-mono text-sm"
                placeholder={`// Collez votre code ici...\n\nfunction exemple() {\n  // Votre code\n}`}
                required
              />
              <p className="text-sm text-muted-foreground mt-2">
                {code.length} caractères (min: 10, max: 50 000)
              </p>
            </div>

            {/* Context */}
            <div>
              <label className="block text-sm font-medium mb-2">
                Contexte (optionnel)
              </label>
              <textarea
                value={context}
                onChange={(e) => setContext(e.target.value)}
                className="w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                placeholder="Décrivez le contexte de ce code pour une meilleure analyse..."
                rows={3}
              />
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isLoading || code.length < 10}
              className="w-full flex items-center justify-center space-x-2 px-6 py-4 bg-primary text-primary-foreground rounded-lg font-medium hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin" />
                  <span>{isAnalyzing ? 'Analyse en cours...' : 'Soumission...'}</span>
                </>
              ) : (
                <>
                  <Sparkles className="h-5 w-5" />
                  <span>Analyser le code</span>
                </>
              )}
            </button>

            {/* Credits Info */}
            {!user?.isPremium && (
              <p className="text-center text-sm text-muted-foreground">
                Crédits restants: <span className="font-medium">{user?.creditsRemaining}</span>
              </p>
            )}
          </form>
        </div>

        {/* Results */}
        <div>
          {isAnalyzing ? (
            <div className="h-full flex flex-col items-center justify-center p-12 border rounded-xl bg-muted/30">
              <div className="relative">
                <div className="animate-spin rounded-full h-16 w-16 border-4 border-primary border-t-transparent"></div>
                <Sparkles className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-6 w-6 text-primary" />
              </div>
              <h3 className="text-lg font-medium mt-6">Analyse en cours...</h3>
              <p className="text-muted-foreground text-center mt-2">
                Notre IA analyse votre code en profondeur. Cela peut prendre quelques secondes.
              </p>
            </div>
          ) : result ? (
            <div className="space-y-6">
              {/* Score Card */}
              <div className={`p-6 rounded-xl ${getScoreBg(result.result.score)}`}>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium opacity-80">Score global</p>
                    <p className={`text-5xl font-bold ${getScoreColor(result.result.score)}`}>
                      {result.result.score}/10
                    </p>
                  </div>
                  <CheckCircle className={`h-12 w-12 ${getScoreColor(result.result.score)}`} />
                </div>
              </div>

              {/* Score Breakdown */}
              <div className="bg-card border rounded-xl p-6">
                <h3 className="font-semibold mb-4">Détail du score</h3>
                <div className="space-y-3">
                  {Object.entries(result.result.scoreBreakdown).map(([key, value]: [string, any]) => (
                    <div key={key} className="flex items-center justify-between">
                      <span className="capitalize">
                        {key === 'quality' && 'Qualité'}
                        {key === 'security' && 'Sécurité'}
                        {key === 'performance' && 'Performance'}
                        {key === 'readability' && 'Lisibilité'}
                      </span>
                      <div className="flex items-center space-x-2">
                        <div className="w-32 h-2 bg-muted rounded-full overflow-hidden">
                          <div
                            className={`h-full ${
                              value >= 7 ? 'bg-green-500' : value >= 4 ? 'bg-yellow-500' : 'bg-red-500'
                            }`}
                            style={{ width: `${(value / 10) * 100}%` }}
                          />
                        </div>
                        <span className="text-sm font-medium w-8">{value}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Summary */}
              <div className="bg-card border rounded-xl p-6">
                <h3 className="font-semibold mb-2">Résumé</h3>
                <p className="text-muted-foreground">{result.result.summary}</p>
              </div>

              {/* Issues Count */}
              <div className="grid grid-cols-3 gap-4">
                <div className="bg-red-50 p-4 rounded-xl text-center">
                  <p className="text-2xl font-bold text-red-600">
                    {result.result.errors.length}
                  </p>
                  <p className="text-sm text-red-600">Erreurs</p>
                </div>
                <div className="bg-yellow-50 p-4 rounded-xl text-center">
                  <p className="text-2xl font-bold text-yellow-600">
                    {result.result.warnings.length}
                  </p>
                  <p className="text-sm text-yellow-600">Avertissements</p>
                </div>
                <div className="bg-blue-50 p-4 rounded-xl text-center">
                  <p className="text-2xl font-bold text-blue-600">
                    {result.result.suggestions.length}
                  </p>
                  <p className="text-sm text-blue-600">Suggestions</p>
                </div>
              </div>

              {/* View Details Button */}
              <button
                onClick={() => navigate(`/analysis/${result._id}`)}
                className="w-full flex items-center justify-center space-x-2 px-4 py-3 border rounded-lg font-medium hover:bg-accent"
              >
                <span>Voir le détail complet</span>
              </button>
            </div>
          ) : (
            <div className="h-full flex flex-col items-center justify-center p-12 border rounded-xl bg-muted/30 border-dashed">
              <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mb-4">
                <Code2 className="h-8 w-8 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-medium">Résultats de l'analyse</h3>
              <p className="text-muted-foreground text-center mt-2">
                Soumettez votre code pour voir les résultats détaillés
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default NewAnalysis;
