const fs = require('fs');
const path = require('path');
const { getDatabase } = require('./connection');

class NavigationMigration {
    constructor() {
        this.db = getDatabase();
    }

    async migrate() {
        try {
            console.log('Starting navigation database migration...');
            
            // Connect to database
            await this.db.connect();
            
            // Read and execute navigation schema
            const schemaPath = path.join(__dirname, 'navigation_schema.sql');
            const schema = fs.readFileSync(schemaPath, 'utf8');
            
            // Split schema into individual statements
            const statements = schema
                .split(';')
                .map(stmt => stmt.trim())
                .filter(stmt => stmt.length > 0);
            
            console.log(`Executing ${statements.length} navigation schema statements...`);
            
            for (const statement of statements) {
                try {
                    await this.db.run(statement);
                } catch (error) {
                    // Ignore "table already exists" errors
                    if (!error.message.includes('already exists')) {
                        throw error;
                    }
                }
            }
            
            // Insert initial portal configurations
            await this.insertInitialPortalConfigurations();
            
            console.log('Navigation database migration completed successfully');
            
        } catch (error) {
            console.error('Navigation migration failed:', error);
            throw error;
        } finally {
            await this.db.close();
        }
    }

    async insertInitialPortalConfigurations() {
        console.log('Inserting initial portal configurations...');
        
        const portals = [
            {
                domain: 'pmkisan.gov.in',
                portal_name: 'PM-KISAN Portal',
                portal_type: 'central',
                login_methods: JSON.stringify(['mobile_otp', 'aadhaar']),
                common_patterns: JSON.stringify({
                    login_selectors: ['.login-btn', '#login', 'a[href*="login"]'],
                    form_selectors: ['form[name*="farmer"]', '.application-form'],
                    navigation_patterns: ['Apply Online', 'New Registration', 'Farmer Corner']
                })
            },
            {
                domain: 'pmjay.gov.in',
                portal_name: 'Ayushman Bharat PM-JAY',
                portal_type: 'central',
                login_methods: JSON.stringify(['mobile_otp', 'aadhaar']),
                common_patterns: JSON.stringify({
                    login_selectors: ['.signin-btn', '#signin'],
                    form_selectors: ['form[name*="beneficiary"]', '.pmjay-form'],
                    navigation_patterns: ['Am I Eligible', 'Find Hospital', 'Beneficiary Login']
                })
            },
            {
                domain: 'scholarships.gov.in',
                portal_name: 'National Scholarship Portal',
                portal_type: 'central',
                login_methods: JSON.stringify(['credentials', 'mobile_otp']),
                common_patterns: JSON.stringify({
                    login_selectors: ['.login-button', '#studentLogin'],
                    form_selectors: ['form[name*="scholarship"]', '.application-form'],
                    navigation_patterns: ['New Registration', 'Student Login', 'Apply for Scholarship']
                })
            },
            {
                domain: 'india.gov.in',
                portal_name: 'India Portal',
                portal_type: 'central',
                login_methods: JSON.stringify(['digilocker', 'credentials']),
                common_patterns: JSON.stringify({
                    login_selectors: ['.login-link', '#login-btn'],
                    form_selectors: ['form', '.service-form'],
                    navigation_patterns: ['Services', 'Apply Online', 'Citizen Services']
                })
            },
            {
                domain: 'digitalseva.jharkhand.gov.in',
                portal_name: 'Jharkhand Digital Seva',
                portal_type: 'state',
                login_methods: JSON.stringify(['mobile_otp', 'credentials']),
                common_patterns: JSON.stringify({
                    login_selectors: ['.login-btn', '#userLogin'],
                    form_selectors: ['.service-form', 'form[name*="application"]'],
                    navigation_patterns: ['Apply for Service', 'Citizen Login', 'New Application']
                })
            }
        ];

        for (const portal of portals) {
            try {
                await this.db.run(`
                    INSERT OR IGNORE INTO portal_configurations 
                    (domain, portal_name, portal_type, login_methods, common_patterns)
                    VALUES (?, ?, ?, ?, ?)
                `, [
                    portal.domain,
                    portal.portal_name,
                    portal.portal_type,
                    portal.login_methods,
                    portal.common_patterns
                ]);
            } catch (error) {
                console.warn(`Failed to insert portal configuration for ${portal.domain}:`, error.message);
            }
        }
    }
}

// Run migration if called directly
if (require.main === module) {
    const migration = new NavigationMigration();
    migration.migrate()
        .then(() => {
            console.log('Navigation migration completed successfully');
            process.exit(0);
        })
        .catch((error) => {
            console.error('Navigation migration failed:', error);
            process.exit(1);
        });
}

module.exports = NavigationMigration;