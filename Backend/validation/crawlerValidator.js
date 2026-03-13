const PortalCrawler = require('../src/agents/portalCrawler');
const { getDatabase } = require('../src/database/connection');
const fs = require('fs');
const path = require('path');

class CrawlerValidator {
    constructor() {
        this.db = getDatabase();
        this.crawler = new PortalCrawler();
        this.validationResults = {
            totalPagesCrawled: 0,
            totalSchemesExtracted: 0,
            extractionSuccessRate: 0,
            failedPages: [],
            duplicatesDetected: 0,
            eligibilityTagsGenerated: 0,
            validationErrors: []
        };
        this.crawledSchemes = [];
    }

    async initialize() {
        await this.db.connect();
        await this.crawler.initialize();
        console.log('Crawler validator initialized');
    }

    async validateRealSources() {
        console.log('🔍 Starting real source validation...');
        
        const testSources = [
            // Central Government Portals
            'https://www.india.gov.in/my-government/schemes',
            'https://www.pmjay.gov.in/',
            'https://pmkisan.gov.in/',
            'https://www.nrega.nic.in/',
            'https://pmindia.gov.in/en/government_tr_rec/schemes/',
            
            // Ministry Websites
            'https://www.mohfw.gov.in/schemes',
            'https://www.education.gov.in/schemes',
            'https://rural.nic.in/schemes',
            'https://www.agricoop.nic.in/schemes',
            'https://www.msme.gov.in/schemes-initiatives'
        ];

        for (const url of testSources) {
            await this.validateSingleSource(url);
            await this.randomDelay(2000, 4000); // Respectful crawling
        }

        return this.validationResults;
    }

    async validateSingleSource(url) {
        console.log(`📄 Validating: ${url}`);
        this.validationResults.totalPagesCrawled++;

        try {
            const success = await this.crawler.navigateToUrl(url);
            if (!success) {
                this.validationResults.failedPages.push({
                    url,
                    error: 'Navigation failed',
                    timestamp: new Date().toISOString()
                });
                return;
            }

            // Test scheme extraction
            const schemeData = await this.extractSchemeFromPage(url);
            
            if (schemeData) {
                // Validate extracted data quality
                const validation = this.validateSchemeData(schemeData);
                
                if (validation.isValid) {
                    this.validationResults.totalSchemesExtracted++;
                    this.crawledSchemes.push(schemeData);
                    
                    // Check for eligibility tags
                    if (schemeData.eligibility_tags && schemeData.eligibility_tags.length > 0) {
                        this.validationResults.eligibilityTagsGenerated++;
                    }
                    
                    console.log(`✅ Extracted: ${schemeData.scheme_name}`);
                } else {
                    this.validationResults.validationErrors.push({
                        url,
                        errors: validation.errors,
                        extractedData: schemeData
                    });
                }
            } else {
                this.validationResults.failedPages.push({
                    url,
                    error: 'No scheme data extracted',
                    timestamp: new Date().toISOString()
                });
            }

        } catch (error) {
            this.validationResults.failedPages.push({
                url,
                error: error.message,
                timestamp: new Date().toISOString()
            });
            console.error(`❌ Error validating ${url}:`, error.message);
        }
    }

    async extractSchemeFromPage(url) {
        try {
            // Extract basic scheme information
            const schemeName = await this.crawler.extractText('.scheme-title, .main-heading, h1, .page-title, .scheme-name');
            const ministry = await this.crawler.extractText('.ministry, .department, .ministry-name, .dept');
            const description = await this.crawler.extractText('.description, .about, .scheme-description, .overview, p');
            const benefits = await this.crawler.extractText('.benefits, .scheme-benefits, .advantages');
            const eligibilityText = await this.crawler.extractText('.eligibility, .eligibility-criteria, .who-can-apply');

            // Validate critical fields
            if (!schemeName || schemeName.length < 5) {
                return null;
            }

            const schemeData = {
                scheme_name: this.crawler.cleanText(schemeName),
                ministry: ministry ? this.crawler.cleanText(ministry) : null,
                description: description ? this.crawler.cleanText(description) : null,
                benefits: benefits ? this.crawler.cleanText(benefits) : null,
                eligibility_text: eligibilityText ? this.crawler.cleanText(eligibilityText) : null,
                category: this.crawler.categorizeScheme(`${schemeName} ${description || ''}`),
                application_mode: 'online',
                official_url: url,
                extracted_at: new Date().toISOString()
            };

            // Extract eligibility tags if eligibility text exists
            if (eligibilityText) {
                schemeData.eligibility_tags = this.crawler.extractEligibilityTags(eligibilityText);
            }

            return schemeData;

        } catch (error) {
            console.error('Error extracting scheme data:', error);
            return null;
        }
    }

    validateSchemeData(schemeData) {
        const errors = [];
        
        // Required field validation
        if (!schemeData.scheme_name || schemeData.scheme_name.length < 5) {
            errors.push('Scheme name too short or missing');
        }
        
        if (!schemeData.official_url) {
            errors.push('Official URL missing');
        }
        
        // Data quality checks
        if (schemeData.description && schemeData.description.length < 20) {
            errors.push('Description too short');
        }
        
        if (schemeData.scheme_name && schemeData.scheme_name.includes('undefined')) {
            errors.push('Scheme name contains undefined values');
        }
        
        // URL validation
        try {
            new URL(schemeData.official_url);
        } catch (e) {
            errors.push('Invalid official URL format');
        }

        return {
            isValid: errors.length === 0,
            errors
        };
    }

    async testDeduplication() {
        console.log('🔍 Testing deduplication system...');
        
        // Test with known duplicate sources
        const duplicateTestSources = [
            'https://www.pmjay.gov.in/',
            'https://www.india.gov.in/spotlight/pradhan-mantri-jan-arogya-yojana-pmjay',
            'https://pmkisan.gov.in/',
            'https://www.india.gov.in/spotlight/pradhan-mantri-kisan-samman-nidhi-pm-kisan'
        ];

        const beforeCount = await this.db.get('SELECT COUNT(*) as count FROM schemes');
        
        for (const url of duplicateTestSources) {
            await this.validateSingleSource(url);
            await this.randomDelay(1000, 2000);
        }
        
        const afterCount = await this.db.get('SELECT COUNT(*) as count FROM schemes');
        
        // Check for duplicates in database
        const duplicates = await this.db.query(`
            SELECT scheme_name, COUNT(*) as count 
            FROM schemes 
            GROUP BY LOWER(scheme_name) 
            HAVING COUNT(*) > 1
        `);
        
        this.validationResults.duplicatesDetected = duplicates.length;
        
        console.log(`📊 Deduplication test: ${duplicates.length} duplicates found`);
        return duplicates;
    }

    async testFTS5Search() {
        console.log('🔍 Testing FTS5 search performance...');
        
        const testQueries = [
            'health insurance',
            'farmer subsidy', 
            'education scholarship',
            'women welfare',
            'employment guarantee',
            'housing scheme',
            'pension',
            'disability'
        ];

        const searchResults = [];

        for (const query of testQueries) {
            const startTime = Date.now();
            
            const results = await this.db.searchSchemes(query, 10, 0);
            
            const endTime = Date.now();
            const latency = endTime - startTime;
            
            searchResults.push({
                query,
                resultCount: results.length,
                latency,
                results: results.slice(0, 3) // Top 3 results for analysis
            });
            
            console.log(`🔍 "${query}": ${results.length} results in ${latency}ms`);
        }

        return searchResults;
    }

    async generateValidationReport() {
        // Calculate success rate
        this.validationResults.extractionSuccessRate = 
            (this.validationResults.totalSchemesExtracted / this.validationResults.totalPagesCrawled) * 100;

        // Get database statistics
        const dbStats = await this.db.get(`
            SELECT 
                COUNT(*) as total_schemes,
                COUNT(CASE WHEN eligibility_text IS NOT NULL THEN 1 END) as schemes_with_eligibility,
                COUNT(CASE WHEN description IS NOT NULL THEN 1 END) as schemes_with_description,
                COUNT(CASE WHEN benefits IS NOT NULL THEN 1 END) as schemes_with_benefits
            FROM schemes
        `);

        // Test search performance
        const searchResults = await this.testFTS5Search();
        
        // Test deduplication
        const duplicates = await this.testDeduplication();

        const report = {
            timestamp: new Date().toISOString(),
            crawlerValidation: this.validationResults,
            databaseStatistics: dbStats,
            searchPerformance: {
                averageLatency: searchResults.reduce((sum, r) => sum + r.latency, 0) / searchResults.length,
                totalQueries: searchResults.length,
                results: searchResults
            },
            deduplication: {
                duplicatesFound: duplicates.length,
                duplicateSchemes: duplicates
            },
            dataQualityMetrics: {
                schemesWithStructuredTags: this.validationResults.eligibilityTagsGenerated,
                schemesWithRawEligibility: dbStats.schemes_with_eligibility - this.validationResults.eligibilityTagsGenerated,
                completenessScore: (dbStats.schemes_with_description / dbStats.total_schemes) * 100
            }
        };

        // Save report to file
        const reportPath = path.join(__dirname, 'validation_report.json');
        fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
        
        console.log(`📊 Validation report saved to: ${reportPath}`);
        return report;
    }

    async randomDelay(min = 1000, max = 3000) {
        const delay = Math.floor(Math.random() * (max - min + 1)) + min;
        await new Promise(resolve => setTimeout(resolve, delay));
    }

    async cleanup() {
        await this.crawler.cleanup();
        await this.db.close();
    }
}

module.exports = CrawlerValidator;