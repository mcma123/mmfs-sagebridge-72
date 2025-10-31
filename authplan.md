# Authentication Implementation Plan

Purpose: introduce secure authentication and role-based access aligned with the current data model (`dms`, `accounting`, `banking`). This plan is phased to enable incremental delivery while minimizing risk.

## Context & References
- Data model reference: `datamodel.md` (DMS, Accounting, Banking Import schemas and RBAC conventions).
- Backend uses Supabase client for Postgres/Storage (`backend/src/middleware/supabase.ts`) and header-based RBAC (`backend/src/middleware/rbac.ts`, `X-Role`).
- Existing UI routes for Administration include user management screens (`src/pages/administration/*`) which currently use mock data.

## Goals
- Create a first-class `auth` schema storing users and roles.
- Seed Admin user: email `admin@mmfs.co.za`, password `P@sswordMMFSadmin`.
- Allow Admin to add/manage user credentials via `/administration/users`.
- Enforce role-based security end-to-end and reflect role-specific views after login.
- Remove demo credentials from login UI.

---

## Phase 0 – Discovery & Baseline
1. Confirm environment variables for Supabase service role are available (`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`).
2. Verify DB connectivity from backend and confirm existing schemas match `datamodel.md`.
3. Inventory current role names used by middleware: `admin`, `accountant`, `editor`, `viewer`.

Deliverables:
- Checklist of envs and connectivity.
- Role map document for consistency across backend and UI.

---

## Phase 1 – Database Schema & Admin Seed
1. Create new schema `auth` with:
   - `auth.users` (`id`, `email` UNIQUE, `password_hash`, `name`, `status`, `created_at`, `updated_at`).
   - `auth.roles` (`id`, `name` UNIQUE, `description`). Seed: `admin`, `accountant`, `editor`, `viewer`.
   - `auth.user_roles` (`user_id`, `role_id`) with PK (`user_id`, `role_id`).
   - Enable `pgcrypto` and use `crypt()` for bcrypt hashing.
2. Seed Admin user: `admin@mmfs.co.za` with hashed password for `P@sswordMMFSadmin` and attach `admin` role.
3. Optional (future): `auth.sessions` for server-managed sessions if not using JWT (can be omitted initially).

Deliverables:
- SQL migrations: `003_auth_init.sql` (schema) and `004_auth_seed_admin.sql` (admin + roles).
- Updated `datamodel.md` (future PR) to include `auth` schema and ERD.

---

## Phase 2 – Backend Auth API
1. Implement endpoints:
   - `POST /api/v1/auth/login` → validates `email`/`password`, returns `accessToken` (JWT) and `role` list. Uses `auth.users` + `auth.user_roles`.
   - `POST /api/v1/auth/logout` → client-side token clear; server optional blacklist if needed.
   - `GET /api/v1/admin/users` → list users (Admin only).
   - `POST /api/v1/admin/users` → create user with role(s) (Admin only). Hash password before insert.
   - `PATCH /api/v1/admin/users/:id` → update user profile/roles/status (Admin only).
   - `DELETE /api/v1/admin/users/:id` → deactivate/delete (soft delete recommended).
2. Token handling:
   - Issue JWT with `sub`, `email`, and `roles` claim.
   - Frontend sets `Authorization: Bearer <token>`; backend adapter continues bridging via `X-Role` header as fallback during transition.
3. RBAC integration:
   - Map `roles` claim → request context → middleware `authorize()` (extend to read from token, not only `X-Role`).

Deliverables:
- Auth router with login/logout and admin user CRUD.
- Middleware updates to extract `role` from JWT.

---

## Phase 3 – Frontend Login Integration
1. Replace simulated login in `src/pages/Login.tsx` with real API call to `POST /api/v1/auth/login`.
2. Persist `accessToken` and basic user profile (email, roles) in a client store (e.g., context/Zustand).
3. Configure global fetch/axios to attach `Authorization` header and bridge `X-Role` until all routes use JWT.
4. Remove demo credential hints from login screens.

Deliverables:
- Integrated login flow with error handling and loading states.
- Demo UI blocks removed.

---

## Phase 4 – Administration: Manage Users
1. Wire `ManageUsers.tsx` and `AddUser.tsx` to backend admin endpoints.
2. Admin can:
   - Create user with `email`, `name`, `password`, `role(s)`.
   - Edit user profile and change roles.
   - Reset password (server generates reset token or set directly by Admin if policy allows).
   - Deactivate user (soft delete).
3. Add validation: unique email, password strength, required role.

Deliverables:
- Functional `/administration/users` screens backed by API.
- Toasts and forms reflect server responses.

---

## Phase 5 – Role-Based UI & Navigation
1. Introduce `RoleGuard` utility to gate routes and components (e.g., only Admin sees Administration menu).
2. At login, compute role capabilities (e.g., `canCreateJournal`, `canManageUsers`) and store in client state.
3. Update menus and pages to reflect authorized views:
   - Viewer: read-only views.
   - Accountant: accounting modules + banking import, no admin.
   - Editor: DMS edit/upload.
   - Admin: full access.

Deliverables:
- Consistent gated navigation and component visibility.
- Reduced 403 errors by client-side gating.

---

## Phase 6 – Auditing & Logging
1. Log auth/admin actions in `dms.audit_logs` (or new `auth.audit_events`): user creation, role changes, login attempts (success/failure summary).
2. Add simple rate limiting on login route and lockout policy after N failures.

Deliverables:
- Audit trail for administrative actions.
- Basic protections against brute-force attempts.

---

## Phase 7 – Testing & Hardening
1. Unit tests: password hashing/verification, role resolution, endpoint guards.
2. Integration tests: login flow, admin create/edit user, RBAC on critical endpoints.
3. Security reviews: password policies, token expiry/refresh, storage of tokens, CORS, CSRF.

Deliverables:
- Test coverage for core auth paths.
- Security checklist completed.

---

## Phase 8 – Rollout
1. Apply migrations to each environment.
2. Seed admin user.
3. Deploy backend auth routes and frontend updates.
4. Communicate credentials to Admin and force password change on first login (optional policy).

Deliverables:
- Auth live with admin access and user management.

---

## Immediate Actions in This Change Set
1. Database migrations added to create `auth` schema and seed Admin user.
2. Demo credentials removed from login pages.
3. This plan documented for phased delivery.

---

## Migrations & Operations
Location: `backend/migrations/sql/`

1. `003_auth_init.sql`
   - Create schema and tables (`users`, `roles`, `user_roles`).
   - Enable `pgcrypto`.
2. `004_auth_seed_admin.sql`
   - Seed roles and Admin user with bcrypt hash for `P@sswordMMFSadmin`.

Apply:
- Run the project’s migration process (matching existing conventions; if using Supabase SQL, run in the project database).

---

## Acceptance Criteria
- Admin user exists in DB with email `admin@mmfs.co.za` and a hashed password derived from `P@sswordMMFSadmin`.
- Login pages no longer display demo credentials.
- Admin screens exist and are prepared to connect to backend endpoints for user CRUD.
- Plan approved and used to guide subsequent implementation phases.