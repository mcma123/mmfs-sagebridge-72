# Journal Actions Troubleshooting Runbook

## Quick Diagnosis

If you're seeing 404s or 500s on journal review/delete/void actions, follow these steps:

### Step 1: Verify Migrations Are Applied

Run the migration script to ensure all required database objects exist:

```bash
npm run db:migrate:app
```

This applies migrations 010 and 011 which create:
- `fn_review_journal` - marks draft journals as reviewed
- `fn_post_journal_from_draft` - posts reviewed/draft journals to ledger
- `fn_void_journal` - voids posted journals by creating reversals
- `fn_create_journal_draft` - creates unbalanced draft journals
- Workflow columns: `status`, `reviewed_at`, `reviewed_by`, `posted_at`, `posted_by`

### Step 2: Verify Database Objects

Connect to your database and run:

```bash
psql $DATABASE_URL -f backend/scripts/verify_migrations.sql
```

Expected output:
- 4 functions listed (fn_review_journal, fn_post_journal_from_draft, fn_void_journal, fn_create_journal_draft)
- 6 workflow columns on accounting.journals
- public.accounting_journals view includes status, reviewed_at, posted_at, voided_at

### Step 3: Test API Endpoints Directly

```bash
# List all journals (get real IDs)
curl -s http://localhost:8080/api/v1/accounting/journals | jq '.items[] | {id, status, reference}'

# Get a specific journal
curl -s http://localhost:8080/api/v1/accounting/journals/1 | jq

# Review a draft journal (ID 1, must be status='draft')
curl -i -X PATCH \
  -H 'X-Role: accountant' \
  -H 'x-user-id: 1' \
  http://localhost:8080/api/v1/accounting/journals/1/review

# Delete a draft/reviewed journal
curl -i -X DELETE \
  -H 'X-Role: accountant' \
  http://localhost:8080/api/v1/accounting/journals/1

# Void a posted journal (ID 2, must be status='posted')
curl -i -X POST \
  -H 'Content-Type: application/json' \
  -H 'X-Role: accountant' \
  -H 'x-user-id: 1' \
  -d '{"reason":"test void"}' \
  http://localhost:8080/api/v1/accounting/journals/2/void
```

### Step 4: Check Journal Status in Database

```sql
-- See all journals with their statuses
SELECT id, date, reference, status, reviewed_at, posted_at, voided_at
FROM accounting.journals
ORDER BY id;

-- Check specific failing IDs
SELECT id, status, voided_at, 
       (SELECT COUNT(*) FROM accounting.journal_lines WHERE journal_id = j.id) as line_count
FROM accounting.journals j
WHERE id IN (1, 2, 3);
```

## Common Issues and Fixes

### Issue: 500 on /journals/:id/review

**Cause**: Journal not found or not in draft status

**Fix**: 
1. Verify journal exists and status='draft':
   ```sql
   SELECT id, status FROM accounting.journals WHERE id = ?;
   ```
2. If status is 'reviewed' or 'posted', the review endpoint won't work (expected)
3. If journal doesn't exist, check the ID from the UI list

### Issue: 500 on /journals/:id/void

**Cause**: Journal not found or already voided

**Fix**:
1. Check if journal exists and is not already voided:
   ```sql
   SELECT id, status, voided_at FROM accounting.journals WHERE id = ?;
   ```
2. If `voided_at` is not null, journal is already voided (expected)

### Issue: 404 on /journals/:id (GET or DELETE)

**Cause**: Journal ID doesn't exist in database

**Fix**:
1. List all journals to get valid IDs:
   ```sql
   SELECT id, reference, status FROM accounting.journals ORDER BY id;
   ```
2. Ensure the UI is displaying the correct IDs from the API response

### Issue: Journals don't appear in Reviewed tab after review

**Cause**: Frontend not refetching or status filter not working

**Fix**:
1. Check the API response for status='reviewed':
   ```bash
   curl -s 'http://localhost:8080/api/v1/accounting/journals?status=reviewed' | jq
   ```
2. Verify the UI invalidates the query cache after review
3. Check browser network tab for the refetch request

## Expected Behavior

### Mark as Reviewed Flow
1. User selects draft journals
2. UI calls `PATCH /journals/:id/review` for each
3. Backend calls `fn_review_journal` which:
   - Checks journal is in draft status
   - Updates status='reviewed', reviewed_at=NOW(), reviewed_by=userId
4. UI refetches, switches to Reviewed tab
5. Journals appear under "Reviewed Journals"

### Delete Flow
1. User selects journals
2. For draft/reviewed: UI calls `DELETE /journals/:id`
   - Backend deletes journal_lines then journal
3. For posted: UI calls `POST /journals/:id/void`
   - Backend creates reversal journal and marks original as voided
4. UI refetches, clears selection
5. Deleted journals disappear; voided journals may remain with voided_at set

## QA Checklist

- [ ] Migrations 010 and 011 applied successfully
- [ ] All 4 RPC functions exist in public schema
- [ ] Workflow columns exist on accounting.journals
- [ ] public.accounting_journals view includes workflow fields
- [ ] Can list journals via API (GET /journals)
- [ ] Can get single journal (GET /journals/:id)
- [ ] Can review draft journal (PATCH /journals/:id/review)
- [ ] Review returns 400 for non-draft journals (not 500)
- [ ] Can delete draft/reviewed journal (DELETE /journals/:id)
- [ ] Delete returns 409 for posted journals
- [ ] Can void posted journal (POST /journals/:id/void)
- [ ] Void returns 400 for already-voided journals (not 500)
- [ ] UI shows reviewed journals in Reviewed tab after review
- [ ] UI removes deleted journals from all tabs
- [ ] UI shows clear error toasts for failures

## Restart Backend After Changes

After applying migrations or code changes:

```bash
# Kill the backend process (Ctrl+C if running in terminal)
# Then restart:
npm run dev:backend

# Or restart the full stack:
npm run dev
```

