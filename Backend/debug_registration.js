const express = require('express');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

// Debug middleware to log all registration requests
app.post('/api/auth/register', (req, res) => {
    console.log('=== Registration Request Debug ===');
    console.log('Headers:', req.headers);
    console.log('Body:', JSON.stringify(req.body, null, 2));
    console.log('Body type:', typeof req.body);
    console.log('Body keys:', Object.keys(req.body));
    
    // Check each field
    Object.entries(req.body).forEach(([key, value]) => {
        console.log(`${key}: ${value} (${typeof value})`);
    });
    
    res.json({
        success: true,
        message: 'Debug response',
        receivedData: req.body
    });
});

app.listen(3005, () => {
    console.log('Debug server running on port 3005');
    console.log('Update frontend API URL to http://localhost:3005 to debug');
});