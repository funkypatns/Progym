const axios = require('axios');

async function testApi() {
    try {
        // Assuming running on localhost:5000 based on previous context
        const response = await axios.get('http://localhost:5000/api/reports/gym-income', {
            params: {
                from: '2026-01-28',
                to: '2026-01-28',
                coachId: 'all',
                serviceType: 'all'
            }
        });

        console.log('Status:', response.status);
        console.log('Data Rows Length:', response.data.data.rows.length);
        if (response.data.data.rows.length > 0) {
            console.log('Sample Row:', JSON.stringify(response.data.data.rows[0], null, 2));
        }

    } catch (error) {
        console.error('Error:', error.message);
        if (error.response) console.error(error.response.data);
    }
}

testApi();
