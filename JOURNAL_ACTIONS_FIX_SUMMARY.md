# Journal Actions Fix Summary

## Problem
The "Mark as Reviewed" and "Delete" buttons on `/accounting/journals` were not working, showing 404 and 500 errors in the console.

## Root Causes Identified
1. **Missing/Unapplied Migrations**: Database functions (`fn_review_journal`, `fn_void_journal`) and workflow columns may not have been applied
2. **Poor Error Handling**: Backend was returning generic 500 errors instead of meaningful 400/409 responses
3. **Unclear Error Messages**: UI wasn't extracting and displaying specific error messages from failed API calls

## Changes Made

### 1. Backend Error Handling Improvements
**File**: `backend/src/routes/accounting.ts`

- **Review endpoint** (line 217-234): Now maps "not found" and "not in draft" errors to HTTP 400 instead of 500
- **Void endpoint** (line 291-311): Now maps "not found" and "already voided" errors to HTTP 400 instead of 500
- **Delete endpoint** (already correct): Returns 409 for posted journals

### 2. Frontend Error Display Enhancements
**File**: `src/pages/accounting/Journals.tsx`

- **handleMarkReviewed** (line 148-156): Now extracts and displays the first error message from failed promises
- **handleDeleteSelected** (line 233-242): Now shows specific error messages from delete/void failures

### 3. Documentation & Testing

**Created Files**:
- `backend/JOURNAL_ACTIONS_RUNBOOK.md` - Complete troubleshooting guide with:
  - Migration verification steps
  - API testing commands (curl)
  - Database verification queries
  - Common issues and fixes
  - QA checklist

- `backend/scripts/verify_migrations.sql` - SQL script to verify all required database objects exist

- `backend/scripts/test_journal_actions.ts` - Integration tests for:
  - Create draft → Review → Delete flow
  - Create draft → Post → Void flow

## How to Fix Your Environment

### Step 1: Apply Migrations
```bash
npm run db:migrate:app
```

This ensures migrations 010 and 011 are applied, creating:
- `fn_review_journal` function
- `fn_void_journal` function
- `fn_post_journal_from_draft` function
- `fn_create_journal_draft` function
- Workflow columns: `status`, `reviewed_at`, `reviewed_by`, `posted_at`, `posted_by`, `voided_at`

### Step 2: Verify Database Objects
```bash
psql $DATABASE_URL -f backend/scripts/verify_migrations.sql
```

Expected output:
- 4 functions listed
- 6 workflow columns on accounting.journals
- public.accounting_journals view includes all workflow fields

### Step 3: Restart Backend
```bash
# Stop the current backend (Ctrl+C)
npm run dev:backend

# Or restart full stack
npm run dev
```

### Step 4: Test the API
```bash
# Run integration tests
tsx backend/scripts/test_journal_actions.ts

# Or test manually with curl (see runbook for commands)
```

### Step 5: Test in UI
1. Go to `/accounting/journals`
2. Select draft journals
3. Click "Mark as Reviewed"
   - ✅ Should move to Reviewed tab
   - ✅ Should show success toast
4. Select reviewed journals
5. Click "Delete"
   - ✅ Should remove from list
   - ✅ Should show success toast
6. Select posted journals
7. Click "Delete"
   - ✅ Should void them (create reversals)
   - ✅ Should show "voided" toast

## Expected Behavior After Fix

### Mark as Reviewed
- Draft journals → status='reviewed', appear in Reviewed tab
- Non-draft journals → Clear error message (400), not generic 500

### Delete
- Draft/Reviewed journals → Permanently deleted (204)
- Posted journals → Voided with reversal created (200)
- Already voided → Clear error message (400)

### Error Messages
- All errors now show specific messages in toasts
- No more generic "Some journals failed" without details
- Backend returns proper HTTP status codes (400/409 instead of 500)

## Files Modified
1. `backend/src/routes/accounting.ts` - Improved error mapping
2. `src/pages/accounting/Journals.tsx` - Enhanced error display

## Files Created
1. `backend/JOURNAL_ACTIONS_RUNBOOK.md` - Troubleshooting guide
2. `backend/scripts/verify_migrations.sql` - DB verification script
3. `backend/scripts/test_journal_actions.ts` - Integration tests
4. `JOURNAL_ACTIONS_FIX_SUMMARY.md` - This file

## Next Steps
1. Run `npm run db:migrate:app` to apply migrations
2. Restart backend
3. Test in UI
4. If issues persist, follow the runbook: `backend/JOURNAL_ACTIONS_RUNBOOK.md`
5. Run integration tests: `tsx backend/scripts/test_journal_actions.ts`

## Support
If you still see errors after following these steps:
1. Check `backend/JOURNAL_ACTIONS_RUNBOOK.md` for detailed troubleshooting
2. Run the verification script to confirm DB state
3. Check the console for specific error messages (now more helpful!)
4. Verify journal IDs exist in the database














