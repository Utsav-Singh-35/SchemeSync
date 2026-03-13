#!/usr/bin/env node
/**
 * Migration script to import comprehensive crawler data into backend database
 */

const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

class CrawlerDataMigration {
    constructor() {
        this.crawlerDbPath = path.join(__dirname, '../../../myscheme-crawler/comprehensive_schemes.db');
        this.backendDbPath = path.join(__dirname, '../../../Backend/data/schemesync.db');
        this.schemaPath = path.join(__dirname, 'comprehensive_schema.sql');
    }

    async migrate() {
        console.log('🚀 Starting crawler data migration...');
        
        try {
            // Check if crawler database exists
            if (!fs.existsSync(this.crawlerDbPath)) {
                throw new Error(`Crawler database not found at: ${this.crawlerDbPath}`);
            }

            // Create backend database directory if it doesn't exist
            const backendDataDir = path.dirname(this.backendDbPath);
            if (!fs.existsSync(backendDataDir)) {
                fs.mkdirSync(backendDataDir, { recursive: true });
            }

            // Initialize backend database with new schema
            await this.initializeBackendDatabase();
            
            // Migrate scheme data
            await this.migrateSchemeData();
            
            // Parse and migrate eligibility criteria
            await this.parseEligibilityCriteria();
            
            console.log('✅ Migration completed successfully!');
            
        } catch (error) {
            console.error('❌ Migration failed:', error.message);
            process.exit(1);
        }
    }

    async initializeBackendDatabase() {
        console.log('📋 Initializing backend database schema...');
        
        return new Promise((resolve, reject) => {
            const db = new sqlite3.Database(this.backendDbPath);
            const schema = fs.readFileSync(this.schemaPath, 'utf8');
            
            db.exec(schema, (err) => {
                if (err) {
                    reject(err);
                } else {
                    console.log('✅ Backend database schema initialized');
                    db.close();
                    resolve();
                }
            });
        });
    }

    async migrateSchemeData() {
        console.log('📊 Migrating scheme data from crawler database...');
        
        return new Promise((resolve, reject) => {
            const crawlerDb = new sqlite3.Database(this.crawlerDbPath, sqlite3.OPEN_READONLY);
            const backendDb = new sqlite3.Database(this.backendDbPath);
            
            // Get all schemes from crawler database
            crawlerDb.all(`
                SELECT * FROM comprehensive_schemes 
                WHERE id IS NOT NULL AND name IS NOT NULL
            `, (err, schemes) => {
                if (err) {
                    reject(err);
                    return;
                }
                
                console.log(`📈 Found ${schemes.length} schemes to migrate`);
                
                // Prepare insert statement for backend database
                const insertStmt = backendDb.prepare(`
                    INSERT OR REPLACE INTO schemes (
                        id, slug, name, short_title, ministry, department, implementing_agency,
                        level, scheme_for, dbt_scheme, brief_description, detailed_description,
                        detailed_description_md, eligibility_criteria, eligibility_criteria_md,
                        benefits, benefit_type, exclusions, application_process, application_mode,
                        application_url, required_documents, scheme_definitions, contact_information,
                        reference_links, official_website, scheme_image_url, tags, target_beneficiaries,
                        scheme_category, scheme_subcategory, scheme_open_date, scheme_close_date,
                        is_active, last_updated
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                `);
                
                let processed = 0;
                let errors = 0;
                
                schemes.forEach(scheme => {
                    try {
                        insertStmt.run([
                            scheme.id,
                            scheme.slug,
                            scheme.name,
                            scheme.short_title,
                            scheme.ministry,
                            scheme.department,
                            scheme.implementing_agency,
                            scheme.level,
                            scheme.scheme_for,
                            scheme.dbt_scheme ? 1 : 0,
                            scheme.brief_description,
                            scheme.detailed_description,
                            scheme.detailed_description_md,
                            scheme.eligibility_criteria,
                            scheme.eligibility_criteria_md,
                            scheme.benefits,
                            scheme.benefit_type,
                            scheme.exclusions,
                            scheme.application_process,
                            scheme.application_mode,
                            scheme.application_url,
                            scheme.required_documents,
                            scheme.scheme_definitions,
                            scheme.contact_information,
                            scheme.reference_links,
                            scheme.official_website,
                            scheme.scheme_image_url,
                            scheme.tags,
                            scheme.target_beneficiaries,
                            scheme.scheme_category,
                            scheme.scheme_subcategory,
                            scheme.scheme_open_date,
                            scheme.scheme_close_date,
                            1, // is_active
                            scheme.last_updated || new Date().toISOString()
                        ]);
                        processed++;
                    } catch (error) {
                        console.error(`❌ Error migrating scheme ${scheme.id}:`, error.message);
                        errors++;
                    }
                });
                
                insertStmt.finalize();
                
                console.log(`✅ Migrated ${processed} schemes successfully`);
                if (errors > 0) {
                    console.log(`⚠️  ${errors} schemes had errors`);
                }
                
                crawlerDb.close();
                backendDb.close();
                resolve();
            });
        });
    }

    async parseEligibilityCriteria() {
        console.log('🔍 Parsing eligibility criteria for structured matching...');
        
        return new Promise((resolve, reject) => {
            const db = new sqlite3.Database(this.backendDbPath);
            
            // Get all schemes with eligibility criteria
            db.all(`
                SELECT id, eligibility_criteria, eligibility_criteria_md 
                FROM schemes 
                WHERE eligibility_criteria IS NOT NULL AND eligibility_criteria != ''
            `, (err, schemes) => {
                if (err) {
                    reject(err);
                    return;
                }
                
                console.log(`📋 Parsing eligibility for ${schemes.length} schemes`);
                
                const insertStmt = db.prepare(`
                    INSERT INTO eligibility_criteria (scheme_id, criteria_type, criteria_value, criteria_operator, is_mandatory)
                    VALUES (?, ?, ?, ?, ?)
                `);
                
                let totalCriteria = 0;
                
                schemes.forEach(scheme => {
                    const criteria = this.extractEligibilityCriteria(scheme.eligibility_criteria);
                    
                    criteria.forEach(criterion => {
                        insertStmt.run([
                            scheme.id,
                            criterion.type,
                            criterion.value,
                            criterion.operator,
                            criterion.mandatory ? 1 : 0
                        ]);
                        totalCriteria++;
                    });
                });
                
                insertStmt.finalize();
                
                console.log(`✅ Parsed ${totalCriteria} eligibility criteria`);
                
                db.close();
                resolve();
            });
        });
    }

    extractEligibilityCriteria(eligibilityText) {
        const criteria = [];
        
        if (!eligibilityText) return criteria;
        
        const text = eligibilityText.toLowerCase();
        
        // Age criteria
        const ageMatches = text.match(/(\d+)\s*(?:years?|yrs?)\s*(?:or\s+)?(?:above|older|minimum|min)/g);
        if (ageMatches) {
            ageMatches.forEach(match => {
                const age = match.match(/\d+/)[0];
                criteria.push({
                    type: 'age_min',
                    value: age,
                    operator: 'greater_than_equal',
                    mandatory: true
                });
            });
        }
        
        const maxAgeMatches = text.match(/(?:below|under|maximum|max)\s*(\d+)\s*(?:years?|yrs?)/g);
        if (maxAgeMatches) {
            maxAgeMatches.forEach(match => {
                const age = match.match(/\d+/)[0];
                criteria.push({
                    type: 'age_max',
                    value: age,
                    operator: 'less_than',
                    mandatory: true
                });
            });
        }
        
        // Income criteria
        const incomeMatches = text.match(/(?:income|salary|earning).*?(?:not\s+exceed|below|under|maximum|max).*?(?:₹|rs\.?|rupees?)\s*(\d+(?:,\d+)*(?:\.\d+)?)\s*(?:lakh|crore|thousand)?/g);
        if (incomeMatches) {
            incomeMatches.forEach(match => {
                const amount = match.match(/(\d+(?:,\d+)*(?:\.\d+)?)/)[1];
                let value = parseFloat(amount.replace(/,/g, ''));
                
                if (match.includes('lakh')) value *= 100000;
                else if (match.includes('crore')) value *= 10000000;
                else if (match.includes('thousand')) value *= 1000;
                
                criteria.push({
                    type: 'income_max',
                    value: value.toString(),
                    operator: 'less_than_equal',
                    mandatory: true
                });
            });
        }
        
        // Category criteria
        const categories = ['sc', 'st', 'obc', 'ews', 'general'];
        categories.forEach(category => {
            if (text.includes(category)) {
                criteria.push({
                    type: 'category',
                    value: category.toUpperCase(),
                    operator: 'equals',
                    mandatory: false
                });
            }
        });
        
        // Student status
        if (text.includes('student') || text.includes('studying')) {
            criteria.push({
                type: 'is_student',
                value: 'true',
                operator: 'equals',
                mandatory: true
            });
        }
        
        // Disability status
        if (text.includes('disabilit') || text.includes('handicap') || text.includes('pwd')) {
            criteria.push({
                type: 'is_disabled',
                value: 'true',
                operator: 'equals',
                mandatory: true
            });
        }
        
        // Gender criteria
        if (text.includes('women') || text.includes('female') || text.includes('girl')) {
            criteria.push({
                type: 'gender',
                value: 'female',
                operator: 'equals',
                mandatory: true
            });
        }
        
        return criteria;
    }
}

// Run migration if called directly
if (require.main === module) {
    const migration = new CrawlerDataMigration();
    migration.migrate().catch(console.error);
}

module.exports = CrawlerDataMigration;