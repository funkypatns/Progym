const axios = require('axios');

const API_URL = 'http://localhost:3001/api';

async function run() {
    try {
        console.log('1. Logging in...');
        const loginRes = await axios.post(`${API_URL}/auth/login`, {
            username: 'admin',
            password: 'admin123'
        });

        const token = loginRes.data.token;
        console.log(' Login success. Token obtained.');
        const headers = { Authorization: `Bearer ${token}` };

        console.log('\n2. Testing Member Search (query: "GYM")...');
        try {
            const searchRes = await axios.get(`${API_URL}/members?search=GYM`, { headers });
            console.log(` Status: ${searchRes.status}`);
            console.log(` Success: ${searchRes.data.success}`);
            console.log(` Count: ${searchRes.data.data ? searchRes.data.data.length : 0}`);
            if (searchRes.data.data && searchRes.data.data.length > 0) {
                console.log(' Sample Member:', searchRes.data.data[0].firstName, searchRes.data.data[0].memberId);
            } else {
                console.log(' NO MEMBERS FOUND with "GYM". Trying empty search...');
                const allRes = await axios.get(`${API_URL}/members`, { headers });
                console.log(` Count (All): ${allRes.data.data ? allRes.data.data.length : 0}`);
            }
        } catch (err) {
            console.error(' Member Search Failed:', err.message);
            if (err.response) console.error(' Response:', err.response.data);
        }

        console.log('\n3. Testing Active Plans...');
        try {
            const plansRes = await axios.get(`${API_URL}/plans?active=true`, { headers });
            console.log(` Status: ${plansRes.status}`);
            console.log(` Success: ${plansRes.data.success}`);
            console.log(` Count: ${plansRes.data.data ? plansRes.data.data.length : 0}`);
            if (plansRes.data.data && plansRes.data.data.length > 0) {
                console.log(' Sample Plan:', plansRes.data.data[0].name, plansRes.data.data[0].price);
            }
        } catch (err) {
            console.error(' Plans Fetch Failed:', err.message);
        }

    } catch (err) {
        console.error('Login Failed or Critical Error:', err.message);
        if (err.response) console.error('Response:', err.response.data);
    }
}

run();
