// Document Management Module for File Upload Assistance
class DocumentManager {
  constructor() {
    this.API_BASE = 'http://localhost:3000/api';
    this.documentCache = new Map();
    this.documentMappings = this.initializeDocumentMappings();
  }

  initializeDocumentMappings() {
    return {
      // Identity Documents
      aadhaar: {
        keywords: ['aadhaar', 'aadhar', 'uid', 'unique id', 'identity proof', 'id proof'],
        fileTypes: ['pdf', 'jpg', 'jpeg', 'png'],
        maxSize: 2 * 1024 * 1024 // 2MB
      },
      pan: {
        keywords: ['pan', 'pan card', 'permanent account number', 'tax id'],
        fileTypes: ['pdf', 'jpg', 'jpeg', 'png'],
        maxSize: 2 * 1024 * 1024
      },
      voter_id: {
        keywords: ['voter id', 'election card', 'epic', 'voter card'],
        fileTypes: ['pdf', 'jpg', 'jpeg', 'png'],
        maxSize: 2 * 1024 * 1024
      },
      
      // Income Documents
      income_certificate: {
        keywords: ['income certificate', 'income proof', 'salary certificate', 'income statement'],
        fileTypes: ['pdf', 'jpg', 'jpeg', 'png'],
        maxSize: 5 * 1024 * 1024 // 5MB
      },
      
      // Caste Documents
      caste_certificate: {
        keywords: ['caste certificate', 'category certificate', 'sc certificate', 'st certificate', 'obc certificate'],
        fileTypes: ['pdf', 'jpg', 'jpeg', 'png'],
        maxSize: 5 * 1024 * 1024
      },
      
      // Residence Documents
      domicile: {
        keywords: ['domicile', 'residence certificate', 'domicile certificate', 'residential proof'],
        fileTypes: ['pdf', 'jpg', 'jpeg', 'png'],
        maxSize: 5 * 1024 * 1024
      },
      
      // Other Documents
      birth_certificate: {
        keywords: ['birth certificate', 'date of birth proof', 'birth proof'],
        fileTypes: ['pdf', 'jpg', 'jpeg', 'png'],
        maxSize: 5 * 1024 * 1024
      },
      bank_passbook: {
        keywords: ['bank passbook', 'bank statement', 'account proof', 'bank details'],
        fileTypes: ['pdf', 'jpg', 'jpeg', 'png'],
        maxSize: 5 * 1024 * 1024
      },
      photo: {
        keywords: ['photo', 'photograph', 'passport size photo', 'recent photo', 'image'],
        fileTypes: ['jpg', 'jpeg', 'png'],
        maxSize: 1 * 1024 * 1024 // 1MB
      }
    };
  }
}
  // Get user documents from backend
  async getUserDocuments() {
    if (this.documentCache.has('user_documents')) {
      return this.documentCache.get('user_documents');
    }

    try {
      const response = await this.sendMessage({
        type: 'GET_USER_DOCUMENTS'
      });

      if (response.success) {
        this.documentCache.set('user_documents', response.data);
        return response.data;
      } else {
        throw new Error(response.error || 'Failed to fetch documents');
      }
    } catch (error) {
      console.error('DocumentManager: Failed to get user documents:', error);
      return [];
    }
  }

  // Identify document type from field label/name
  identifyDocumentType(fieldLabel, fieldName = '') {
    const searchText = `${fieldLabel} ${fieldName}`.toLowerCase();
    
    for (const [docType, config] of Object.entries(this.documentMappings)) {
      for (const keyword of config.keywords) {
        if (searchText.includes(keyword.toLowerCase())) {
          return {
            type: docType,
            confidence: this.calculateConfidence(searchText, keyword),
            config: config
          };
        }
      }
    }

    return {
      type: 'unknown',
      confidence: 0,
      config: null
    };
  }

  // Calculate confidence score for document type matching
  calculateConfidence(searchText, keyword) {
    if (searchText === keyword.toLowerCase()) {
      return 1.0; // Exact match
    } else if (searchText.includes(keyword.toLowerCase())) {
      return 0.8; // Partial match
    }
    return 0.5; // Default
  }

  // Find matching document for a field
  async findMatchingDocument(fieldInfo) {
    const documents = await this.getUserDocuments();
    const docTypeInfo = this.identifyDocumentType(fieldInfo.label, fieldInfo.name);

    if (docTypeInfo.type === 'unknown') {
      return null;
    }

    // Find document with matching type
    const matchingDoc = documents.find(doc => 
      doc.type === docTypeInfo.type || 
      doc.category === docTypeInfo.type
    );

    return matchingDoc ? {
      document: matchingDoc,
      confidence: docTypeInfo.confidence,
      type: docTypeInfo.type
    } : null;
  }

  // Create File object from document metadata
  async createFileFromDocument(document) {
    try {
      // In a real implementation, this would fetch the file from S3 or backend
      // For now, create a placeholder file
      const response = await fetch(document.downloadUrl);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch document: ${response.statusText}`);
      }

      const blob = await response.blob();
      return new File([blob], document.originalName || document.filename, {
        type: document.mimeType || 'application/octet-stream'
      });
    } catch (error) {
      console.error('DocumentManager: Failed to create file from document:', error);
      
      // Create a placeholder file as fallback
      const blob = new Blob(['Document content placeholder'], { 
        type: document.mimeType || 'application/pdf' 
      });
      
      return new File([blob], document.originalName || 'document.pdf', {
        type: document.mimeType || 'application/pdf'
      });
    }
  }

  // Attach document to file input
  async attachDocumentToInput(fileInput, document) {
    try {
      const file = await this.createFileFromDocument(document);
      
      // Create DataTransfer object to set files
      const dataTransfer = new DataTransfer();
      dataTransfer.items.add(file);
      
      // Set files to input
      fileInput.files = dataTransfer.files;
      
      // Trigger change event
      const changeEvent = new Event('change', { bubbles: true });
      fileInput.dispatchEvent(changeEvent);
      
      return true;
    } catch (error) {
      console.error('DocumentManager: Failed to attach document:', error);
      return false;
    }
  }

  // Validate file against document type requirements
  validateFile(file, documentType) {
    const config = this.documentMappings[documentType];
    
    if (!config) {
      return { valid: true, errors: [] };
    }

    const errors = [];

    // Check file type
    const fileExtension = file.name.split('.').pop().toLowerCase();
    if (!config.fileTypes.includes(fileExtension)) {
      errors.push(`Invalid file type. Allowed: ${config.fileTypes.join(', ')}`);
    }

    // Check file size
    if (file.size > config.maxSize) {
      const maxSizeMB = Math.round(config.maxSize / (1024 * 1024));
      errors.push(`File too large. Maximum size: ${maxSizeMB}MB`);
    }

    return {
      valid: errors.length === 0,
      errors: errors
    };
  }

  // Get document upload requirements
  getDocumentRequirements(documentType) {
    const config = this.documentMappings[documentType];
    
    if (!config) {
      return null;
    }

    return {
      type: documentType,
      allowedTypes: config.fileTypes,
      maxSize: config.maxSize,
      maxSizeMB: Math.round(config.maxSize / (1024 * 1024)),
      keywords: config.keywords
    };
  }

  // Clear document cache
  clearCache() {
    this.documentCache.clear();
  }

  // Send message to background script
  async sendMessage(message) {
    return new Promise((resolve) => {
      chrome.runtime.sendMessage(message, (response) => {
        resolve(response || { success: false, error: 'No response' });
      });
    });
  }
}

// Make DocumentManager available globally
window.DocumentManager = DocumentManager;