const axios = require('axios');
require('dotenv').config();

const key = process.env.OPENROUTER_API_KEY;

async function listModels() {
    try {
        const response = await axios.get('https://openrouter.ai/api/v1/models', {
            headers: {
                'Authorization': `Bearer ${key}`
            }
        });
        
        console.log('--- AVAILABLE MODELS ---');
        const mistralModels = response.data.data.filter(m => m.id.toLowerCase().includes('mistral-7b'));
        mistralModels.forEach(m => console.log(`ID: ${m.id} | Name: ${m.name}`));
        console.log('------------------------');
        
        if (mistralModels.length === 0) {
            console.log('No Mistral 7B models found. Listing first 10 models:');
            response.data.data.slice(0, 10).forEach(m => console.log(`ID: ${m.id} | Name: ${m.name}`));
        }
    } catch (error) {
        console.error(' FAILED TO LIST MODELS:', error.message);
    }
}

listModels();
