# Projects: Status & Notes — Phased Execution Plan

This plan adds a notes section to every project card and enables editing project status (Active, Pending Approval, In Progress, Done, Cancelled). Notes and status updates reflect in the Progress Tracker module. The plan is split into phases with clear deliverables and checkboxes.

## Current State (Analysis)
- `src/pages/dms/Projects.tsx` renders project cards with fields: `id, country, client, name, type, coverage, value, dueDate, status, progress`.
- Status is displayed via `getStatusColor`; editable status UI does not exist.
- Notes are not present on Project cards.
- `src/pages/dms/ProgressTracker.tsx` renders its own local `projects` array with fields: `id, name, progress, stage, team, daysInStage, lastUpdate, updateNote, blockers`.
- Progress updates use `UpdateProgressDrawer` which collects a new progress value and optional `note` and calls `updateProjectProgress(...)` (`src/lib/api/progress.ts` is a stub).
- Progress Tracker does not persist the `note` back into its local state nor share data with Projects.

## Goals
- Add a Notes section on each Project card to write and view notes.
- Reflect latest note on Progress Tracker (e.g., “Latest Update”).
- Provide a status changer on Projects with options: Active, Pending Approval, In Progress, Done, Cancelled.
- Keep Projects and Progress Tracker in sync without duplicating data.

---

- [x] Phase 1 — Shared Data Model & Store

  - Define a unified `Project` type shared across modules:
    - Core: `id, name, client, country, type, coverage, value, dueDate`
    - Tracking: `status: 'Active' | 'Pending Approval' | 'In Progress' | 'Done' | 'Cancelled'`, `progress: number`
    - Notes: `notes: Array<{ id: string; text: string; createdAt: string; author?: string }>` and `latestNote?: string`
    - Optional: `stage?: string`, `team?: string[]`, `daysInStage?: number`, `lastUpdate?: string`, `blockers?: string[]`
  - Create a shared store: `src/lib/store/projects.tsx` (React Context) exposing:
    - `getProjects()`, `getProjectById(id)`, `addNote(projectId, text)`, `updateStatus(projectId, nextStatus)`, `updateProgress(projectId, percent)`.
    - Initialize the store with the existing mock projects from `Projects.tsx` and align IDs with `ProgressTracker.tsx` so both reference the same entries.
  - Persistence (initial): local in-memory; add optional localStorage hydration to preserve across reloads.

- [x] Phase 2 — Project Card UI: Notes

  - On each card (grid/list) add a Notes teaser:
    - Show the latest note or “No notes yet”.
    - Show a small count badge of total notes.
  - Add an “Add Note” action on the card:
    - Reuse `SlideOutPanel` or inline editor with `Textarea` and `Save`.
    - On save, call `addNote(projectId, text)` in the shared store and update `latestNote`.
  - Optional: Add a “View Notes” drawer listing recent notes with timestamps.

- [x] Phase 3 — Project Status Editing

  - Replace the static status `Badge` with a `DropdownMenu` or button group on the card:
    - Options: `Active`, `Pending Approval`, `In Progress`, `Done`, `Cancelled`.
    - On selection, call `updateStatus(projectId, nextStatus)`.
  - Update `getStatusColor` to include `Done` and `Cancelled` styles; keep semantic colors consistent:
    - Active: green; In Progress: yellow; Pending Approval: orange; Done: emerald; Cancelled: slate/rose.
  - Optional rules:
    - `Done` sets `progress = 100` automatically.
    - `Cancelled` sets `progress = 0` and disables progress updates (can be reversed if status changes later).

- [x] Phase 4 — Progress Tracker Integration

  - Refactor `ProgressTracker.tsx` to read projects from the shared store instead of maintaining its own local array.
  - Bind “Latest Update” to the store’s `latestNote` for the corresponding project.
  - Wire `UpdateProgressDrawer` save handler to the store:
    - On save: `updateProgress(projectId, percent)`.
    - If a note is provided: `addNote(projectId, note)` and update `lastUpdate` timestamp.
  - Summary cards (On Track/In Progress/Blocked):
    - Define mapping: e.g., On Track = `status === 'Active' || (progress >= 80 && status !== 'Cancelled')`.
    - Blocked can be driven by presence of blockers notes (tagged) or specific status.

- [x] Phase 5 — API & Persistence

  - Unify the API under `src/lib/api/projects.ts`:
    - `PATCH /projects/:id/status` → `updateProjectStatus(id, status)`.
    - `PATCH /projects/:id/progress` → `updateProjectProgress(id, percent, note?)` (already stubbed; extend to persist note).
    - `POST /projects/:id/notes` → `createProjectNote(id, text)`.
  - Add optimistic UI updates with rollback on error; reuse existing toast patterns.
  - Optional: add localStorage fallback for offline support; hydrate store on app start.

- [x] Phase 6 — QA, Accessibility, and Documentation

  - Verify sync: adding a note or changing status on Projects must reflect immediately in Progress Tracker.
  - Tests (lightweight): unit test store actions; integration test rendering with the store providers.
  - Accessibility: ensure all controls have labels; keyboard navigation works for status dropdown and note editor.
  - Update docs: `README.md` and this plan with implementation notes and any deviations.

---

## Implementation Details & File Map
- New:
  - `src/lib/store/projects.ts` — shared store + types.
  - `src/components/dms/ProjectNotesPanel.tsx` — reusable notes panel for cards.
  - `src/lib/api/projects.ts` — consolidated API (status/progress/notes).
- Modified:
  - `src/pages/dms/Projects.tsx` — add notes UI and status dropdown; adopt store.
  - `src/pages/dms/ProgressTracker.tsx` — now consumes store; shows latestNote/lastUpdate; adds local preview overrides; optimistic save updates store and calls unified API.
  - `src/components/ui/UpdateProgressDrawer.tsx` — no API change; passes note to save handler which persists via store/API.
  - `src/lib/api/progress.ts` — usage replaced by `projects.ts` in ProgressTracker.

### Notes on Phases 4–6 Implementation
- Progress Tracker reads from the shared store and reflects `latestNote` and `lastUpdate`.
- Save handler applies optimistic `updateProgress` and `addNote`, then calls `updateProjectProgress` with rollback on error.
- Projects page status changes call `updateProjectStatus` with optimistic UI and rollback on failure; notes use `createProjectNote` then commit to store.
- Summary cards compute counts dynamically from store (On Track/In Progress/Blocked/Team Members).
- Accessibility: Update drawer includes labels and ARIA attributes; status dropdown uses button-as-trigger for keyboard access.
- Persistence remains in-memory; unified API stubs are ready for backend integration.

## Acceptance Criteria
- Projects cards display latest note and allow adding notes.
- Status can be changed among the five options on Projects cards.
- Progress Tracker shows updated status and latest note after changes in Projects.
- Updating progress via the drawer can also add a note; both reflect in Projects and Progress Tracker.
- No duplicate project sources; both modules read from the same store.

## Risks & Mitigations
- Divergent IDs between modules → Seed store with a single source of truth and ensure both use the same IDs.
- UI complexity on cards → Use a drawer/panel to avoid overcrowding; show a concise teaser.
- Persistence not ready → Keep an in-memory store; stub APIs with optimistic updates and add localStorage fallback.

## Estimation
-

---

## Quick Pseudocode Snippets (for clarity)

```ts
// src/lib/store/projects.ts (Zustand example)
type ProjectStatus = 'Active' | 'Pending Approval' | 'In Progress' | 'Done' | 'Cancelled';
type Note = { id: string; text: string; createdAt: string; author?: string };
type Project = { id: string; name: string; client: string; country: string; type: string; coverage: string; value: string; dueDate: string; status: ProjectStatus; progress: number; notes: Note[]; latestNote?: string; stage?: string; team?: string[]; daysInStage?: number; lastUpdate?: string; blockers?: string[] };

interface ProjectStore {
  projects: Project[];
  addNote: (id: string, text: string) => void;
  updateStatus: (id: string, s: ProjectStatus) => void;
  updateProgress: (id: string, p: number) => void;
}
```

```tsx
// Projects.tsx (status dropdown example)
<DropdownMenu>
  <DropdownMenuTrigger asChild>
    <Badge className={getStatusColor(project.status)}>{project.status}</Badge>
  </DropdownMenuTrigger>
  <DropdownMenuContent>
    {['Active','Pending Approval','In Progress','Done','Cancelled'].map(s => (
      <DropdownMenuItem key={s} onClick={() => updateStatus(project.id, s as ProjectStatus)}>
        {s}
      </DropdownMenuItem>
    ))}
  </DropdownMenuContent>
</DropdownMenu>
```

```tsx
// ProgressTracker.tsx (save handler integration)
const handleSave = async (newValue: number, note?: string) => {
  await updateProjectProgress(currentProjectId, newValue, note);
  updateProgress(currentProjectId, newValue);
  if (note) addNote(currentProjectId, note);
};
```