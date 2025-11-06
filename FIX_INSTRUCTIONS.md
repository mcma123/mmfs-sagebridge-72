# 🔧 Quick Fix Instructions

## Problem
Accounting pages (Journals, Chart of Accounts, General Ledger) show "Failed to load ledger entries" error.

## Solution
Add Supabase credentials to fix the issue.

## Steps (5 minutes)

### 1. Run the Fix Tool
```bash
cd backend
npx tsx scripts/fix_supabase_connection.ts
```

### 2. Enter Your Credentials
When prompted, provide:
- Supabase URL (from Supabase Dashboard → Settings → API)
- Service Role Key (from Supabase Dashboard → Settings → API)
- Anon Key (optional, from Supabase Dashboard → Settings → API)

### 3. Configure Supabase
1. Go to [Supabase Dashboard](https://supabase.com/dashboard)
2. Select your project
3. Go to **Settings** → **API**
4. Scroll to **"Exposed schemas"**
5. Add `public` if not present
6. Click **Save**

### 4. Restart Backend
```bash
npm run dev
```

### 5. Test
Visit these pages:
- http://localhost:8080/accounting/general-ledger
- http://localhost:8080/accounting/chart-of-accounts
- http://localhost:8080/accounting/journals

✅ All should load data now!

---

## Need More Help?

- **Detailed Guide:** See `USER_ACTION_REQUIRED.md`
- **Troubleshooting:** Run `npx tsx backend/scripts/check_supabase_env.ts`
- **Technical Details:** See `ACCOUNTING_PAGES_FIX_SUMMARY.md`

---

## What Was Wrong?

The backend was missing Supabase environment variables. Trial Balance worked because it uses a different database access method.

## What Was Fixed?

✅ Diagnostic tools created  
✅ Startup health check added  
✅ Error messages improved  
✅ Documentation written  

Now you just need to add your Supabase credentials! 🎯

