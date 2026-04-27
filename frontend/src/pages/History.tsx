import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { codeApi } from '../utils/api';
import { AnalysisSummary } from '../types';
import { Code2, CheckCircle, Clock, AlertCircle, Trash2, ChevronLeft, ChevronRight } from 'lucide-react';

const History = () => {
  const [analyses, setAnalyses] = useState<AnalysisSummary[]>([]);
  const [pagination, setPagination] = useState({ total: 0, limit: 20, offset: 0, hasMore: false });
  const [isLoading, setIsLoading] = useState(true);

  const fetchHistory = async (offset = 0) => {
    setIsLoading(true);
    try {
      const response = await codeApi.getHistory({ limit: 20, offset });
      setAnalyses(response.data.data.analyses);
      setPagination(response.data.data.pagination);
    } catch (error) {
      console.error('Error fetching history:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, []);

  const handleDelete = async (id: string) => {
    if (!confirm('Êtes-vous sûr de vouloir supprimer cette analyse ?')) return;
    
    try {
      await codeApi.deleteAnalysis(id);
      fetchHistory(pagination.offset);
    } catch (error) {
      console.error('Error deleting analysis:', error);
    }
  };

  const handlePageChange = (newOffset: number) => {
    if (newOffset < 0 || newOffset >= pagination.total) return;
    fetchHistory(newOffset);
  };

  if (isLoading) {
    return (
      <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">Historique des analyses</h1>
        <p className="text-muted-foreground mt-1">
          {pagination.total} analyse{pagination.total !== 1 ? 's' : ''} au total
        </p>
      </div>

      {analyses.length === 0 ? (
        <div className="text-center py-16">
          <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
            <Code2 className="h-8 w-8 text-muted-foreground" />
          </div>
          <h3 className="text-lg font-medium mb-2">Aucune analyse</h3>
          <p className="text-muted-foreground mb-4">
            Vous n'avez pas encore effectué d'analyse
          </p>
          <Link
            to="/analyze"
            className="inline-flex items-center space-x-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg"
          >
            <span>Nouvelle analyse</span>
          </Link>
        </div>
      ) : (
        <>
          <div className="bg-card border rounded-xl overflow-hidden">
            <div className="divide-y">
              {analyses.map((analysis) => (
                <div
                  key={analysis.id}
                  className="p-4 flex items-center justify-between hover:bg-muted/50 transition-colors"
                >
                  <Link
                    to={`/analysis/${analysis.id}`}
                    className="flex-1 flex items-center space-x-4"
                  >
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
                      ) : analysis.status === 'failed' ? (
                        <AlertCircle className="h-5 w-5 text-red-600" />
                      ) : (
                        <Clock className="h-5 w-5 text-muted-foreground" />
                      )}
                    </div>
                    <div>
                      <p className="font-medium">
                        {analysis.fileName || `Analyse ${analysis.language}`}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {new Date(analysis.createdAt).toLocaleDateString('fr-FR', {
                          day: 'numeric',
                          month: 'long',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </p>
                    </div>
                  </Link>
                  <div className="flex items-center space-x-4">
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
                        {analysis.errorsCount} erreur{analysis.errorsCount !== 1 ? 's' : ''}
                      </p>
                    </div>
                    <button
                      onClick={() => handleDelete(analysis.id)}
                      className="p-2 text-muted-foreground hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                    >
                      <Trash2 className="h-5 w-5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Pagination */}
          {pagination.total > pagination.limit && (
            <div className="flex items-center justify-between mt-6">
              <button
                onClick={() => handlePageChange(pagination.offset - pagination.limit)}
                disabled={pagination.offset === 0}
                className="flex items-center space-x-2 px-4 py-2 border rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-accent"
              >
                <ChevronLeft className="h-4 w-4" />
                <span>Précédent</span>
              </button>
              <span className="text-sm text-muted-foreground">
                Page {Math.floor(pagination.offset / pagination.limit) + 1} sur{' '}
                {Math.ceil(pagination.total / pagination.limit)}
              </span>
              <button
                onClick={() => handlePageChange(pagination.offset + pagination.limit)}
                disabled={!pagination.hasMore}
                className="flex items-center space-x-2 px-4 py-2 border rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-accent"
              >
                <span>Suivant</span>
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default History;
