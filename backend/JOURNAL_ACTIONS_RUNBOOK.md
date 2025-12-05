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
















## Issue: 500 on Debit Note Mark as Paid / Record Partial Payment

**Symptoms**

- In the **Debit &amp; Credit Notes** screen, using the Actions menu on a debit note:
  - **Mark as Paid** shows an error toast like:  
    `Failed to mark as paid / 500 permission denied for table journals`
  - **Record Partial Payment** shows:  
    `Failed to record partial payment / 500 permission denied for table journals`
- Backend logs contain `permission denied for table journals` when calling Supabase RPC:
  - `fn_mark_note_paid`
  - `fn_record_partial_payment`

**Root Cause**

- The UI actions hit backend endpoints:
  - `[POST /journals/:id/mark-paid](backend/src/routes/accounting.ts:440)`
  - `[POST /journals/:id/partial-payment](backend/src/routes/accounting.ts:471)`
- These call Supabase RPC functions:
  - `[req.db.rpc('fn_mark_note_paid', ...)](backend/src/routes/accounting.ts:451)`
  - `[req.db.rpc('fn_record_partial_payment', ...)](backend/src/routes/accounting.ts:482)`
- Supabase resolves them to public wrapper functions:
  - `[public.fn_mark_note_paid()](backend/migrations/sql/025_notes_payment_wrappers.sql:14)`
  - `[public.fn_record_partial_payment()](backend/migrations/sql/025_notes_payment_wrappers.sql:37)`
- Those wrappers delegate into core implementations in the `accounting` schema:
  - `[accounting.fn_mark_note_paid()](backend/migrations/sql/020_notes_actions.sql:98)`
  - `[accounting.fn_record_partial_payment()](backend/migrations/sql/020_notes_actions.sql:227)`
- All note/payment functions in `[020_notes_actions.sql](backend/migrations/sql/020_notes_actions.sql)` were originally defined as plain `LANGUAGE plpgsql` (no `SECURITY DEFINER`) but they **directly INSERT/UPDATE** `accounting.journals`.
- The Supabase `authenticated` role is only granted:
  - `SELECT/INSERT/UPDATE` on `accounting.note_payments`
  - `SELECT/INSERT/UPDATE` on `accounting.note_applications`
  - It does **not** have `INSERT`/`UPDATE` on `accounting.journals`.
- When called via RPC, the `accounting.*` functions run as the caller (`authenticated`), so their writes to `accounting.journals` fail with `permission denied for table journals`, which bubbles up as a 500 error for both **Mark as Paid** and **Record Partial Payment**.

**Fix (Migration 026)**

Apply migration `[026_notes_payment_security.sql](backend/migrations/sql/026_notes_payment_security.sql)` which:

1. Marks the following functions as `SECURITY DEFINER` so they execute with the owner’s privileges instead of the caller’s:
   - `[accounting.fn_mark_note_paid()](backend/migrations/sql/020_notes_actions.sql:98)`
   - `[accounting.fn_record_partial_payment()](backend/migrations/sql/020_notes_actions.sql:227)`
   - `[accounting.fn_reconcile_payment()](backend/migrations/sql/020_notes_actions.sql:369)`
   - `[accounting.fn_apply_credit_to_debit()](backend/migrations/sql/020_notes_actions.sql:421)`
   - `[accounting.fn_mark_refund_paid()](backend/migrations/sql/020_notes_actions.sql:616)`
   - `[accounting.fn_delete_journal()](backend/migrations/sql/020_notes_actions.sql:742)`
   - `[accounting.fn_finalize_debit_note()](backend/migrations/sql/020_notes_actions.sql:826)`
2. Sets `search_path = accounting, public` for these functions for extra safety, although their table references are already fully schema-qualified.
3. Leaves public RPC wrappers unchanged:
   - `[public.fn_mark_note_paid()](backend/migrations/sql/025_notes_payment_wrappers.sql:14)`
   - `[public.fn_record_partial_payment()](backend/migrations/sql/025_notes_payment_wrappers.sql:37)`
   - `[public.fn_apply_credit_to_debit()](backend/migrations/sql/024_apply_credit_wrapper.sql:22)`
   These wrappers do not touch tables directly; they simply call the secured `accounting.*` functions.

**How to Apply**

1. Run the app migrations so `026_notes_payment_security.sql` is applied:

   ```bash
   npm run db:migrate:app
   ```

2. Verify in `psql` that the key functions are now `SECURITY DEFINER`:

   ```sql
   \df+ accounting.fn_mark_note_paid
   \df+ accounting.fn_record_partial_payment
   ```

   The `Security` column for each should show `definer`.

**Post-Fix QA Checklist**

_Minimum smoke tests for debit note payments:_

1. **Record Partial Payment**
   - Create or locate a posted debit note (`reference` starts with `DN-`, `payment_status = 'unpaid'`).
   - In the UI, go to Debit &amp; Credit Notes → Actions → **Record Partial Payment**.
   - Enter:
     - `amount` less than the full note amount,
     - a valid `bank_account_id`,
     - a valid `payment_date`.
   - Submit.
   - Expect:
     - No 500 error; specifically no `permission denied for table journals`.
     - Note’s payment status becomes **Partial** (or equivalent).
   - DB checks:
     - `accounting.journals.payment_status = 'partial'` and `paid_amount` equals the partial amount.
     - A payment journal exists with reference like `PMT-<DN-ref>-P1`.
     - `accounting.note_payments` has a row with `payment_type = 'partial'`.

2. **Mark as Paid**
   - For an unpaid or partially paid debit note, use Actions → **Mark as Paid**.
   - Provide `bank_account_id` and `payment_date`.
   - Expect:
     - No 500 error.
     - Note’s payment status becomes **Paid**.
   - DB checks:
     - `payment_status = 'paid'`, `paid_amount` equals the full debit total.
     - `accounting.note_payments` has a row with `payment_type = 'full'`.

3. **Validation / Errors**
   - Attempt a partial payment where `amount` exceeds the remaining balance.
     - Expect a 400 with a message based on `[accounting.fn_record_partial_payment()](backend/migrations/sql/020_notes_actions.sql:270) (e.g. “Partial payment amount exceeds total note amount”), not a 500.
   - Attempt **Mark as Paid** on:
     - A **voided** debit note.
     - A note already in `paid` or `reconciled` status.
     - Expect 400 with messages from `[accounting.fn_mark_note_paid()](backend/migrations/sql/020_notes_actions.sql:125) (e.g. “Note is already marked as paid” or “Cannot mark voided note as paid”).

4. **Reconciliation and Related Flows**
   - From the Payment Reconciliation UI, use **Apply Match** so `/reconciliation/apply-match` runs:
     - Internally calls `[accounting.fn_mark_note_paid()](backend/src/routes/accounting.ts:1892)` or `[accounting.fn_record_partial_payment()](backend/src/routes/accounting.ts:1905)`.
     - Confirm no permission errors and allocations are recorded.
   - Apply a credit note to a debit note via `POST /journals/:id/apply-credit`:
     - Uses `[fn_apply_credit_to_debit()](backend/src/routes/accounting.ts:546)`.
     - Confirm payment statuses and `paid_amount` are updated on both notes without 500 errors.
   - Mark a credit note refund as paid via `POST /journals/:id/refund-paid`:
     - Uses `[fn_mark_refund_paid()](backend/src/routes/accounting.ts:577)`.
     - Confirm no permission errors and `note_payments.payment_type = 'refund'`.

If any `permission denied for table journals` errors remain after applying migration 026:

- Re-check function definitions with `\df+` to confirm `Security: definer`.
- Confirm no direct `INSERT`/`UPDATE` grants have been added to `accounting.journals` for application roles; all writes should go through these secured functions.
