import axios from 'axios';

const BASE_URL = import.meta.env.VITE_API_URL ?? '/api';

export const apiClient = axios.create({
  baseURL: BASE_URL,
  headers: { 'Content-Type': 'application/json' },
});

// Attach JWT automatically
apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('nitatime_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// On 401, redirect to login
apiClient.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('nitatime_token');
      window.location.href = '/login';
    }
    return Promise.reject(err);
  },
);
