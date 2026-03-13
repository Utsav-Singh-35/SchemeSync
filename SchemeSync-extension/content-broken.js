// SchemeSync Extension Content Script
class SchemeSyncContent {
  constructor() {
    this.isActive = false;
    this.userProfile = null;
    this.documents = [];
    this.domAnalyzer = null;
    this.autofillEngine = null;
    this.uiOverlay = null;
    this.intelligentNavigator = null;
    
    // Only do full initialization if not in injected context
    const isInjected = !document.querySelector('[data-schemesync-extension]');
    if (!isInjected) {
      this.init();
    }
  }

  async init() {
    // Inject extension detection marker
    this.injectDetectionMarker();
    
    // Listen for extension detection events from frontend
    this.setupEventListeners();
    
    // Listen for messages from background script
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      this.handleBackgroundMessage(message, sender, sendResponse);
      return true; // Keep message channel open
    });
    
    // Check if user is authenticated
    const authStatus = await this.sendMessage({ type: 'CHECK_AUTH_STATUS' });
    
    if (!authStatus.success || !authStatus.data.isAuthenticated) {
      console.log('SchemeSync: User not authenticated');
      return;
    }

    // Load required modules
    await this.loadModules();
    
    // Check if current page has forms
    this.checkForForms();
    
    // Listen for dynamic content changes
    this.observePageChanges();
    
    console.log('SchemeSync Extension initialized');
  }

  async handleBackgroundMessage(message, sender, sendResponse) {
    console.log('📨 Handling background message:', message.type);
    
    try {
      switch (message.type) {
        case 'PING':
          console.log('🏓 PING received, checking readiness...');
          // Check if extension is ready
          const isReady = this.intelligentNavigator !== null;
          console.log('📊 Readiness status:', isReady);
          sendResponse({ success: isReady });
          break;
        case 'START_INTELLIGENT_NAVIGATION':
          console.log('🤖 Starting intelligent navigation:', message.data);
          await this.startIntelligentNavigation(message.data);
          sendResponse({ success: true });
          break;
        default:
          console.log('❓ Unknown message type:', message.type);
          sendResponse({ success: false, error: 'Unknown message type' });
      }
    } catch (error) {
      console.error('❌ Background message handling error:', error);
      sendResponse({ success: false, error: error.message });
    }
  }

  async startIntelligentNavigation(data) {
    const { objective, schemeId } = data;
    
    if (!this.intelligentNavigator) {
      console.error('Intelligent Navigator not loaded');
      return;
    }
    
    try {
      // Start the intelligent navigation process
      await this.intelligentNavigator.startIntelligentNavigation(objective, schemeId);
    } catch (error) {
      console.error('Failed to start intelligent navigation:', error);
    }
  }

  injectDetectionMarker() {
    // Add a marker element that frontend can detect
    const marker = document.createElement('div');
    marker.setAttribute('data-schemesync-extension', 'active');
    marker.style.display = 'none';
    document.head.appendChild(marker);
  }

  setupEventListeners() {
    // Listen for extension detection events from frontend
    document.addEventListener('schemesync-check', (event) => {
      // Respond that extension is available
      const responseEvent = new CustomEvent('schemesync-response', {
        detail: { available: true, timestamp: Date.now() }
      });
      document.dispatchEvent(responseEvent);
    });

    // Listen for autofill trigger from SchemeSync portal
    document.addEventListener('schemesync-trigger-autofill', async (event) => {
      const { schemeId, applicationUrl } = event.detail;
      console.log('🚀 Extension triggered for autofill:', { schemeId, applicationUrl });
      
      try {
        // Send message to background script to handle tab creation and navigation
        const response = await this.sendMessage({
          type: 'TRIGGER_AUTOFILL',
          data: { schemeId, applicationUrl }
        });
        
        // Respond to portal
        const responseEvent = new CustomEvent('schemesync-autofill-response', {
          detail: response
        });
        document.dispatchEvent(responseEvent);
        
      } catch (error) {
        console.error('Autofill trigger error:', error);
        const responseEvent = new CustomEvent('schemesync-autofill-response', {
          detail: { success: false, error: error.message }
        });
        document.dispatchEvent(responseEvent);
      }
    });
  }

  async loadModules() {
    try {
      // Load scripts with proper promise-based loading
      const loadScript = (src) => {
        return new Promise((resolve, reject) => {
          const script = document.createElement('script');
          script.src = chrome.runtime.getURL(src);
          script.onload = resolve;
          script.onerror = reject;
          document.head.appendChild(script);
        });
      };

      // Load all scripts in parallel
      await Promise.all([
        loadScript('domAnalyzer.js'),
        loadScript('autofillEngine.js'),
        loadScript('uiOverlay.js'),
        loadScript('intelligentNavigator.js')
      ]);

      // Initialize modules after all scripts are loaded
      if (window.DOMAnalyzer) {
        this.domAnalyzer = new window.DOMAnalyzer();
      }
      
      if (window.AutofillEngine) {
        this.autofillEngine = new window.AutofillEngine();
      }
      
      if (window.UIOverlay) {
        this.uiOverlay = new window.UIOverlay();
      }

      if (window.IntelligentNavigator) {
        this.intelligentNavigator = new window.IntelligentNavigator();
      }

      console.log('✅ All SchemeSync modules loaded successfully');
    } catch (error) {
      console.error('Failed to load SchemeSync modules:', error);
      throw error;
    }
  }

  async checkForForms() {
    if (!this.domAnalyzer) return;

    const forms = this.domAnalyzer.detectForms();
    
    if (forms.length > 0) {
      console.log(`SchemeSync: Detected ${forms.length} form(s) on page`);
      
      // Check if this looks like an application form
      const hasApplicationForm = forms.some(form => {
        const inputs = form.element.querySelectorAll('input, select, textarea');
        return inputs.length >= 5; // Likely application form
      });

      if (hasApplicationForm) {
        // Show activation button for direct autofill
        this.showActivationButton(forms);
      } else {
        // Show intelligent navigation button
        this.showNavigationButton();
      }
    } else {
      // No forms found - show intelligent navigation
      this.showNavigationButton();
    }
  }

  showNavigationButton() {
    if (!this.uiOverlay) return;

    // Remove existing buttons
    const existingButton = document.getElementById('schemesync-activation-btn');
    if (existingButton) existingButton.remove();

    const button = document.createElement('button');
    button.id = 'schemesync-navigation-btn';
    button.className = 'schemesync-activation-button';
    button.innerHTML = `
      <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
        <path d="M9.5 3A6.5 6.5 0 0 1 16 9.5c0 1.61-.59 3.09-1.56 4.23l.27.27h.79l5 5-1.5 1.5-5-5v-.79l-.27-.27A6.516 6.516 0 0 1 9.5 16 6.5 6.5 0 0 1 3 9.5 6.5 6.5 0 0 1 9.5 3m0 2C7 5 5 7 5 9.5S7 14 9.5 14 14 12 14 9.5 12 5 9.5 5Z"/>
      </svg>
      Find Application Form
    `;

    button.addEventListener('click', () => {
      this.startIntelligentNavigation();
    });

    document.body.appendChild(button);
  }

  async startIntelligentNavigation() {
    if (!this.intelligentNavigator) {
      console.error('Intelligent Navigator not available');
      return;
    }

    try {
      // Hide navigation button
      const navButton = document.getElementById('schemesync-navigation-btn');
      if (navButton) navButton.remove();

      // Start intelligent navigation
      await this.intelligentNavigator.startIntelligentNavigation('find_application_form');
      
    } catch (error) {
      console.error('Failed to start intelligent navigation:', error);
      this.uiOverlay?.showError('Failed to start intelligent navigation: ' + error.message);
    }
  }

  showActivationButton(forms) {
    if (!this.uiOverlay) return;

    const button = this.uiOverlay.createActivationButton();
    button.addEventListener('click', () => {
      this.activateAutofill(forms);
    });
  }

  async activateAutofill(forms) {
    try {
      this.isActive = true;
      
      // Show loading overlay
      this.uiOverlay.showLoading('Fetching your profile...');
      
      // Get user profile and documents
      await this.loadUserData();
      
      // Analyze forms in detail
      const formAnalysis = this.domAnalyzer.analyzeForms(forms);
      
      // Start autofill process
      await this.startAutofill(formAnalysis);
      
    } catch (error) {
      console.error('Autofill activation error:', error);
      this.uiOverlay.showError('Failed to activate autofill: ' + error.message);
    }
  }

  async loadUserData() {
    try {
      // Get user profile
      const profileResponse = await this.sendMessage({ type: 'GET_USER_PROFILE' });
      if (profileResponse.success) {
        this.userProfile = profileResponse.data;
      }

      // Get user documents
      const documentsResponse = await this.sendMessage({ type: 'GET_USER_DOCUMENTS' });
      if (documentsResponse.success) {
        this.documents = documentsResponse.data;
      }

      console.log('SchemeSync: User data loaded', {
        profile: !!this.userProfile,
        documents: this.documents.length
      });
    } catch (error) {
      throw new Error('Failed to load user data');
    }
  }

  async startAutofill(formAnalysis) {
    if (!this.autofillEngine || !this.userProfile) {
      throw new Error('Autofill engine or user profile not available');
    }

    this.uiOverlay.showLoading('Analyzing form fields...');

    const results = {
      fieldsFound: 0,
      fieldsFilled: 0,
      documentsUploaded: 0,
      missingFields: [],
      errors: []
    };

    for (const form of formAnalysis) {
      try {
        const formResult = await this.autofillEngine.fillForm(
          form,
          this.userProfile,
          this.documents
        );

        results.fieldsFound += formResult.fieldsFound;
        results.fieldsFilled += formResult.fieldsFilled;
        results.documentsUploaded += formResult.documentsUploaded;
        results.missingFields.push(...formResult.missingFields);
        results.errors.push(...formResult.errors);

      } catch (error) {
        console.error('Form filling error:', error);
        results.errors.push(`Form filling failed: ${error.message}`);
      }
    }

    // Handle missing fields
    if (results.missingFields.length > 0) {
      await this.handleMissingFields(results.missingFields);
    }

    // Show completion summary
    this.showCompletionSummary(results);

    // Log the autofill attempt
    await this.logAutofillAttempt(results);
  }

  async handleMissingFields(missingFields) {
    for (const field of missingFields) {
      try {
        const value = await this.uiOverlay.promptForMissingField(field);
        
        if (value) {
          // Update the form field
          this.autofillEngine.fillSingleField(field.element, value);
          
          // Send to backend to update profile
          await this.sendMessage({
            type: 'UPDATE_PROFILE_FIELD',
            data: {
              field_name: field.mappedName || field.label,
              field_value: value,
              source: 'application_form'
            }
          });
        }
      } catch (error) {
        console.error('Missing field handling error:', error);
      }
    }
  }

  showCompletionSummary(results) {
    const summary = {
      title: 'Autofill Complete',
      fieldsFound: results.fieldsFound,
      fieldsFilled: results.fieldsFilled,
      documentsUploaded: results.documentsUploaded,
      missingFields: results.missingFields.length,
      errors: results.errors.length
    };

    this.uiOverlay.showCompletionSummary(summary);
  }

  async logAutofillAttempt(results) {
    try {
      const logData = {
        portal: window.location.hostname,
        url: window.location.href,
        fields_detected: results.fieldsFound,
        fields_filled: results.fieldsFilled,
        documents_uploaded: results.documentsUploaded,
        missing_fields: results.missingFields.length,
        errors: results.errors.length,
        success: results.errors.length === 0
      };

      await this.sendMessage({
        type: 'LOG_AUTOFILL_ATTEMPT',
        data: logData
      });
    } catch (error) {
      console.error('Failed to log autofill attempt:', error);
    }
  }

  observePageChanges() {
    // Watch for dynamic content changes
    const observer = new MutationObserver((mutations) => {
      let hasNewForms = false;
      
      mutations.forEach((mutation) => {
        if (mutation.type === 'childList') {
          mutation.addedNodes.forEach((node) => {
            if (node.nodeType === Node.ELEMENT_NODE) {
              const forms = node.querySelectorAll('form, input, select, textarea');
              if (forms.length > 0) {
                hasNewForms = true;
              }
            }
          });
        }
      });

      if (hasNewForms && !this.isActive) {
        setTimeout(() => this.checkForForms(), 1000);
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true
    });
  }

  async sendMessage(message) {
    return new Promise((resolve) => {
      chrome.runtime.sendMessage(message, (response) => {
        resolve(response || { success: false, error: 'No response' });
      });
    });
  }
}

// Initialize content script when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    initializeContentScript();
  });
} else {
  initializeContentScript();
}

async function initializeContentScript() {
  console.log('🔧 Initializing content script...');
  
  // Check if we're being injected by background script
  const isInjected = !document.querySelector('[data-schemesync-extension]');
  console.log('📍 Injection context:', isInjected ? 'INJECTED' : 'NATURAL');
  
  if (isInjected) {
    // We're in a new tab created by background script
    // IntelligentNavigator should already be available globally
    console.log('🚀 Content script injected into new tab');
    console.log('🔍 Checking for IntelligentNavigator...');
    
    // Wait for IntelligentNavigator to be available
    let retries = 0;
    while (!window.IntelligentNavigator && retries < 20) {
      console.log(`⏳ Waiting for IntelligentNavigator... (${retries + 1}/20)`);
      console.log('🔍 Current window properties:', Object.keys(window).filter(k => k.includes('Intel')));
      await new Promise(resolve => setTimeout(resolve, 100));
      retries++;
    }
    
    if (window.IntelligentNavigator) {
      console.log('✅ IntelligentNavigator found!');
      
      // Create minimal content script instance for injected context
      const contentScript = new SchemeSyncContent();
      contentScript.intelligentNavigator = new window.IntelligentNavigator();
      
      console.log('🤖 IntelligentNavigator instance created');
      
      // Set up message listener for background script
      chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
        console.log('📨 Received message:', message.type);
        contentScript.handleBackgroundMessage(message, sender, sendResponse);
        return true;
      });
      
      console.log('✅ Content script ready for intelligent navigation');
      
      // Store globally for debugging
      window.schemeSyncContent = contentScript;
    } else {
      console.error('❌ IntelligentNavigator not available after injection');
    }
  } else {
    console.log('🏠 Normal initialization for SchemeSync portal pages');
    // Normal initialization for SchemeSync portal pages
    new SchemeSyncContent();
  }
}