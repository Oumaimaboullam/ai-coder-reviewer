import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { codeApi } from '../utils/api';
import { Analysis } from '../types';
import { 
  ArrowLeft, 
  CheckCircle, 
  AlertCircle, 
  AlertTriangle, 
  Lightbulb, 
  Shield,
  Clock,
  Code2,
  Brain,
  Baby
} from 'lucide-react';

const AnalysisDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'errors' | 'logic' | 'warnings' | 'suggestions' | 'security'>('errors');

  useEffect(() => {
    const fetchAnalysis = async () => {
      try {
        const response = await codeApi.getAnalysis(id!);
        setAnalysis(response.data.data);
      } catch (error) {
        console.error('Error fetching analysis:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchAnalysis();
  }, [id]);

  if (isLoading) {
    return (
      <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!analysis) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="text-center py-16">
          <AlertCircle className="h-16 w-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold mb-2">Analyse non trouvée</h2>
          <p className="text-muted-foreground mb-4">
            L'analyse que vous recherchez n'existe pas ou a été supprimée.
          </p>
          <button
            onClick={() => navigate('/history')}
            className="inline-flex items-center space-x-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Retour à l'historique</span>
          </button>
        </div>
      </div>
    );
  }

  if (analysis.status !== 'completed' || !analysis.result) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="text-center py-16">
          <Clock className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
          <h2 className="text-2xl font-bold mb-2">Analyse en cours</h2>
          <p className="text-muted-foreground">
            Cette analyse est toujours en cours de traitement. Revenez plus tard.
          </p>
        </div>
      </div>
    );
  }

  const result = analysis.result;

  const getScoreColor = (score: number) => {
    if (score >= 7) return 'text-green-600';
    if (score >= 4) return 'text-yellow-600';
    return 'text-red-600';
  };

  const tabs = [
    { id: 'errors', label: `Bugs (${result.errors.length})`, icon: AlertCircle },
    { id: 'logic', label: `Logique Métier (${result.businessLogicIssues?.length || 0})`, icon: Brain },
    { id: 'security', label: `Sécurité (${result.securityIssues.length})`, icon: Shield },
    { id: 'warnings', label: `Clean Code (${result.warnings.length})`, icon: AlertTriangle },
    { id: 'suggestions', label: `Suggestions (${result.suggestions.length})`, icon: Lightbulb },
  ];
  
  const scoreValue = result.fullScore || result.score * 10;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="mb-8">
        <button
          onClick={() => navigate('/history')}
          className="flex items-center space-x-2 text-muted-foreground hover:text-foreground mb-4"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Retour à l'historique</span>
        </button>
        
        <div className="flex flex-col md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-3xl font-bold">
              {analysis.fileName || `Analyse ${analysis.language}`}
            </h1>
            <p className="text-muted-foreground mt-1">
              {new Date(analysis.createdAt).toLocaleDateString('fr-FR', {
                day: 'numeric',
                month: 'long',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
              })}
            </p>
          </div>
          <div className="mt-4 md:mt-0 flex items-center space-x-4">
            <div className={`text-4xl font-bold ${getScoreColor(result.score)}`}>
              {scoreValue}/100
            </div>
          </div>
        </div>
      </div>

      {/* Score Breakdown */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        {Object.entries(result.scoreBreakdown).map(([key, value]: [string, any]) => (
          <div key={key} className="bg-card border rounded-xl p-4">
            <p className="text-sm text-muted-foreground capitalize">
              {key === 'quality' && 'Qualité'}
              {key === 'security' && 'Sécurité'}
              {key === 'performance' && 'Performance'}
              {key === 'readability' && 'Lisibilité'}
            </p>
            <p className={`text-2xl font-bold ${getScoreColor(value)}`}>
              {value}
            </p>
          </div>
        ))}
      </div>

      {/* ELI5 / Summary */}
      <div className="bg-card border rounded-xl p-6 mb-8">
        <div className="flex items-center space-x-2 mb-4">
          <Baby className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-semibold">Explication Simple (ELI5)</h2>
        </div>
        <div className="prose prose-sm max-w-none text-muted-foreground bg-muted/30 p-4 rounded-lg italic">
          "{result.eli5 || result.summary}"
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-card border rounded-xl overflow-hidden">
        <div className="flex overflow-x-auto border-b">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center space-x-2 px-6 py-4 text-sm font-medium whitespace-nowrap ${
                activeTab === tab.id
                  ? 'border-b-2 border-primary text-primary'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <tab.icon className="h-4 w-4" />
              <span>{tab.label}</span>
            </button>
          ))}
        </div>

        <div className="p-6">
          {activeTab === 'errors' && (
            <div className="space-y-4">
              {result.errors.length === 0 ? (
                <div className="text-center py-8">
                  <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-2" />
                  <p className="text-muted-foreground">Aucun bug détecté !</p>
                </div>
              ) : (
                result.errors.map((error, index) => (
                  <div key={error.id || index} className="border rounded-lg p-4">
                    <div className="flex items-start space-x-3">
                      <AlertCircle className="h-5 w-5 text-red-500 mt-0.5" />
                      <div className="flex-1">
                        <div className="flex items-center space-x-2 mb-1">
                          <span className="px-2 py-0.5 bg-red-100 text-red-700 text-xs rounded-full">
                            {error.severity}
                          </span>
                          {error.line && (
                            <span className="text-sm text-muted-foreground">
                              Ligne {error.line}
                            </span>
                          )}
                        </div>
                        <p className="font-medium">{error.description}</p>
                        {error.fix && (
                          <div className="mt-2 p-3 bg-muted rounded-lg">
                            <p className="text-sm text-muted-foreground mb-1">Correction suggérée:</p>
                            <code className="text-sm font-mono">{error.fix}</code>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {activeTab === 'logic' && (
            <div className="space-y-4">
              {!result.businessLogicIssues || result.businessLogicIssues.length === 0 ? (
                <div className="text-center py-8">
                  <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-2" />
                  <p className="text-muted-foreground">Aucun problème de logique métier !</p>
                </div>
              ) : (
                result.businessLogicIssues.map((issue, index) => (
                  <div key={index} className="border border-primary/20 rounded-lg p-4 bg-primary/5">
                    <div className="flex items-start space-x-3">
                      <Brain className="h-5 w-5 text-primary mt-0.5" />
                      <div className="flex-1">
                        <div className="flex items-center space-x-2 mb-1">
                          <span className="px-2 py-0.5 bg-primary/10 text-primary text-xs rounded-full font-medium">
                            {issue.severity || 'HIGH'}
                          </span>
                          {issue.line && (
                            <span className="text-sm text-muted-foreground">
                              Ligne {issue.line}
                            </span>
                          )}
                        </div>
                        <p className="font-medium text-foreground">{issue.description}</p>
                        {issue.reason && (
                          <div className="mt-2 text-sm text-muted-foreground">
                            <span className="font-semibold text-primary">Pourquoi :</span> {issue.reason}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {activeTab === 'warnings' && (
            <div className="space-y-4">
              {result.warnings.length === 0 ? (
                <div className="text-center py-8">
                  <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-2" />
                  <p className="text-muted-foreground">Aucun avertissement !</p>
                </div>
              ) : (
                result.warnings.map((warning, index) => (
                  <div key={warning.id || index} className="border rounded-lg p-4">
                    <div className="flex items-start space-x-3">
                      <AlertTriangle className="h-5 w-5 text-yellow-500 mt-0.5" />
                      <div className="flex-1">
                        <div className="flex items-center space-x-2 mb-1">
                          <span className="px-2 py-0.5 bg-yellow-100 text-yellow-700 text-xs rounded-full">
                            {warning.severity}
                          </span>
                          {warning.line && (
                            <span className="text-sm text-muted-foreground">
                              Ligne {warning.line}
                            </span>
                          )}
                        </div>
                        <p className="font-medium">{warning.description}</p>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {activeTab === 'suggestions' && (
            <div className="space-y-4">
              {result.suggestions.length === 0 ? (
                <div className="text-center py-8">
                  <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-2" />
                  <p className="text-muted-foreground">Aucune suggestion !</p>
                </div>
              ) : (
                result.suggestions.map((suggestion, index) => (
                  <div key={suggestion.id || index} className="border rounded-lg p-4">
                    <div className="flex items-start space-x-3">
                      <Lightbulb className="h-5 w-5 text-blue-500 mt-0.5" />
                      <div className="flex-1">
                        <div className="flex items-center space-x-2 mb-1">
                          <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-xs rounded-full">
                            {suggestion.type}
                          </span>
                          {suggestion.impact && (
                            <span className="text-sm text-muted-foreground">
                              Impact: {suggestion.impact}
                            </span>
                          )}
                        </div>
                        <p className="font-medium">{suggestion.description}</p>
                        {suggestion.beforeCode && suggestion.afterCode && (
                          <div className="mt-3 grid grid-cols-2 gap-4">
                            <div className="p-3 bg-red-50 rounded-lg">
                              <p className="text-xs text-red-600 mb-1">Avant:</p>
                              <code className="text-sm font-mono">{suggestion.beforeCode}</code>
                            </div>
                            <div className="p-3 bg-green-50 rounded-lg">
                              <p className="text-xs text-green-600 mb-1">Après:</p>
                              <code className="text-sm font-mono">{suggestion.afterCode}</code>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {activeTab === 'security' && (
            <div className="space-y-4">
              {result.securityIssues.length === 0 ? (
                <div className="text-center py-8">
                  <Shield className="h-12 w-12 text-green-500 mx-auto mb-2" />
                  <p className="text-muted-foreground">Aucun problème de sécurité détecté !</p>
                </div>
              ) : (
                result.securityIssues.map((issue, index) => (
                  <div key={issue.id || index} className="border border-red-200 rounded-lg p-4 bg-red-50">
                    <div className="flex items-start space-x-3">
                      <Shield className="h-5 w-5 text-red-600 mt-0.5" />
                      <div className="flex-1">
                        <div className="flex items-center space-x-2 mb-1">
                          <span className="px-2 py-0.5 bg-red-200 text-red-800 text-xs rounded-full font-medium">
                            {issue.severity}
                          </span>
                          {issue.line && (
                            <span className="text-sm text-muted-foreground">
                              Ligne {issue.line}
                            </span>
                          )}
                        </div>
                        <p className="font-medium text-red-900">{issue.description}</p>
                        {issue.recommendation && (
                          <p className="mt-2 text-sm text-red-700">
                            <span className="font-medium">Recommandation:</span> {issue.recommendation}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </div>

      {/* Code Corrected */}
      <div className="mt-8">
        <h2 className="text-lg font-semibold mb-4">Code corrigé</h2>
        <div className="bg-card border rounded-xl overflow-hidden">
          <div className="bg-muted px-4 py-2 border-b flex items-center space-x-2">
            <Code2 className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">{analysis.language}</span>
          </div>
          <pre className="p-4 overflow-x-auto code-editor text-sm">
            <code>{result.correctedCode || analysis.code}</code>
          </pre>
        </div>
      </div>
    </div>
  );
};

export default AnalysisDetail;
