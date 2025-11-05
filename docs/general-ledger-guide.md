# General Ledger - User Guide & Troubleshooting

## Overview

The General Ledger page provides a comprehensive view of all ledger entries in the accounting system. It displays transaction-level details including debits, credits, and running balances for each account.

**Location:** `/accounting/general-ledger`

**Access:** Available to users with roles: `admin`, `accountant`, `editor`, `viewer`

---

## Features

### 1. Live Data Display

The General Ledger now pulls real-time data from the database via the `/api/v1/accounting/ledger` endpoint. All entries are fetched from the `public.accounting_ledger_entries` view.

**Displayed Information:**
- **Date:** Transaction date
- **Account:** Account code and name (e.g., "1000 - Cash")
- **Journal Line:** Reference to the source journal line ID
- **Debit:** Debit amount (if applicable)
- **Credit:** Credit amount (if applicable)
- **Running Balance:** Account balance after the transaction

### 2. Filtering

#### Account Filter
- **Type:** Dropdown select
- **Options:** All accounts from the chart of accounts
- **Display Format:** `{code} - {name}` (e.g., "1000 - Cash")
- **Behavior:** Filters ledger entries to show only transactions for the selected account
- **Reset:** Select "All Accounts" to clear the filter

#### Date Range Filter
- **Type:** Calendar date picker
- **Mode:** Range selection (start and end date)
- **Behavior:** 
  - Filters entries to show only transactions within the selected date range (inclusive)
  - Supports single date selection (shows transactions for that day only)
- **Reset:** Click "Clear" button in the calendar popover

### 3. Search

- **Type:** Text input (client-side search)
- **Scope:** Searches across account names, account codes, and dates
- **Behavior:** Filters the currently displayed page of results
- **Note:** Search is applied after server-side pagination

### 4. Pagination

- **Page Size:** 50 entries per page (default)
- **Controls:**
  - Previous/Next buttons
  - Current page indicator (e.g., "Page 1 of 5")
  - Entry count display (e.g., "Showing 1 to 50 of 237 entries")
- **Behavior:**
  - Pagination is server-side for performance
  - Filters reset pagination to page 1
  - Disabled state when loading or at first/last page

### 5. Totals Summary

Displays calculated totals for the **currently displayed entries** (on the current page):

- **Total Debits:** Sum of all debit amounts
- **Total Credits:** Sum of all credit amounts
- **Net Change:** Difference between debits and credits
  - Green text for positive net change
  - Red text for negative net change

**Note:** Totals are calculated client-side from the visible entries, not the entire dataset.

### 6. Currency Formatting

All monetary values are formatted using South African Rand (ZAR) locale:
- Format: `R1,234.56`
- Locale: `en-ZA`
- Zero values display as `-` in debit/credit columns

---

## Usage Examples

### View All Ledger Entries

1. Navigate to `/accounting/general-ledger`
2. The page loads with all ledger entries (first 50)
3. Use pagination to browse through entries

### Filter by Account

1. Click the account dropdown (default: "All Accounts")
2. Select an account (e.g., "1000 - Cash")
3. The table updates to show only entries for that account
4. Pagination resets to page 1

### Filter by Date Range

1. Click the date range button (default: "All Dates")
2. Select a start date in the calendar
3. Select an end date (or leave blank for single-day filter)
4. Click "Apply"
5. The table updates to show entries within the date range
6. Pagination resets to page 1

### Combine Filters

You can combine account and date filters:
1. Select an account from the dropdown
2. Select a date range from the calendar
3. Both filters are applied simultaneously
4. Use search to further narrow results on the current page

### Search Within Results

1. Apply any filters (optional)
2. Type in the search box (e.g., "Cash" or "1000")
3. Results are filtered client-side on the current page
4. Search does not affect server-side pagination

---

## Technical Details

### API Endpoint

**Endpoint:** `GET /api/v1/accounting/ledger`

**Query Parameters:**
- `account_id` (optional): Filter by account ID (integer)
- `start` (optional): Start date (ISO format: `YYYY-MM-DD`)
- `end` (optional): End date (ISO format: `YYYY-MM-DD`)
- `limit` (optional): Page size (default: 50)
- `offset` (optional): Offset for pagination (default: 0)

**Response:**
```json
{
  "items": [
    {
      "id": 1,
      "account_id": 1,
      "journal_line_id": 101,
      "date": "2024-01-15",
      "debit": "1000.00",
      "credit": "0.00",
      "balance_after": "1000.00",
      "created_at": "2024-01-15T10:00:00Z"
    }
  ],
  "total": 237
}
```

**Authentication:**
- Requires JWT token or `X-Role` header
- Minimum role: `viewer`

### Data Source

- **Database View:** `public.accounting_ledger_entries`
- **Source Table:** `accounting.ledger_entries`
- **Related Tables:**
  - `accounting.accounts` (for account details)
  - `accounting.journal_lines` (source transactions)

### Frontend Implementation

- **Framework:** React with TypeScript
- **State Management:** React Query (TanStack Query)
- **API Client:** `src/lib/api/accounting.ts`
- **Component:** `src/pages/accounting/GeneralLedger.tsx`

**Key Dependencies:**
- `@tanstack/react-query` - Data fetching and caching
- `date-fns` - Date formatting
- `framer-motion` - Page animations

---

## Troubleshooting

### Issue: Page shows "No ledger entries found"

**Possible Causes:**
1. No journal entries have been posted to the ledger
2. Filters are too restrictive (no entries match)
3. Database connection issue

**Solutions:**
1. Check if any journals have been posted (status = 'posted')
2. Clear all filters (account and date range)
3. Check browser console for API errors
4. Verify backend is running and accessible

### Issue: "Failed to load ledger entries" error

**Possible Causes:**
1. Backend API is down or unreachable
2. Authentication token expired
3. Database connection issue
4. RBAC permissions issue

**Solutions:**
1. Check backend server status (should be running on port 3000)
2. Log out and log back in to refresh token
3. Check backend logs for database errors
4. Verify user has at least `viewer` role

### Issue: Account names not displaying (shows "Account 123" instead)

**Possible Causes:**
1. Accounts API failed to load
2. Account was deleted but ledger entries remain
3. Data inconsistency

**Solutions:**
1. Check browser console for account loading errors
2. Verify `GET /api/v1/accounting/accounts` returns data
3. Check if account exists in `accounting.accounts` table

### Issue: Pagination not working

**Possible Causes:**
1. Total count not returned from API
2. JavaScript error in pagination logic
3. Query parameter formatting issue

**Solutions:**
1. Check API response includes `total` field
2. Check browser console for errors
3. Verify backend returns correct `count` from Supabase query

### Issue: Filters not applying

**Possible Causes:**
1. Query parameters not being sent to API
2. Backend not processing filter parameters
3. Date format mismatch

**Solutions:**
1. Check Network tab in browser DevTools for query params
2. Verify backend route handles `account_id`, `start`, `end` params
3. Ensure dates are in ISO format (`YYYY-MM-DD`)

### Issue: Totals don't match expected values

**Expected Behavior:**
- Totals are calculated **only for entries on the current page**
- Not for the entire filtered dataset

**If totals are incorrect:**
1. Check if debit/credit values are numeric strings
2. Verify `parseFloat()` conversion is working
3. Check for null or undefined values in data

### Issue: Slow performance with large datasets

**Optimization Tips:**
1. Use account filter to reduce result set
2. Use date range filter to limit time period
3. Consider adding indexes to database (already present on `account_id`, `date`)
4. Reduce page size if needed (modify `pageSize` constant)

### Issue: Currency formatting incorrect

**Expected Format:** `R1,234.56` (South African Rand)

**If format is wrong:**
1. Check browser locale settings
2. Verify `Intl.NumberFormat` is supported
3. Check for null/undefined values being formatted

---

## Testing

### Backend Tests

**Location:** `backend/scripts/test_ledger.ts`

**Run Tests:**
```bash
tsx backend/scripts/test_ledger.ts
```

**Test Coverage:**
- Get all ledger entries (no filters)
- Filter by account ID
- Filter by date range
- Pagination (limit/offset)
- Combined filters (account + date + pagination)
- Empty results (invalid account)

### Frontend Tests

**Location:** `src/pages/accounting/GeneralLedger.test.tsx`

**Run Tests:**
```bash
npm test GeneralLedger
```

**Test Coverage:**
- Page rendering
- Loading states
- Error states
- Empty states
- Filter UI rendering
- Data display
- Currency formatting
- Pagination controls

---

## Database Schema

### Ledger Entries Table

```sql
CREATE TABLE accounting.ledger_entries (
  id BIGSERIAL PRIMARY KEY,
  account_id BIGINT NOT NULL REFERENCES accounting.accounts(id),
  journal_line_id BIGINT NOT NULL REFERENCES accounting.journal_lines(id),
  date DATE NOT NULL,
  debit NUMERIC(15,2) DEFAULT 0,
  credit NUMERIC(15,2) DEFAULT 0,
  balance_after NUMERIC(15,2) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_ledger_entries_account_id ON accounting.ledger_entries(account_id);
CREATE INDEX idx_ledger_entries_date ON accounting.ledger_entries(date);
```

### Public View

```sql
CREATE VIEW public.accounting_ledger_entries AS
SELECT id, account_id, journal_line_id, date, debit, credit, balance_after, created_at
FROM accounting.ledger_entries;

GRANT SELECT ON public.accounting_ledger_entries TO anon, authenticated, service_role;
```

---

## Future Enhancements

Potential improvements for future releases:

1. **Export Functionality**
   - CSV export of filtered results
   - PDF report generation
   - Excel export with formatting

2. **Advanced Filters**
   - Filter by journal reference
   - Filter by entity (if entity_id added to ledger)
   - Filter by amount range

3. **Sorting**
   - Sort by date (ascending/descending)
   - Sort by amount
   - Sort by account

4. **Drill-Down**
   - Click journal line ID to view full journal entry
   - Click account to view account detail page
   - View related documents

5. **Reconciliation**
   - Mark entries as reconciled
   - Reconciliation status indicator
   - Reconciliation reports

6. **Performance**
   - Virtual scrolling for large datasets
   - Infinite scroll option
   - Caching strategy improvements

---

## Support

For issues not covered in this guide:

1. Check backend logs: `backend/logs/` (if logging enabled)
2. Check browser console for JavaScript errors
3. Verify database migrations are up to date: `npm run db:migrate:app`
4. Review `datamodel.md` for schema details
5. Contact system administrator

---

## Related Documentation

- [Data Model](../datamodel.md) - Complete database schema and API reference
- [Journal Actions Runbook](../backend/JOURNAL_ACTIONS_RUNBOOK.md) - Journal workflow troubleshooting
- [Accounting API](../docs/openapi.yaml) - Full API specification (if available)

