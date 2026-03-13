// SchemeSync Extension Content Script
class SchemeSyncContent {
  constructor() {
    this.isActive = false;
    this.userProfile = null;
    this.documents = [];
    this.domAnalyzer = null;
    this.autofillEngine = null;
    this.uiOverlay = null;
    
    this.init();
  }

  async init() {
    // Inject extension detection marker
    this.injectDetectionMarker();
    
    // Listen for extension detection events from frontend
    this.setupEventListeners();
    
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
  }

  async loadModules() {
    try {
      // Dynamically import modules
      const domAnalyzerScript = document.createElement('script');
      domAnalyzerScript.src = chrome.runtime.getURL('domAnalyzer.js');
      document.head.appendChild(domAnalyzerScript);

      const autofillEngineScript = document.createElement('script');
      autofillEngineScript.src = chrome.runtime.getURL('autofillEngine.js');
      document.head.appendChild(autofillEngineScript);

      const uiOverlayScript = document.createElement('script');
      uiOverlayScript.src = chrome.runtime.getURL('uiOverlay.js');
      document.head.appendChild(uiOverlayScript);

      // Wait for modules to load
      await new Promise(resolve => setTimeout(resolve, 500));

      // Initialize modules
      if (window.DOMAnalyzer) {
        this.domAnalyzer = new window.DOMAnalyzer();
      }
      
      if (window.AutofillEngine) {
        this.autofillEngine = new window.AutofillEngine();
      }
      
      if (window.UIOverlay) {
        this.uiOverlay = new window.UIOverlay();
      }
    } catch (error) {
      console.error('Failed to load SchemeSync modules:', error);
    }
  }

  async checkForForms() {
    if (!this.domAnalyzer) return;

    const forms = this.domAnalyzer.detectForms();
    
    if (forms.length > 0) {
      console.log(`SchemeSync: Detected ${forms.length} form(s) on page`);
      
      // Show activation button
      this.showActivationButton(forms);
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
    new SchemeSyncContent();
  });
} else {
  new SchemeSyncContent();
}