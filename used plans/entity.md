# Entities Module – Add Entity Form Plan

## Overview
- Goal: Enable users to add entity records (Clients, CDANTs, Reinsurers) from the Entities module via an Add Entity form.
- Entry point: The "Add Entity" button on `src/pages/Entities.tsx` currently navigates to `/entities/add`, which has no route or page yet.
- Scope: Frontend form, local persistence (initial), and clean routing. Backend API stubs can be added later.

## Current State Summary
- `src/pages/Entities.tsx` renders three tabs (Clients, CDANTs, Reinsurers) with hardcoded sample data and a button navigating to `/entities/add`.
- `src/App.tsx` defines `<Route path="/entities" element={<Entities />} />` but no route for `/entities/add`, causing 404 on click.
- Forms elsewhere (e.g., `AddAccount.tsx`, `AddUser.tsx`, `Signup.tsx`) use `react-hook-form` + `zod` with shadcn/ui components, consistent motion/transitions, and toasts.
- Backend: No existing endpoints for entities; docs and routes focus on DMS and Banking. We will start with a local store pattern (like `src/lib/store/documents.ts`).

## Design
- Entity types: `Client`, `CDANT`, `Reinsurer`.
- Common fields: `name`, `type`, `status`, `currency`, `country`, `address`, `email`, `phone`, `notes`.
- Type-specific fields:
  - Client: `vatNumber`, `creditTermsDays`, `outstanding`
  - CDANT: `commissionRate`, `licenseNumber`, `outstanding`
  - Reinsurer: `treatyTerms`, `rating`, `capacity`, `netPosition`
- Validation: Zod schemas per type composed from a common base.
- Persistence: Local store in `localStorage` initially; optional future backend API.
- UX: Single page with type selector and dynamic sections, consistent with shadcn/ui.

## UI/UX Plan
- Page: `src/pages/entities/AddEntity.tsx`
  - Header: "Add Entity" with breadcrumb-like back button to Entities list.
  - Type selector: `Select` with `Client | CDANT | Reinsurer`.
  - Form sections:
    - Common details (always visible).
    - Conditional section per type.
  - Actions: `Save`, `Save & Add Another`, `Cancel`.
  - Feedback: Use `use-toast` for success/error messages.
  - Motion: Subtle `framer-motion` transitions consistent with other pages.

## Data Model (Frontend)
```ts
// src/lib/store/entities.ts (new)
export type EntityType = 'Client' | 'CDANT' | 'Reinsurer';

export interface BaseEntity {
  id: string; // uuid
  type: EntityType;
  name: string;
  status: 'Active' | 'Inactive';
  currency: string; // ISO code e.g. 'USD', 'ZAR'
  country?: string;
  address?: string;
  email?: string;
  phone?: string;
  notes?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface ClientEntity extends BaseEntity {
  vatNumber?: string;
  creditTermsDays?: number;
  outstanding?: number; // optional analytics field
}

export interface CdantEntity extends BaseEntity {
  commissionRate?: number; // %
  licenseNumber?: string;
  outstanding?: number;
}

export interface ReinsurerEntity extends BaseEntity {
  treatyTerms?: string;
  rating?: string; // e.g., AM Best
  capacity?: number; // optional
  netPosition?: number; // positive/negative
}

export type AnyEntity = ClientEntity | CdantEntity | ReinsurerEntity;

// Store API (initial): list/add/update/remove, persisted to localStorage
export function listEntities(type?: EntityType): AnyEntity[] {}
export function addEntity(entity: AnyEntity): AnyEntity {}
export function updateEntity(id: string, patch: Partial<AnyEntity>): AnyEntity {}
export function removeEntity(id: string): void {}
```

## Validation Rules (Zod)
- Common:
  - `name`: non-empty string
  - `status`: enum `Active | Inactive`
  - `currency`: 3-letter uppercase ISO code (basic validation)
  - `email`: optional valid email
  - `phone`: optional string
  - `country`: optional string
- Client-specific:
  - `vatNumber`: optional string
  - `creditTermsDays`: optional number ≥ 0
- CDANT-specific:
  - `commissionRate`: 0–100
- Reinsurer-specific:
  - `treatyTerms`: optional string
  - `rating`: optional string

## Routing and Navigation
- Update `src/App.tsx` to add:
  - `<Route path="/entities/add" element={<AddEntity />} />`
- `Entities.tsx` button already navigates to `/entities/add`.
- After save:
  - Default: navigate back to `/entities` and show success toast.
  - "Save & Add Another": stay on page with reset form and success toast.

## Persistence Strategy
- Phase 1 (local): Local store `src/lib/store/entities.ts` using `localStorage`, modeled on `src/lib/store/documents.ts` for consistency, minimal dependencies.
- Phase 2 (API): Add backend routes (`backend/src/routes/entities.ts`) and mount under `/api/v1/accounting/entities` and `/api/v1/entities` if needed.
  - Endpoints: `GET /entities?type=...`, `POST /entities`, `PATCH /entities/:id`, `DELETE /entities/:id`.
  - RBAC: Reuse `authorize` middleware.
  - Validation: Add runtime schema validators in `backend/src/validation/schemas.ts`.

## Implementation Steps
1) Create local store
   - File: `src/lib/store/entities.ts`
   - Implement types and CRUD funcs (`listEntities`, `addEntity`, etc.), with a namespaced `LS_KEY` and `seq/uuid` generator.
   - Unit tests optional, patterned after store usage.

2) Scaffold Add Entity page
   - File: `src/pages/entities/AddEntity.tsx`
   - Use `react-hook-form` + `zodResolver` and shadcn/ui components (`Input`, `Select`, `Textarea`, `Card`, `Button`).
   - Dynamic fields rendered based on type; reuse common `FormField` patterns from `AddAccount.tsx` and `AddUser.tsx`.
   - `onSubmit`: calls `addEntity`, shows toast, navigates per action.

3) Wire up routing
   - Update `src/App.tsx` with `<Route path="/entities/add" element={<AddEntity />} />`.
   - Verify navigation works from `Entities.tsx` button.

4) Refresh Entities list
   - Replace hardcoded sample arrays with data from the local store via `listEntities('Client')`, `listEntities('CDANT')`, `listEntities('Reinsurer')`.
   - Preserve table headers and styling; ensure search filters on `name`.
   - Add a lightweight `useEffect` or computed list that listens to store changes (simple re-fetch on mount is sufficient initially).

5) Optional: Backend stub
   - Add `backend/src/routes/entities.ts` with placeholder CRUD and mount in `backend/src/server.ts`.
   - Create `src/lib/api/entities.ts` with `fetch` helpers mirroring local store shape.

## Acceptance Criteria
- Clicking "Add Entity" on the Entities page opens the Add Entity form at `/entities/add`.
- Users can select type and input common + type-specific fields.
- Validation prevents invalid submissions; displays helpful messages.
- Saving persists the entity; success toast appears.
- Navigating back to `/entities` shows the newly added entity in the correct tab.
- No 404 on `/entities/add`.

## Testing & QA
- Manual: Verify navigation, validation, and list refresh across all three entity types.
- Unit (optional): Test local store CRUD functions.
- Visual: Ensure the page adheres to existing shadcn/ui style and motion consistency.

## Rollout Notes
- Start with local persistence to unblock UX and demos.
- Plan backend integration when accounting data flows require server authority, multi-user access, and audit trails.
- When backend is ready, swap store calls to API layer, preserving types.

## Effort Estimate
- Local store + form page + routing + list refresh: ~6–8 hours.
- Backend stubs (optional): ~2–3 hours.

## Dependencies
- `react-hook-form`, `zod`, shadcn/ui components are already present and used in other pages.
- No new external packages required for Phase 1.