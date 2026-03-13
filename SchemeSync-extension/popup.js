// Popup Script for SchemeSync Extension
class PopupController {
  constructor() {
    this.API_BASE = 'http://localhost:3003/api';
    this.init();
  }

  async init() {
    try {
      await this.checkAuthStatus();
      await this.loadCurrentTabInfo();
      await this.loadUserStats();
    } catch (error) {
      console.error('Popup initialization error:', error);
      this.showError('Failed to initialize extension');
    }
  }

  async checkAuthStatus() {
    const result = await chrome.storage.local.get(['authToken']);
    
    if (!result.authToken) {
      this.showLoginRequired();
      return false;
    }
    
    return true;
  }

  async loadCurrentTabInfo() {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      
      if (!tab) {
        this.showError('Unable to access current tab');
        return;
      }

      // Check if current page has forms
      const hasFormsResult = await chrome.tabs.sendMessage(tab.id, { 
        type: 'CHECK_FORMS' 
      }).catch(() => null);

      this.displayTabInfo(tab, hasFormsResult);
    } catch (error) {
      console.error('Tab info error:', error);
      this.displayTabInfo(null, null);
    }
  }

  async loadUserStats() {
    try {
      const { authToken } = await chrome.storage.local.get(['authToken']);
      
      if (!authToken) return;

      // Get user profile
      const profileResponse = await fetch(`${this.API_BASE}/auth/profile`, {
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json'
        }
      });

      if (profileResponse.ok) {
        const profileData = await profileResponse.json();
        this.displayUserStats(profileData.data);
      }
    } catch (error) {
      console.error('Stats loading error:', error);
    }
  }

  showLoginRequired() {
    document.getElementById('content').innerHTML = `
      <div class="status error">
        <div class="status-title">Authentication Required</div>
        <div class="status-message">Please log in to SchemeSync to use the autofill feature.</div>
      </div>
      
      <div class="actions">
        <button class="btn" id="open-schemesync-btn">
          Open SchemeSync Portal
        </button>
      </div>
    `;
  }

  displayTabInfo(tab, formsInfo) {
    const isSchemePortal = tab ? this.isSchemePortal(tab.url) : false;
    const hasForms = formsInfo && formsInfo.hasForms;

    let statusClass = 'status';
    let statusTitle = 'Ready';
    let statusMessage = 'Extension is ready to assist with form filling';

    if (!isSchemePortal) {
      statusClass = 'status warning';
      statusTitle = 'Not a Scheme Portal';
      statusMessage = 'This doesn\'t appear to be a government scheme portal';
    } else if (!hasForms) {
      statusClass = 'status warning';
      statusTitle = 'No Forms Detected';
      statusMessage = 'No application forms found on this page';
    } else {
      statusClass = 'status';
      statusTitle = 'Forms Detected';
      statusMessage = `Found ${formsInfo.formCount || 1} form(s) ready for autofill`;
    }

    const content = `
      <div class="${statusClass}">
        <div class="status-title">${statusTitle}</div>
        <div class="status-message">${statusMessage}</div>
      </div>
      
      <div class="actions">
        ${hasForms ? `
          <button class="btn" id="activate-autofill-btn">
            Activate Autofill
          </button>
        ` : ''}
        <button class="btn secondary" id="open-profile-btn">
          Manage Profile
        </button>
        <button class="btn secondary" id="view-history-btn">
          View History
        </button>
      </div>
    `;

    document.getElementById('content').innerHTML = content;
  }

  displayUserStats(userData) {
    const user = userData.user || userData;
    const profileCompleteness = this.calculateProfileCompleteness(user);

    const statsHtml = `
      <div class="stats">
        <div class="stats-title">Profile Status</div>
        <div class="stats-row">
          <span class="stats-label">Completeness:</span>
          <span class="stats-value">${profileCompleteness}%</span>
        </div>
        <div class="stats-row">
          <span class="stats-label">Name:</span>
          <span class="stats-value">${user.name || 'Not set'}</span>
        </div>
        <div class="stats-row">
          <span class="stats-label">State:</span>
          <span class="stats-value">${user.state || 'Not set'}</span>
        </div>
      </div>
    `;

    // Insert stats before actions
    const content = document.getElementById('content');
    const actions = content.querySelector('.actions');
    if (actions) {
      actions.insertAdjacentHTML('beforebegin', statsHtml);
    }
  }

  calculateProfileCompleteness(user) {
    const requiredFields = [
      'name', 'email', 'date_of_birth', 'gender', 'state', 
      'district', 'annual_income', 'occupation', 'category'
    ];

    const filledFields = requiredFields.filter(field => 
      user[field] && user[field] !== null && user[field] !== ''
    );

    return Math.round((filledFields.length / requiredFields.length) * 100);
  }

  isSchemePortal(url) {
    if (!url) return false;
    
    const schemeKeywords = [
      'gov.in', 'nic.in', 'scheme', 'application', 'form',
      'pmkisan', 'pmjay', 'ayushman', 'pradhan mantri',
      'ministry', 'department', 'portal'
    ];

    return schemeKeywords.some(keyword => 
      url.toLowerCase().includes(keyword)
    );
  }

  async activateAutofill() {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      
      await chrome.tabs.sendMessage(tab.id, { 
        type: 'ACTIVATE_AUTOFILL' 
      });

      // Close popup
      window.close();
    } catch (error) {
      console.error('Autofill activation error:', error);
      this.showError('Failed to activate autofill');
    }
  }

  openSchemeSync() {
    chrome.tabs.create({ url: 'http://localhost:3000' });
    window.close();
  }

  openProfile() {
    chrome.tabs.create({ url: 'http://localhost:3000/profile' });
    window.close();
  }

  viewHistory() {
    chrome.tabs.create({ url: 'http://localhost:3000/dashboard' });
    window.close();
  }

  showError(message) {
    document.getElementById('content').innerHTML = `
      <div class="status error">
        <div class="status-title">Error</div>
        <div class="status-message">${message}</div>
      </div>
      
      <div class="actions">
        <button class="btn secondary" id="retry-btn">
          Retry
        </button>
      </div>
    `;
  }
}

// Initialize popup when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  const popup = new PopupController();
  
  // Handle button clicks
  document.addEventListener('click', (e) => {
    switch (e.target.id) {
      case 'open-schemesync-btn':
        popup.openSchemeSync();
        break;
      case 'activate-autofill-btn':
        popup.activateAutofill();
        break;
      case 'open-profile-btn':
        popup.openProfile();
        break;
      case 'view-history-btn':
        popup.viewHistory();
        break;
      case 'retry-btn':
        location.reload();
        break;
    }
  });
});