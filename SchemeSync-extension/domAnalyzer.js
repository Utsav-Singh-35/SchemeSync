// DOM Analysis Module for Form Detection and Field Mapping
class DOMAnalyzer {
  constructor() {
    this.fieldMappings = this.initializeFieldMappings();
    this.documentMappings = this.initializeDocumentMappings();
  }

  initializeFieldMappings() {
    return {
      // Personal Information
      name: ['name', 'full name', 'applicant name', 'candidate name', 'full_name', 'applicant_name'],
      first_name: ['first name', 'fname', 'first_name', 'given name'],
      last_name: ['last name', 'lname', 'last_name', 'surname', 'family name'],
      father_name: ['father name', 'father_name', 'fathers name', 'parent name'],
      mother_name: ['mother name', 'mother_name', 'mothers name'],
      
      // Contact Information
      email: ['email', 'e-mail', 'email address', 'email_address', 'mail'],
      phone: ['phone', 'mobile', 'contact', 'phone number', 'mobile number', 'contact_number'],
      address: ['address', 'residential address', 'permanent address', 'current address'],
      pin_code: ['pincode', 'pin code', 'postal code', 'zip code', 'pin_code'],
      
      // Demographics
      date_of_birth: ['dob', 'date of birth', 'birth date', 'date_of_birth', 'birthdate'],
      age: ['age', 'current age'],
      gender: ['gender', 'sex'],
      category: ['category', 'caste', 'social category', 'reservation category'],
      religion: ['religion', 'religious community'],
      
      // Location
      state: ['state', 'state name', 'state_name'],
      district: ['district', 'district name', 'district_name'],
      
      // Economic Information
      annual_income: ['income', 'annual income', 'yearly income', 'family income', 'annual_income'],
      occupation: ['occupation', 'profession', 'job', 'employment'],
      employment_status: ['employment status', 'job status', 'work status'],
      
      // Family Information
      marital_status: ['marital status', 'marriage status', 'married'],
      family_size: ['family size', 'family members', 'household size'],
      
      // Special Categories
      is_student: ['student', 'currently studying', 'education status'],
      is_farmer: ['farmer', 'agriculture', 'farming'],
      is_disabled: ['disabled', 'disability', 'physically challenged', 'handicapped'],
      disability_percentage: ['disability percentage', 'disability %', 'handicap percentage'],
      is_widow: ['widow', 'widowed'],
      is_senior_citizen: ['senior citizen', 'elderly', 'above 60']
    };
  }

  initializeDocumentMappings() {
    return {
      aadhaar: ['aadhaar', 'aadhar', 'uid', 'unique id', 'identity proof'],
      pan: ['pan', 'pan card', 'permanent account number'],
      income_certificate: ['income certificate', 'income proof', 'salary certificate'],
      caste_certificate: ['caste certificate', 'category certificate', 'sc/st certificate'],
      domicile: ['domicile', 'residence certificate', 'domicile certificate'],
      birth_certificate: ['birth certificate', 'date of birth proof'],
      passport: ['passport', 'passport copy'],
      driving_license: ['driving license', 'dl', 'license'],
      voter_id: ['voter id', 'election card', 'epic'],
      bank_passbook: ['bank passbook', 'bank statement', 'account proof'],
      photo: ['photo', 'photograph', 'passport size photo', 'recent photo']
    };
  }

  detectForms() {
    const forms = [];
    
    // Find all form elements
    const formElements = document.querySelectorAll('form');
    
    formElements.forEach((form, index) => {
      const formData = {
        element: form,
        id: form.id || `form_${index}`,
        action: form.action || window.location.href,
        method: form.method || 'GET',
        fields: []
      };
      
      forms.push(formData);
    });

    // Also check for forms without <form> tags (common in SPAs)
    if (forms.length === 0) {
      const potentialFormContainers = document.querySelectorAll(
        'div[class*="form"], div[id*="form"], section[class*="application"], div[class*="application"]'
      );
      
      potentialFormContainers.forEach((container, index) => {
        const inputs = container.querySelectorAll('input, select, textarea');
        if (inputs.length >= 3) { // Minimum 3 inputs to consider it a form
          forms.push({
            element: container,
            id: container.id || `container_form_${index}`,
            action: window.location.href,
            method: 'POST',
            fields: []
          });
        }
      });
    }

    return forms;
  }

  analyzeForms(forms) {
    return forms.map(form => this.analyzeForm(form));
  }

  analyzeForm(form) {
    const fields = this.extractFormFields(form.element);
    const mappedFields = this.mapFieldsToProfile(fields);
    const documentFields = this.identifyDocumentFields(fields);
    
    return {
      ...form,
      fields: mappedFields,
      documentFields: documentFields,
      totalFields: fields.length,
      mappedFields: mappedFields.filter(f => f.mappedName).length,
      documentCount: documentFields.length
    };
  }

  extractFormFields(container) {
    const fields = [];
    const inputs = container.querySelectorAll('input, select, textarea');
    
    inputs.forEach((input, index) => {
      // Skip hidden, submit, and button inputs
      if (['hidden', 'submit', 'button', 'reset'].includes(input.type)) {
        return;
      }

      const field = {
        element: input,
        type: input.type || input.tagName.toLowerCase(),
        name: input.name || input.id || `field_${index}`,
        id: input.id,
        label: this.extractFieldLabel(input),
        placeholder: input.placeholder || '',
        required: input.required || input.hasAttribute('required'),
        value: input.value || '',
        options: []
      };

      // Extract options for select elements
      if (input.tagName.toLowerCase() === 'select') {
        field.options = Array.from(input.options).map(option => ({
          value: option.value,
          text: option.textContent.trim()
        }));
      }

      fields.push(field);
    });

    return fields;
  }

  extractFieldLabel(input) {
    let label = '';

    // Method 1: Associated label element
    if (input.id) {
      const labelElement = document.querySelector(`label[for="${input.id}"]`);
      if (labelElement) {
        label = labelElement.textContent.trim();
      }
    }

    // Method 2: Parent label element
    if (!label) {
      const parentLabel = input.closest('label');
      if (parentLabel) {
        label = parentLabel.textContent.replace(input.outerHTML, '').trim();
      }
    }

    // Method 3: aria-label attribute
    if (!label && input.getAttribute('aria-label')) {
      label = input.getAttribute('aria-label').trim();
    }

    // Method 4: placeholder as fallback
    if (!label && input.placeholder) {
      label = input.placeholder.trim();
    }

    // Method 5: Look for nearby text (previous sibling, parent, etc.)
    if (!label) {
      label = this.findNearbyText(input);
    }

    // Method 6: Table header (for table-based forms)
    if (!label) {
      label = this.findTableHeader(input);
    }

    return label;
  }

  findNearbyText(input) {
    // Check previous sibling elements
    let sibling = input.previousElementSibling;
    while (sibling) {
      const text = sibling.textContent.trim();
      if (text && text.length < 100) { // Reasonable label length
        return text;
      }
      sibling = sibling.previousElementSibling;
    }

    // Check parent element text
    const parent = input.parentElement;
    if (parent) {
      const parentText = parent.textContent.replace(input.outerHTML, '').trim();
      if (parentText && parentText.length < 100) {
        return parentText;
      }
    }

    return '';
  }

  findTableHeader(input) {
    const cell = input.closest('td');
    if (!cell) return '';

    const row = cell.closest('tr');
    if (!row) return '';

    const table = row.closest('table');
    if (!table) return '';

    const cellIndex = Array.from(row.cells).indexOf(cell);
    const headerRow = table.querySelector('tr');
    
    if (headerRow && headerRow.cells[cellIndex]) {
      return headerRow.cells[cellIndex].textContent.trim();
    }

    return '';
  }

  mapFieldsToProfile(fields) {
    return fields.map(field => {
      const mappedName = this.findFieldMapping(field.label, field.name, field.placeholder);
      
      return {
        ...field,
        mappedName: mappedName,
        confidence: this.calculateMappingConfidence(field, mappedName)
      };
    });
  }

  findFieldMapping(label, name, placeholder) {
    const searchText = `${label} ${name} ${placeholder}`.toLowerCase();
    
    for (const [profileField, keywords] of Object.entries(this.fieldMappings)) {
      for (const keyword of keywords) {
        if (searchText.includes(keyword.toLowerCase())) {
          return profileField;
        }
      }
    }

    return null;
  }

  calculateMappingConfidence(field, mappedName) {
    if (!mappedName) return 0;

    let confidence = 0.5; // Base confidence

    // Increase confidence based on exact matches
    const searchText = `${field.label} ${field.name} ${field.placeholder}`.toLowerCase();
    const keywords = this.fieldMappings[mappedName] || [];
    
    for (const keyword of keywords) {
      if (searchText === keyword.toLowerCase()) {
        confidence = 1.0; // Exact match
        break;
      } else if (searchText.includes(keyword.toLowerCase())) {
        confidence = Math.max(confidence, 0.8);
      }
    }

    // Adjust confidence based on field type appropriateness
    if (mappedName === 'email' && field.type === 'email') confidence += 0.1;
    if (mappedName === 'date_of_birth' && field.type === 'date') confidence += 0.1;
    if (mappedName === 'phone' && field.type === 'tel') confidence += 0.1;

    return Math.min(confidence, 1.0);
  }

  identifyDocumentFields(fields) {
    const documentFields = [];

    fields.forEach(field => {
      if (field.type === 'file') {
        const documentType = this.identifyDocumentType(field.label, field.name);
        
        documentFields.push({
          ...field,
          documentType: documentType,
          confidence: this.calculateDocumentConfidence(field, documentType)
        });
      }
    });

    return documentFields;
  }

  identifyDocumentType(label, name) {
    const searchText = `${label} ${name}`.toLowerCase();
    
    for (const [docType, keywords] of Object.entries(this.documentMappings)) {
      for (const keyword of keywords) {
        if (searchText.includes(keyword.toLowerCase())) {
          return docType;
        }
      }
    }

    return 'unknown';
  }

  calculateDocumentConfidence(field, documentType) {
    if (documentType === 'unknown') return 0;

    const searchText = `${field.label} ${field.name}`.toLowerCase();
    const keywords = this.documentMappings[documentType] || [];
    
    for (const keyword of keywords) {
      if (searchText.includes(keyword.toLowerCase())) {
        return searchText === keyword.toLowerCase() ? 1.0 : 0.8;
      }
    }

    return 0.5;
  }

  // Utility method to detect CAPTCHA elements
  detectCaptcha() {
    const captchaSelectors = [
      '[class*="captcha"]',
      '[id*="captcha"]',
      'iframe[src*="recaptcha"]',
      '.g-recaptcha',
      '[class*="hcaptcha"]',
      'canvas[id*="captcha"]'
    ];

    for (const selector of captchaSelectors) {
      const element = document.querySelector(selector);
      if (element && element.offsetParent !== null) { // Element is visible
        return {
          found: true,
          element: element,
          type: this.identifyCaptchaType(element)
        };
      }
    }

    return { found: false };
  }

  identifyCaptchaType(element) {
    const className = element.className.toLowerCase();
    const id = element.id.toLowerCase();
    
    if (className.includes('recaptcha') || element.src?.includes('recaptcha')) {
      return 'recaptcha';
    } else if (className.includes('hcaptcha')) {
      return 'hcaptcha';
    } else if (element.tagName === 'CANVAS') {
      return 'canvas';
    } else {
      return 'unknown';
    }
  }
}

// Make DOMAnalyzer available globally
window.DOMAnalyzer = DOMAnalyzer;