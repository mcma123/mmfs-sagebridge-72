
import fetch from 'node-fetch';

async function verify() {
    try {
        // 1. Login
        console.log('Logging in...');
        const loginRes = await fetch('http://localhost:3000/api/v1/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: 'mcmarsh.fif@gmail.com', password: 'P@ssword61157' })
        });

        if (!loginRes.ok) {
            console.error('Login Failed:', loginRes.status, await loginRes.text());
            return;
        }

        const loginData = await loginRes.json();
        const token = loginData.accessToken || loginData.session?.access_token;
        if (!token) {
            console.error('No token received:', loginData);
            return;
        }
        console.log('Login successful. Token received.');

        // 2. Create Account
        console.log('Creating Test Account...');
        const accountRes = await fetch('http://localhost:3000/api/v1/accounting/accounts', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`,
                'x-user-id': loginData.user?.id ? String(loginData.user.id) : '1' // Mocking user ID if needed by middleware?
                // Actually requireSupabase uses the token to get the user context usually. 
                // But let's check headers needed.
                // The frontend sent X-Role: accountant.
            },
            body: JSON.stringify({
                code: `TEST-${Math.floor(Math.random() * 1000)}`,
                name: 'Auto Verification Account',
                type: 'Asset',
                is_active: true
            })
        });

        const accountText = await accountRes.text();
        console.log('Create Account Status:', accountRes.status);
        console.log('Create Account Response:', accountText);

        if (accountRes.ok) {
            console.log('VERIFICATION SUCCESS: Account created.');
        } else {
            console.error('VERIFICATION FAILED: Could not create account.');
        }

    } catch (err) {
        console.error('Exception:', err);
    }
}

verify();
