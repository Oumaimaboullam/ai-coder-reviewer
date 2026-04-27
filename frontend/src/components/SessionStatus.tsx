import React, { useState, useEffect } from 'react';
import SessionManager from '../utils/sessionManager';

interface SessionStatusProps {
  className?: string;
}

const SessionStatus: React.FC<SessionStatusProps> = ({ className = '' }) => {
  const [remainingTime, setRemainingTime] = useState<string>('');
  const [isSessionActive, setIsSessionActive] = useState<boolean>(false);
  const [showWarning, setShowWarning] = useState<boolean>(false);

  useEffect(() => {
    const sessionManager = SessionManager.getInstance();
    
    const updateSessionStatus = () => {
      const active = sessionManager.isSessionActive();
      setIsSessionActive(active);
      
      if (active) {
        const time = sessionManager.formatRemainingTime();
        setRemainingTime(time);
        
        // Afficher un avertissement si moins de 5 minutes restantes
        const remainingSeconds = sessionManager.getTokenRemainingTime();
        setShowWarning(remainingSeconds < 300 && remainingSeconds > 0);
      } else {
        setRemainingTime('Expiré');
        setShowWarning(false);
      }
    };

    // Mettre à jour immédiatement
    updateSessionStatus();

    // Mettre à jour toutes les 30 secondes
    const interval = setInterval(updateSessionStatus, 30000);

    return () => clearInterval(interval);
  }, []);

  const handleRefreshSession = async () => {
    try {
      const sessionManager = SessionManager.getInstance();
      await sessionManager.refreshToken();
      // Le statut sera mis à jour automatiquement par useEffect
    } catch (error) {
      console.error('Erreur rafraîchissement session:', error);
    }
  };

  if (!isSessionActive) {
    return null; // Ne rien afficher si la session n'est pas active
  }

  return (
    <div className={`session-status ${className}`}>
      {showWarning && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 mb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <svg className="w-5 h-5 text-yellow-600 mr-2" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
              <span className="text-yellow-800 text-sm">
                Votre session expire dans {remainingTime}
              </span>
            </div>
            <button
              onClick={handleRefreshSession}
              className="bg-yellow-600 text-white px-3 py-1 rounded text-sm hover:bg-yellow-700 transition-colors"
            >
              Rafraîchir
            </button>
          </div>
        </div>
      )}
      
      <div className="text-xs text-gray-500">
        Session active - Temps restant: {remainingTime}
      </div>
    </div>
  );
};

export default SessionStatus;
