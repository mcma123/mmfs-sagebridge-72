
import 'dotenv/config';

function parseJwt(token: string) {
    if (!token) return null;
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(atob(base64).split('').map(function (c) {
        return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
    }).join(''));

    return JSON.parse(jsonPayload);
}

const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;
if (key) {
    const claims = parseJwt(key);
    console.log('Issuer (iss):', claims.iss);
    console.log('Ref (ref):', claims.ref); // Sometimes present
    const fs = require('fs');
    fs.writeFileSync('jwt_iss.txt', claims.iss);
} else {
    console.error('No key found in env');
}
