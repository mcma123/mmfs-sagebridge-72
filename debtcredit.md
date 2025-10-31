# Debit/Credit Notes Persistence – Detailed Fix Plan

Purpose: resolve the issue where Debit Notes and Credit Notes appear to be created in the UI but are not saved to the database. This plan analyzes current code, aligns with `datamodel.md`, and outlines phased implementation to persist notes via the existing accounting journaling backend.

## Problem Summary
- Creating notes in `CreateDebitNote.tsx` and `CreateCreditNote.tsx` only logs data, shows a success toast, and navigates away.
- No API call is made to persist to the backend.
- The list page `DebitCreditNotes.tsx` displays hardcoded sample arrays, not backend data.
- Backend already provides accounting endpoints and a journaling RPC (`fn_post_journal`), but frontend forms aren’t wired to use them.

## Key Findings (Code)
- Frontend
  - `src/pages/notes/CreateDebitNote.tsx`: `onSubmit` logs payload, then toast + `navigate('/debit-credit-notes')`; no persistence.
  - `src/pages/notes/CreateCreditNote.tsx`: same pattern; no persistence.
  - `src/pages/DebitCreditNotes.tsx`: uses hardcoded mock `debitNotes` and `creditNotes` arrays; no backend fetch.
- Backend
  - `backend/src/server.ts`: mounts accounting router under `/api/v1/accounting`.
  - `backend/src/routes/accounting.ts`:
    - `POST /api/v1/accounting/journals` calls `req.db.rpc('fn_post_journal', { p_date, p_reference, p_description, p_created_by, p_lines })`, returning `{ journal_id }`.
    - `GET /api/v1/accounting/journals` returns journals; `GET /api/v1/accounting/accounts` and `/entities` support lookups.
  - `datamodel.md` confirms accounting schema (`entities`, `accounts`, `journals`, `journal_lines`, `ledger_entries`) and the RPC `fn_post_journal(...) -> bigint`.
- Vite dev proxy: `/api/*` proxied to `http://localhost:3001` → frontend can call `/api/v1/accounting/*` directly.

## Datamodel Alignment (from datamodel.md)
- `journals`: (`id`, `date`, `reference`, `description`, `created_by`, timestamps) – suitable for storing note identity and summary.
- `journal_lines`: (`journal_id`, `account_id`, `entity_id`, `date`, `debit`, `credit`, `memo`) – lines used for balanced postings.
- `ledger_entries`: auto-written when posting journals via `fn_post_journal`.
- Endpoints: `/api/v1/accounting/*` including `POST /journals` for persistence and `GET /journals` for listing.

## Proposed Architecture for Notes
- Persist each Debit/Credit Note by posting a Journal via `POST /api/v1/accounting/journals`.
- Use `journals.reference` to store a standardized note number (e.g., `DN-2024-0001`, `CN-2024-0001`).
- Store human-friendly text in `journals.description` (e.g., entity/policy summary). Put granular fields (e.g., policy ref, cover type, terms) into `journal_lines.memo` for now.
- Optionally later add `journals.metadata_json` to store structured note metadata for richer reporting/printing.

## Journal Line Mapping
Note: Account selection should be configurable and come from `/api/v1/accounting/accounts` (by `id`). Below mappings assume defaults; actual accounts must be selected or configured.

- Debit Note (Premium adjustment)
  - Dr `Accounts Receivable` = `netDue` (calculated as `ourShareAmount - commissionAmount`), `entity_id` set to selected entity.
  - Dr `Commission Expense` = `commissionAmount` (if you wish to track commission as expense).
  - Cr `Premium Income` = `ourShareAmount`.
  - Balanced because `netDue + commissionAmount = ourShareAmount`.

- Credit Note (Refund/adjustment reducing revenue)
  - Dr `Premium Income` = `yourShareAmount`.
  - Cr `Accounts Receivable` = `netDueToYou` (reduces A/R).
  - Cr `Commission Expense` = `deductionAmount` (expense reversal; alternatively use a specific recovery account).
  - Balanced because `yourShareAmount = netDueToYou + deductionAmount`.

## Phase 1 – Wire Frontend Forms to Backend Journals
Outcome: Notes persist to DB and appear in listing.

1) Add Accounting API client (`src/lib/api/accounting.ts`)
   - `getAccounts(): Promise<{ items: AccountDTO[] }>` → `GET /api/v1/accounting/accounts`.
   - `getEntities(): Promise<{ items: EntityDTO[] }>` → `GET /api/v1/accounting/entities`.
   - `postJournal(payload: { date: string; reference?: string; description?: string; lines: Array<{ account_id: number; entity_id?: number | null; date: string; debit: number; credit: number; memo?: string }> }): Promise<{ journal_id: number }>` → `POST /api/v1/accounting/journals`.
   - Headers: include `'Content-Type': 'application/json'`. Optionally include `X-Role` and `x-user-id` in dev (backend reads `x-user-id` for `created_by`).

2) Reference generation
   - Utility: `makeNoteRef(type: 'debit'|'credit', date: Date) → string` like `DN-YYYY-####` / `CN-YYYY-####`.
   - For first cut, generate client-side sequential number based on timestamp; later, move to server-side sequence for consistency.

3) Transform form → journal payload
   - Create helpers:
     - `buildDebitJournal(form, accounts, entityId)` returns `{ date, reference, description, lines[] }` using mapping above.
     - `buildCreditJournal(form, accounts, entityId)` returns `{ date, reference, description, lines[] }`.
   - `description` example: `Debit Note for ${entityName} – ${policyRef} (${coverType})`.
   - `memo` fields can include `currency`, `paymentTerms`, `preparedBy`, and additional text.

4) Update forms
   - In `CreateDebitNote.tsx` and `CreateCreditNote.tsx`, replace `console.log + toast + navigate` with:
     - Load required account IDs (AR, Premium Income, Commission Expense) and selected `entity_id`.
     - Build payload via helper.
     - Call `postJournal(payload)`.
     - On success: toast with the assigned `reference`/`journal_id`, navigate to notes list.
     - On failure: show error toast with server message.

5) Notes listing
   - Replace `debitNotes`/`creditNotes` sample arrays in `DebitCreditNotes.tsx` with data fetched from `GET /api/v1/accounting/journals`.
   - Filter by `reference` prefix (`DN-` vs `CN-`) or by `description` tag.
   - Display amount using a derived total: sum of credit lines for DN; sum of debit reductions for CN; or compute from lines.

## Phase 2 – Entity & Account Selection UX
Outcome: Correct entity linkage and accounts chosen explicitly; fewer hard-coded assumptions.

- Entity selection
  - Add an entity select/autocomplete backed by `GET /api/v1/accounting/entities`.
  - Provide “Create entity” inline using `POST /api/v1/accounting/entities` when not found.
  - Persist `entity_id` in journal lines.

- Account selection
  - Add settings or select inputs to pick default accounts for: `Accounts Receivable`, `Premium Income`, `Commission Expense` (or `Commission Payable` if desired).
  - Store defaults in local config or workspace settings; load via a small settings hook.
  - Ensure mapping uses `account_id` (not `code`).

## Phase 3 – Metadata & Printing (Optional but Recommended)
Outcome: Better fidelity of note details for statements and printing.

- Minimal path (no DB change): keep detailed fields in `journal_lines.memo` as JSON/text.
- Structured path (DB change): add `journals.metadata_json JSONB` to capture full note fields:
  - `issuedTo`, `insured`, `coverType`, `policyRef`, `periodStart`, `periodEnd`, `currency`, `paymentTerms`, `preparedBy`, `calculations`, etc.
  - Update backend to accept `metadata` in `POST /journals` and write to `accounting.journals` alongside RPC.
- Build a printable view that reads `journals + journal_lines` and renders note document.

## Phase 4 – Validation, Errors, and Tests
Outcome: Robustness and confidence.

- Client validation: ensure mapped journal is balanced before calling API (`sum(debits) === sum(credits)`).
- Exclude zero-amount lines to reduce clutter.
- Currency: amounts posted are numeric; display currency in UI and store currency code in `memo` or `metadata_json`.
- Auth: in dev, include `X-Role: accountant` and `x-user-id` headers if JWT isn’t used; in prod, use JWT.
- Unit tests:
  - Tests for `buildDebitJournal` and `buildCreditJournal` mapping.
  - Tests for reference generation and balance validation.

## Phase 5 – Optional: Domain Table for Notes
Outcome: Rich domain reporting beyond journals.

- Add `accounting.debit_credit_notes` table:
  - `id PK`, `journal_id FK`, `type ENUM('debit','credit')`, `issued_to_entity_id FK`, `policy_ref`, `cover_type`, `currency`, `terms`, `prepared_by`, `amounts_json`, timestamps.
  - Endpoint(s): `POST /accounting/notes`, `GET /accounting/notes` for listing; keep journals as source of truth for ledger.
  - This table links the note document and metadata directly to its journal.
  - Migration can be deferred if the journal-only approach suffices.

## Example Payloads

- Debit Note → POST `/api/v1/accounting/journals`
```json
{
  "date": "2024-10-01",
  "reference": "DN-2024-0001",
  "description": "Debit Note for Maamba Collieries – MCL/001/2024 (Contractors All Risks)",
  "lines": [
    { "account_id": 1001, "entity_id": 2001, "date": "2024-10-01", "debit": 6750.00, "credit": 0.00, "memo": "AR Net Due USD" },
    { "account_id": 5101, "entity_id": 2001, "date": "2024-10-01", "debit": 2250.00, "credit": 0.00, "memo": "Commission Expense USD" },
    { "account_id": 4001, "entity_id": 2001, "date": "2024-10-01", "debit": 0.00, "credit": 9000.00, "memo": "Premium Income USD" }
  ]
}
```

- Credit Note → POST `/api/v1/accounting/journals`
```json
{
  "date": "2024-10-05",
  "reference": "CN-2024-0002",
  "description": "Credit Note for Waica Re – WR/2024/09 (Retro)",
  "lines": [
    { "account_id": 4001, "entity_id": 2105, "date": "2024-10-05", "debit": 10000.00, "credit": 0.00, "memo": "Premium Income reversal USD" },
    { "account_id": 1001, "entity_id": 2105, "date": "2024-10-05", "debit": 0.00, "credit": 8000.00, "memo": "AR reduction USD" },
    { "account_id": 5101, "entity_id": 2105, "date": "2024-10-05", "debit": 0.00, "credit": 2000.00, "memo": "Commission Expense reversal USD" }
  ]
}
```

## Acceptance Criteria
- Submitting either form persists a journal and returns a `journal_id`.
- Notes list loads from backend, not mock data; shows newly created notes.
- Journal postings are balanced and visible in the ledger/trial balance.
- Entity linkage present (`entity_id` set on lines) when an entity is selected.
- Clear error messages on failures (server or validation).

## Rollout Plan
- Implement Phase 1 (API client, helpers, wiring) and deploy to dev.
- Validate with a few sample entries; confirm trial balance and ledger reflect postings.
- Implement Phase 2 (entity & account selection) to reduce hard-coded assumptions.
- Optionally proceed with Phase 3 (metadata JSON) and Phase 5 (domain table) if printing/reporting needs demand it.

## Risks & Considerations
- Account IDs must exist and be correct; add UI to select or configure.
- Entity must exist to link lines meaningfully; add creation flow.
- Reference generation collisions if client-side; consider server-side sequence later.
- Currency handling: ledger stores numeric amounts only; ensure display formatting.
- RBAC/JWT: ensure correct headers or login flow; backend `authorize` guards routes.

## Quick Summary of Root Cause
UI-only implementation for creating Debit/Credit Notes. No backend persistence call; listing uses mock data. Backend journaling exists and should be invoked from forms.