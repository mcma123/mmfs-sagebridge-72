# Supabase API Configuration Guide

## Overview

This guide explains how to configure Supabase REST API to ensure the accounting pages work correctly.

## The Problem

Three accounting pages were failing with 500 errors:
- `/accounting/journals`
- `/accounting/chart-of-accounts`
- `/accounting/general-ledger`

While Trial Balance continued to work.

## Root Cause

These pages use different database access methods:

| Page | Access Method | Requirement |
|------|--------------|-------------|
| Journals | Supabase Data API (`req.db`) | Supabase env + REST config |
| Chart of Accounts | Supabase Data API (`req.db`) | Supabase env + REST config |
| General Ledger | Supabase Data API (`req.db`) | Supabase env + REST config |
| Trial Balance | Direct PostgreSQL (`req.pg`) | Only DATABASE_URL |

**The failing pages require Supabase environment variables AND proper REST API configuration.**

## Fix Steps

### Step 1: Configure Environment Variables

The backend needs these environment variables in `.env`:

```env
# Supabase Project URL
SUPABASE_URL=https://your-project-id.supabase.co

# Service Role Key (from Supabase Dashboard → Settings → API)
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here

# Optional: Anon key for client-side operations
SUPABASE_ANON_KEY=your-anon-key-here
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
```

**Where to find these:**
1. Go to [Supabase Dashboard](https://supabase.com/dashboard)
2. Select your project
3. Go to **Settings** → **API**
4. Copy the values

### Step 2: Configure Exposed Schemas

Supabase REST API must be configured to expose the `public` schema:

1. Go to **Supabase Dashboard** → **Settings** → **API**
2. Scroll to **"Exposed schemas"**
3. Ensure `public` is in the list
4. If not, add it and click **Save**

**Why this is needed:**
The backend queries these public views:
- `public.accounting_accounts`
- `public.accounting_journals`
- `public.accounting_ledger_entries`

Without `public` in exposed schemas, Supabase REST API returns 404 for these views.

### Step 3: Verify Public Views Exist

Run this migration to ensure the public views are created:

```bash
cd backend
npm run db:migrate:app
```

Or manually:

```bash
psql $DATABASE_URL -f backend/migrations/sql/009_accounting_api_views.sql
```

**What this migration does:**
- Creates public views that wrap the `accounting.*` tables
- Grants SELECT permissions to `anon`, `authenticated`, and `service_role` roles
- Makes the accounting data accessible via Supabase Data API

### Step 4: Test the Configuration

Run the diagnostic script:

```bash
cd backend
npx tsx scripts/check_supabase_env.ts
```

This will:
- ✓ Check if environment variables are set
- ✓ Test Supabase connection
- ✓ Query the public views
- ✓ Report any configuration issues

### Step 5: Restart and Verify

1. **Restart the backend server**
   ```bash
   cd backend
   npm run dev
   ```

2. **Check startup logs** for the health check warning

3. **Test in browser:**
   - Visit `/accounting/general-ledger`
   - Visit `/accounting/chart-of-accounts`
   - Visit `/accounting/journals`
   - All should load data without errors

## Automated Fix Tool

For an interactive setup experience, run:

```bash
cd backend
npx tsx scripts/fix_supabase_connection.ts
```

This tool will:
- Diagnose the current configuration
- Offer to create/update `.env` file
- Test the connection
- Provide next steps

## Troubleshooting

### "Supabase env missing" warning on startup

**Cause:** Environment variables not loaded

**Fix:**
1. Ensure `.env` file exists in project root
2. Check that `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are set
3. Restart the backend server

### "relation does not exist" errors

**Cause:** Public views not created or not exposed

**Fix:**
1. Run migration 009: `npm run db:migrate:app`
2. Check Supabase "Exposed schemas" includes `public`
3. Verify views exist:
   ```sql
   SELECT * FROM public.accounting_accounts LIMIT 1;
   ```

### "permission denied" errors

**Cause:** Missing GRANTs on public views

**Fix:**
Re-run migration 009 which includes GRANT statements:
```bash
psql $DATABASE_URL -f backend/migrations/sql/009_accounting_api_views.sql
```

### Connection works but queries fail

**Cause:** Exposed schemas doesn't include `public`

**Fix:**
1. Supabase Dashboard → Settings → API
2. Add `public` to Exposed schemas
3. Save and retry

## Architecture Notes

### Why Two Access Methods?

The codebase uses two database access patterns:

1. **Supabase Data API** (`req.db`):
   - Uses PostgREST under the hood
   - Requires public views and exposed schemas
   - Benefits: RLS support, automatic API generation
   - Used by: Journals, Chart of Accounts, General Ledger

2. **Direct PostgreSQL** (`req.pg`):
   - Uses node-pg Pool directly
   - Only needs DATABASE_URL
   - Benefits: Full SQL power, no REST config needed
   - Used by: Trial Balance, some backend operations

### Migration to Single Method

If you want to avoid Supabase REST configuration issues, you can migrate all endpoints to use `req.pg`. See the plan discussion for pros/cons.

## Health Check

The backend now includes a startup health check that warns if Supabase env is missing:

```
⚠️  WARNING: Supabase environment variables are not configured!
   Endpoints using Supabase Data API will fail (accounts, journals, ledger).
   Trial Balance will continue to work (uses direct PostgreSQL).
```

This helps catch configuration issues early.

## Quick Reference

### Required Env Vars
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

### Required Supabase Config
- Exposed schemas: `public`

### Required Database Objects
- `public.accounting_accounts` (view)
- `public.accounting_journals` (view)
- `public.accounting_ledger_entries` (view)

### Diagnostic Commands
```bash
# Check env and test connection
npx tsx backend/scripts/check_supabase_env.ts

# Interactive fix tool
npx tsx backend/scripts/fix_supabase_connection.ts

# Re-run public views migration
npm run db:migrate:app
```

## See Also

- `ENV_SETUP_GUIDE.md` - Complete environment setup guide
- `datamodel.md` - Database schema and connectivity documentation
- `backend/migrations/sql/009_accounting_api_views.sql` - Public views migration

