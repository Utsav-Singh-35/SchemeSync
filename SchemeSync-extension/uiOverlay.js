// UI Overlay for Extension Interface
class UIOverlay {
  constructor() {
    this.overlayId = 'schemesync-overlay';
    this.isVisible = false;
    this.currentModal = null;
    this.addOverlayStyles();
  }

  addOverlayStyles() {
    if (document.getElementById('schemesync-overlay-styles')) return;

    const style = document.createElement('style');
    style.id = 'schemesync-overlay-styles';
    style.textContent = `
      .schemesync-overlay {
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.7);
        z-index: 999999;
        display: flex;
        align-items: center;
        justify-content: center;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      }

      .schemesync-modal {
        background: white;
        border-radius: 12px;
        padding: 24px;
        max-width: 500px;
        width: 90%;
        max-height: 80vh;
        overflow-y: auto;
        box-shadow: 0 20px 40px rgba(0, 0, 0, 0.3);
        position: relative;
      }

      .schemesync-modal h2 {
        margin: 0 0 16px 0;
        color: #333;
        font-size: 20px;
        font-weight: 600;
      }

      .schemesync-modal p {
        margin: 0 0 16px 0;
        color: #666;
        line-height: 1.5;
      }

      .schemesync-button {
        background: #4CAF50;
        color: white;
        border: none;
        padding: 12px 24px;
        border-radius: 6px;
        cursor: pointer;
        font-size: 14px;
        font-weight: 500;
        margin: 8px 8px 0 0;
        transition: background 0.2s;
      }

      .schemesync-button:hover {
        background: #45a049;
      }

      .schemesync-button.secondary {
        background: #f5f5f5;
        color: #333;
      }

      .schemesync-button.secondary:hover {
        background: #e0e0e0;
      }

      .schemesync-button.danger {
        background: #f44336;
      }

      .schemesync-button.danger:hover {
        background: #d32f2f;
      }

      .schemesync-input {
        width: 100%;
        padding: 12px;
        border: 2px solid #ddd;
        border-radius: 6px;
        font-size: 14px;
        margin: 8px 0;
        box-sizing: border-box;
      }

      .schemesync-input:focus {
        outline: none;
        border-color: #4CAF50;
      }

      .schemesync-close {
        position: absolute;
        top: 16px;
        right: 16px;
        background: none;
        border: none;
        font-size: 24px;
        cursor: pointer;
        color: #999;
        padding: 0;
        width: 32px;
        height: 32px;
        display: flex;
        align-items: center;
        justify-content: center;
      }

      .schemesync-close:hover {
        color: #333;
      }

      .schemesync-loading {
        display: flex;
        align-items: center;
        gap: 12px;
      }

      .schemesync-spinner {
        width: 20px;
        height: 20px;
        border: 2px solid #f3f3f3;
        border-top: 2px solid #4CAF50;
        border-radius: 50%;
        animation: schemesync-spin 1s linear infinite;
      }

      @keyframes schemesync-spin {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
      }

      .schemesync-activation-button {
        position: fixed;
        bottom: 20px;
        right: 20px;
        background: #4CAF50;
        color: white;
        border: none;
        padding: 16px 20px;
        border-radius: 50px;
        cursor: pointer;
        font-size: 14px;
        font-weight: 600;
        box-shadow: 0 4px 12px rgba(76, 175, 80, 0.3);
        z-index: 999998;
        transition: all 0.3s ease;
        display: flex;
        align-items: center;
        gap: 8px;
      }

      .schemesync-activation-button:hover {
        background: #45a049;
        transform: translateY(-2px);
        box-shadow: 0 6px 16px rgba(76, 175, 80, 0.4);
      }

      .schemesync-stats {
        background: #f8f9fa;
        border-radius: 8px;
        padding: 16px;
        margin: 16px 0;
      }

      .schemesync-stats-row {
        display: flex;
        justify-content: space-between;
        margin: 8px 0;
      }

      .schemesync-stats-label {
        color: #666;
        font-weight: 500;
      }

      .schemesync-stats-value {
        color: #333;
        font-weight: 600;
      }

      .schemesync-error-message {
        background: #ffebee;
        color: #c62828;
        padding: 12px;
        border-radius: 6px;
        margin: 16px 0;
        border-left: 4px solid #f44336;
      }

      .schemesync-success-message {
        background: #e8f5e8;
        color: #2e7d32;
        padding: 12px;
        border-radius: 6px;
        margin: 16px 0;
        border-left: 4px solid #4CAF50;
      }
    `;
    document.head.appendChild(style);
  }

  createActivationButton() {
    // Remove existing button if present
    const existingButton = document.getElementById('schemesync-activation-btn');
    if (existingButton) {
      existingButton.remove();
    }

    const button = document.createElement('button');
    button.id = 'schemesync-activation-btn';
    button.className = 'schemesync-activation-button';
    button.innerHTML = `
      <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
        <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
      </svg>
      Activate SchemeSync
    `;

    document.body.appendChild(button);
    return button;
  }

  showLoading(message = 'Processing...') {
    this.hideOverlay();
    
    const overlay = this.createOverlay();
    const modal = this.createModal();
    
    modal.innerHTML = `
      <div class="schemesync-loading">
        <div class="schemesync-spinner"></div>
        <span>${message}</span>
      </div>
    `;

    overlay.appendChild(modal);
    document.body.appendChild(overlay);
    this.isVisible = true;
    this.currentModal = overlay;
  }

  showError(message) {
    this.hideOverlay();
    
    const overlay = this.createOverlay();
    const modal = this.createModal();
    
    modal.innerHTML = `
      <button class="schemesync-close">&times;</button>
      <h2>Error</h2>
      <div class="schemesync-error-message">${message}</div>
      <button class="schemesync-button" onclick="this.closest('.schemesync-overlay').remove()">
        Close
      </button>
    `;

    this.addCloseHandlers(modal);
    overlay.appendChild(modal);
    document.body.appendChild(overlay);
    this.isVisible = true;
    this.currentModal = overlay;
  }

  showCompletionSummary(summary) {
    this.hideOverlay();
    
    const overlay = this.createOverlay();
    const modal = this.createModal();
    
    const successRate = summary.fieldsFound > 0 ? 
      Math.round((summary.fieldsFilled / summary.fieldsFound) * 100) : 0;
    
    modal.innerHTML = `
      <button class="schemesync-close">&times;</button>
      <h2>${summary.title}</h2>
      
      <div class="schemesync-success-message">
        Form filling completed with ${successRate}% success rate
      </div>
      
      <div class="schemesync-stats">
        <div class="schemesync-stats-row">
          <span class="schemesync-stats-label">Fields Found:</span>
          <span class="schemesync-stats-value">${summary.fieldsFound}</span>
        </div>
        <div class="schemesync-stats-row">
          <span class="schemesync-stats-label">Fields Filled:</span>
          <span class="schemesync-stats-value">${summary.fieldsFilled}</span>
        </div>
        <div class="schemesync-stats-row">
          <span class="schemesync-stats-label">Documents Uploaded:</span>
          <span class="schemesync-stats-value">${summary.documentsUploaded}</span>
        </div>
        <div class="schemesync-stats-row">
          <span class="schemesync-stats-label">Missing Fields:</span>
          <span class="schemesync-stats-value">${summary.missingFields}</span>
        </div>
        ${summary.errors > 0 ? `
        <div class="schemesync-stats-row">
          <span class="schemesync-stats-label">Errors:</span>
          <span class="schemesync-stats-value" style="color: #f44336;">${summary.errors}</span>
        </div>
        ` : ''}
      </div>
      
      <p><strong>Important:</strong> Please review all filled information before submitting the form. SchemeSync does not automatically submit forms for your safety.</p>
      
      <button class="schemesync-button" onclick="this.closest('.schemesync-overlay').remove()">
        Continue with Form
      </button>
    `;

    this.addCloseHandlers(modal);
    overlay.appendChild(modal);
    document.body.appendChild(overlay);
    this.isVisible = true;
    this.currentModal = overlay;
  }

  async promptForMissingField(field) {
    return new Promise((resolve) => {
      this.hideOverlay();
      
      const overlay = this.createOverlay();
      const modal = this.createModal();
      
      modal.innerHTML = `
        <button class="schemesync-close">&times;</button>
        <h2>Missing Information</h2>
        <p>The form requires information that's not in your profile:</p>
        <p><strong>${field.label}</strong></p>
        <input type="text" class="schemesync-input" id="missing-field-input" 
               placeholder="Enter ${field.label}" />
        <div style="margin-top: 16px;">
          <button class="schemesync-button" id="save-field-btn">
            Save & Continue
          </button>
          <button class="schemesync-button secondary" id="skip-field-btn">
            Skip This Field
          </button>
        </div>
      `;

      const input = modal.querySelector('#missing-field-input');
      const saveBtn = modal.querySelector('#save-field-btn');
      const skipBtn = modal.querySelector('#skip-field-btn');

      saveBtn.onclick = () => {
        const value = input.value.trim();
        this.hideOverlay();
        resolve(value || null);
      };

      skipBtn.onclick = () => {
        this.hideOverlay();
        resolve(null);
      };

      // Handle Enter key
      input.onkeypress = (e) => {
        if (e.key === 'Enter') {
          saveBtn.click();
        }
      };

      this.addCloseHandlers(modal, () => resolve(null));
      overlay.appendChild(modal);
      document.body.appendChild(overlay);
      
      // Focus the input
      setTimeout(() => input.focus(), 100);
      
      this.isVisible = true;
      this.currentModal = overlay;
    });
  }

  showCaptchaDetected(captchaInfo) {
    this.hideOverlay();
    
    const overlay = this.createOverlay();
    const modal = this.createModal();
    
    modal.innerHTML = `
      <button class="schemesync-close">&times;</button>
      <h2>CAPTCHA Detected</h2>
      <p>A CAPTCHA has been detected on this page. Please solve it manually to continue.</p>
      <p><strong>CAPTCHA Type:</strong> ${captchaInfo.type}</p>
      <div class="schemesync-error-message">
        Autofill has been paused. Once you solve the CAPTCHA, you can resume the process.
      </div>
      <button class="schemesync-button" onclick="this.closest('.schemesync-overlay').remove()">
        I'll Solve the CAPTCHA
      </button>
    `;

    this.addCloseHandlers(modal);
    overlay.appendChild(modal);
    document.body.appendChild(overlay);
    this.isVisible = true;
    this.currentModal = overlay;
  }

  createOverlay() {
    const overlay = document.createElement('div');
    overlay.className = 'schemesync-overlay';
    overlay.id = this.overlayId;
    return overlay;
  }

  createModal() {
    const modal = document.createElement('div');
    modal.className = 'schemesync-modal';
    return modal;
  }

  addCloseHandlers(modal, callback = null) {
    const closeBtn = modal.querySelector('.schemesync-close');
    if (closeBtn) {
      closeBtn.onclick = () => {
        this.hideOverlay();
        if (callback) callback();
      };
    }

    // Close on overlay click (but not modal click)
    const overlay = modal.closest('.schemesync-overlay');
    if (overlay) {
      overlay.onclick = (e) => {
        if (e.target === overlay) {
          this.hideOverlay();
          if (callback) callback();
        }
      };
    }

    // Close on Escape key
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.isVisible) {
        this.hideOverlay();
        if (callback) callback();
      }
    });
  }

  hideOverlay() {
    const overlay = document.getElementById(this.overlayId);
    if (overlay) {
      overlay.remove();
    }
    this.isVisible = false;
    this.currentModal = null;
  }

  removeActivationButton() {
    const button = document.getElementById('schemesync-activation-btn');
    if (button) {
      button.remove();
    }
  }

  isOverlayVisible() {
    return this.isVisible;
  }
}

// Make UIOverlay available globally
window.UIOverlay = UIOverlay;