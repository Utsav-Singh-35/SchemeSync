// SchemeSync Extension Background Script
class BackgroundService {
  constructor() {
    this.API_BASE = 'http://localhost:3003/api';
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
        case 'TRIGGER_AUTOFILL':
          const autofillResult = await this.handleAutofillTrigger(message.data);
          sendResponse({ success: true, data: autofillResult });
          break;

        case 'START_NAVIGATION_SESSION':
          const sessionResult = await this.startNavigationSession(message.data);
          sendResponse({ success: true, data: sessionResult });
          break;

        case 'ANALYZE_PAGE':
          const analysisResult = await this.analyzePage(message.data);
          sendResponse({ success: true, data: analysisResult });
          break;

        case 'COMPLETE_NAVIGATION':
          const completionResult = await this.completeNavigation(message.data);
          sendResponse({ success: true, data: completionResult });
          break;

        case 'GET_USER_PROFILE':
          const userProfile = await this.getUserProfile();
          sendResponse({ success: true, data: userProfile });
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

  async handleAutofillTrigger(data) {
    const { schemeId, applicationUrl } = data;
    
    try {
      console.log('🚀 Background handling autofill trigger:', { schemeId, applicationUrl });
      
      // Create new tab with the application URL
      const tab = await chrome.tabs.create({
        url: applicationUrl,
        active: true
      });
      
      console.log('📄 New tab created:', tab.id);
      
      // Wait for tab to load
      await this.waitForTabLoad(tab.id);
      console.log('✅ Tab loaded successfully');
      
      console.log('📝 Scripts injected, waiting for content script readiness...');
      
      // Inject intelligent navigator first, then content script
      try {
        // First inject a minimal IntelligentNavigator directly
        await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          func: () => {
            console.log('🔧 Creating minimal IntelligentNavigator...');
            
            class IntelligentNavigator {
              constructor() {
                this.API_BASE = 'http://localhost:3003/api';
                this.isNavigating = false;
                console.log('🤖 IntelligentNavigator constructor called');
              }
              
              async startIntelligentNavigation(objective, schemeId) {
                console.log('🚀 Starting intelligent navigation:', { objective, schemeId });
                
                // Show a simple UI indicator
                const indicator = document.createElement('div');
                indicator.innerHTML = '🤖 SchemeSync AI Navigation Active';
                indicator.style.cssText = `
                  position: fixed; top: 20px; right: 20px; z-index: 10000;
                  background: #f59e0b; color: white; padding: 10px 15px;
                  border-radius: 8px; font-family: Arial; font-size: 14px;
                  box-shadow: 0 4px 12px rgba(0,0,0,0.3);
                `;
                document.body.appendChild(indicator);
                
                // Simple form detection
                const forms = document.querySelectorAll('form');
                console.log(`📋 Found ${forms.length} forms on page`);
                
                if (forms.length > 0) {
                  indicator.innerHTML = `🎯 Found ${forms.length} form(s) - Ready for autofill`;
                  indicator.style.background = '#10b981';
                } else {
                  indicator.innerHTML = '🔍 Analyzing page for application forms...';
                }
                
                return { success: true, formsFound: forms.length };
              }
            }
            
            window.IntelligentNavigator = IntelligentNavigator;
            console.log('✅ IntelligentNavigator available globally');
          }
        });
        
        // Then inject content script
        await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          files: ['content.js']
        });
        
        console.log('✅ Script injection completed successfully');
      } catch (injectionError) {
        console.error('❌ Script injection failed:', injectionError);
        throw new Error(`Script injection failed: ${injectionError.message}`);
      }
      
      // Wait for content script to be ready with proper retry logic
      let retries = 0;
      const maxRetries = 10;
      let contentReady = false;
      
      while (!contentReady && retries < maxRetries) {
        try {
          console.log(`🔄 Ping attempt ${retries + 1}/${maxRetries}`);
          const response = await chrome.tabs.sendMessage(tab.id, {
            type: 'PING'
          });
          if (response && response.success) {
            contentReady = true;
            console.log('✅ Content script is ready!');
          }
        } catch (error) {
          console.log(`❌ Ping failed: ${error.message}`);
          retries++;
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      }
      
      if (!contentReady) {
        console.error('❌ Content script failed to initialize after 5 seconds');
        throw new Error('Content script failed to initialize after 5 seconds');
      }
      
      console.log('🤖 Starting intelligent navigation...');
      
      // Send message to start intelligent navigation
      const navResponse = await chrome.tabs.sendMessage(tab.id, {
        type: 'START_INTELLIGENT_NAVIGATION',
        data: {
          objective: 'find_and_fill_application_form',
          schemeId: schemeId
        }
      });
      
      console.log('🎯 Navigation response:', navResponse);
      
      return {
        success: true,
        message: 'Intelligent navigation started',
        tabId: tab.id
      };
      
    } catch (error) {
      console.error('❌ Autofill trigger failed:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  async waitForTabLoad(tabId) {
    return new Promise((resolve) => {
      const checkTab = () => {
        chrome.tabs.get(tabId, (tab) => {
          if (tab.status === 'complete') {
            resolve();
          } else {
            setTimeout(checkTab, 500);
          }
        });
      };
      checkTab();
    });
  }

  async startNavigationSession(data) {
    try {
      const { authToken } = await chrome.storage.local.get(['authToken']);
      
      if (!authToken) {
        throw new Error('User not authenticated');
      }

      // Implementation continues...
      return { success: true, sessionId: Date.now().toString() };
    } catch (error) {
      console.error('Start navigation session error:', error);
      throw error;
    }
  }
}

// Initialize background service
new BackgroundService();