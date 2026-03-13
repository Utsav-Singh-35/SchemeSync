-- Extension-specific database tables for SchemeSync Autofill

-- User custom fields for dynamic profile expansion
CREATE TABLE IF NOT EXISTS user_custom_fields (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    field_name TEXT NOT NULL,
    field_value TEXT NOT NULL,
    source TEXT DEFAULT 'manual', -- manual, application_form, import
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE(user_id, field_name)
);

-- User documents with enhanced metadata (drop and recreate to avoid conflicts)
DROP TABLE IF EXISTS user_documents;
CREATE TABLE user_documents (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    filename TEXT NOT NULL,
    original_name TEXT NOT NULL,
    file_type TEXT NOT NULL, -- pdf, jpg, png, etc.
    category TEXT NOT NULL, -- aadhaar, income_certificate, caste_certificate, etc.
    file_size INTEGER,
    mime_type TEXT,
    s3_key TEXT, -- S3 object key
    upload_date DATETIME DEFAULT CURRENT_TIMESTAMP,
    is_active BOOLEAN DEFAULT 1,
    verification_status TEXT DEFAULT 'pending' CHECK(verification_status IN ('pending', 'verified', 'rejected')),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Autofill attempt logs
CREATE TABLE IF NOT EXISTS autofill_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    portal TEXT NOT NULL, -- hostname of the portal
    url TEXT NOT NULL, -- full URL of the form page
    fields_detected INTEGER DEFAULT 0,
    fields_filled INTEGER DEFAULT 0,
    documents_uploaded INTEGER DEFAULT 0,
    missing_fields INTEGER DEFAULT 0,
    errors INTEGER DEFAULT 0,
    success BOOLEAN DEFAULT 0,
    timestamp DATETIME NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Form field mappings for learning and improvement
CREATE TABLE IF NOT EXISTS form_field_mappings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    portal TEXT NOT NULL,
    field_label TEXT NOT NULL,
    field_name TEXT NOT NULL,
    field_type TEXT NOT NULL,
    mapped_profile_field TEXT,
    confidence_score REAL DEFAULT 0.0,
    usage_count INTEGER DEFAULT 1,
    success_rate REAL DEFAULT 0.0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(portal, field_label, field_name)
);

-- Document type mappings for automatic document selection
CREATE TABLE IF NOT EXISTS document_type_mappings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    portal TEXT NOT NULL,
    field_label TEXT NOT NULL,
    document_type TEXT NOT NULL,
    confidence_score REAL DEFAULT 0.0,
    usage_count INTEGER DEFAULT 1,
    success_rate REAL DEFAULT 0.0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(portal, field_label, document_type)
);

-- Portal metadata for better form detection
CREATE TABLE IF NOT EXISTS portal_metadata (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    hostname TEXT UNIQUE NOT NULL,
    portal_name TEXT,
    portal_type TEXT, -- government, private, ngo
    form_detection_rules TEXT, -- JSON with CSS selectors and patterns
    known_field_patterns TEXT, -- JSON with common field patterns
    captcha_patterns TEXT, -- JSON with CAPTCHA detection patterns
    is_active BOOLEAN DEFAULT 1,
    last_updated DATETIME DEFAULT CURRENT_TIMESTAMP,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_user_custom_fields_user_id ON user_custom_fields(user_id);
CREATE INDEX IF NOT EXISTS idx_user_custom_fields_field_name ON user_custom_fields(field_name);
CREATE INDEX IF NOT EXISTS idx_user_documents_user_id ON user_documents(user_id);
CREATE INDEX IF NOT EXISTS idx_user_documents_category ON user_documents(category);
CREATE INDEX IF NOT EXISTS idx_autofill_logs_user_id ON autofill_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_autofill_logs_portal ON autofill_logs(portal);
CREATE INDEX IF NOT EXISTS idx_autofill_logs_timestamp ON autofill_logs(timestamp);
CREATE INDEX IF NOT EXISTS idx_form_field_mappings_portal ON form_field_mappings(portal);
CREATE INDEX IF NOT EXISTS idx_document_type_mappings_portal ON document_type_mappings(portal);
CREATE INDEX IF NOT EXISTS idx_portal_metadata_hostname ON portal_metadata(hostname);