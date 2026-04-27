/**
 * Gestionnaire de session pour éviter les problèmes de token expiré
 * Gère automatiquement le rafraîchissement des tokens et la reconnexion
 */

interface TokenData {
  exp: number;
  iat: number;
  userId: string;
  email: string;
}

class SessionManager {
  private static instance: SessionManager;
  private refreshInProgress = false;
  private refreshPromise: Promise<any> | null = null;

  static getInstance(): SessionManager {
    if (!SessionManager.instance) {
      SessionManager.instance = new SessionManager();
    }
    return SessionManager.instance;
  }

  /**
   * Vérifie si le token est expiré ou proche de l'expiration
   */
  isTokenExpiredOrExpiring(token: string, bufferSeconds: number = 60): boolean {
    try {
      const parts = token.split('.');
      if (parts.length !== 3) return true;

      const payload = JSON.parse(atob(parts[1]));
      const currentTime = Date.now() / 1000;
      
      return payload.exp <= (currentTime + bufferSeconds);
    } catch (error) {
      console.error('[ERROR] Erreur validation token:', error);
      return true;
    }
  }

  /**
   * Récupère les informations du token
   */
  getTokenData(token: string): TokenData | null {
    try {
      const parts = token.split('.');
      if (parts.length !== 3) return null;

      return JSON.parse(atob(parts[1]));
    } catch (error) {
      console.error('[ERROR] Erreur parsing token:', error);
      return null;
    }
  }

  /**
   * Vérifie si une session est active (access ou refresh token valide)
   */
  isSessionActive(): boolean {
    const token = localStorage.getItem('accessToken');
    const refreshToken = localStorage.getItem('refreshToken');
    
    if (!token && !refreshToken) return false;
    
    // Si l'access token est encore valide, la session est active
    if (token && !this.isTokenExpiredOrExpiring(token)) return true;
    
    // Si l'access token est expiré mais le refresh token existe, la session peut être récupérée
    if (refreshToken && !this.isTokenExpiredOrExpiring(refreshToken, 0)) return true;
    
    return false;
  }

  /**
   * Rafraîchit le token de manière sécurisée avec évitement des doublons
   */
  async refreshToken(): Promise<string> {
    // Si un rafraîchissement est déjà en cours, retourner la promesse existante
    if (this.refreshInProgress && this.refreshPromise) {
      return this.refreshPromise;
    }

    this.refreshInProgress = true;
    
    this.refreshPromise = this.performRefresh();
    
    try {
      const result = await this.refreshPromise;
      return result;
    } finally {
      this.refreshInProgress = false;
      this.refreshPromise = null;
    }
  }

  private async performRefresh(): Promise<string> {
    const refreshToken = localStorage.getItem('refreshToken');
    
    if (!refreshToken) {
      throw new Error('No refresh token available');
    }

    try {
      // Appeler via le gateway (port 3000 + prefix /api/) au lieu du service auth directement
      // Nettoyer l'URL au cas où VITE_API_URL contiendrait déjà '/api' (ex: docker-compose)
      const rawUrl = (import.meta as any).env.VITE_API_URL || 'http://localhost:3000';
      const apiUrl = rawUrl.endsWith('/api') ? rawUrl.slice(0, -4) : rawUrl;
      const response = await fetch(`${apiUrl}/api/auth/refresh`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ refreshToken }),
      });

      if (!response.ok) {
        throw new Error(`Refresh failed: ${response.status}`);
      }

      const data = await response.json();
      const { accessToken, refreshToken: newRefreshToken } = data.tokens;

      // Mettre à jour les tokens
      localStorage.setItem('accessToken', accessToken);
      localStorage.setItem('refreshToken', newRefreshToken);

      return accessToken;
    } catch (error) {
      console.error('[ERROR] Erreur rafraîchissement token:', error);
      
      // Nettoyer les tokens invalides
      this.clearSession();
      
      throw error;
    }
  }

  /**
   * Nettoie la session locale
   */
  clearSession(): void {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
  }

  /**
   * Force la déconnexion avec redirection (sans alert pour éviter les doublons)
   */
  forceLogout(): void {
    this.clearSession();
    
    if (typeof window !== 'undefined') {
      window.location.href = '/login';
    }
  }

  /**
   * Vérifie et rafraîchit automatiquement le token si nécessaire
   */
  async ensureValidToken(): Promise<string | null> {
    const token = localStorage.getItem('accessToken');
    
    if (!token) return null;

    if (this.isTokenExpiredOrExpiring(token)) {
      try {
        return await this.refreshToken();
      } catch (error) {
        console.error('[ERROR] Impossible de rafraîchir le token:', error);
        this.forceLogout();
        return null;
      }
    }

    return token;
  }

  /**
   * Initialise le gestionnaire de session
   */
  init(): void {
    // Au chargement, vérifier si la session peut être récupérée
    // Ne PAS supprimer les tokens si seul l'accessToken est expiré
    // car le refreshToken peut encore être valide
    if (!this.isSessionActive()) {
      const token = localStorage.getItem('accessToken');
      const refreshToken = localStorage.getItem('refreshToken');
      if (token && !refreshToken) {
        // Pas de refresh token → session irrécupérable, nettoyer
        this.clearSession();
      }
      // Si un refresh token existe, on laisse l'intercepteur API gérer le refresh
    }

    // Configurer un vérificateur périodique
    this.setupPeriodicCheck();
  }

  private setupPeriodicCheck(): void {
    // Vérifier toutes les 5 minutes
    setInterval(() => {
      if (!this.isSessionActive()) {
        const token = localStorage.getItem('accessToken');
        if (token) {
          this.forceLogout();
        }
      }
    }, 5 * 60 * 1000);
  }

  /**
   * Récupère le temps restant avant expiration du token (en secondes)
   */
  getTokenRemainingTime(): number {
    const token = localStorage.getItem('accessToken');
    if (!token) return 0;

    const tokenData = this.getTokenData(token);
    if (!tokenData) return 0;

    const currentTime = Date.now() / 1000;
    return Math.max(0, tokenData.exp - currentTime);
  }

  /**
   * Formate le temps restant en format lisible
   */
  formatRemainingTime(): string {
    const remaining = this.getTokenRemainingTime();
    
    if (remaining <= 0) return 'Expiré';
    
    const hours = Math.floor(remaining / 3600);
    const minutes = Math.floor((remaining % 3600) / 60);
    
    if (hours > 0) {
      return `${hours}h ${minutes}min`;
    }
    
    return `${minutes}min`;
  }
}

export default SessionManager;
export { SessionManager };
