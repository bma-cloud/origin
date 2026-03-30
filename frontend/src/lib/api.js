import axios from 'axios';

const API_URL = process.env.REACT_APP_BACKEND_URL;

const api = axios.create({
  baseURL: `${API_URL}/api`,
  withCredentials: true
});

// Add auth token to requests
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('access_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Handle 401 responses
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('access_token');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// Helper to format API errors
export function formatApiError(error) {
  const detail = error.response?.data?.detail;
  if (detail == null) return 'Une erreur est survenue. Veuillez réessayer.';
  if (typeof detail === 'string') return detail;
  if (Array.isArray(detail)) {
    return detail
      .map((e) => (e && typeof e.msg === 'string' ? e.msg : JSON.stringify(e)))
      .filter(Boolean)
      .join(' ');
  }
  if (detail && typeof detail.msg === 'string') return detail.msg;
  return String(detail);
}

// Users API
export const usersApi = {
  getAll: () => api.get('/users'),
  create: (data) => api.post('/users', data),
  update: (id, data) => api.put(`/users/${id}`, data),
  delete: (id) => api.delete(`/users/${id}`)
};

// Domaines API
export const domainesApi = {
  getAll: () => api.get('/domaines'),
  create: (data) => api.post('/domaines', data),
  update: (id, data) => api.put(`/domaines/${id}`, data),
  delete: (id) => api.delete(`/domaines/${id}`),
  assignUser: (domaineId, userId) => api.post(`/domaines/${domaineId}/assign`, { user_id: userId }),
  unassignUser: (domaineId, userId) => api.delete(`/domaines/${domaineId}/unassign/${userId}`)
};

// Outils API
export const outilsApi = {
  getAll: () => api.get('/outils'),
  create: (data) => api.post('/outils', data),
  update: (id, data) => api.put(`/outils/${id}`, data),
  delete: (id) => api.delete(`/outils/${id}`),
  assignUser: (outilId, userId, role) => api.post(`/outils/${outilId}/assign`, { user_id: userId, role }),
  unassignUser: (outilId, userId) => api.delete(`/outils/${outilId}/unassign/${userId}`)
};

// Audit Logs API
export const auditLogsApi = {
  getAll: (limit = 100) => api.get(`/audit-logs?limit=${limit}`)
};

// Dashboard API
export const dashboardApi = {
  getStats: () => api.get('/dashboard/stats')
};

export default api;
