
import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

async function checkConnection() {
    console.log('Checking Supabase connection...');

    const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

    if (!url || !key) {
        console.error('Missing Supabase credentials in .env');
        return;
    }

    console.log('URL:', url);

    try {
        const supabase = createClient(url, key);

        // Try a simple query
        const { data, error } = await supabase.from('accounting_accounts').select('count').limit(1).single();

        if (error) {
            // It might error if table doesn't exist or is empty, but if it connects, that's progress.
            // A connection error usually looks different.
            console.error('Supabase Query Error:', error.message);
            console.error('Error Details:', error);
        } else {
            console.log('Successfully connected to Supabase!');
            console.log('Data received:', data);
        }

    } catch (err: any) {
        console.error('Connection Failed:', err.message);
        if (err.cause) console.error('Cause:', err.cause);
        const fs = require('fs');
        fs.writeFileSync('connection_test_output.txt', `Connection Failed: ${err.message}\nCause: ${JSON.stringify(err.cause)}`);
    }
}

checkConnection().then(() => {
    const fs = require('fs');
    if (!fs.existsSync('connection_test_output.txt')) {
        fs.writeFileSync('connection_test_output.txt', 'Success (check console for data details)');
    }
});
