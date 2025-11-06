# Accounting Pages Fix Summary

## Problem Statement

Three accounting pages were returning 500 errors and failing to load data:
- `/accounting/journals`
- `/accounting/chart-of-accounts`
- `/accounting/general-ledger`

Meanwhile, `/accounting/trial-balance` continued to work correctly.

## Root Cause Analysis

### Investigation Results

1. **Frontend Console Errors:**
   - `GET /api/v1/accounting/accounts` → 500 Internal Server Error
   - `GET /api/v1/accounting/ledger` → 500 Internal Server Error

2. **Backend Diagnostic:**
   - Ran `backend/scripts/check_supabase_env.ts`
   - **Finding:** `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are **NOT SET**

3. **Architecture Difference:**
   - Failing pages use `req.db` (Supabase Data API client)
   - Working page (Trial Balance) uses `req.pg` (direct PostgreSQL)

### Root Cause

**Missing Supabase environment variables** in the backend process.

The backend's Supabase middleware (`backend/src/middleware/supabase.ts`) requires:
- `SUPABASE_URL` or `VITE_SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY` or `SUPABASE_ANON_KEY`

Without these, the Supabase client cannot be initialized, causing all `req.db` queries to fail.

## Solution Implemented

### 1. Diagnostic Tools Created

**`backend/scripts/check_supabase_env.ts`**
- Checks if Supabase environment variables are set
- Tests connection to Supabase
- Queries the three public views used by accounting pages
- Provides actionable error messages

**`backend/scripts/fix_supabase_connection.ts`**
- Interactive diagnostic and fix tool
- Offers to create/update `.env` file with Supabase credentials
- Tests the connection after setup
- Guides user through troubleshooting

### 2. Startup Health Check

**Modified `backend/src/index.ts`:**
- Added health check that runs on server startup
- Warns if Supabase env variables are missing
- Provides clear instructions on how to fix
- Helps catch configuration issues early

```typescript
if (!supabaseUrl || !supabaseKey) {
  console.warn('\n⚠️  WARNING: Supabase environment variables are not configured!');
  console.warn('   Endpoints using Supabase Data API will fail (accounts, journals, ledger).');
  console.warn('   Trial Balance will continue to work (uses direct PostgreSQL).');
  // ... fix instructions ...
}
```

### 3. Improved Error Handling

**Updated frontend pages to surface backend error messages:**

- **`src/pages/accounting/Journals.tsx`**
  - Added `onError` handler to useQuery
  - Displays backend error message in toast

- **`src/pages/accounting/ChartOfAccounts.tsx`**
  - Added `onError` handlers for both accounts and trial balance queries
  - Shows specific error messages for each failure

- **`src/pages/accounting/GeneralLedger.tsx`**
  - Already had error handling (no changes needed)

Now users see helpful error messages like:
- "Error loading accounts: 500 Supabase env missing"
- Instead of generic "Failed to load"

### 4. Documentation Created

**`ENV_SETUP_GUIDE.md`**
- Complete guide to setting up environment variables
- Explains required Supabase configuration
- Verification checklist
- Troubleshooting section

**`SUPABASE_API_SETUP.md`**
- Detailed explanation of Supabase REST API configuration
- Step-by-step fix instructions
- Architecture notes explaining why two access methods exist
- Quick reference for required configuration

## Required Actions for User

To fix the issue, the user needs to:

### 1. Create `.env` file

Create a `.env` file in the project root with:

```env
SUPABASE_URL=https://your-project-id.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here
SUPABASE_ANON_KEY=your-anon-key-here
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
```

Get these values from: **Supabase Dashboard → Settings → API**

### 2. Configure Supabase REST API

1. Go to **Supabase Dashboard → Settings → API**
2. Scroll to **"Exposed schemas"**
3. Ensure `public` is in the list
4. Save

### 3. Verify Public Views

Run the migration to ensure public views exist:

```bash
cd backend
npm run db:migrate:app
```

### 4. Test the Fix

```bash
# Run diagnostic
cd backend
npx tsx scripts/check_supabase_env.ts

# Or use interactive tool
npx tsx scripts/fix_supabase_connection.ts

# Restart backend
npm run dev
```

### 5. Verify in Browser

Visit these pages and confirm they load:
- http://localhost:8080/accounting/general-ledger
- http://localhost:8080/accounting/chart-of-accounts
- http://localhost:8080/accounting/journals

## Technical Details

### Why Trial Balance Still Worked

Trial Balance endpoint (`GET /api/v1/accounting/trial-balance`) uses a different code path:

```typescript
// Trial Balance - uses req.pg (direct PostgreSQL)
const result = await req.pg.query(
  'SELECT * FROM accounting.fn_trial_balance_asof($1::DATE)',
  [dateParam]
);
```

This only requires `DATABASE_URL`, which was already configured.

### Why Other Pages Failed

Other endpoints use Supabase Data API:

```typescript
// Accounts - uses req.db (Supabase client)
const { data, error } = await req.db
  .from('accounting_accounts')
  .select('*')
  .order('code', { ascending: true });
```

This requires:
1. Supabase environment variables
2. Public views to exist
3. Supabase REST "Exposed schemas" to include `public`

### Files Modified

1. `backend/src/index.ts` - Added startup health check
2. `src/pages/accounting/Journals.tsx` - Added error handling
3. `src/pages/accounting/ChartOfAccounts.tsx` - Added error handling

### Files Created

1. `backend/scripts/check_supabase_env.ts` - Diagnostic tool
2. `backend/scripts/fix_supabase_connection.ts` - Interactive fix tool
3. `ENV_SETUP_GUIDE.md` - Environment setup guide
4. `SUPABASE_API_SETUP.md` - Supabase configuration guide
5. `ACCOUNTING_PAGES_FIX_SUMMARY.md` - This file

## Prevention

To prevent this issue in the future:

1. **Startup health check** now warns if Supabase env is missing
2. **Better error messages** help diagnose issues faster
3. **Documentation** provides clear setup instructions
4. **Diagnostic tools** make troubleshooting easy

## Alternative Solution (Not Implemented)

The plan discussed migrating all endpoints to use `req.pg` (like Trial Balance) instead of `req.db`. This would:

**Pros:**
- Remove dependency on Supabase REST configuration
- Simplify environment setup
- More consistent architecture

**Cons:**
- Requires rewriting three endpoints
- Loses Supabase RLS benefits
- More SQL to maintain

**Decision:** Keep current design, fix environment configuration.

## Next Steps

1. User must add Supabase credentials to `.env`
2. User must configure Supabase "Exposed schemas"
3. Run diagnostic to verify: `npx tsx backend/scripts/check_supabase_env.ts`
4. Restart backend and test in browser

## Success Criteria

- ✓ Diagnostic tools created and tested
- ✓ Startup health check added
- ✓ Error handling improved on frontend
- ✓ Documentation created
- ⏳ User must configure Supabase environment (requires credentials)
- ⏳ User must verify fix in browser

## References

- Root cause: Missing `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`
- Affected endpoints: `/accounts`, `/journals`, `/ledger`
- Working endpoint: `/trial-balance` (uses different access method)
- Required migration: `009_accounting_api_views.sql` (already exists)

