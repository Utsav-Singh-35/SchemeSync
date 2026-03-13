-- SchemeSync Comprehensive Database Schema
-- Updated to match the comprehensive crawler data structure

-- Users table (enhanced for eligibility matching)
CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    name TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- User profiles for eligibility matching
CREATE TABLE IF NOT EXISTS user_profiles (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    
    -- Basic demographics
    age INTEGER,
    gender TEXT CHECK(gender IN ('male', 'female', 'other', 'transgender')),
    date_of_birth DATE,
    
    -- Economic status
    annual_income INTEGER,
    occupation TEXT,
    employment_status TEXT CHECK(employment_status IN ('employed', 'unemployed', 'self_employed', 'student', 'retired')),
    
    -- Location
    state TEXT,
    district TEXT,
    address TEXT,
    pin_code TEXT,
    
    -- Categories
    category TEXT CHECK(category IN ('general', 'obc', 'sc', 'st', 'ews')),
    religion TEXT,
    
    -- Status flags
    is_student BOOLEAN DEFAULT 0,
    is_farmer BOOLEAN DEFAULT 0,
    is_disabled BOOLEAN DEFAULT 0,
    disability_percentage INTEGER,
    is_widow BOOLEAN DEFAULT 0,
    is_senior_citizen BOOLEAN DEFAULT 0,
    
    -- Family details
    family_size INTEGER,
    marital_status TEXT CHECK(marital_status IN ('single', 'married', 'divorced', 'widowed')),
    
    -- Contact
    phone_number TEXT,
    
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Family members table
CREATE TABLE IF NOT EXISTS family_members (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    age INTEGER,
    gender TEXT,
    relationship TEXT CHECK(relationship IN ('spouse', 'child', 'parent', 'grandparent', 'sibling', 'dependent')),
    occupation TEXT,
    annual_income INTEGER,
    is_student BOOLEAN DEFAULT 0,
    is_disabled BOOLEAN DEFAULT 0,
    education_level TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Comprehensive schemes table (matches crawler output)
CREATE TABLE IF NOT EXISTS schemes (
    id TEXT PRIMARY KEY, -- Using MyScheme API ID
    slug TEXT UNIQUE,
    name TEXT NOT NULL,
    short_title TEXT,
    
    -- Ministry and department
    ministry TEXT,
    department TEXT,
    implementing_agency TEXT,
    level TEXT, -- central, state, district
    scheme_for TEXT, -- individual, organization
    dbt_scheme BOOLEAN DEFAULT 0,
    
    -- Content
    brief_description TEXT,
    detailed_description TEXT,
    detailed_description_md TEXT,
    
    -- Eligibility
    eligibility_criteria TEXT,
    eligibility_criteria_md TEXT,
    
    -- Benefits
    benefits TEXT,
    benefit_type TEXT, -- cash, kind, service
    exclusions TEXT,
    
    -- Application
    application_process TEXT,
    application_mode TEXT, -- online, offline
    application_url TEXT,
    
    -- Documents and requirements
    required_documents TEXT,
    scheme_definitions TEXT,
    
    -- Contact and references
    contact_information TEXT, -- JSON
    reference_links TEXT,
    official_website TEXT,
    scheme_image_url TEXT,
    
    -- Categorization
    tags TEXT, -- JSON array
    target_beneficiaries TEXT, -- JSON array
    scheme_category TEXT, -- JSON array
    scheme_subcategory TEXT, -- JSON array
    
    -- Dates
    scheme_open_date TEXT,
    scheme_close_date TEXT,
    
    -- Metadata
    is_active BOOLEAN DEFAULT 1,
    last_updated DATETIME DEFAULT CURRENT_TIMESTAMP,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- FTS5 virtual table for comprehensive scheme search
CREATE VIRTUAL TABLE IF NOT EXISTS schemes_fts USING fts5(
    name,
    brief_description,
    detailed_description,
    eligibility_criteria,
    benefits,
    tags,
    ministry,
    department,
    content='schemes',
    content_rowid='rowid'
);

-- Triggers to keep FTS5 in sync
CREATE TRIGGER IF NOT EXISTS schemes_ai AFTER INSERT ON schemes BEGIN
    INSERT INTO schemes_fts(rowid, name, brief_description, detailed_description, eligibility_criteria, benefits, tags, ministry, department)
    VALUES (new.rowid, new.name, new.brief_description, new.detailed_description, new.eligibility_criteria, new.benefits, new.tags, new.ministry, new.department);
END;

CREATE TRIGGER IF NOT EXISTS schemes_ad AFTER DELETE ON schemes BEGIN
    INSERT INTO schemes_fts(schemes_fts, rowid, name, brief_description, detailed_description, eligibility_criteria, benefits, tags, ministry, department)
    VALUES ('delete', old.rowid, old.name, old.brief_description, old.detailed_description, old.eligibility_criteria, old.benefits, old.tags, old.ministry, old.department);
END;

CREATE TRIGGER IF NOT EXISTS schemes_au AFTER UPDATE ON schemes BEGIN
    INSERT INTO schemes_fts(schemes_fts, rowid, name, brief_description, detailed_description, eligibility_criteria, benefits, tags, ministry, department)
    VALUES ('delete', old.rowid, old.name, old.brief_description, old.detailed_description, old.eligibility_criteria, old.benefits, old.tags, old.ministry, old.department);
    INSERT INTO schemes_fts(rowid, name, brief_description, detailed_description, eligibility_criteria, benefits, tags, ministry, department)
    VALUES (new.rowid, new.name, new.brief_description, new.detailed_description, new.eligibility_criteria, new.benefits, new.tags, new.ministry, new.department);
END;

-- Parsed eligibility criteria for structured matching
CREATE TABLE IF NOT EXISTS eligibility_criteria (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    scheme_id TEXT NOT NULL,
    criteria_type TEXT NOT NULL, -- age_min, age_max, income_max, category, state, etc.
    criteria_value TEXT NOT NULL,
    criteria_operator TEXT DEFAULT 'equals', -- equals, greater_than, less_than, in, not_in
    is_mandatory BOOLEAN DEFAULT 1,
    FOREIGN KEY (scheme_id) REFERENCES schemes(id) ON DELETE CASCADE
);

-- Application tracking
CREATE TABLE IF NOT EXISTS applications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    scheme_id TEXT NOT NULL,
    application_date DATE NOT NULL,
    acknowledgment_number TEXT,
    application_status TEXT DEFAULT 'submitted' CHECK(application_status IN ('submitted', 'under_review', 'approved', 'rejected', 'pending_documents')),
    portal_url TEXT,
    notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (scheme_id) REFERENCES schemes(id) ON DELETE CASCADE
);

-- Document uploads
CREATE TABLE IF NOT EXISTS user_documents (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    document_type TEXT NOT NULL, -- aadhaar, income_certificate, caste_certificate, etc.
    document_name TEXT NOT NULL,
    file_path TEXT NOT NULL, -- S3 path
    file_size INTEGER,
    mime_type TEXT,
    verification_status TEXT DEFAULT 'pending' CHECK(verification_status IN ('pending', 'verified', 'rejected')),
    uploaded_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Saved schemes (user bookmarks)
CREATE TABLE IF NOT EXISTS saved_schemes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    scheme_id TEXT NOT NULL,
    saved_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (scheme_id) REFERENCES schemes(id) ON DELETE CASCADE,
    UNIQUE(user_id, scheme_id)
);

-- Crawler tracking
CREATE TABLE IF NOT EXISTS crawler_runs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    run_type TEXT NOT NULL, -- full, incremental
    started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    completed_at DATETIME,
    schemes_processed INTEGER DEFAULT 0,
    schemes_updated INTEGER DEFAULT 0,
    status TEXT DEFAULT 'running' CHECK(status IN ('running', 'completed', 'failed'))
);

-- Browser automation sessions
CREATE TABLE IF NOT EXISTS automation_sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    scheme_id TEXT NOT NULL,
    session_id TEXT UNIQUE NOT NULL,
    application_url TEXT NOT NULL,
    status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'running', 'completed', 'failed', 'closed')),
    fields_found INTEGER DEFAULT 0,
    fields_filled INTEGER DEFAULT 0,
    error_message TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (scheme_id) REFERENCES schemes(id) ON DELETE CASCADE
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_user_profiles_user_id ON user_profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_user_profiles_state ON user_profiles(state);
CREATE INDEX IF NOT EXISTS idx_user_profiles_category ON user_profiles(category);
CREATE INDEX IF NOT EXISTS idx_family_members_user_id ON family_members(user_id);
CREATE INDEX IF NOT EXISTS idx_schemes_ministry ON schemes(ministry);
CREATE INDEX IF NOT EXISTS idx_schemes_level ON schemes(level);
CREATE INDEX IF NOT EXISTS idx_schemes_active ON schemes(is_active);
CREATE INDEX IF NOT EXISTS idx_eligibility_criteria_scheme ON eligibility_criteria(scheme_id);
CREATE INDEX IF NOT EXISTS idx_eligibility_criteria_type ON eligibility_criteria(criteria_type);
CREATE INDEX IF NOT EXISTS idx_applications_user ON applications(user_id);
CREATE INDEX IF NOT EXISTS idx_applications_scheme ON applications(scheme_id);
CREATE INDEX IF NOT EXISTS idx_saved_schemes_user ON saved_schemes(user_id);
CREATE INDEX IF NOT EXISTS idx_user_documents_user ON user_documents(user_id);
CREATE INDEX IF NOT EXISTS idx_automation_sessions_user ON automation_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_automation_sessions_session ON automation_sessions(session_id);