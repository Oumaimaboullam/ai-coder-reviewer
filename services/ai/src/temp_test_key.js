const axios = require('axios');
require('dotenv').config();

const key = process.env.OPENROUTER_API_KEY;

if (!key || key.includes('your_openrouter_api_key_here')) {
    console.error(' KEY IS MISSING OR PLACEHOLDER IN .env');
    process.exit(1);
}

console.log(' Testing key (first 10 chars):', key.substring(0, 10) + '...');

async function testKey() {
    try {
        // Test key info / balance
        const response = await axios.get('https://openrouter.ai/api/v1/auth/key', {
            headers: {
                'Authorization': `Bearer ${key}`
            }
        });
        console.log(' KEY IS VALID!');
        console.log('--- Key Details ---');
        console.log('Label:', response.data.data.label);
        console.log('Usage:', response.data.data.usage);
        console.log('Limit:', response.data.data.limit || 'No limit');
        console.log('-------------------');
        
        // Bonus: Test a minimal completion to be 100% sure
        console.log(' Testing minimal completion (mistral-7b v0.1)...');
        const completion = await axios.post('https://openrouter.ai/api/v1/chat/completions', {
            model: 'mistralai/mistral-7b-instruct-v0.1',
            messages: [{ role: 'user', content: 'Say "API OK"' }],
            max_tokens: 10
        }, {
            headers: {
                'Authorization': `Bearer ${key}`,
                'Content-Type': 'application/json'
            }
        });
        
        console.log(' AI Response:', completion.data.choices[0].message.content.trim());
        console.log(' EVERYTHING IS WORKING 100%!');
    } catch (error) {
        console.error(' API TEST FAILED!');
        if (error.response) {
            console.error('Status:', error.response.status);
            console.error('Error info:', JSON.stringify(error.response.data, null, 2));
        } else {
            console.error('Message:', error.message);
        }
    }
}

testKey();
