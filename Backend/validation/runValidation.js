require('dotenv').config();
const CrawlerValidator = require('./crawlerValidator');

async function runFullValidation() {
    const validator = new CrawlerValidator();
    
    try {
        console.log('🚀 Starting SchemeSync Data Quality Validation');
        console.log('=' .repeat(60));
        
        await validator.initialize();
        
        // Step 1: Validate real sources
        console.log('\n📊 Phase 1: Real Source Validation');
        const crawlResults = await validator.validateRealSources();
        
        // Step 2: Generate comprehensive report
        console.log('\n📊 Phase 2: Generating Validation Report');
        const report = await validator.generateValidationReport();
        
        // Display summary
        console.log('\n' + '='.repeat(60));
        console.log('🎯 VALIDATION SUMMARY');
        console.log('='.repeat(60));
        console.log(`📄 Pages Crawled: ${report.crawlerValidation.totalPagesCrawled}`);
        console.log(`✅ Schemes Extracted: ${report.crawlerValidation.totalSchemesExtracted}`);
        console.log(`📈 Success Rate: ${report.crawlerValidation.extractionSuccessRate.toFixed(2)}%`);
        console.log(`🏷️  Eligibility Tags Generated: ${report.crawlerValidation.eligibilityTagsGenerated}`);
        console.log(`🔍 Average Search Latency: ${report.searchPerformance.averageLatency.toFixed(2)}ms`);
        console.log(`🚫 Duplicates Detected: ${report.deduplication.duplicatesFound}`);
        console.log(`📊 Data Completeness: ${report.dataQualityMetrics.completenessScore.toFixed(2)}%`);
        
        // Show failed pages
        if (report.crawlerValidation.failedPages.length > 0) {
            console.log('\n❌ FAILED PAGES:');
            report.crawlerValidation.failedPages.forEach(failure => {
                console.log(`   ${failure.url}: ${failure.error}`);
            });
        }
        
        // Show validation errors
        if (report.crawlerValidation.validationErrors.length > 0) {
            console.log('\n⚠️  VALIDATION ERRORS:');
            report.crawlerValidation.validationErrors.forEach(error => {
                console.log(`   ${error.url}: ${error.errors.join(', ')}`);
            });
        }
        
        console.log('\n✅ Validation completed successfully!');
        
    } catch (error) {
        console.error('❌ Validation failed:', error);
        process.exit(1);
    } finally {
        await validator.cleanup();
    }
}

if (require.main === module) {
    runFullValidation();
}

module.exports = { runFullValidation };