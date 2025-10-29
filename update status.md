# Update Status — Phased Plan

Enable status editing across the app: while creating a project in the slide-out form, on project cards (grid and list views), and inside the Progress Tracker’s update drawer. Address the slide-out form scroll issue so all fields are reachable.

## Objectives
- Allow setting project status at creation time in the slide-out form.
- Make status editable on Projects (grid and list views) with optimistic updates.
- Add status control to the Progress Tracker’s Update Progress drawer.
- Fix form scroll/height so users can reach and submit all fields on smaller screens.

## Current Observations
- Projects grid shows static status badges; list view status dropdown exists but needs confirm + unify behaviors.
- Slide-out form (`NewProjectForm` in `SlideOutPanel`) doesn’t scroll; users can’t reach bottom fields.
- Progress drawer (`UpdateProgressDrawer`) lacks a status control; only progress and note are editable.
- Store already has `updateStatus(id, status)` with rules (Done → 100%, Cancelled → 0%). API stubs exist in `src/lib/api/projects.ts`.

---

- [ ] Phase 1 — Status in New Project Form + Fix Scroll
  - [ ] Add Status field to `NewProjectForm` using `Select` or `DropdownMenu` with options: `Draft`, `Active`, `Pending Approval`, `In Progress`, `Done`, `Cancelled`.
  - [ ] Extend `ProjectFormData` to include `status` and default to `Active`.
  - [ ] Pass `status` to `useProjects.addProject` when creating the project; ensure store type accepts it.
  - [ ] Fix slide-out scroll: set content container to `max-h-[100dvh]` and `overflow-y-auto` OR wrap the form in `ScrollArea` with `className="h-[calc(100dvh-var(--header))]"`.
  - [ ] Verify mobile: keyboard open/close does not break layout; header remains sticky; actions visible.
  - [ ] Acceptance: User can scroll through all form fields and set status; project is created with the selected status; success toast shows.

- [ ] Phase 2 — Status Dropdown on Project Cards (Grid + List)
  - [ ] Grid view: replace static status badge with a `DropdownMenu` or `Select` that shows current status and allows change.
  - [ ] List view: ensure dropdown calls optimistic `updateStatus(id, s)` then `updateProjectStatus(id, s)`; on error, rollback and show destructive toast.
  - [ ] Harmonize badge colors and status labels via a shared `getStatusColor(status)` util.
  - [ ] Acceptance: Changing status from any project card updates immediately, persists via API, rolls back on failure, and updates progress for `Done`/`Cancelled` per store rules.

- [ ] Phase 3 — Status Control in Progress Drawer
  - [ ] Add a Status selector to `UpdateProgressDrawer` alongside progress inputs and note.
  - [ ] In `ProgressTracker` save handler, detect changes:
    - [ ] If status changed: optimistic `updateStatus(id, status)`, call `updateProjectStatus(id, status)`; rollback on error.
    - [ ] If progress/note changed: optimistic `updateProgress(id, percent)` and `addNote(id, note?)`, call `updateProjectProgress(id, percent, note)`; rollback on error.
    - [ ] Allow both status and progress changes in one save; handle each promise’s error independently.
  - [ ] Show toasts: success on commit, destructive on failure; disable Save while in-flight.
  - [ ] Acceptance: User can change status inside the drawer; both Projects and Progress Tracker reflect changes immediately; notes and progress persist as expected.

- [ ] Phase 4 — UX, Accessibility, and Edge Cases
  - [ ] Add labels and `aria-*` for status controls; ensure keyboard navigation (Tab/Enter/Space) works in dropdowns/selects.
  - [ ] Focus management in drawer: initial focus on progress; easily reach status and note fields.
  - [ ] Edge rules: `Done` sets progress to 100; `Cancelled` sets progress to 0; preview overlays respect the latest in-flight values.
  - [ ] Acceptance: Accessibility checks pass; UX is consistent across light/dark themes and mobile/desktop.

- [ ] Phase 5 — QA, Tests, and Documentation
  - [ ] Unit-test store `updateStatus` rules and interactions with `updateProgress`.
  - [ ] Integration-test Projects and Progress pages with `ProjectsProvider` for shared state sync.
  - [ ] Update `README.md` and planning docs (`status and notes plan.md`, this doc) with the behavior and any deviations.
  - [ ] Acceptance: CI/local tests pass; docs explain how to use status controls in all surfaces.

---

## File Change Map (Targeted)
- `src/components/dms/NewProjectForm.tsx`: add Status field; include in submit payload.
- `src/components/ui/slide-out-panel.tsx`: enable vertical scroll for form content; ensure header/actions remain visible.
- `src/pages/dms/Projects.tsx`: add/confirm status dropdown in grid and list views; wire optimistic save with rollback.
- `src/components/ui/UpdateProgressDrawer.tsx`: add Status control; propagate `status` through `onSave`.
- `src/pages/dms/ProgressTracker.tsx`: update save handler to persist both status and progress/note; manage optimistic states.
- `src/lib/store/projects.tsx`: confirm `addProject` accepts status; `updateStatus` rules remain (Done/Cancelled → progress adjustments).
- `src/lib/api/projects.ts`: reuse `updateProjectStatus` and `updateProjectProgress` stubs; later swap for real HTTP.

## Acceptance Criteria (Summary)
- Users can set status at project creation in the slide-out form.
- Users can change status from Projects cards in both grid and list views.
- Users can change status in the Progress Tracker drawer while adjusting progress.
- Form is scrollable; all fields are reachable on mobile and desktop.
- Optimistic updates with toasts and rollback on error are in place.
- Store and both pages stay in sync; `Done`/`Cancelled` adjust progress as defined.

## Risks & Mitigations
- Conflicting updates (status vs progress): handle both in one save; rollback each independently.
- Mobile viewport issues: use `max-h-[100dvh]`, `overflow-y-auto`, or `ScrollArea` to ensure reliable scrolling.
- Visual regressions: validate badge/label colors and contrast; test keyboard flows.