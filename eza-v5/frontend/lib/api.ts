/**
 * API client utilities
 */

import axios from 'axios';
import { getToken } from './auth';

const API_URL = process.env.NEXT_PUBLIC_EZA_API_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

const apiClient = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add auth token to requests
apiClient.interceptors.request.use((config) => {
  const token = getToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Handle auth errors
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Redirect to login
      if (typeof window !== 'undefined') {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

export default apiClient;

// Stub functions for EZA Proxy UI

export async function analyzeLite(text: string) {
  const response = await apiClient.post('/api/proxy-lite/report', {
    message: text,
    output_text: text, // For proxy-lite, using same text
  });
  return response.data;
}

export async function loginCorporate(email: string, password: string) {
  const response = await apiClient.post('/api/auth/login', {
    email,
    password,
  });
  return response.data;
}

export async function fetchCases() {
  const response = await apiClient.get('/api/proxy/cases');
  return response.data;
}

export async function fetchApiKeys() {
  const response = await apiClient.get('/api/institution/api-keys');
  return response.data;
}

export async function generateApiKey(name: string) {
  const response = await apiClient.post('/api/institution/api-keys', { name });
  return response.data;
}

export async function revokeApiKey(id: string) {
  const response = await apiClient.delete(`/api/institution/api-keys/${id}`);
  return response.data;
}

