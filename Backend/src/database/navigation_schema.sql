-- Navigation Intelligence Database Schema

-- Navigation analysis logs for learning and debugging
CREATE TABLE IF NOT EXISTS navigation_analysis_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    url TEXT NOT NULL,
    domain TEXT NOT NULL,
    action TEXT NOT NULL,
    confidence REAL NOT NULL,
    reasoning TEXT,
    method TEXT NOT NULL, -- pattern_based, llm_enhanced, combined
    element TEXT, -- CSS selector
    data TEXT, -- JSON data
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    session_id TEXT,
    user_id INTEGER,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);

-- Navigation patterns learned from successful interactions
CREATE TABLE IF NOT EXISTS navigation_patterns (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    domain TEXT NOT NULL,
    pattern TEXT NOT NULL,
    action TEXT NOT NULL,
    success_count INTEGER DEFAULT 0,
    total_count INTEGER DEFAULT 0,
    confidence REAL DEFAULT 0.0,
    css_selector TEXT,
    context_data TEXT, -- JSON
    last_updated DATETIME DEFAULT CURRENT_TIMESTAMP,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(domain, pattern, action)
);

-- User feedback on navigation suggestions
CREATE TABLE IF NOT EXISTS navigation_feedback (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    url TEXT NOT NULL,
    suggested_action TEXT NOT NULL,
    actual_action TEXT,
    success BOOLEAN NOT NULL,
    user_rating INTEGER CHECK(user_rating BETWEEN 1 AND 5),
    feedback_text TEXT,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    user_id INTEGER,
    session_id TEXT,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);

-- Navigation sessions for tracking multi-step journeys
CREATE TABLE IF NOT EXISTS navigation_sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id TEXT UNIQUE NOT NULL,
    user_id INTEGER,
    start_url TEXT NOT NULL,
    target_objective TEXT NOT NULL,
    current_step INTEGER DEFAULT 1,
    total_steps INTEGER,
    status TEXT DEFAULT 'active' CHECK(status IN ('active', 'completed', 'failed', 'abandoned')),
    success BOOLEAN,
    error_message TEXT,
    started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    completed_at DATETIME,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);

-- Individual steps within navigation sessions
CREATE TABLE IF NOT EXISTS navigation_steps (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id TEXT NOT NULL,
    step_number INTEGER NOT NULL,
    url TEXT NOT NULL,
    action TEXT NOT NULL,
    element TEXT, -- CSS selector
    data TEXT, -- JSON data
    confidence REAL,
    reasoning TEXT,
    user_confirmed BOOLEAN DEFAULT 0,
    success BOOLEAN,
    error_message TEXT,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (session_id) REFERENCES navigation_sessions(session_id) ON DELETE CASCADE
);

-- Portal-specific configuration and metadata
CREATE TABLE IF NOT EXISTS portal_configurations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    domain TEXT UNIQUE NOT NULL,
    portal_name TEXT,
    portal_type TEXT, -- central, state, district
    login_methods TEXT, -- JSON array: ["digilocker", "aadhaar", "mobile_otp"]
    common_patterns TEXT, -- JSON object with known patterns
    success_rate REAL DEFAULT 0.0,
    last_analysis DATETIME,
    is_active BOOLEAN DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- LLM analysis cache to avoid repeated API calls
CREATE TABLE IF NOT EXISTS llm_analysis_cache (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    content_hash TEXT UNIQUE NOT NULL, -- SHA256 of HTML content
    url_pattern TEXT, -- Pattern to match similar URLs
    analysis_result TEXT NOT NULL, -- JSON result
    confidence REAL NOT NULL,
    model_version TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    expires_at DATETIME,
    hit_count INTEGER DEFAULT 0,
    last_used DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Performance metrics for monitoring
CREATE TABLE IF NOT EXISTS navigation_metrics (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    metric_name TEXT NOT NULL,
    metric_value REAL NOT NULL,
    domain TEXT,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    metadata TEXT -- JSON
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_navigation_logs_domain ON navigation_analysis_logs(domain);
CREATE INDEX IF NOT EXISTS idx_navigation_logs_timestamp ON navigation_analysis_logs(timestamp);
CREATE INDEX IF NOT EXISTS idx_navigation_logs_session ON navigation_analysis_logs(session_id);
CREATE INDEX IF NOT EXISTS idx_navigation_patterns_domain ON navigation_patterns(domain);
CREATE INDEX IF NOT EXISTS idx_navigation_feedback_url ON navigation_feedback(url);
CREATE INDEX IF NOT EXISTS idx_navigation_sessions_user ON navigation_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_navigation_sessions_status ON navigation_sessions(status);
CREATE INDEX IF NOT EXISTS idx_navigation_steps_session ON navigation_steps(session_id);
CREATE INDEX IF NOT EXISTS idx_portal_configs_domain ON portal_configurations(domain);
CREATE INDEX IF NOT EXISTS idx_llm_cache_hash ON llm_analysis_cache(content_hash);
CREATE INDEX IF NOT EXISTS idx_llm_cache_expires ON llm_analysis_cache(expires_at);
CREATE INDEX IF NOT EXISTS idx_navigation_metrics_name ON navigation_metrics(metric_name);
CREATE INDEX IF NOT EXISTS idx_navigation_metrics_timestamp ON navigation_metrics(timestamp);