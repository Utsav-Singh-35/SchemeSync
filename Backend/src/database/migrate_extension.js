const fs = require('fs');
const path = require('path');
const { getDatabase } = require('./connection');

class ExtensionMigration {
    constructor() {
        this.db = getDatabase();
        // Ensure we're using the same database path as the main application
        console.log(`Using database path: ${this.db.dbPath}`);
    }

    async migrate() {
        try {
            console.log('Starting extension database migration...');
            
            // Connect to database
            await this.db.connect();
            
            // Read and execute extension schema
            const schemaPath = path.join(__dirname, 'extension_schema.sql');
            const schema = fs.readFileSync(schemaPath, 'utf8');
            
            // Split schema into individual statements
            const statements = schema
                .split(';')
                .map(stmt => stmt.trim())
                .filter(stmt => stmt.length > 0);
            
            console.log(`Executing ${statements.length} schema statements...`);
            
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
            
            // Insert initial portal metadata
            await this.insertInitialPortalMetadata();
            
            console.log('Extension database migration completed successfully');
            
        } catch (error) {
            console.error('Extension migration failed:', error);
            throw error;
        } finally {
            await this.db.close();
        }
    }

    async insertInitialPortalMetadata() {
        console.log('Inserting initial portal metadata...');
        
        const portals = [
            {
                hostname: 'pmkisan.gov.in',
                portal_name: 'PM-KISAN Portal',
                portal_type: 'government',
                form_detection_rules: JSON.stringify({
                    selectors: ['form[name*="application"]', 'form[id*="farmer"]', '.application-form'],
                    keywords: ['farmer', 'kisan', 'application', 'registration']
                }),
                known_field_patterns: JSON.stringify({
                    name: ['farmer name', 'applicant name', 'beneficiary name'],
                    aadhaar: ['aadhaar', 'aadhar', 'uid'],
                    mobile: ['mobile', 'phone', 'contact'],
                    bank_account: ['account number', 'bank account', 'ifsc']
                }),
                captcha_patterns: JSON.stringify({
                    selectors: ['#captcha', '.captcha', 'img[src*="captcha"]']
                })
            },
            {
                hostname: 'pmjay.gov.in',
                portal_name: 'Ayushman Bharat PM-JAY',
                portal_type: 'government',
                form_detection_rules: JSON.stringify({
                    selectors: ['form[name*="beneficiary"]', 'form[id*="pmjay"]', '.beneficiary-form'],
                    keywords: ['beneficiary', 'pmjay', 'ayushman', 'health']
                }),
                known_field_patterns: JSON.stringify({
                    name: ['beneficiary name', 'patient name', 'applicant name'],
                    aadhaar: ['aadhaar number', 'aadhar', 'uid'],
                    ration_card: ['ration card', 'bpl card', 'apl card']
                })
            },
            {
                hostname: 'scholarships.gov.in',
                portal_name: 'National Scholarship Portal',
                portal_type: 'government',
                form_detection_rules: JSON.stringify({
                    selectors: ['form[name*="scholarship"]', 'form[id*="student"]', '.scholarship-form'],
                    keywords: ['scholarship', 'student', 'education', 'application']
                }),
                known_field_patterns: JSON.stringify({
                    name: ['student name', 'applicant name'],
                    father_name: ['father name', 'guardian name'],
                    category: ['caste category', 'social category'],
                    income: ['family income', 'annual income']
                })
            },
            {
                hostname: 'india.gov.in',
                portal_name: 'India Portal',
                portal_type: 'government',
                form_detection_rules: JSON.stringify({
                    selectors: ['form', '.gov-form', '.application-form'],
                    keywords: ['application', 'form', 'service', 'citizen']
                })
            }
        ];

        for (const portal of portals) {
            try {
                await this.db.run(`
                    INSERT OR IGNORE INTO portal_metadata 
                    (hostname, portal_name, portal_type, form_detection_rules, known_field_patterns, captcha_patterns)
                    VALUES (?, ?, ?, ?, ?, ?)
                `, [
                    portal.hostname,
                    portal.portal_name,
                    portal.portal_type,
                    portal.form_detection_rules,
                    portal.known_field_patterns || null,
                    portal.captcha_patterns || null
                ]);
            } catch (error) {
                console.warn(`Failed to insert portal metadata for ${portal.hostname}:`, error.message);
            }
        }
    }
}

// Run migration if called directly
if (require.main === module) {
    const migration = new ExtensionMigration();
    migration.migrate()
        .then(() => {
            console.log('Migration completed successfully');
            process.exit(0);
        })
        .catch((error) => {
            console.error('Migration failed:', error);
            process.exit(1);
        });
}

module.exports = ExtensionMigration;