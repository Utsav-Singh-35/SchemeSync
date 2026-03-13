// Simple SchemeSync Background Script
console.log('🔧 SchemeSync background script loaded');

class SimpleBackground {
  constructor() {
    this.setupEventListeners();
  }

  setupEventListeners() {
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      this.handleMessage(message, sender, sendResponse);
      return true;
    });
  }

  async handleMessage(message, sender, sendResponse) {
    console.log('📨 Background received:', message.type);

    try {
      switch (message.type) {
        case 'TRIGGER_AUTOFILL':
          const result = await this.handleAutofillTrigger(message.data);
          sendResponse({ success: true, data: result });
          break;
        case 'OPEN_CLEAN_AUTH_TAB':
          const authResult = await this.openCleanAuthTab(message.data);
          sendResponse({ success: true, data: authResult });
          break;
        case 'GET_CURRENT_TAB_ID':
          const tabId = sender.tab ? sender.tab.id : null;
          sendResponse({ success: true, data: { tabId } });
          break;
        default:
          sendResponse({ success: false, error: 'Unknown message type' });
      }
    } catch (error) {
      console.error('Background error:', error);
      sendResponse({ success: false, error: error.message });
    }
  }

  async openCleanAuthTab(data) {
    const { authUrl, originalTabId } = data;
    console.log('🔐 Opening clean auth tab:', authUrl);

    try {
      // Create new tab without extension content scripts
      const authTab = await chrome.tabs.create({
        url: authUrl,
        active: true
      });

      console.log('✅ Clean auth tab created:', authTab.id);
      
      return {
        success: true,
        authTabId: authTab.id,
        message: 'Authentication tab opened'
      };

    } catch (error) {
      console.error('Failed to open auth tab:', error);
      throw error;
    }
  }

  async handleAutofillTrigger(data) {
    const { schemeId, applicationUrl } = data;
    console.log('🚀 Creating tab for:', applicationUrl);

    try {
      // Create new tab
      const tab = await chrome.tabs.create({
        url: applicationUrl,
        active: true
      });

      console.log('📄 Tab created:', tab.id);

      // Wait for tab to load
      await this.waitForTabLoad(tab.id);

      // Send autofill message to content script
      await chrome.tabs.sendMessage(tab.id, {
        type: 'START_AUTOFILL',
        data: { schemeId, applicationUrl }
      });

      return {
        success: true,
        message: 'Autofill started',
        tabId: tab.id
      };

    } catch (error) {
      console.error('Autofill trigger failed:', error);
      throw error;
    }
  }

  async waitForTabLoad(tabId) {
    return new Promise((resolve) => {
      const checkTab = () => {
        chrome.tabs.get(tabId, (tab) => {
          if (tab.status === 'complete') {
            resolve();
          } else {
            setTimeout(checkTab, 100);
          }
        });
      };
      checkTab();
    });
  }
}

// Initialize
new SimpleBackground();