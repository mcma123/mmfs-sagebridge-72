
import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

async function diagnose() {
    console.log('Starting diagnosis...');

    // Check Env
    const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;

    console.log('Env Check:');
    console.log('URL available:', !!url);
    if (url) console.log('URL:', url);
    console.log('Key available:', !!key);

    if (!url || !key) {
        console.error('Missing credentials!');
        return;
    }

    const client = createClient(url, key, {
        auth: { autoRefreshToken: false, persistSession: false },
    });

    console.log('Client created. Attempting query...');

    try {
        const { data, error } = await client
            .from('accounting_accounts')
            .select('id')
            .limit(1);

        if (error) {
            console.error('Query Failed!');
            console.error('Error Message:', error.message);
            console.error('Error Code:', error.code);
            console.error('Error Details:', JSON.stringify(error, null, 2));
        } else {
            console.log('Query Successful!');
            console.log('Data:', data);
        }
    } catch (err: any) {
        console.error('Exception during query:', err.message);
        console.error('Stack:', err.stack);
        if (err.cause) console.error('Cause:', err.cause);
    }
}

diagnose().catch(err => console.error('Fatal:', err));
