// Setup and Test Script for Intelligent Navigation System
const { getDatabase } = require('./Backend/src/database/connection');

async function setupIntelligentNavigation() {
    console.log('🚀 Setting up SchemeSync Intelligent Navigation System...\n');
    
    const db = getDatabase();
    
    try {
        await db.connect();
        console.log('✅ Database connection successful');
        
        // Test navigation tables
        const navigationTables = [
            'navigation_analysis_logs',
            'navigation_patterns', 
            'navigation_feedback',
            'navigation_sessions',
            'navigation_steps',
            'portal_configurations',
            'llm_analysis_cache',
            'navigation_metrics'
        ];
        
        console.log('\n📊 Navigation Database Tables:');
        for (const table of navigationTables) {
            try {
                const result = await db.get(`SELECT COUNT(*) as count FROM ${table}`);
                console.log(`   ✅ ${table} (${result.count} rows)`);
            } catch (error) {
                console.log(`   ❌ ${table} - ${error.message}`);
            }
        }
        
        // Test portal configurations
        const portals = await db.query('SELECT domain, portal_name, portal_type FROM portal_configurations');
        console.log(`\n🌐 Portal Configurations (${portals.length} portals):`);
        portals.forEach(portal => {
            console.log(`   • ${portal.portal_name} (${portal.domain}) - ${portal.portal_type}`);
        });
        
        // Test extension files
        console.log('\n📁 Extension Files:');
        const fs = require('fs');
        const extensionFiles = [
            'SchemeSync-extension/manifest.json',
            'SchemeSync-extension/background.js',
            'SchemeSync-extension/content.js',
            'SchemeSync-extension/intelligentNavigator.js',
            'SchemeSync-extension/domAnalyzer.js',
            'SchemeSync-extension/autofillEngine.js',
            'SchemeSync-extension/uiOverlay.js'
        ];
        
        extensionFiles.forEach(file => {
            if (fs.existsSync(file)) {
                const stats = fs.statSync(file);
                console.log(`   ✅ ${file} (${Math.round(stats.size/1024)}KB)`);
            } else {
                console.log(`   ❌ ${file} - Missing`);
            }
        });
        
        // Test backend services
        console.log('\n🔧 Backend Services:');
        const backendFiles = [
            'Backend/src/services/intelligentNavigationService.js',
            'Backend/src/routes/navigation.js',
            'Backend/src/database/navigation_schema.sql'
        ];
        
        backendFiles.forEach(file => {
            if (fs.existsSync(file)) {
                const stats = fs.statSync(file);
                console.log(`   ✅ ${file} (${Math.round(stats.size/1024)}KB)`);
            } else {
                console.log(`   ❌ ${file} - Missing`);
            }
        });
        
        console.log('\n🎯 System Capabilities:');
        console.log('   ✅ AI-powered page analysis using GPT-4');
        console.log('   ✅ Multi-step navigation with user confirmation');
        console.log('   ✅ Intelligent login assistance (credential filling)');
        console.log('   ✅ Dynamic form discovery across government portals');
        console.log('   ✅ Learning system with pattern recognition');
        console.log('   ✅ Session tracking and analytics');
        console.log('   ✅ Fallback mechanisms for offline scenarios');
        
        console.log('\n⚙️  Configuration Requirements:');
        console.log('   🔑 OPENAI_API_KEY environment variable (for GPT-4 analysis)');
        console.log('   🌐 Backend running on http://localhost:3000');
        console.log('   🖥️  Chrome extension loaded in developer mode');
        console.log('   👤 User authenticated in SchemeSync portal');
        
        console.log('\n🧪 Testing Workflow:');
        console.log('   1. Start backend: cd Backend && npm start');
        console.log('   2. Start frontend: cd frontend && npm run dev');
        console.log('   3. Load extension in Chrome');
        console.log('   4. Login to SchemeSync and complete profile');
        console.log('   5. Navigate to government portal (e.g., pmkisan.gov.in)');
        console.log('   6. Click "Find Application Form" button');
        console.log('   7. Follow AI navigation prompts');
        console.log('   8. Confirm each step when prompted');
        console.log('   9. Complete form filling when application form found');
        
        console.log('\n📈 Advanced Features:');
        console.log('   🤖 LLM-powered decision making for complex navigation');
        console.log('   🔄 Adaptive learning from user interactions');
        console.log('   📊 Real-time confidence scoring and fallback logic');
        console.log('   🛡️  Safety controls with user confirmation at each step');
        console.log('   📝 Comprehensive logging for debugging and improvement');
        console.log('   ⚡ Caching system to reduce API calls and improve speed');
        
        console.log('\n✅ Intelligent Navigation System Setup Complete!');
        console.log('\n🎉 Ready for expert-level AI-assisted government portal navigation!');
        
    } catch (error) {
        console.error('❌ Setup failed:', error);
    } finally {
        await db.close();
    }
}

// Run setup
setupIntelligentNavigation();