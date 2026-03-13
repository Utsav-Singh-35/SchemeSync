// Autofill Engine for Form Field Population
class AutofillEngine {
  constructor() {
    this.fillDelay = 100; // Delay between field fills to appear natural
    this.highlightClass = 'schemesync-filled';
    this.addStyles();
  }

  addStyles() {
    if (document.getElementById('schemesync-styles')) return;

    const style = document.createElement('style');
    style.id = 'schemesync-styles';
    style.textContent = `
      .schemesync-filled {
        background-color: #e8f5e8 !important;
        border: 2px solid #4CAF50 !important;
        transition: all 0.3s ease !important;
      }
      .schemesync-error {
        background-color: #ffebee !important;
        border: 2px solid #f44336 !important;
      }
      .schemesync-pending {
        background-color: #fff3e0 !important;
        border: 2px solid #ff9800 !important;
      }
    `;
    document.head.appendChild(style);
  }

  async fillForm(formAnalysis, userProfile, documents) {
    const results = {
      fieldsFound: formAnalysis.fields.length,
      fieldsFilled: 0,
      documentsUploaded: 0,
      missingFields: [],
      errors: []
    };

    // Fill regular form fields
    for (const field of formAnalysis.fields) {
      try {
        const filled = await this.fillField(field, userProfile);
        if (filled) {
          results.fieldsFilled++;
        } else if (field.mappedName) {
          results.missingFields.push(field);
        }
      } catch (error) {
        console.error('Field fill error:', error);
        results.errors.push(`Failed to fill ${field.label}: ${error.message}`);
        this.markFieldError(field.element);
      }
      
      // Add delay between fills
      await this.delay(this.fillDelay);
    }

    // Handle document uploads
    for (const docField of formAnalysis.documentFields) {
      try {
        const uploaded = await this.uploadDocument(docField, documents);
        if (uploaded) {
          results.documentsUploaded++;
        } else {
          results.missingFields.push(docField);
        }
      } catch (error) {
        console.error('Document upload error:', error);
        results.errors.push(`Failed to upload ${docField.label}: ${error.message}`);
        this.markFieldError(docField.element);
      }
    }

    return results;
  }

  async fillField(field, userProfile) {
    if (!field.mappedName || !userProfile) return false;

    const value = this.extractProfileValue(field.mappedName, userProfile);
    if (value === null || value === undefined) return false;

    return this.fillSingleField(field.element, value, field.type);
  }

  extractProfileValue(mappedName, userProfile) {
    // Handle nested profile structure
    const user = userProfile.user || userProfile;
    
    // Direct property access
    if (user[mappedName] !== undefined) {
      return user[mappedName];
    }

    // Handle special mappings
    switch (mappedName) {
      case 'name':
        return user.name || `${user.first_name || ''} ${user.last_name || ''}`.trim();
      
      case 'first_name':
        return user.first_name || user.name?.split(' ')[0];
      
      case 'last_name':
        return user.last_name || user.name?.split(' ').slice(1).join(' ');
      
      case 'phone':
        return user.phone_number || user.phone || user.mobile;
      
      case 'date_of_birth':
        return user.date_of_birth || user.dob;
      
      case 'annual_income':
        return user.annual_income || user.income;
      
      case 'pin_code':
        return user.pin_code || user.pincode || user.postal_code;
      
      // Boolean fields
      case 'is_student':
      case 'is_farmer':
      case 'is_disabled':
      case 'is_widow':
      case 'is_senior_citizen':
        return user[mappedName] ? 'Yes' : 'No';
      
      default:
        return user[mappedName];
    }
  }

  async fillSingleField(element, value, fieldType) {
    if (!element || value === null || value === undefined) return false;

    try {
      // Focus the element first
      element.focus();

      switch (element.tagName.toLowerCase()) {
        case 'input':
          return this.fillInputField(element, value, fieldType);
        
        case 'select':
          return this.fillSelectField(element, value);
        
        case 'textarea':
          return this.fillTextareaField(element, value);
        
        default:
          return false;
      }
    } catch (error) {
      console.error('Single field fill error:', error);
      return false;
    }
  }

  fillInputField(input, value, fieldType) {
    const inputType = input.type.toLowerCase();

    switch (inputType) {
      case 'text':
      case 'email':
      case 'tel':
      case 'url':
      case 'search':
        return this.fillTextInput(input, value);
      
      case 'number':
        return this.fillNumberInput(input, value);
      
      case 'date':
        return this.fillDateInput(input, value);
      
      case 'radio':
        return this.fillRadioInput(input, value);
      
      case 'checkbox':
        return this.fillCheckboxInput(input, value);
      
      case 'file':
        // File inputs are handled separately
        return false;
      
      default:
        return this.fillTextInput(input, value);
    }
  }

  fillTextInput(input, value) {
    const stringValue = String(value);
    
    // Clear existing value
    input.value = '';
    
    // Set new value
    input.value = stringValue;
    
    // Trigger events
    this.triggerInputEvents(input);
    this.markFieldFilled(input);
    
    return true;
  }

  fillNumberInput(input, value) {
    const numericValue = parseFloat(value);
    if (isNaN(numericValue)) return false;
    
    input.value = numericValue;
    this.triggerInputEvents(input);
    this.markFieldFilled(input);
    
    return true;
  }

  fillDateInput(input, value) {
    let dateValue = value;
    
    // Convert various date formats to YYYY-MM-DD
    if (typeof value === 'string') {
      const date = new Date(value);
      if (!isNaN(date.getTime())) {
        dateValue = date.toISOString().split('T')[0];
      } else {
        // Try to parse DD/MM/YYYY or DD-MM-YYYY format
        const parts = value.split(/[\/\-]/);
        if (parts.length === 3) {
          const day = parts[0].padStart(2, '0');
          const month = parts[1].padStart(2, '0');
          const year = parts[2];
          dateValue = `${year}-${month}-${day}`;
        }
      }
    }
    
    input.value = dateValue;
    this.triggerInputEvents(input);
    this.markFieldFilled(input);
    
    return true;
  }

  fillRadioInput(input, value) {
    const stringValue = String(value).toLowerCase();
    const inputValue = input.value.toLowerCase();
    const inputLabel = this.getRadioLabel(input).toLowerCase();
    
    // Check if this radio button matches the value
    if (inputValue === stringValue || inputLabel.includes(stringValue) || stringValue.includes(inputValue)) {
      input.checked = true;
      this.triggerInputEvents(input);
      this.markFieldFilled(input);
      return true;
    }
    
    return false;
  }

  fillCheckboxInput(input, value) {
    const boolValue = this.parseBoolean(value);
    input.checked = boolValue;
    this.triggerInputEvents(input);
    this.markFieldFilled(input);
    return true;
  }

  fillSelectField(select, value) {
    const stringValue = String(value).toLowerCase();
    
    // Try exact match first
    for (const option of select.options) {
      if (option.value.toLowerCase() === stringValue || 
          option.textContent.toLowerCase() === stringValue) {
        select.value = option.value;
        this.triggerInputEvents(select);
        this.markFieldFilled(select);
        return true;
      }
    }
    
    // Try partial match
    for (const option of select.options) {
      if (option.textContent.toLowerCase().includes(stringValue) ||
          stringValue.includes(option.textContent.toLowerCase())) {
        select.value = option.value;
        this.triggerInputEvents(select);
        this.markFieldFilled(select);
        return true;
      }
    }
    
    return false;
  }

  fillTextareaField(textarea, value) {
    textarea.value = String(value);
    this.triggerInputEvents(textarea);
    this.markFieldFilled(textarea);
    return true;
  }

  async uploadDocument(docField, documents) {
    if (!docField.documentType || docField.documentType === 'unknown') {
      return false;
    }

    // Find matching document
    const matchingDoc = documents.find(doc => 
      doc.type === docField.documentType || 
      doc.category === docField.documentType
    );

    if (!matchingDoc) {
      return false;
    }

    try {
      // Create a File object from the document data
      const file = await this.createFileFromDocument(matchingDoc);
      
      // Set the file to the input
      const dataTransfer = new DataTransfer();
      dataTransfer.items.add(file);
      docField.element.files = dataTransfer.files;
      
      // Trigger change event
      this.triggerInputEvents(docField.element);
      this.markFieldFilled(docField.element);
      
      return true;
    } catch (error) {
      console.error('Document upload error:', error);
      return false;
    }
  }

  async createFileFromDocument(document) {
    // This would need to fetch the actual file from the backend
    // For now, create a placeholder file
    const blob = new Blob(['Document content'], { type: 'application/pdf' });
    return new File([blob], document.filename || 'document.pdf', {
      type: document.mime_type || 'application/pdf'
    });
  }

  triggerInputEvents(element) {
    // Trigger multiple events to ensure compatibility with different frameworks
    const events = ['input', 'change', 'blur', 'keyup'];
    
    events.forEach(eventType => {
      const event = new Event(eventType, { bubbles: true, cancelable: true });
      element.dispatchEvent(event);
    });

    // Also trigger React-style events
    if (element._valueTracker) {
      element._valueTracker.setValue('');
    }
  }

  getRadioLabel(radioInput) {
    // Try to find associated label
    if (radioInput.id) {
      const label = document.querySelector(`label[for="${radioInput.id}"]`);
      if (label) return label.textContent.trim();
    }

    // Check parent label
    const parentLabel = radioInput.closest('label');
    if (parentLabel) {
      return parentLabel.textContent.replace(radioInput.outerHTML, '').trim();
    }

    // Check next sibling text
    const nextSibling = radioInput.nextSibling;
    if (nextSibling && nextSibling.nodeType === Node.TEXT_NODE) {
      return nextSibling.textContent.trim();
    }

    return radioInput.value || '';
  }

  parseBoolean(value) {
    if (typeof value === 'boolean') return value;
    if (typeof value === 'number') return value !== 0;
    
    const stringValue = String(value).toLowerCase();
    return ['true', 'yes', '1', 'on', 'checked'].includes(stringValue);
  }

  markFieldFilled(element) {
    element.classList.remove('schemesync-error', 'schemesync-pending');
    element.classList.add('schemesync-filled');
  }

  markFieldError(element) {
    element.classList.remove('schemesync-filled', 'schemesync-pending');
    element.classList.add('schemesync-error');
  }

  markFieldPending(element) {
    element.classList.remove('schemesync-filled', 'schemesync-error');
    element.classList.add('schemesync-pending');
  }

  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Method to clear all highlights
  clearHighlights() {
    const highlightedElements = document.querySelectorAll('.schemesync-filled, .schemesync-error, .schemesync-pending');
    highlightedElements.forEach(element => {
      element.classList.remove('schemesync-filled', 'schemesync-error', 'schemesync-pending');
    });
  }
}

// Make AutofillEngine available globally
window.AutofillEngine = AutofillEngine;