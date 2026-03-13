// Advanced Intelligent Navigation System for SchemeSync Extension
console.log('🔧 IntelligentNavigator script loading...');

class IntelligentNavigator {
  constructor() {
    this.API_BASE = 'http://localhost:3003/api';
    this.currentSession = null;
    this.stepNumber = 1;
    this.maxSteps = 15; // Prevent infinite loops
    this.isNavigating = false;
    this.userProfile = null;
    this.navigationHistory = [];
    this.confidenceThreshold = 0.7;
    this.retryAttempts = 3;
    
    this.setupEventListeners();
  }

  setupEventListeners() {
    // Listen for page navigation events
    window.addEventListener('beforeunload', () => {
      this.handlePageUnload();
    });

    // Listen for DOM changes that might indicate page updates
    this.observePageChanges();
  }

  async startIntelligentNavigation(objective = 'find_application_form', schemeId = null) {
    console.log('🚀 IntelligentNavigator.startIntelligentNavigation called');
    console.log('📋 Parameters:', { objective, schemeId });
    
    if (this.isNavigating) {
      console.warn('⚠️ Navigation already in progress');
      return;
    }

    try {
      console.log('🔄 Setting navigation state...');
      this.isNavigating = true;
      this.stepNumber = 1;
      
      console.log('📡 Starting navigation session...');
      // Start new navigation session
      const sessionResponse = await this.sendMessage({
        type: 'START_NAVIGATION_SESSION',
        data: {
          startUrl: window.location.href,
          objective,
          schemeId
        }
      });

      console.log('📡 Session response:', sessionResponse);

      if (!sessionResponse.success) {
        throw new Error('Failed to start navigation session');
      }

      this.currentSession = sessionResponse.data.sessionId;
      console.log('🆔 Session ID:', this.currentSession);
      
      console.log('👤 Getting user profile...');
      // Get user profile for context
      this.userProfile = await this.getUserProfile();
      console.log('👤 User profile loaded:', !!this.userProfile);
      
      console.log('🎨 Showing navigation UI...');
      // Show navigation UI
      this.showNavigationInterface();
      
      console.log('🎯 Starting navigation process...');
      // Start the navigation process
      await this.navigateToTarget(objective);
      
    } catch (error) {
      console.error('❌ Intelligent navigation failed:', error);
      this.showError('Navigation failed: ' + error.message);
      this.isNavigating = false;
    }
  }

  async navigateToTarget(objective) {
    let currentStep = 1;
    let lastUrl = '';
    
    while (currentStep <= this.maxSteps && this.isNavigating) {
      try {
        const currentUrl = window.location.href;
        
        // Avoid infinite loops on same page
        if (currentUrl === lastUrl && currentStep > 1) {
          await this.delay(2000); // Wait for potential page changes
          if (window.location.href === lastUrl) {
            throw new Error('Navigation stuck on same page');
          }
        }
        
        lastUrl = currentUrl;
        
        // Update UI with current step
        this.updateNavigationStatus(`Step ${currentStep}: Analyzing page...`);
        
        // Analyze current page
        const analysis = await this.analyzeCurrentPage(objective, currentStep);
        
        // Log the step
        this.navigationHistory.push({
          step: currentStep,
          url: currentUrl,
          action: analysis.action,
          confidence: analysis.confidence,
          reasoning: analysis.reasoning
        });
        
        // Handle the analysis result
        const result = await this.executeNavigationAction(analysis, currentStep);
        
        if (result.completed) {
          await this.completeNavigation(result);
          return;
        }
        
        if (result.blocked) {
          await this.handleNavigationBlocked(result);
          return;
        }
        
        if (result.requiresUserAction) {
          const userDecision = await this.promptUserAction(result);
          if (!userDecision.continue) {
            this.cancelNavigation('User cancelled navigation');
            return;
          }
        }
        
        currentStep++;
        
        // Wait for page to load after action
        if (result.waitForNavigation) {
          await this.waitForPageLoad();
        }
        
      } catch (error) {
        console.error(`Navigation step ${currentStep} failed:`, error);
        
        // Try to recover or ask user for guidance
        const recovery = await this.attemptRecovery(error, currentStep);
        if (!recovery.success) {
          this.showError(`Navigation failed at step ${currentStep}: ${error.message}`);
          this.isNavigating = false;
          return;
        }
        
        currentStep++;
      }
    }
    
    // Max steps reached
    this.showError('Navigation reached maximum steps without finding application form');
    this.isNavigating = false;
  }

  async analyzeCurrentPage(objective, stepNumber) {
    try {
      // Capture page content
      const pageData = this.capturePageData();
      
      // Send to backend AI service for analysis
      const response = await this.sendMessage({
        type: 'ANALYZE_PAGE',
        data: {
          url: window.location.href,
          html: pageData.html,
          screenshot: pageData.screenshot,
          objective,
          sessionId: this.currentSession,
          stepNumber
        }
      });

      if (!response.success) {
        throw new Error('Page analysis failed: ' + response.error);
      }

      const analysis = response.data;
      
      // Validate analysis confidence
      if (analysis.confidence < this.confidenceThreshold) {
        console.warn(`Low confidence analysis (${analysis.confidence}):`, analysis.reasoning);
      }
      
      return analysis;
      
    } catch (error) {
      console.error('Page analysis error:', error);
      
      // Fallback to basic pattern analysis
      return this.performBasicAnalysis(objective);
    }
  }

  capturePageData() {
    // Capture essential page data for analysis
    const html = document.documentElement.outerHTML;
    
    // Create a cleaned version for analysis
    const cleanedHtml = this.cleanHtmlForAnalysis(html);
    
    // Capture screenshot if possible (limited in content scripts)
    let screenshot = null;
    try {
      // This would require additional permissions and implementation
      screenshot = this.captureScreenshot();
    } catch (error) {
      console.warn('Screenshot capture failed:', error);
    }
    
    return {
      html: cleanedHtml,
      screenshot,
      url: window.location.href,
      title: document.title,
      forms: this.detectForms(),
      links: this.extractImportantLinks(),
      buttons: this.extractActionButtons()
    };
  }

  cleanHtmlForAnalysis(html) {
    // Remove scripts, styles, and other noise for better LLM analysis
    let cleaned = html
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
      .replace(/<!--[\s\S]*?-->/g, '')
      .replace(/\s+/g, ' ')
      .trim();
    
    // Limit size (LLM token limits)
    if (cleaned.length > 50000) {
      // Extract key sections
      const keyContent = this.extractKeyContent(cleaned);
      cleaned = keyContent.substring(0, 50000);
    }
    
    return cleaned;
  }

  extractKeyContent(html) {
    const keySelectors = [
      'form', 'nav', 'main', '.main-content', '#main', '.content',
      '.login', '.signin', '.application', '.apply', '.register',
      'header', '.header', '.navigation', '.menu', '.sidebar'
    ];
    
    let keyContent = '';
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    
    keySelectors.forEach(selector => {
      const elements = doc.querySelectorAll(selector);
      elements.forEach(el => {
        keyContent += el.outerHTML + ' ';
      });
    });
    
    return keyContent || html;
  }

  detectForms() {
    const forms = [];
    document.querySelectorAll('form').forEach((form, index) => {
      const inputs = form.querySelectorAll('input, select, textarea');
      forms.push({
        index,
        id: form.id || `form_${index}`,
        action: form.action,
        method: form.method,
        inputCount: inputs.length,
        hasFileInput: form.querySelector('input[type="file"]') !== null,
        hasSubmitButton: form.querySelector('input[type="submit"], button[type="submit"]') !== null
      });
    });
    return forms;
  }

  extractImportantLinks() {
    const links = [];
    const importantPatterns = [
      /apply/i, /application/i, /register/i, /login/i, /signin/i,
      /form/i, /new/i, /create/i, /start/i, /begin/i
    ];
    
    document.querySelectorAll('a[href]').forEach((link, index) => {
      const text = link.textContent.trim();
      const href = link.href;
      
      if (importantPatterns.some(pattern => pattern.test(text) || pattern.test(href))) {
        links.push({
          index,
          text,
          href,
          selector: this.generateSelector(link)
        });
      }
    });
    
    return links.slice(0, 20); // Limit to most relevant
  }

  extractActionButtons() {
    const buttons = [];
    const buttonSelectors = 'button, input[type="button"], input[type="submit"], .btn, .button';
    
    document.querySelectorAll(buttonSelectors).forEach((button, index) => {
      const text = button.textContent || button.value || '';
      if (text.trim()) {
        buttons.push({
          index,
          text: text.trim(),
          type: button.type || 'button',
          selector: this.generateSelector(button)
        });
      }
    });
    
    return buttons.slice(0, 15); // Limit to most relevant
  }

  async executeNavigationAction(analysis, stepNumber) {
    const { action, element, data, userInstructions, confidence } = analysis;
    
    this.updateNavigationStatus(`Step ${stepNumber}: ${analysis.reasoning}`);
    
    switch (action) {
      case 'form_found':
        return await this.handleFormFound(analysis);
        
      case 'login_required':
        return await this.handleLoginRequired(analysis);
        
      case 'click_element':
        return await this.handleClickElement(analysis);
        
      case 'navigate':
        return await this.handleNavigate(analysis);
        
      case 'blocked':
        return await this.handleBlocked(analysis);
        
      case 'analyze_further':
        return await this.handleAnalyzeFurther(analysis);
        
      default:
        throw new Error(`Unknown action: ${action}`);
    }
  }

  async handleFormFound(analysis) {
    this.updateNavigationStatus('✅ Application form found! Starting autofill...');
    
    // Switch to autofill mode
    setTimeout(() => {
      this.completeNavigationAndStartAutofill();
    }, 1000);
    
    return { completed: true, action: 'form_found' };
  }

  async handleLoginRequired(analysis) {
    const { data, userInstructions } = analysis;
    
    this.updateNavigationStatus('🔐 Login required - preparing credentials...');
    
    // Show user instructions
    const userConfirmed = await this.showUserPrompt({
      title: 'Login Required',
      message: userInstructions,
      actions: ['Fill Credentials', 'Skip', 'Cancel']
    });
    
    if (userConfirmed.action === 'Cancel') {
      return { completed: false, cancelled: true };
    }
    
    if (userConfirmed.action === 'Fill Credentials') {
      await this.fillLoginCredentials(analysis);
    }
    
    return { 
      requiresUserAction: true, 
      waitForNavigation: true,
      action: 'login_assistance'
    };
  }

  async handleClickElement(analysis) {
    const { element, reasoning } = analysis;
    
    if (!element) {
      throw new Error('No element specified for click action');
    }
    
    // Find the element
    const targetElement = document.querySelector(element);
    if (!targetElement) {
      throw new Error(`Element not found: ${element}`);
    }
    
    // Highlight element for user confirmation
    this.highlightElement(targetElement);
    
    const userConfirmed = await this.showUserPrompt({
      title: 'Confirm Action',
      message: `Click on: "${targetElement.textContent?.trim() || element}"\n\nReason: ${reasoning}`,
      actions: ['Confirm', 'Skip', 'Cancel']
    });
    
    this.removeHighlight(targetElement);
    
    if (userConfirmed.action === 'Cancel') {
      return { completed: false, cancelled: true };
    }
    
    if (userConfirmed.action === 'Confirm') {
      // Scroll element into view
      targetElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
      
      // Wait a moment then click
      await this.delay(500);
      targetElement.click();
      
      this.updateNavigationStatus('✅ Element clicked successfully');
    }
    
    return { 
      waitForNavigation: userConfirmed.action === 'Confirm',
      action: 'element_clicked'
    };
  }

  async handleBlocked(analysis) {
    const { data, reasoning } = analysis;
    
    this.updateNavigationStatus('⚠️ Navigation blocked: ' + reasoning);
    
    await this.showUserPrompt({
      title: 'Navigation Blocked',
      message: `${reasoning}\n\nThe system cannot proceed automatically. Please continue manually.`,
      actions: ['OK']
    });
    
    return { blocked: true, reason: reasoning };
  }

  async fillLoginCredentials(analysis) {
    const { data } = analysis;
    
    if (!this.userProfile) {
      console.warn('No user profile available for credential filling');
      return;
    }
    
    try {
      // Fill mobile number if required
      if (data.fields?.includes('mobile_number')) {
        const mobileInput = document.querySelector('input[type="tel"], input[name*="mobile"], input[id*="mobile"]');
        if (mobileInput && this.userProfile.phone_number) {
          mobileInput.value = this.userProfile.phone_number;
          this.triggerInputEvents(mobileInput);
          this.highlightFilledField(mobileInput);
        }
      }
      
      // Fill username if required
      if (data.fields?.includes('username')) {
        const usernameInput = document.querySelector('input[name*="user"], input[id*="user"], input[type="email"]');
        if (usernameInput && this.userProfile.email) {
          usernameInput.value = this.userProfile.email;
          this.triggerInputEvents(usernameInput);
          this.highlightFilledField(usernameInput);
        }
      }
      
      this.updateNavigationStatus('✅ Credentials filled - please review and login manually');
      
    } catch (error) {
      console.error('Credential filling error:', error);
      this.updateNavigationStatus('⚠️ Could not fill all credentials - please fill manually');
    }
  }
  // UI and User Interaction Methods
  showNavigationInterface() {
    // Create navigation overlay UI
    const overlay = document.createElement('div');
    overlay.id = 'schemesync-navigation-overlay';
    overlay.innerHTML = `
      <div class="schemesync-nav-panel">
        <div class="schemesync-nav-header">
          <h3>🤖 SchemeSync AI Navigator</h3>
          <button class="schemesync-nav-close" data-action="close-navigation">×</button>
        </div>
        <div class="schemesync-nav-content">
          <div class="schemesync-nav-status" id="schemesync-nav-status">
            Initializing intelligent navigation...
          </div>
          <div class="schemesync-nav-progress">
            <div class="schemesync-progress-bar" id="schemesync-progress-bar"></div>
          </div>
          <div class="schemesync-nav-history" id="schemesync-nav-history"></div>
        </div>
        <div class="schemesync-nav-actions">
          <button class="schemesync-btn secondary" data-action="pause-navigation">Pause</button>
          <button class="schemesync-btn danger" data-action="cancel-navigation">Cancel</button>
        </div>
      </div>
    `;
    
    // Add styles
    const styles = `
      #schemesync-navigation-overlay {
        position: fixed;
        top: 20px;
        right: 20px;
        width: 350px;
        background: white;
        border-radius: 12px;
        box-shadow: 0 10px 30px rgba(0,0,0,0.3);
        z-index: 999999;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        border: 2px solid #4CAF50;
      }
      
      .schemesync-nav-panel {
        padding: 0;
      }
      
      .schemesync-nav-header {
        background: #4CAF50;
        color: white;
        padding: 12px 16px;
        border-radius: 10px 10px 0 0;
        display: flex;
        justify-content: space-between;
        align-items: center;
      }
      
      .schemesync-nav-header h3 {
        margin: 0;
        font-size: 16px;
        font-weight: 600;
      }
      
      .schemesync-nav-close {
        background: none;
        border: none;
        color: white;
        font-size: 20px;
        cursor: pointer;
        padding: 0;
        width: 24px;
        height: 24px;
        display: flex;
        align-items: center;
        justify-content: center;
      }
      
      .schemesync-nav-content {
        padding: 16px;
      }
      
      .schemesync-nav-status {
        font-size: 14px;
        color: #333;
        margin-bottom: 12px;
        min-height: 20px;
      }
      
      .schemesync-nav-progress {
        background: #f0f0f0;
        height: 4px;
        border-radius: 2px;
        margin-bottom: 16px;
        overflow: hidden;
      }
      
      .schemesync-progress-bar {
        background: #4CAF50;
        height: 100%;
        width: 0%;
        transition: width 0.3s ease;
      }
      
      .schemesync-nav-history {
        max-height: 150px;
        overflow-y: auto;
        font-size: 12px;
        color: #666;
      }
      
      .schemesync-nav-step {
        padding: 4px 0;
        border-bottom: 1px solid #eee;
      }
      
      .schemesync-nav-actions {
        padding: 12px 16px;
        border-top: 1px solid #eee;
        display: flex;
        gap: 8px;
      }
      
      .schemesync-btn {
        padding: 8px 16px;
        border: none;
        border-radius: 6px;
        cursor: pointer;
        font-size: 12px;
        font-weight: 500;
        flex: 1;
      }
      
      .schemesync-btn.secondary {
        background: #f5f5f5;
        color: #333;
      }
      
      .schemesync-btn.danger {
        background: #f44336;
        color: white;
      }
    `;
    
    // Inject styles
    const styleSheet = document.createElement('style');
    styleSheet.textContent = styles;
    document.head.appendChild(styleSheet);
    
    document.body.appendChild(overlay);
    
    // Make navigator globally accessible for button handlers
    window.schemeSyncNavigator = this;
  }

  updateNavigationStatus(status) {
    const statusElement = document.getElementById('schemesync-nav-status');
    if (statusElement) {
      statusElement.textContent = status;
    }
    
    // Update progress bar
    const progressBar = document.getElementById('schemesync-progress-bar');
    if (progressBar) {
      const progress = Math.min((this.stepNumber / this.maxSteps) * 100, 100);
      progressBar.style.width = progress + '%';
    }
    
    // Add to history
    this.addToNavigationHistory(status);
  }

  addToNavigationHistory(status) {
    const historyElement = document.getElementById('schemesync-nav-history');
    if (historyElement) {
      const stepElement = document.createElement('div');
      stepElement.className = 'schemesync-nav-step';
      stepElement.textContent = `${new Date().toLocaleTimeString()}: ${status}`;
      historyElement.appendChild(stepElement);
      historyElement.scrollTop = historyElement.scrollHeight;
    }
  }

  async showUserPrompt(options) {
    return new Promise((resolve) => {
      const modal = document.createElement('div');
      modal.className = 'schemesync-modal-overlay';
      modal.innerHTML = `
        <div class="schemesync-modal">
          <h3>${options.title}</h3>
          <p>${options.message.replace(/\n/g, '<br>')}</p>
          <div class="schemesync-modal-actions">
            ${options.actions.map(action => 
              `<button class="schemesync-btn" data-action="${action}">${action}</button>`
            ).join('')}
          </div>
        </div>
      `;
      
      // Add modal styles
      const modalStyles = `
        .schemesync-modal-overlay {
          position: fixed;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          background: rgba(0,0,0,0.7);
          z-index: 1000000;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        
        .schemesync-modal {
          background: white;
          padding: 24px;
          border-radius: 12px;
          max-width: 500px;
          width: 90%;
          box-shadow: 0 20px 40px rgba(0,0,0,0.3);
        }
        
        .schemesync-modal h3 {
          margin: 0 0 16px 0;
          color: #333;
        }
        
        .schemesync-modal p {
          margin: 0 0 20px 0;
          color: #666;
          line-height: 1.5;
        }
        
        .schemesync-modal-actions {
          display: flex;
          gap: 12px;
          justify-content: flex-end;
        }
      `;
      
      const styleSheet = document.createElement('style');
      styleSheet.textContent = modalStyles;
      document.head.appendChild(styleSheet);
      
      // Handle button clicks
      modal.addEventListener('click', (e) => {
        if (e.target.dataset.action) {
          const action = e.target.dataset.action;
          modal.remove();
          styleSheet.remove();
          resolve({ action });
        }
      });
      
      document.body.appendChild(modal);
    });
  }

  highlightElement(element) {
    element.style.outline = '3px solid #4CAF50';
    element.style.backgroundColor = 'rgba(76, 175, 80, 0.1)';
    element.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  removeHighlight(element) {
    element.style.outline = '';
    element.style.backgroundColor = '';
  }

  highlightFilledField(element) {
    element.style.backgroundColor = '#e8f5e8';
    element.style.border = '2px solid #4CAF50';
  }

  // Utility Methods
  generateSelector(element) {
    if (element.id) return `#${element.id}`;
    if (element.className) return `.${element.className.split(' ')[0]}`;
    return element.tagName.toLowerCase();
  }

  triggerInputEvents(element) {
    const events = ['input', 'change', 'blur'];
    events.forEach(eventType => {
      const event = new Event(eventType, { bubbles: true });
      element.dispatchEvent(event);
    });
  }

  async waitForPageLoad() {
    return new Promise((resolve) => {
      if (document.readyState === 'complete') {
        setTimeout(resolve, 1000); // Additional wait for dynamic content
      } else {
        window.addEventListener('load', () => {
          setTimeout(resolve, 1000);
        });
      }
    });
  }

  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async getUserProfile() {
    try {
      const response = await this.sendMessage({ type: 'GET_USER_PROFILE' });
      return response.success ? response.data : null;
    } catch (error) {
      console.error('Failed to get user profile:', error);
      return null;
    }
  }

  async sendMessage(message) {
    return new Promise((resolve) => {
      chrome.runtime.sendMessage(message, (response) => {
        resolve(response || { success: false, error: 'No response' });
      });
    });
  }

  // Navigation Control Methods
  pauseNavigation() {
    this.isNavigating = false;
    this.updateNavigationStatus('⏸️ Navigation paused by user');
  }

  cancelNavigation(reason = 'User cancelled') {
    this.isNavigating = false;
    this.updateNavigationStatus('❌ Navigation cancelled: ' + reason);
    
    // Clean up UI
    setTimeout(() => {
      const overlay = document.getElementById('schemesync-navigation-overlay');
      if (overlay) overlay.remove();
    }, 2000);
  }

  async completeNavigation(result) {
    this.isNavigating = false;
    this.updateNavigationStatus('✅ Navigation completed successfully!');
    
    // Log completion
    await this.sendMessage({
      type: 'COMPLETE_NAVIGATION',
      data: {
        sessionId: this.currentSession,
        success: true,
        result: result
      }
    });
  }

  completeNavigationAndStartAutofill() {
    this.updateNavigationStatus('🎯 Starting autofill process...');
    
    // Remove navigation UI
    setTimeout(() => {
      const overlay = document.getElementById('schemesync-navigation-overlay');
      if (overlay) overlay.remove();
      
      // Trigger existing autofill system
      if (window.schemeSyncContent) {
        window.schemeSyncContent.checkForForms();
      }
    }, 1500);
  }

  performBasicAnalysis(objective) {
    // Fallback analysis when AI service is unavailable
    const forms = this.detectForms();
    
    if (forms.length > 0) {
      return {
        action: 'form_found',
        confidence: 0.8,
        reasoning: 'Found application form on page',
        element: 'form',
        data: { formCount: forms.length }
      };
    }
    
    // Look for common navigation patterns
    const applyLinks = document.querySelectorAll('a[href*="apply"], a:contains("Apply")');
    if (applyLinks.length > 0) {
      return {
        action: 'click_element',
        confidence: 0.7,
        reasoning: 'Found "Apply" link',
        element: this.generateSelector(applyLinks[0]),
        data: { linkText: applyLinks[0].textContent }
      };
    }
    
    return {
      action: 'analyze_further',
      confidence: 0.3,
      reasoning: 'No clear navigation path found',
      element: null,
      data: {}
    };
  }

  observePageChanges() {
    const observer = new MutationObserver((mutations) => {
      if (this.isNavigating) {
        // Page content changed during navigation
        let significantChange = false;
        
        mutations.forEach((mutation) => {
          if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
            mutation.addedNodes.forEach((node) => {
              if (node.nodeType === Node.ELEMENT_NODE) {
                const hasForm = node.querySelector && node.querySelector('form');
                const hasImportantContent = node.querySelector && 
                  node.querySelector('.login, .application, .form, .apply');
                
                if (hasForm || hasImportantContent) {
                  significantChange = true;
                }
              }
            });
          }
        });
        
        if (significantChange) {
          // Debounce to avoid too frequent updates
          clearTimeout(this.pageChangeTimeout);
          this.pageChangeTimeout = setTimeout(() => {
            this.updateNavigationStatus('📄 Page content updated - re-analyzing...');
          }, 1000);
        }
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true
    });
  }

  handlePageUnload() {
    if (this.isNavigating && this.currentSession) {
      // Save navigation state before page unload
      this.sendMessage({
        type: 'SAVE_NAVIGATION_STATE',
        data: {
          sessionId: this.currentSession,
          stepNumber: this.stepNumber,
          history: this.navigationHistory
        }
      });
    }
  }
}

// Make IntelligentNavigator available globally
console.log('🌍 Making IntelligentNavigator globally available...');
window.IntelligentNavigator = IntelligentNavigator;
console.log('✅ IntelligentNavigator assigned to window:', !!window.IntelligentNavigator);