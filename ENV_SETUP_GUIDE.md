# Environment Setup Guide

## Root Cause Identified

The accounting pages (Journals, Chart of Accounts, General Ledger) are failing with 500 errors because **Supabase environment variables are missing** from the backend.

### Why Trial Balance Still Works

Trial Balance uses direct PostgreSQL connection (`req.pg`), while the other pages use Supabase Data API client (`req.db`), which requires Supabase credentials.

## Required Environment Variables

Create a `.env` file in the project root with the following variables:

### Supabase Configuration (REQUIRED)

Get these from: **Supabase Dashboard → Settings → API**

```env
# Project URL (e.g., https://xxxxx.supabase.co)
SUPABASE_URL=https://your-project.supabase.co

# Service Role Key (server-side, full access - keep secret!)
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here

# Anon Key (client-side, RLS-protected - safe for frontend)
SUPABASE_ANON_KEY=your-anon-key-here

# Frontend env vars (Vite requires VITE_ prefix)
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
```

### Database Configuration (REQUIRED)

You already have this working (since Trial Balance works), but for reference:

```env
# Option 1: Single connection string (recommended)
DATABASE_URL=postgresql://user:password@host:5432/database?sslmode=require
```

### Authentication

```env
# JWT secret for token signing
JWT_SECRET=dev-secret-change-me
```

### Server Configuration

```env
# Port for backend server (default: 3000)
PORT=3000
```

## Quick Fix Steps

1. **Create `.env` file** in project root (if it doesn't exist)

2. **Add Supabase credentials** from your Supabase Dashboard:
   - Go to: https://supabase.com/dashboard/project/YOUR_PROJECT/settings/api
   - Copy the Project URL → set as `SUPABASE_URL`
   - Copy the `service_role` key → set as `SUPABASE_SERVICE_ROLE_KEY`
   - Copy the `anon` key → set as `SUPABASE_ANON_KEY`

3. **Verify the fix** by running:
   ```bash
   cd backend
   npx tsx scripts/check_supabase_env.ts
   ```

4. **Restart the backend server**

5. **Test in browser**: Visit `/accounting/general-ledger` and verify data loads

## Supabase REST API Configuration

After setting environment variables, ensure Supabase REST API is configured correctly:

1. Go to: **Supabase Dashboard → Settings → API → Exposed schemas**
2. Ensure `public` is included in the list
3. Save changes

This is required for the public views:
- `public.accounting_accounts`
- `public.accounting_journals`
- `public.accounting_ledger_entries`

## Verification Checklist

- [ ] `.env` file exists in project root
- [ ] `SUPABASE_URL` is set
- [ ] `SUPABASE_SERVICE_ROLE_KEY` is set
- [ ] Diagnostic script passes: `npx tsx backend/scripts/check_supabase_env.ts`
- [ ] Supabase "Exposed schemas" includes `public`
- [ ] Backend server restarted
- [ ] `/accounting/general-ledger` loads data
- [ ] `/accounting/chart-of-accounts` loads data
- [ ] `/accounting/journals` loads data

## Troubleshooting

### Still getting 500 errors after adding env vars?

Run the diagnostic script to see specific errors:
```bash
cd backend
npx tsx scripts/check_supabase_env.ts
```

### Views not found errors?

Re-run the migration to create public views:
```bash
cd backend
npm run db:migrate:app
```

Or manually run:
```bash
psql $DATABASE_URL -f backend/migrations/sql/009_accounting_api_views.sql
```

### Permission denied errors?

Check that GRANTs exist on the views:
```sql
SELECT 1 FROM public.accounting_accounts LIMIT 1;
SELECT 1 FROM public.accounting_ledger_entries LIMIT 1;
SELECT 1 FROM public.accounting_journals LIMIT 1;
```

## For Deployment

If deploying to a hosting provider (Vercel, Render, etc.):

1. Add environment variables in the hosting dashboard
2. Ensure both backend and frontend variables are set
3. Redeploy/restart the application

