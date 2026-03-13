import axios from 'axios';
import Cookies from 'js-cookie';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';

// Create axios instance
const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
});

// Add auth token to requests
api.interceptors.request.use((config) => {
  const token = Cookies.get('auth_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Handle auth errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      Cookies.remove('auth_token');
      window.location.href = '/auth/login';
    }
    return Promise.reject(error);
  }
);

// Types
export interface Scheme {
  id: number;
  title: string;
  slug: string;
  description: string;
  ministry: string;
  level: string;
  scheme_category: string[];
  tags: string[];
  target_beneficiaries: string[];
  eligibility_criteria: string;
  benefits: string;
  application_process: string;
  required_documents: string;
  contact_information: any;
  reference_links: string;
  last_updated: string;
  eligibility?: {
    status: 'eligible' | 'not_eligible' | 'likely_eligible' | 'insufficient_data';
    score: number;
    reasons: string[];
    missing_criteria: string[];
  };
}

export interface User {
  id: number;
  email: string;
  name: string;
}

export interface UserProfile {
  age?: number;
  gender?: string;
  annual_income?: number;
  occupation?: string;
  state?: string;
  district?: string;
  category?: string;
  is_student?: boolean;
  is_farmer?: boolean;
  is_disabled?: boolean;
  is_senior_citizen?: boolean;
  family_size?: number;
  marital_status?: string;
}

// Auth API
export const authAPI = {
  register: async (data: {
    email: string;
    password: string;
    name: string;
  } & Partial<UserProfile>) => {
    const response = await api.post('/auth/register', data);
    return response.data;
  },

  login: async (email: string, password: string) => {
    const response = await api.post('/auth/login', { email, password });
    return response.data;
  },

  getProfile: async () => {
    const response = await api.get('/auth/profile');
    return response.data;
  },

  updateProfile: async (data: Partial<UserProfile>) => {
    const response = await api.put('/auth/profile', data);
    return response.data;
  },

  changePassword: async (currentPassword: string, newPassword: string) => {
    const response = await api.put('/auth/password', {
      currentPassword,
      newPassword,
    });
    return response.data;
  },
};

// Schemes API
export const schemesAPI = {
  search: async (params: {
    query?: string;
    category?: string;
    ministry?: string;
    level?: string;
    limit?: number;
    offset?: number;
  }) => {
    const response = await api.get('/schemes/search', { params });
    return response.data;
  },

  getById: async (id: string) => {
    const response = await api.get(`/schemes/${id}`);
    return response.data;
  },

  getEligible: async (params: { limit?: number; offset?: number }) => {
    const response = await api.get('/schemes/eligible/me', { params });
    return response.data;
  },

  getSaved: async (params: { limit?: number; offset?: number }) => {
    const response = await api.get('/schemes/saved/me', { params });
    return response.data;
  },

  saveScheme: async (id: number) => {
    const response = await api.post(`/schemes/${id}/save`);
    return response.data;
  },

  removeSaved: async (id: number) => {
    const response = await api.delete(`/schemes/${id}/save`);
    return response.data;
  },

  getStats: async () => {
    const response = await api.get('/schemes/stats/overview');
    return response.data;
  },
};

export default api;