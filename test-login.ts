
import fetch from 'node-fetch';

async function testLogin() {
    try {
        console.log('Testing POST to http://localhost:3000/api/v1/auth/login...');
        const res = await fetch('http://localhost:3000/api/v1/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: 'mcmarsh.fif@gmail.com', password: 'P@ssword61157' })
        });

        console.log('Status:', res.status, res.statusText);
        const text = await res.text();
        console.log('Body:', text);
    } catch (err) {
        console.error('Error:', err.message);
    }
}

testLogin();
