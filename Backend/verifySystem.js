#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

class SystemVerification {
    constructor() {
        this.results = {
            passed: 0,
            failed: 0,
            warnings: 0,
            errors: []
        };
    }

    async runVerification() {
        console.log('🔍 SchemeSync System Verification');
        console.log('='.repeat(50));
        
        this.verifyProjectStructure();
        this.verifyDatabaseSetup();
        this.verifyDiscoverySystem();
        this.verifyPortalRegistry();
        this.verifyConstraintCompliance();
        this.verifyDeploymentReadiness();
        
        this.displayResults();
        return this.results;
    }

    verifyProjectStructure() {
        console.log('\n📁 Project Structure Verification');
        
        const requiredFiles = [
            'src/server.js',
            'src/database/connection.js',
            'src/database/schema.sql',
            'src/database/setup.js',
            'src/discovery/discoveryOrchestrator.js',
            'src/discovery/datasetIngester.js',
            'src/discovery/antiBlockingCrawler.js',
            'src/discovery/crawlerQueue.js',
            'src/discovery/deduplicationLayer.js',
            'src/discovery/discoveryMonitor.js',
            'src/discovery/portalRegistry.json',
            'src/discovery/parsers/indiaGovParser.js',
            'src/discovery/parsers/ministryParser.js',
            'src/discovery/parsers/statePortalParser.js',
            'package.json',
            'REMEDIATION_REPORT.md',
            'MULTI_SOURCE_DISCOVERY_REPORT.md'
        ];
        
        for (const file of requiredFiles) {
            if (fs.existsSync(file)) {
                this.pass(`✓ ${file}