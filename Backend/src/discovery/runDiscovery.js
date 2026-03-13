#!/usr/bin/env node

const DiscoveryOrchestrator = require('./discoveryOrchestrator');
const DiscoveryMonitor = require('./discoveryMonitor');

class DiscoveryRunner {
    constructor() {
        this.orchestrator = new DiscoveryOrchestrator();
        this.monitor = new DiscoveryMonitor();
    }

    async run() {
        console.log('🚀 Starting SchemeSync Multi-Source Discovery System');
        
        try {
            // Initialize components
            await this.orchestrator.initialize();
            await this.monitor.initialize();
            
            // Run full discovery with monitoring
            const report = await this.orchestrator.runFullDiscovery();
            
            // Generate monitoring report
            const monitoringReport = await this.monitor.generateDailyReport();
            
            // Display results
            this.displayResults(report, monitoringReport);
            
            return { discovery: report, monitoring: monitoringReport };
            
        } catch (error) {
            console.error('❌ Discovery system failed:', error.message);
            await this.monitor.logError('Discovery System', error.message, 'critical');
            throw error;
        } finally {
            await this.cleanup();
        }
    }

    displayResults(discoveryReport, monitoringReport) {
        console.log('\n' + '='.repeat(60));
        console.log('📊 DISCOVERY SYSTEM RESULTS');
        console.log('='.repeat(60));
        
        console.log('\n🎯 SUMMARY:');
        console.log(`├─ Total Runtime: ${discoveryReport.summary.total_runtime_seconds}s`);
        console.log(`├─ Datasets Processed: ${discoveryReport.summary.datasets_processed}`);
        console.log(`├─ URLs Discovered: ${discoveryReport.summary.urls_discovered}`);
        console.log(`├─ Schemes Extracted: ${discoveryReport.summary.schemes_extracted}`);
        console.log(`├─ Duplicates Found: ${discoveryReport.summary.duplicates_found}`);
        console.log(`├─ Total Schemes in DB: ${discoveryReport.summary.total_schemes_in_db}`);
        console.log(`└─ Errors: ${discoveryReport.summary.errors_encountered}`);
        
        console.log('\n📈 PERFORMANCE:');
        console.log(`├─ Success Rate: ${discoveryReport.performance_metrics.success_rate}%`);
        console.log(`├─ Schemes/Minute: ${discoveryReport.performance_metrics.schemes_per_minute}`);
        console.log(`├─ Error Rate: ${discoveryReport.performance_metrics.error_rate}%`);
        console.log(`└─ Deduplication Rate: ${discoveryReport.deduplication.deduplication_rate}%`);
        
        console.log('\n🏷️ TOP CATEGORIES:');
        discoveryReport.scheme_distribution.by_category.slice(0, 5).forEach((cat, i) => {
            const prefix = i === discoveryReport.scheme_distribution.by_category.length - 1 ? '└─' : '├─';
            console.log(`${prefix} ${cat.category}: ${cat.count} schemes`);
        });
        
        console.log('\n🏛️ TOP MINISTRIES:');
        discoveryReport.scheme_distribution.by_ministry.slice(0, 5).forEach((min, i) => {
            const prefix = i === 4 ? '└─' : '├─';
            console.log(`${prefix} ${min.ministry}: ${min.count} schemes`);
        });
        
        if (monitoringReport.recommendations.length > 0) {
            console.log('\n⚠️ RECOMMENDATIONS:');
            monitoringReport.recommendations.forEach((rec, i) => {
                const prefix = i === monitoringReport.recommendations.length - 1 ? '└─' : '├─';
                console.log(`${prefix} [${rec.priority.toUpperCase()}] ${rec.message}`);
            });
        }
        
        console.log('\n' + '='.repeat(60));
    }

    async cleanup() {
        try {
            await this.orchestrator.cleanup();
            await this.monitor.cleanup();
            console.log('✅ Discovery system cleanup completed');
        } catch (error) {
            console.error('❌ Cleanup failed:', error.message);
        }
    }
}

// Run if called directly
if (require.main === module) {
    const runner = new DiscoveryRunner();
    
    runner.run()
        .then((results) => {
            console.log('✅ Discovery completed successfully');
            process.exit(0);
        })
        .catch((error) => {
            console.error('❌ Discovery failed:', error.message);
            process.exit(1);
        });
}

module.exports = DiscoveryRunner;