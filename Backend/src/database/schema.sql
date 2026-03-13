-- SchemeSync Database Schema with FTS5 Support

-- Users table
CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    name TEXT NOT NULL,
    date_of_birth DATE,
    gender TEXT CHECK(gender IN ('male', 'female', 'other')),
    occupation TEXT,
    annual_income INTEGER,
    address TEXT,
    district TEXT,
    state TEXT,
    phone_number TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Family members table
CREATE TABLE IF NOT EXISTS family_members (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    age INTEGER,
    relationship TEXT CHECK(relationship IN ('self', 'spouse', 'child', 'parent', 'grandparent', 'dependent')),
    occupation TEXT,
    is_student BOOLEAN DEFAULT 0,
    has_disability BOOLEAN DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Schemes table
CREATE TABLE IF NOT EXISTS schemes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    scheme_name TEXT NOT NULL,
    ministry TEXT,
    description TEXT,
    benefits TEXT,
    eligibility_text TEXT,
    category TEXT,
    application_mode TEXT CHECK(application_mode IN ('online', 'offline', 'both')),
    official_url TEXT,
    last_updated DATETIME DEFAULT CURRENT_TIMESTAMP,
    is_active BOOLEAN DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- FTS5 virtual table for scheme search
CREATE VIRTUAL TABLE IF NOT EXISTS schemes_fts USING fts5(
    scheme_name,
    description,
    benefits,
    eligibility_text,
    category,
    content='schemes',
    content_rowid='id'
);

-- Triggers to keep FTS5 in sync
CREATE TRIGGER IF NOT EXISTS schemes_ai AFTER INSERT ON schemes BEGIN
    INSERT INTO schemes_fts(rowid, scheme_name, description, benefits, eligibility_text, category)
    VALUES (new.id, new.scheme_name, new.description, new.benefits, new.eligibility_text, new.category);
END;

CREATE TRIGGER IF NOT EXISTS schemes_ad AFTER DELETE ON schemes BEGIN
    INSERT INTO schemes_fts(schemes_fts, rowid, scheme_name, description, benefits, eligibility_text, category)
    VALUES ('delete', old.id, old.scheme_name, old.description, old.benefits, old.eligibility_text, old.category);
END;

CREATE TRIGGER IF NOT EXISTS schemes_au AFTER UPDATE ON schemes BEGIN
    INSERT INTO schemes_fts(schemes_fts, rowid, scheme_name, description, benefits, eligibility_text, category)
    VALUES ('delete', old.id, old.scheme_name, old.description, old.benefits, old.eligibility_text, old.category);
    INSERT INTO schemes_fts(rowid, scheme_name, description, benefits, eligibility_text, category)
    VALUES (new.id, new.scheme_name, new.description, new.benefits, new.eligibility_text, new.category);
END;

-- Documents required for schemes
CREATE TABLE IF NOT EXISTS scheme_documents (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    scheme_id INTEGER NOT NULL,
    document_name TEXT NOT NULL,
    description TEXT,
    is_mandatory BOOLEAN DEFAULT 1,
    FOREIGN KEY (scheme_id) REFERENCES schemes(id) ON DELETE CASCADE
);

-- Eligibility tags for structured matching
CREATE TABLE IF NOT EXISTS eligibility_tags (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    scheme_id INTEGER NOT NULL,
    tag_type TEXT NOT NULL, -- 'age_min', 'age_max', 'income_limit', 'student_required', etc.
    tag_value TEXT NOT NULL,
    FOREIGN KEY (scheme_id) REFERENCES schemes(id) ON DELETE CASCADE
);

-- Application tracking
CREATE TABLE IF NOT EXISTS applications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    scheme_id INTEGER NOT NULL,
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

-- Crawler tracking to avoid duplicates
CREATE TABLE IF NOT EXISTS crawler_sources (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    source_url TEXT UNIQUE NOT NULL,
    source_type TEXT NOT NULL, -- 'portal', 'pdf', 'announcement'
    last_crawled DATETIME,
    schemes_found INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT 1
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_family_members_user_id ON family_members(user_id);
CREATE INDEX IF NOT EXISTS idx_schemes_category ON schemes(category);
CREATE INDEX IF NOT EXISTS idx_schemes_active ON schemes(is_active);
CREATE INDEX IF NOT EXISTS idx_eligibility_tags_scheme ON eligibility_tags(scheme_id, tag_type);
CREATE INDEX IF NOT EXISTS idx_applications_user ON applications(user_id);
CREATE INDEX IF NOT EXISTS idx_applications_scheme ON applications(scheme_id);
CREATE INDEX IF NOT EXISTS idx_crawler_sources_url ON crawler_sources(source_url);