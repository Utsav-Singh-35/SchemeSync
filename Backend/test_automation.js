const BrowserAutomationService = require('./src/services/browserAutomationService');

async function testAgentBrowserAutomation() {
    console.log('🧪 Testing Agent-Browser Automation Service...\n');
    
    const service = new BrowserAutomationService();
    
    // Mock user profile data
    const mockUserProfile = {
        name: 'Rajesh Kumar',
        email: 'rajesh.kumar@example.com',
        age: 35,
        gender: 'Male',
        annual_income: 600000,
        occupation: 'Software Engineer',
        state: 'Karnataka',
        district: 'Bangalore Urban',
        address: '123 MG Road, Bangalore',
        pin_code: '560001',
        category: 'General',
        phone_number: '9876543210',
        aadhaar_number: '1234-5678-9012',
        pan_number: 'ABCDE1234F',
        marital_status: 'Married'
    };
    
    // Test URL - using a real form for testing
    const testUrl = 'https://httpbin.org/forms/post';
    const sessionId = `test_${Date.now()}`;
    
    console.log(`📋 Test Parameters:`);
    console.log(`- Session ID: ${sessionId}`);
    console.log(`- Test URL: ${testUrl}`);
    console.log(`- User Profile: ${JSON.stringify(mockUserProfile, null, 2)}\n`);
    
    try {
        console.log('🚀 Starting agent-browser automation test...');
        
        const result = await service.fillApplicationForm(
            mockUserProfile,
            testUrl,
            sessionId
        );
        
        console.log('\n📊 Test Results:');
        console.log('================');
        console.log(`Success: ${result.success}`);
        console.log(`Session ID: ${result.sessionId}`);
        console.log(`Initial URL: ${result.initialUrl}`);
        console.log(`Final URL: ${result.finalUrl}`);
        console.log(`Fields Found: ${result.fieldsFound}`);
        console.log(`Fields Filled: ${result.fieldsFilled}`);
        console.log(`Message: ${result.message}`);
        
        if (result.success) {
            console.log(`Browser URL: ${result.browserUrl}`);
            console.log(`Instructions: ${result.instructions}`);
            console.log(`Screenshots: ${JSON.stringify(result.screenshots, null, 2)}`);
            
            // Wait for user to review
            console.log('\n⏳ Browser session is active. Press Enter to close it...');
            await new Promise(resolve => {
                process.stdin.once('data', () => resolve());
            });
        } else {
            console.log(`Error: ${result.error}`);
            if (result.fallbackUrl) {
                console.log(`Fallback URL: ${result.fallbackUrl}`);
            }
        }
        
        // Clean up
        console.log('\n🧹 Cleaning up...');
        await service.closeBrowserSession(sessionId);
        
        console.log('\n✅ Test completed!');
        
    } catch (error) {
        console.error('\n❌ Test failed with error:', error);
        
        // Try to clean up even on error
        try {
            await service.closeBrowserSession(sessionId);
        } catch (cleanupError) {
            console.error('Cleanup also failed:', cleanupError);
        }
    }
}

// Run the test
testAgentBrowserAutomation().catch(console.error);