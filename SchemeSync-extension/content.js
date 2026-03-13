// Simple SchemeSync Extension Content Script
console.log('🔧 SchemeSync extension loaded');

class SimpleSchemeSync {
  constructor() {
    this.API_BASE = 'http://localhost:3003/api';
    this.init();
  }

  init() {
    // Add detection marker
    const marker = document.createElement('div');
    marker.setAttribute('data-schemesync-extension', 'active');
    marker.style.display = 'none';
    document.head.appendChild(marker);

    // Listen for portal triggers
    document.addEventListener('schemesync-trigger-autofill', (event) => {
      this.handleAutofillTrigger(event.detail);
    });

    // Listen for background messages
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      this.handleMessage(message, sender, sendResponse);
      return true;
    });

    console.log('✅ SchemeSync extension ready');
  }

  async handleAutofillTrigger(data) {
    const { schemeId, applicationUrl } = data;
    console.log('🚀 Autofill triggered:', { schemeId, applicationUrl });

    try {
      // Send to background script
      const response = await this.sendMessage({
        type: 'TRIGGER_AUTOFILL',
        data: { schemeId, applicationUrl }
      });

      // Respond to portal
      document.dispatchEvent(new CustomEvent('schemesync-autofill-response', {
        detail: response
      }));
    } catch (error) {
      console.error('Autofill trigger failed:', error);
      document.dispatchEvent(new CustomEvent('schemesync-autofill-response', {
        detail: { success: false, error: error.message }
      }));
    }
  }

  handleMessage(message, sender, sendResponse) {
    console.log('📨 Message received:', message.type);

    switch (message.type) {
      case 'PING':
        sendResponse({ success: true });
        break;
      case 'START_AUTOFILL':
        this.startAutofill(message.data);
        sendResponse({ success: true });
        break;
      default:
        sendResponse({ success: false, error: 'Unknown message type' });
    }
  }

  async startAutofill(data) {
    console.log('🤖 Starting autofill:', data);

    // Show initial indicator
    this.showIndicator('🤖 SchemeSync AI Active - Analyzing page...');

    // Simple form detection
    const forms = document.querySelectorAll('form');
    console.log(`📋 Found ${forms.length} forms`);

    if (forms.length > 0) {
      // Check if this is an application form
      const applicationForm = this.findApplicationForm(forms);
      
      if (applicationForm) {
        this.showIndicator(`🎯 Found application form - Ready for autofill`, 'success');
        // TODO: Start actual form filling
      } else {
        this.showIndicator(`📋 Found ${forms.length} form(s) but not application form`, 'warning');
        // Navigate to find application form
        await this.navigateToApplicationForm();
      }
    } else {
      this.showIndicator('🔍 No forms found - Looking for application links...', 'warning');
      // Navigate to find application form
      await this.navigateToApplicationForm();
    }
  }

  findApplicationForm(forms) {
    // Check if any form looks like an application form
    for (const form of forms) {
      const inputs = form.querySelectorAll('input, select, textarea');
      const formText = form.textContent.toLowerCase();
      
      // Look for application-related keywords and sufficient fields
      if (inputs.length >= 5 && (
        formText.includes('application') ||
        formText.includes('apply') ||
        formText.includes('name') ||
        formText.includes('email') ||
        formText.includes('phone')
      )) {
        return form;
      }
    }
    return null;
  }

  async navigateToApplicationForm() {
    console.log('🧭 Looking for application form links...');
    this.showIndicator('🧭 Searching for application form...', 'info');

    // Look for application/apply links and auth links
    const navigationLinks = this.findApplicationLinks();
    
    if (navigationLinks.length > 0) {
      const bestLink = navigationLinks[0];
      const linkType = bestLink.type;
      const linkElement = bestLink.link;
      
      console.log(`🔗 Found ${navigationLinks.length} potential navigation links`);
      console.log(`🎯 Best link type: ${linkType}, text: "${linkElement.textContent.trim()}"`);
      console.log(`🎯 Link element:`, linkElement);
      console.log(`🎯 Link href:`, linkElement.href);
      
      if (linkType === 'application') {
        this.showIndicator(`🎯 Navigating to application form...`, 'info');
        
        // For application forms, navigate normally
        try {
          linkElement.click();
          setTimeout(() => {
            this.analyzeNewPage();
          }, 3000);
        } catch (error) {
          console.error('❌ Click failed:', error);
        }
        
      } else if (linkType === 'auth') {
        this.showIndicator(`🔐 Opening authentication in clean tab...`, 'warning');
        
        // For auth pages, open in new clean tab to avoid extension interference
        const authUrl = linkElement.href || linkElement.getAttribute('href');
        
        if (authUrl && authUrl !== '#') {
          console.log('🔄 Opening auth URL in clean tab:', authUrl);
          
          // Send message to background script to open clean tab
          await this.sendMessage({
            type: 'OPEN_CLEAN_AUTH_TAB',
            data: { 
              authUrl: authUrl,
              originalTabId: await this.getCurrentTabId()
            }
          });
          
          this.showIndicator(`📱 Please complete authentication in the new tab, then return here`, 'info');
          
          // Set up listener for when user returns
          this.setupAuthReturnWatcher();
          
        } else {
          // Fallback to normal click
          linkElement.click();
          setTimeout(() => {
            this.analyzeNewPage();
          }, 3000);
        }
      }
      
    } else {
      this.showIndicator('❌ No application form or sign-in found on this page', 'error');
      console.log('❌ No navigation links found');
      
      // Show what we did find for debugging
      const allLinks = Array.from(document.querySelectorAll('a, button'))
        .filter(link => link.textContent.trim().length > 0)
        .slice(0, 10);
      
      console.log('🔍 Available links on page:', allLinks.map(link => link.textContent.trim()));
    }
  }

  async getCurrentTabId() {
    try {
      const response = await this.sendMessage({ type: 'GET_CURRENT_TAB_ID' });
      return response.data?.tabId;
    } catch (error) {
      return null;
    }
  }

  setupAuthReturnWatcher() {
    // Watch for user returning to this tab after authentication
    let checkCount = 0;
    const maxChecks = 60; // Check for 5 minutes
    
    const checkForAuthReturn = () => {
      checkCount++;
      
      // Check if user has returned and page has changed
      if (document.hasFocus()) {
        console.log('🔄 User returned to tab, checking for auth completion...');
        
        // Look for signs of successful authentication
        setTimeout(() => {
          this.analyzeNewPage();
        }, 1000);
        
        return; // Stop checking
      }
      
      if (checkCount < maxChecks) {
        setTimeout(checkForAuthReturn, 5000); // Check every 5 seconds
      } else {
        this.showIndicator('⏰ Authentication timeout - Please try again', 'warning');
      }
    };
    
    // Start checking after a delay
    setTimeout(checkForAuthReturn, 10000);
  }

  findApplicationLinks() {
    const links = Array.from(document.querySelectorAll('a, button'));
    const applicationLinks = [];
    const authLinks = [];

    console.log(`🔍 Scanning ${links.length} total links and buttons...`);

    for (const link of links) {
      const text = link.textContent.toLowerCase().trim();
      const href = link.href ? link.href.toLowerCase() : '';
      
      // Debug: Log all links for inspection
      if (text.length > 0) {
        console.log(`🔗 Link found: "${text}" | href: "${href}"`);
      }
      
      // Look for application-related keywords
      if (
        text.includes('apply') ||
        text.includes('application') ||
        text.includes('form') ||
        text.includes('register') ||
        text.includes('submit') ||
        href.includes('apply') ||
        href.includes('application') ||
        href.includes('form')
      ) {
        console.log(`✅ Application link: "${text}"`);
        applicationLinks.push({ link, type: 'application', priority: 1 });
      }
      
      // Look for authentication links (expanded patterns)
      else if (
        text.includes('sign in') ||
        text.includes('signin') ||
        text.includes('log in') ||
        text.includes('login') ||
        text.includes('sign up') ||
        text.includes('signup') ||
        text.includes('register') ||
        text.includes('create account') ||
        text.includes('user login') ||
        text.includes('citizen login') ||
        text.includes('portal login') ||
        href.includes('login') ||
        href.includes('signin') ||
        href.includes('signup') ||
        href.includes('register') ||
        href.includes('auth')
      ) {
        console.log(`🔐 Auth link: "${text}"`);
        authLinks.push({ link, type: 'auth', priority: 2 });
      }
    }

    console.log(`📊 Found ${applicationLinks.length} application links, ${authLinks.length} auth links`);

    // Combine and sort by priority (application links first, then auth)
    const allLinks = [...applicationLinks, ...authLinks].sort((a, b) => {
      if (a.priority !== b.priority) return a.priority - b.priority;
      
      // Within same priority, prefer certain keywords
      const aText = a.link.textContent.toLowerCase();
      const bText = b.link.textContent.toLowerCase();
      
      if (aText.includes('apply') && !bText.includes('apply')) return -1;
      if (!aText.includes('apply') && bText.includes('apply')) return 1;
      if (aText.includes('sign in') && !bText.includes('sign in')) return -1;
      if (!aText.includes('sign in') && bText.includes('sign in')) return 1;
      
      return 0;
    });

    console.log(`🎯 Final sorted links:`, allLinks.map(l => `"${l.link.textContent.trim()}" (${l.type})`));
    return allLinks;
  }

  analyzeNewPage() {
    console.log('🔄 Re-analyzing page after navigation...');
    console.log('📍 Current URL:', window.location.href);
    
    // Check if page loaded properly
    const pageHeight = document.body.scrollHeight;
    const hasContent = document.body.textContent.trim().length > 50;
    const hasVisibleElements = document.querySelectorAll('*:not(script):not(style)').length > 10;
    
    console.log('📊 Page load analysis:', {
      pageHeight,
      hasContent,
      hasVisibleElements,
      textLength: document.body.textContent.trim().length
    });
    
    // Check for page load failures
    if (!hasContent || !hasVisibleElements || pageHeight < 100) {
      this.showIndicator('⚠️ Page loading issue detected - Refreshing...', 'warning');
      console.log('⚠️ Page appears to have loading issues, attempting refresh');
      
      setTimeout(() => {
        window.location.reload();
      }, 2000);
      return;
    }
    
    // Check if this is a login/signup page
    const isAuthPage = this.detectAuthPage();
    
    if (isAuthPage) {
      this.showIndicator(`🔐 Login page detected - Please complete authentication`, 'warning');
      console.log('🔐 Authentication page detected');
      
      // Show specific instructions based on the type of auth page
      if (window.location.href.includes('digilocker') || window.location.href.includes('meripehchaan')) {
        setTimeout(() => {
          this.showIndicator(`📱 DigiLocker authentication - Use your mobile/Aadhaar to login`, 'info');
        }, 3000);
        
        // Check if DigiLocker page loaded properly
        setTimeout(() => {
          const digilockerContent = document.body.textContent.toLowerCase();
          if (digilockerContent.includes('date of birth is required') && digilockerContent.length < 100) {
            this.showIndicator('🔄 DigiLocker page loading issue - Try refreshing manually', 'error');
          }
        }, 5000);
      } else {
        setTimeout(() => {
          this.showIndicator(`ℹ️ After login, extension will continue automatically`, 'info');
        }, 3000);
      }
      
      // Set up listener for successful login (page change)
      this.setupLoginWatcher();
      return;
    }
    
    // Re-run form detection for application forms
    const forms = document.querySelectorAll('form');
    console.log(`📋 Found ${forms.length} forms on new page`);

    if (forms.length > 0) {
      const applicationForm = this.findApplicationForm(forms);
      
      if (applicationForm) {
        this.showIndicator(`✅ Application form found! Ready for autofill`, 'success');
        console.log('✅ Application form detected on new page');
        // TODO: Start actual form filling
      } else {
        this.showIndicator(`📋 Found ${forms.length} form(s) - Analyzing...`, 'warning');
      }
    } else {
      this.showIndicator('🔍 Still looking for application form...', 'warning');
      // Could try another navigation step here
    }
  }

  detectAuthPage() {
    const pageText = document.body.textContent.toLowerCase();
    const title = document.title.toLowerCase();
    const url = window.location.href.toLowerCase();
    
    // Check for authentication-related keywords
    const authKeywords = [
      'sign in', 'login', 'log in', 'sign up', 'signup', 'register',
      'create account', 'authentication', 'username', 'password',
      'oauth', 'authorize', 'digilocker', 'meri pehchaan'
    ];
    
    // Check for OAuth/DigiLocker specific patterns
    const isOAuthPage = url.includes('oauth') || url.includes('authorize') || 
                       url.includes('digilocker') || url.includes('meripehchaan');
    
    const hasAuthKeywords = authKeywords.some(keyword => 
      pageText.includes(keyword) || title.includes(keyword)
    );
    
    console.log('🔍 Auth page detection:', {
      url: window.location.href,
      isOAuthPage,
      hasAuthKeywords,
      title: document.title
    });
    
    return isOAuthPage || hasAuthKeywords;
  }

  setupLoginWatcher() {
    // Watch for URL changes that might indicate successful login
    let currentUrl = window.location.href;
    
    const checkForNavigation = () => {
      if (window.location.href !== currentUrl) {
        console.log('🔄 Page navigation detected after login attempt');
        currentUrl = window.location.href;
        
        // Re-analyze the new page
        setTimeout(() => {
          this.analyzeNewPage();
        }, 1000);
      }
    };
    
    // Check every 2 seconds for navigation
    const navigationWatcher = setInterval(checkForNavigation, 2000);
    
    // Stop watching after 5 minutes
    setTimeout(() => {
      clearInterval(navigationWatcher);
    }, 300000);
  }

  showIndicator(message, type = 'info') {
    console.log('🎨 Creating indicator:', message, type);
    
    // Remove existing indicator
    const existing = document.getElementById('schemesync-indicator');
    if (existing) {
      console.log('🗑️ Removing existing indicator');
      existing.remove();
    }

    // Create new indicator
    const indicator = document.createElement('div');
    indicator.id = 'schemesync-indicator';
    indicator.textContent = message;
    
    const colors = {
      info: '#3b82f6',
      success: '#10b981',
      warning: '#f59e0b',
      error: '#ef4444'
    };

    indicator.style.cssText = `
      position: fixed; top: 20px; right: 20px; z-index: 10000;
      background: ${colors[type]}; color: white; padding: 12px 16px;
      border-radius: 8px; font-family: Arial, sans-serif; font-size: 14px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.3);
      max-width: 300px; word-wrap: break-word;
    `;

    console.log('📍 Appending indicator to body');
    document.body.appendChild(indicator);
    console.log('✅ Indicator created:', indicator);

    // Auto-remove after 5 seconds
    setTimeout(() => {
      if (indicator.parentNode) {
        console.log('⏰ Auto-removing indicator');
        indicator.remove();
      }
    }, 5000);
  }

  async sendMessage(message) {
    return new Promise((resolve) => {
      chrome.runtime.sendMessage(message, (response) => {
        resolve(response || { success: false, error: 'No response' });
      });
    });
  }
}

// Initialize immediately
new SimpleSchemeSync();