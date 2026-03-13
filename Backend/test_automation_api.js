const axios = require('axios');

async function testAutomationAPI() {
    console.log('🧪 Testing Automation API...\n');
    
    const API_BASE = 'http://localhost:3003/api';
    
    // Mock user registration and login
    const testUser = {
        email: 'test@automation.com',
        password: 'test12345',
        name: 'Rajesh Kumar',
        age: 35,
        gender: 'male',
        annual_income: 600000,
        occupation: 'Software Engineer',
        state: 'Karnataka',
        district: 'Bangalore Urban',
        phone_number: '9876543210'
    };
    
    try {
        // Register user
        console.log('📝 Registering test user...');
        await axios.post(`${API_BASE}/auth/register`, testUser);
        
        // Login to get token
        console.log('🔐 Logging in...');
        const loginResponse = await axios.post(`${API_BASE}/auth/login`, {
            email: testUser.email,
            password: testUser.password
        });
        
        const token = loginResponse.data.token;
        console.log('✅ Login successful');
        
        // Test automation endpoint
        console.log('🤖 Testing form automation...');
        const automationResponse = await axios.post(`${API_BASE}/automation/fill-form`, {
            schemeId: 'test-scheme',
            applicationUrl: 'https://httpbin.org/forms/post'
        }, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        console.log('📊 Automation Result:');
        console.log(JSON.stringify(automationResponse.data, null, 2));
        
    } catch (error) {
        console.error('❌ Test failed:', error.response?.data || error.message);
    }
}

testAutomationAPI();