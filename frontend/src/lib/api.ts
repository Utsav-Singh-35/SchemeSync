import axios from 'axios';
import Cookies from 'js-cookie';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3003/api';

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
  application_url?: string; // Optional application URL
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

// Extension Communication API
export const extensionAPI = {
  // Check if SchemeSync extension is installed by looking for injected content
  isExtensionAvailable: async (): Promise<boolean> => {
    return new Promise((resolve) => {
      if (typeof window === 'undefined') {
        resolve(false);
        return;
      }

      // Check if extension has injected its marker
      const extensionMarker = document.querySelector('[data-schemesync-extension]');
      if (extensionMarker) {
        resolve(true);
        return;
      }

      // Try to trigger extension by dispatching custom event
      const checkEvent = new CustomEvent('schemesync-check', {
        detail: { timestamp: Date.now() }
      });
      
      let responseReceived = false;
      
      const responseHandler = () => {
        responseReceived = true;
        resolve(true);
        document.removeEventListener('schemesync-response', responseHandler);
      };
      
      document.addEventListener('schemesync-response', responseHandler);
      document.dispatchEvent(checkEvent);
      
      // Timeout after 1 second
      setTimeout(() => {
        if (!responseReceived) {
          document.removeEventListener('schemesync-response', responseHandler);
          resolve(false);
        }
      }, 1000);
    });
  },

  // Trigger extension autofill by dispatching event to content script
  triggerAutofill: async (schemeId: string, applicationUrl: string) => {
    return new Promise((resolve, reject) => {
      if (typeof window === 'undefined') {
        reject(new Error('Window not available'));
        return;
      }

      console.log('🚀 Triggering extension autofill:', { schemeId, applicationUrl });

      // Set up response listener
      let responseReceived = false;
      
      const responseHandler = (event: any) => {
        console.log('📨 Extension response received:', event.detail);
        responseReceived = true;
        document.removeEventListener('schemesync-autofill-response', responseHandler);
        
        if (event.detail.success) {
          resolve(event.detail);
        } else {
          reject(new Error(event.detail.error || 'Extension autofill failed'));
        }
      };
      
      document.addEventListener('schemesync-autofill-response', responseHandler);
      
      // Dispatch autofill trigger event to extension
      const triggerEvent = new CustomEvent('schemesync-trigger-autofill', {
        detail: { schemeId, applicationUrl }
      });
      
      console.log('📡 Dispatching autofill trigger event');
      document.dispatchEvent(triggerEvent);
      
      // Timeout after 5 seconds
      setTimeout(() => {
        if (!responseReceived) {
          document.removeEventListener('schemesync-autofill-response', responseHandler);
          reject(new Error('Extension did not respond within 5 seconds'));
        }
      }, 5000);
    });
  },

  // Get extension status
  getExtensionStatus: async () => {
    const available = await extensionAPI.isExtensionAvailable();
    return {
      available,
      reason: available ? 'Extension detected and ready' : 'SchemeSync extension not found'
    };
  }
};

// Browser Automation API (Legacy - kept for backward compatibility)
export const automationAPI = {
  fillForm: async (schemeId: string, applicationUrl: string) => {
    // First try extension-based autofill
    try {
      const extensionAvailable = await extensionAPI.isExtensionAvailable();
      
      if (extensionAvailable) {
        // Use extension autofill
        const result = await extensionAPI.triggerAutofill(schemeId, applicationUrl);
        return {
          success: true,
          data: result,
          method: 'extension'
        };
      }
    } catch (error) {
      console.warn('Extension autofill failed, falling back to server automation:', error);
    }

    // Fallback to server-side automation (if still needed)
    const response = await api.post('/automation/fill-form', {
      schemeId,
      applicationUrl
    });
    return {
      ...response.data,
      method: 'server'
    };
  },

  getSession: async (sessionId: string) => {
    const response = await api.get(`/automation/session/${sessionId}`);
    return response.data;
  },

  getHistory: async (params: { limit?: number; offset?: number }) => {
    const response = await api.get('/automation/history', { params });
    return response.data;
  },

  closeSession: async (sessionId: string) => {
    const response = await api.delete(`/automation/session/${sessionId}`);
    return response.data;
  },
};

export default api;