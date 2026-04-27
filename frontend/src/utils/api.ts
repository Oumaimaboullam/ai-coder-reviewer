import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';
import SessionManager from './sessionManager';

// Utiliser la variable d'environnement Vite et s'assurer qu'il n'y a pas de double '/api'
const rawUrl = (import.meta as any).env.VITE_API_URL || 'http://localhost:3000';
export const API_URL = rawUrl.endsWith('/api') ? rawUrl.slice(0, -4) : rawUrl;

// Initialiser le gestionnaire de session
const sessionManager = SessionManager.getInstance();
sessionManager.init();

// Créer une instance axios
const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor pour ajouter le token et valider sa validité avec SessionManager
api.interceptors.request.use(
  async (config) => {
    try {
      // S'assurer d'avoir un token valide avant la requête
      const validToken = await sessionManager.ensureValidToken();

      if (validToken) {
        config.headers.Authorization = `Bearer ${validToken}`;
      }
    } catch (error) {
      console.error('[ERROR] Erreur gestion token avant requête:', error);
      // Continuer la requête même si la gestion du token échoue
      const token = localStorage.getItem('accessToken');
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
    }

    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Intercepteur pour gérer les erreurs et le refresh token
api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean };

    // Si erreur 401 et pas déjà retenté
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      try {
        const refreshToken = localStorage.getItem('refreshToken');

        if (!refreshToken) {
          localStorage.removeItem('accessToken');
          localStorage.removeItem('refreshToken');
          window.location.href = '/login';
          return Promise.reject(new Error('No refresh token'));
        }

        // Appeler le endpoint de refresh via le gateway (avec /api/ prefix)
        const response = await axios.post(`${API_URL}/api/auth/refresh`, {
          refreshToken,
        });

        const { accessToken, refreshToken: newRefreshToken } = response.data.tokens;

        // Mettre à jour les tokens
        localStorage.setItem('accessToken', accessToken);
        localStorage.setItem('refreshToken', newRefreshToken);

        // Réessayer la requête originale
        if (originalRequest.headers) {
          originalRequest.headers.Authorization = `Bearer ${accessToken}`;
        }
        return api(originalRequest);
      } catch (refreshError) {
        const error = refreshError as any;
        console.error('[ERROR] Erreur refresh token:', error.message);

        // Si le refresh token est expiré ou invalide, forcer la reconnexion
        if (error.response?.status === 401 || error.response?.status === 403) {
          localStorage.removeItem('accessToken');
          localStorage.removeItem('refreshToken');
          window.location.href = '/login';
          return Promise.reject(new Error('Session expired'));
        }

        return Promise.reject(error);
      }
    }

    return Promise.reject(error);
  }
);

// Auth API - utilise le prefix /api/auth comme le gateway l'exige
export const authApi = {
  register: (data: { email: string; password: string; firstName: string; lastName: string }) =>
    api.post('/api/auth/register', data),

  login: (data: { email: string; password: string }) =>
    api.post('/api/auth/login', data),

  logout: (refreshToken?: string) =>
    api.post('/api/auth/logout', { refreshToken }),

  refresh: (refreshToken: string) =>
    axios.post(`${API_URL}/api/auth/refresh`, { refreshToken }),

  me: () =>
    api.get('/api/auth/me'),

  updateProfile: (data: { firstName?: string; lastName?: string; preferences?: object }) =>
    api.put('/api/auth/profile', data),
};

// Code API - utilise l'instance api avec intercepteurs au lieu d'axios brut
export const codeApi = {
  submit: (data: { code: string; language: string; fileName?: string; context?: string }) =>
    api.post('/api/code/submit', data),

  getHistory: (params?: { limit?: number; offset?: number; status?: string; language?: string }) =>
    api.get('/api/code/history', { params }),

  getAnalysis: (id: string) =>
    api.get(`/api/code/analysis/${id}`),

  deleteAnalysis: (id: string) =>
    api.delete(`/api/code/analysis/${id}`),

  getStats: () =>
    api.get('/api/code/stats'),

  getLanguages: () =>
    api.get('/api/code/languages'),
};

// AI API - utilise l'instance api avec intercepteurs
export const aiApi = {
  analyze: (data: { code: string; language: string; context?: string }) =>
    api.post('/api/ai/analyze', data),

  getLanguages: () =>
    api.get('/api/ai/languages'),

  getHealth: () =>
    api.get('/api/ai/health'),
};

// Payment API - utilise l'instance api avec intercepteurs
export const paymentApi = {
  createCheckout: (data: { plan: 'monthly' | 'annual' | 'lifetime'; successUrl?: string; cancelUrl?: string }) =>
    api.post('/api/payment/create-checkout', data),

  getSubscription: () =>
    api.get('/api/payment/subscription'),

  cancelSubscription: () =>
    api.delete('/api/payment/cancel-subscription'),

  getInvoices: () =>
    api.get('/api/payment/invoices'),

  getPortal: () =>
    api.post('/api/payment/portal', {}),
};

export default api;
