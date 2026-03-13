// Profile Synchronization Module
class ProfileSync {
  constructor() {
    this.API_BASE = 'http://localhost:3000/api';
    this.syncQueue = [];
    this.isSyncing = false;
  }

  // Queue a profile field update for synchronization
  queueFieldUpdate(fieldName, fieldValue, source = 'application_form') {
    const update = {
      field_name: fieldName,
      field_value: fieldValue,
      source: source,
      timestamp: new Date().toISOString()
    };

    this.syncQueue.push(update);
    
    // Auto-sync if queue gets too large or after a delay
    if (this.syncQueue.length >= 5) {
      this.syncNow();
    } else {
      this.scheduleSyncDelay();
    }
  }

  // Schedule a delayed sync
  scheduleSyncDelay() {
    if (this.syncTimeout) {
      clearTimeout(this.syncTimeout);
    }

    this.syncTimeout = setTimeout(() => {
      this.syncNow();
    }, 2000); // 2 second delay
  }

  // Immediately sync all queued updates
  async syncNow() {
    if (this.isSyncing || this.syncQueue.length === 0) {
      return;
    }

    this.isSyncing = true;

    try {
      const updates = [...this.syncQueue];
      this.syncQueue = [];

      for (const update of updates) {
        await this.syncSingleField(update);
      }

      console.log(`ProfileSync: Successfully synced ${updates.length} field(s)`);
    } catch (error) {
      console.error('ProfileSync: Sync failed:', error);
      // Re-queue failed updates
      this.syncQueue.unshift(...updates);
    } finally {
      this.isSyncing = false;
    }
  }

  // Sync a single field to the backend
  async syncSingleField(update) {
    try {
      const response = await this.sendMessage({
        type: 'UPDATE_PROFILE_FIELD',
        data: update
      });

      if (!response.success) {
        throw new Error(response.error || 'Failed to update profile field');
      }

      return response.data;
    } catch (error) {
      console.error(`ProfileSync: Failed to sync field ${update.field_name}:`, error);
      throw error;
    }
  }

  // Get complete user profile including custom fields
  async getCompleteProfile() {
    try {
      const response = await this.sendMessage({
        type: 'GET_COMPLETE_PROFILE'
      });

      if (response.success) {
        return response.data;
      } else {
        throw new Error(response.error || 'Failed to fetch complete profile');
      }
    } catch (error) {
      console.error('ProfileSync: Failed to get complete profile:', error);
      throw error;
    }
  }

  // Validate field value before syncing
  validateField(fieldName, fieldValue) {
    // Basic validation rules
    const validationRules = {
      email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
      phone: /^[+]?[\d\s\-\(\)]{10,15}$/,
      pin_code: /^\d{6}$/,
      aadhaar: /^\d{12}$/,
      pan: /^[A-Z]{5}\d{4}[A-Z]$/,
      age: (value) => {
        const num = parseInt(value);
        return num >= 0 && num <= 120;
      },
      annual_income: (value) => {
        const num = parseInt(value);
        return num >= 0 && num <= 100000000; // 10 crore max
      }
    };

    const rule = validationRules[fieldName];
    
    if (!rule) {
      return true; // No validation rule, assume valid
    }

    if (typeof rule === 'function') {
      return rule(fieldValue);
    } else if (rule instanceof RegExp) {
      return rule.test(fieldValue);
    }

    return true;
  }

  // Normalize field values
  normalizeFieldValue(fieldName, fieldValue) {
    if (!fieldValue) return fieldValue;

    const stringValue = String(fieldValue).trim();

    switch (fieldName) {
      case 'email':
        return stringValue.toLowerCase();
      
      case 'phone':
        // Remove all non-digit characters except +
        return stringValue.replace(/[^\d+]/g, '');
      
      case 'pin_code':
        // Ensure 6 digits
        return stringValue.replace(/\D/g, '').substring(0, 6);
      
      case 'aadhaar':
        // Remove spaces and ensure 12 digits
        return stringValue.replace(/\s/g, '').replace(/\D/g, '').substring(0, 12);
      
      case 'pan':
        // Uppercase and remove spaces
        return stringValue.toUpperCase().replace(/\s/g, '');
      
      case 'name':
      case 'father_name':
      case 'mother_name':
        // Proper case
        return stringValue.replace(/\w\S*/g, (txt) => 
          txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase()
        );
      
      case 'state':
      case 'district':
        // Proper case
        return stringValue.replace(/\w\S*/g, (txt) => 
          txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase()
        );
      
      case 'gender':
        // Normalize gender values
        const genderMap = {
          'm': 'male',
          'f': 'female',
          'male': 'male',
          'female': 'female',
          'other': 'other',
          'transgender': 'transgender'
        };
        return genderMap[stringValue.toLowerCase()] || stringValue;
      
      case 'category':
        // Normalize caste category
        const categoryMap = {
          'general': 'general',
          'obc': 'obc',
          'sc': 'sc',
          'st': 'st',
          'ews': 'ews'
        };
        return categoryMap[stringValue.toLowerCase()] || stringValue;
      
      default:
        return stringValue;
    }
  }

  // Send message to background script
  async sendMessage(message) {
    return new Promise((resolve) => {
      chrome.runtime.sendMessage(message, (response) => {
        resolve(response || { success: false, error: 'No response' });
      });
    });
  }

  // Clear sync queue
  clearQueue() {
    this.syncQueue = [];
    if (this.syncTimeout) {
      clearTimeout(this.syncTimeout);
      this.syncTimeout = null;
    }
  }

  // Get sync status
  getSyncStatus() {
    return {
      isSyncing: this.isSyncing,
      queueLength: this.syncQueue.length,
      hasScheduledSync: !!this.syncTimeout
    };
  }
}

// Make ProfileSync available globally
window.ProfileSync = ProfileSync;