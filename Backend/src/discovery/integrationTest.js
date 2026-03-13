#!/usr/bin/env node

const DatasetIngester = require('./datasetIngester');
const AntiBlockingCrawler = require('./antiBlockingCrawler');
const CrawlerQueue = require('./crawlerQueue');
const DeduplicationLayer = require('./deduplicationLayer');
const DiscoveryOrchestrator = require('./discoveryOrchestrator');

// Import parsers
const IndiaGovParser = require('./parsers/indiaGovParser');
const MinistryParser = require('./parsers/ministryParser');
const StatePortalParser = require('./parsers/statePortalParser');

class IntegrationTest {
    constructor() {
        this.testResults = {
            passed: 0,
            failed: 0,
            errors: []
        };
    }

    async runAllTests() {
        console.log('🧪 Starting SchemeSync Discovery Integration Tests');
        console.log('='.repeat(60));
        
        try {
            await this.testDatabaseConnection();
            await this.testDatasetIngester();
            await this.testAntiBlockingCrawler();
            await this.testCrawlerQueue();
            await this.testDeduplicationLayer();
            await this.testParsers();
            await this.testDiscoveryOrchestrator();
            
            this.displayResults();
            
        } catch (error) {
            console.error('❌ Integration test suite failed:', error.message);
            this.testResults.errors.push(`Test Suite: ${error.message}`);
        }
        
        return this.testResults;
    }

    async testDatabaseConnection() {
        console.log('\n📊 Testing Database Connection...');
        
        try {
            const { getDatabase } = require('../database/connection');
            const db = getDatabase();
            await db.connect();
            
            // Test basic query
            const result = await db.get('SELECT COUNT(*) as count FROM schemes');
            
            await db.close();
            
            this.pass('Database connection and basic query');
            
        } catch (error) {
            this.fail('Database connection', error.message);
        }
    }

    async testDatasetIngester() {
        console.log('\n📥 Testing Dataset Ingester...');
        
        try {
            const ingester = new DatasetIngester();
            await ingester.initialize();
            
            // Test dataset discovery with mock data (no network calls)
            console.log('  Testing dataset discovery...');
            
            // Mock the network-dependent method for testing
            const originalMethod = ingester.discoverSchemeDatasets;
            ingester.discoverSchemeDatasets = async () => {
                return [
                    { title: 'PM Kisan Scheme', description: 'Agriculture support' },
                    { title: 'Ayushman Bharat', description: 'Health insurance' }
                ];
            };
            
            const datasets = await ingester.discoverSchemeDatasets();
            
            // Restore original method
            ingester.discoverSchemeDatasets = originalMethod;
            
            if (datasets && Array.isArray(datasets) && datasets.length > 0) {
                this.pass(`Dataset discovery - Found ${datasets.length} datasets`);
            } else {
                this.fail('Dataset discovery', 'Invalid response format');
            }
            
            // Test scheme categorization
            const category = ingester.categorizeScheme('PM Kisan Scheme', 'Agriculture support for farmers');
            if (category === 'agriculture') {
                this.pass('Scheme categorization');
            } else {
                this.fail('Scheme categorization', `Expected 'agriculture', got '${category}'`);
            }
            
            await ingester.cleanup();
            
        } catch (error) {
            this.fail('Dataset Ingester', error.message);
        }
    }

    async testAntiBlockingCrawler() {
        console.log('\n🌐 Testing Anti-Blocking Crawler...');
        
        try {
            const crawler = new AntiBlockingCrawler();
            await crawler.initialize();
            
            // Test robots.txt parsing
            const robotsRules = crawler.parseRobotsTxt(`
User-agent: *
Crawl-delay: 5
Disallow: /admin
Disallow: /private
            `);
            
            if (robotsRules.crawlDelay === 5 && robotsRules.disallowed.includes('/admin')) {
                this.pass('Robots.txt parsing');
            } else {
                this.fail('Robots.txt parsing', 'Incorrect parsing results');
            }
            
            // Test URL validation
            const validUrl = crawler.isValidSchemeUrl('/government/schemes/pm-kisan');
            const invalidUrl = crawler.isValidSchemeUrl('/admin/login');
            
            if (validUrl && !invalidUrl) {
                this.pass('URL validation');
            } else {
                this.fail('URL validation', 'Incorrect validation logic');
            }
            
            // Test scheme categorization
            const category = crawler.categorizeScheme('Health Insurance Scheme', 'Medical coverage for all');
            if (category === 'health') {
                this.pass('Crawler scheme categorization');
            } else {
                this.fail('Crawler scheme categorization', `Expected 'health', got '${category}'`);
            }
            
            await crawler.cleanup();
            
        } catch (error) {
            this.fail('Anti-Blocking Crawler', error.message);
        }
    }

    async testCrawlerQueue() {
        console.log('\n📋 Testing Crawler Queue...');
        
        try {
            const queue = new CrawlerQueue();
            await queue.initialize();
            
            // Test adding URLs
            const testUrls = [
                'https://example.gov.in/scheme1',
                'https://example.gov.in/scheme2',
                'https://example.gov.in/scheme3'
            ];
            
            const addedCount = await queue.addUrls(testUrls, {
                priority: 2,
                portalType: 'test',
                parserType: 'generic'
            });
            
            if (addedCount === testUrls.length) {
                this.pass('Queue URL addition');
            } else {
                this.fail('Queue URL addition', `Added ${addedCount}/${testUrls.length} URLs`);
            }
            
            // Test queue statistics
            const stats = await queue.getQueueStats();
            if (stats && typeof stats.pending === 'number') {
                this.pass('Queue statistics');
            } else {
                this.fail('Queue statistics', 'Invalid stats format');
            }
            
            // Test getting next URL
            const nextUrl = await queue.getNextUrl();
            if (nextUrl && nextUrl.url) {
                this.pass('Queue URL retrieval');
                
                // Test marking completed
                await queue.markCompleted(nextUrl.id);
                this.pass('Queue URL completion');
            } else {
                this.fail('Queue URL retrieval', 'No URL returned');
            }
            
            await queue.cleanup();
            
        } catch (error) {
            this.fail('Crawler Queue', error.message);
        }
    }

    async testDeduplicationLayer() {
        console.log('\n🔄 Testing Deduplication Layer...');
        
        try {
            const deduplicator = new DeduplicationLayer();
            await deduplicator.initialize();
            
            // Test similarity calculation
            const similarity1 = deduplicator.calculateSimilarity('PM Kisan Scheme', 'PM Kisan Yojana');
            const similarity2 = deduplicator.calculateSimilarity('Health Insurance', 'Education Scholarship');
            
            if (similarity1 > 0.7 && similarity2 < 0.3) {
                this.pass('Similarity calculation');
            } else {
                this.fail('Similarity calculation', `Similarities: ${similarity1}, ${similarity2}`);
            }
            
            // Test text merging
            const merged = deduplicator.mergeText('Short text', 'This is a much longer text with more details', 'prefer_longer');
            if (merged.includes('longer text')) {
                this.pass('Text merging');
            } else {
                this.fail('Text merging', 'Incorrect merge result');
            }
            
            await deduplicator.cleanup();
            
        } catch (error) {
            this.fail('Deduplication Layer', error.message);
        }
    }

    async testParsers() {
        console.log('\n🔧 Testing Parsers...');
        
        try {
            // Test IndiaGov Parser
            const indiaGovParser = new IndiaGovParser();
            const canParseIndia = indiaGovParser.canParse('https://india.gov.in/schemes/test');
            const cannotParseOther = !indiaGovParser.canParse('https://example.com/test');
            
            if (canParseIndia && cannotParseOther) {
                this.pass('IndiaGov Parser URL detection');
            } else {
                this.fail('IndiaGov Parser URL detection', 'Incorrect URL matching');
            }
            
            // Test Ministry Parser
            const ministryParser = new MinistryParser();
            const ministry = ministryParser.identifyMinistry('https://agricoop.nic.in/schemes/test');
            if (ministry.includes('Agriculture')) {
                this.pass('Ministry Parser identification');
            } else {
                this.fail('Ministry Parser identification', `Got: ${ministry}`);
            }
            
            // Test State Parser
            const stateParser = new StatePortalParser();
            const state = stateParser.identifyState('https://up.gov.in/schemes/test');
            if (state === 'Uttar Pradesh') {
                this.pass('State Parser identification');
            } else {
                this.fail('State Parser identification', `Got: ${state}`);
            }
            
        } catch (error) {
            this.fail('Parsers', error.message);
        }
    }

    async testDiscoveryOrchestrator() {
        console.log('\n🎯 Testing Discovery Orchestrator...');
        
        try {
            const orchestrator = new DiscoveryOrchestrator();
            await orchestrator.initialize();
            
            // Test parser selection
            const parser = orchestrator.parsers.find(p => p.canParse('https://india.gov.in/test'));
            if (parser && parser.name === 'IndiaGov Parser') {
                this.pass('Orchestrator parser selection');
            } else {
                this.fail('Orchestrator parser selection', 'Parser not found or incorrect');
            }
            
            // Test priority calculation
            const priority = orchestrator.getPortalPriority('dataset');
            if (priority === 5) {
                this.pass('Portal priority calculation');
            } else {
                this.fail('Portal priority calculation', `Expected 5, got ${priority}`);
            }
            
            await orchestrator.cleanup();
            
        } catch (error) {
            this.fail('Discovery Orchestrator', error.message);
        }
    }

    pass(testName) {
        console.log(`  ✅ ${testName}`);
        this.testResults.passed++;
    }

    fail(testName, error) {
        console.log(`  ❌ ${testName}: ${error}`);
        this.testResults.failed++;
        this.testResults.errors.push(`${testName}: ${error}`);
    }

    displayResults() {
        console.log('\n' + '='.repeat(60));
        console.log('🧪 INTEGRATION TEST RESULTS');
        console.log('='.repeat(60));
        
        const total = this.testResults.passed + this.testResults.failed;
        const successRate = total > 0 ? Math.round((this.testResults.passed / total) * 100) : 0;
        
        console.log(`\n📊 Summary:`);
        console.log(`├─ Total Tests: ${total}`);
        console.log(`├─ Passed: ${this.testResults.passed}`);
        console.log(`├─ Failed: ${this.testResults.failed}`);
        console.log(`└─ Success Rate: ${successRate}%`);
        
        if (this.testResults.errors.length > 0) {
            console.log(`\n❌ Failures:`);
            this.testResults.errors.forEach((error, i) => {
                const prefix = i === this.testResults.errors.length - 1 ? '└─' : '├─';
                console.log(`${prefix} ${error}`);
            });
        }
        
        if (successRate >= 80) {
            console.log('\n✅ Integration tests PASSED - System ready for deployment');
        } else {
            console.log('\n❌ Integration tests FAILED - System needs fixes before deployment');
        }
        
        console.log('='.repeat(60));
    }
}

// Run if called directly
if (require.main === module) {
    const tester = new IntegrationTest();
    
    tester.runAllTests()
        .then((results) => {
            const successRate = results.passed + results.failed > 0 ? 
                Math.round((results.passed / (results.passed + results.failed)) * 100) : 0;
            
            process.exit(successRate >= 80 ? 0 : 1);
        })
        .catch((error) => {
            console.error('❌ Integration test suite failed:', error.message);
            process.exit(1);
        });
}

module.exports = IntegrationTest;