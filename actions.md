# Actions – View and Delete for Entities and Debit/Credit Notes

Goal: add “View” and “Delete” (Void for posted notes) actions to:
- Entity Management page (Clients, CDANTs, Reinsurers)
- Debit & Credit Notes page

Approach: deliver in phases, ensuring data integrity (accounting) and a smooth UI/UX. Each phase lists concrete tasks with checkboxes.

## Phase 0 – Scope, Assumptions, and UX Decisions
- [ ] Define “View” behavior:
  - Entities: show full entity details in a modal/drawer (name, type, status, contact, currency, notes).
  - Notes: show journal header (date, reference, description, status) and line items (account, entity, debit, credit, memo).
- [ ] Define “Delete” semantics:
  - Entities: soft-delete with `deleted_at` (prevent hard delete if referenced by journal lines). Optionally set `status='Inactive'`.
  - Notes: if posted, “Delete” performs a “Void” (reversal journal) and marks original as `voided_at`. Hard delete only allowed for unposted/draft (not applicable today).
- [ ] RBAC: only `admin` and `accountant` can delete/void; all roles can view.
- [ ] Confirm UI pattern: Actions column with buttons “View”, “Delete/ Void”. Confirm use of `AlertDialog` for confirmations.

## Phase 1 – Database Schema & Public Views
- [ ] Add `deleted_at TIMESTAMPTZ` to `accounting.entities` to support soft-delete.
- [ ] Add `voided_at TIMESTAMPTZ` to `accounting.journals` to record voided notes.
- [ ] Create public view `public.accounting_journal_lines` exposing journal line details for Note views.
- [ ] Update `public.accounting_journals` to include `voided_at` for clarity.
- [ ] Ensure grants on new/updated public views for `anon`, `authenticated`, `service_role`.
- [ ] Confirm Supabase REST “Exposed schemas” includes `public`.

## Phase 2 – Backend RPCs and Endpoints
- [ ] Add `GET /api/v1/accounting/entities/:id` to fetch an entity by id.
- [ ] Add `DELETE /api/v1/accounting/entities/:id` (soft delete): sets `deleted_at` and optionally `status='Inactive'`; guard if referenced by journals.
- [ ] Add `GET /api/v1/accounting/journals/:id` to fetch a journal with its lines (using `public.accounting_journal_lines`).
- [ ] Add `POST /api/v1/accounting/journals/:id/void` RPC call to create a reversal journal and set `voided_at` on the original.
- [ ] Optional: `DELETE /api/v1/accounting/journals/:id` only if not posted (likely unused now).
- [ ] Error handling: return structured `{ error: { code, message } }` for forbidden or invalid states (e.g., `JOURNAL_ALREADY_VOIDED`).

## Phase 3 – Frontend API Client Updates (`src/lib/api/accounting.ts`)
- [ ] Add `getEntity(id)` and `deleteEntity(id)` functions.
- [ ] Add `getJournal(id)`, `voidJournal(id)`, and (optional) `deleteJournal(id)` functions.
- [ ] Add `getJournalLines(journalId)` if not embedding lines in `getJournal` response.
- [ ] Ensure `X-Role` header is set; use `role='accountant'` for delete/void mutations.
- [ ] Improve error surface: prefer `data.error.message` when available.

## Phase 4 – UI: Entities Page
- [ ] Add Actions column buttons: “View”, “Delete”.
- [ ] Implement “View” modal/drawer:
  - Fetch by id; show details with copy-friendly layout.
  - Include quick actions: Edit, Delete (if allowed).
- [ ] Implement “Delete” flow:
  - Show confirmation `AlertDialog` with impact note.
  - Call `deleteEntity(id)`; on success, invalidate list and toast success.
  - Handle server guard: if referenced by journals, show a helpful message.
- [ ] Ensure role guard: only `admin`/`accountant` see Delete.

## Phase 5 – UI: Debit & Credit Notes Page
- [ ] Add Actions column buttons: “View”, “Void” (label Delete, but action is void for posted).
- [ ] Implement “View” drawer/modal:
  - Fetch `getJournal(id)`; display header (date, reference, description, status/voided), and line items table.
  - Show computed totals; flag imbalance if any (defensive).
- [ ] Implement “Void” flow:
  - Show confirmation explaining reversal will be posted.
  - Call `voidJournal(id)`; invalidate list; toast success with new reversal journal id.
  - If already voided, show graceful message.
- [ ] Optional: allow Delete only for draft/unposted (future), else hide.
- [ ] Ensure role guard for Void.

## Phase 6 – RBAC, Audit, and Integrity
- [ ] Enforce `authorize(['admin','accountant'])` for delete/void routes.
- [ ] Write audit log entries for entity deletes and journal voids (user id, timestamp, reason).
- [ ] Data guards:
  - Entities: prevent delete if referenced; suggest archive (status Inactive) instead.
  - Journals: prevent double-void; ensure reversal posts correct opposite signs.

## Phase 7 – Tests, Docs, and Rollout
- [ ] Add backend route tests for new endpoints and edge cases.
- [ ] Add UI tests: open View modals, confirm Delete/ Void flows.
- [ ] Update `docs/openapi.yaml` with new endpoints and payloads.
- [ ] Update `datamodel.md` with schema changes and public view additions.
- [ ] Migrate dev DB; verify endpoints return 200 and UI actions work.
- [ ] Rollout: coordinate Supabase REST exposure, rebuild frontend, smoke test.

## Acceptance Criteria
- [ ] Entities page: clicking “View” shows entity details; clicking “Delete” soft-deletes and removes from list (with appropriate guards).
- [ ] Debit/Credit Notes page: clicking “View” shows journal with lines; clicking “Void/Delete” reverses a posted note and marks original as voided.
- [ ] Only `admin`/`accountant` can delete/void; all roles can view.
- [ ] API returns structured errors; UI displays them clearly.