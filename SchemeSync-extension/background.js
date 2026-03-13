// SchemeSync Extension Background Script
class BackgroundService {
  constructor() {
    this.API_BASE = 'http://localhost:3000/api';
    this.setupEventListeners();
  }

  setupEventListeners() {
    // Handle extension installation
    chrome.runtime.onInstalled.addListener(() => {
      console.log('SchemeSync Extension installed');
    });

    // Handle messages from content scripts
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      this.handleMessage(message, sender, sendResponse);
      return true; // Keep message channel open for async response
    });

    // Handle tab updates to detect form pages
    chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
      if (changeInfo.status === 'complete' && tab.url) {
        this.checkIfSchemePortal(tab);
      }
    });
  }

  async handleMessage(message, sender, sendResponse) {
    try {
      switch (message.type) {
        case 'GET_USER_PROFILE':
          const profile = await this.getUserProfile();
          sendResponse({ success: true, data: profile });
          break;

        case 'GET_USER_DOCUMENTS':
          const documents = await this.getUserDocuments();
          sendResponse({ success: true, data: documents });
          break;

        case 'UPDATE_PROFILE_FIELD':
          const updateResult = await this.updateProfileField(message.data);
          sendResponse({ success: true, data: updateResult });
          break;

        case 'LOG_AUTOFILL_ATTEMPT':
          const logResult = await this.logAutofillAttempt(message.data);
          sendResponse({ success: true, data: logResult });
          break;

        case 'CHECK_AUTH_STATUS':
          const authStatus = await this.checkAuthStatus();
          sendResponse({ success: true, data: authStatus });
          break;

        case 'GET_COMPLETE_PROFILE':
          const completeProfile = await this.getCompleteProfile();
          sendResponse({ success: true, data: completeProfile });
          break;

        default:
          sendResponse({ success: false, error: 'Unknown message type' });
      }
    } catch (error) {
      console.error('Background message handling error:', error);
      sendResponse({ success: false, error: error.message });
    }
  }

  async checkAuthStatus() {
    try {
      const result = await chrome.storage.local.get(['authToken']);
      return {
        isAuthenticated: !!result.authToken,
        token: result.authToken
      };
    } catch (error) {
      return { isAuthenticated: false };
    }
  }

  async getUserProfile() {
    try {
      const { authToken } = await chrome.storage.local.get(['authToken']);
      
      if (!authToken) {
        throw new Error('User not authenticated');
      }

      const response = await fetch(`${this.API_BASE}/auth/profile`, {
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error('Failed to fetch user profile');
      }

      const data = await response.json();
      return data.data;
    } catch (error) {
      console.error('Get user profile error:', error);
      throw error;
    }
  }

  async getUserDocuments() {
    try {
      const { authToken } = await chrome.storage.local.get(['authToken']);
      
      if (!authToken) {
        throw new Error('User not authenticated');
      }

      // Note: This endpoint needs to be implemented in the backend
      const response = await fetch(`${this.API_BASE}/user/documents`, {
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        // Return empty documents if endpoint doesn't exist yet
        return [];
      }

      const data = await response.json();
      return data.data || [];
    } catch (error) {
      console.error('Get user documents error:', error);
      return []; // Return empty array as fallback
    }
  }

  async updateProfileField(fieldData) {
    try {
      const { authToken } = await chrome.storage.local.get(['authToken']);
      
      if (!authToken) {
        throw new Error('User not authenticated');
      }

      // Note: This endpoint needs to be implemented in the backend
      const response = await fetch(`${this.API_BASE}/user/profile/add-field`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(fieldData)
      });

      if (!response.ok) {
        throw new Error('Failed to update profile field');
      }

      const data = await response.json();
      return data.data;
    } catch (error) {
      console.error('Update profile field error:', error);
      throw error;
    }
  }

  async logAutofillAttempt(logData) {
    try {
      const { authToken } = await chrome.storage.local.get(['authToken']);
      
      if (!authToken) {
        throw new Error('User not authenticated');
      }

      // Note: This endpoint needs to be implemented in the backend
      const response = await fetch(`${this.API_BASE}/autofill/log`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          ...logData,
          timestamp: new Date().toISOString(),
          url: logData.portal
        })
      });

      if (!response.ok) {
        console.warn('Failed to log autofill attempt');
        return null;
      }

      const data = await response.json();
      return data.data;
    } catch (error) {
      console.error('Log autofill attempt error:', error);
      return null; // Don't throw error for logging failures
    }
  }

  async checkIfSchemePortal(tab) {
    // Check if the current page might be a government scheme portal
    const schemeKeywords = [
      'gov.in', 'nic.in', 'scheme', 'application', 'form',
      'pmkisan', 'pmjay', 'ayushman', 'pradhan mantri',
      'ministry', 'department', 'portal', 'apply'
    ];

    const url = tab.url.toLowerCase();
    const isSchemePortal = schemeKeywords.some(keyword => url.includes(keyword));

    if (isSchemePortal) {
      // Show page action icon
      chrome.action.setBadgeText({
        tabId: tab.id,
        text: '!'
      });
      
      chrome.action.setBadgeBackgroundColor({
        tabId: tab.id,
        color: '#4CAF50'
      });
    }
  }

  async getCompleteProfile() {
    try {
      const { authToken } = await chrome.storage.local.get(['authToken']);
      
      if (!authToken) {
        throw new Error('User not authenticated');
      }

      const response = await fetch(`${this.API_BASE}/user/profile/complete`, {
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        // Fallback to regular profile if complete profile endpoint doesn't exist
        return await this.getUserProfile();
      }

      const data = await response.json();
      return data.data;
    } catch (error) {
      console.error('Get complete profile error:', error);
      // Fallback to regular profile
      return await this.getUserProfile();
    }
  }
}

// Initialize background service
new BackgroundService();