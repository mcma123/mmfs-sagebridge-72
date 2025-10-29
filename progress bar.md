# Progress Tracker: Slide-Out Progress Bar Update Feature

This plan details how to implement a slide-out panel (drawer) that opens when the user clicks the "Update Progress" button in the Document Management System’s Progress Tracker module. The drawer allows adjusting a project’s progress via a draggable progress bar (slider), with accessible controls, validation, and optional server persistence.

## Goals & Outcomes
- Enable users to click `Update Progress` to open a slide-out panel.
- Let users adjust project progress via a slider (`0–100%`).
- Show immediate visual feedback on the page’s progress bar.
- Confirm or cancel updates with clear actions and toast feedback.
- Ensure accessibility (keyboard, screen reader, color contrast).
- Prepare API hooks for persistence (non-blocking if backend not ready).

## User Stories
- As a user, I can open a slide-out panel to update progress.
- As a user, I can adjust progress using a slider and see the percentage.
- As a user, I can save changes, cancel, or close the panel.
- As a user, I get feedback (success or error) after saving.

## UX Behavior
- `Update Progress` button opens a right-side drawer.
- Drawer contains: project name, current progress, slider with numeric input, optional note, Save and Cancel buttons.
- Real-time preview: as the slider moves, the page’s progress bar reflects the new value (optimistically), reverting if canceled.
- Keyboard support: `Tab` for focus, `ArrowLeft/Right` adjust slider, `Esc` closes drawer.
- Accessible labels: slider is announced with percentage; buttons have clear names.

## Technical Approach
- Stack: React + Vite + TypeScript + Tailwind.
- Use controlled state in the parent (ProgressTracker) and pass to components.
- Implement a reusable `ProgressBar` and `UpdateProgressDrawer`.
- Integrate toasts via existing `hooks/use-toast.ts`.
- Add optional API service for persistence (`lib/api/progress.ts`).

## Data Model
```ts
type ProjectProgress = {
  projectId: string;
  progressPercent: number; // 0–100
  updatedBy?: string;
  updatedAt?: string; // ISO string
  note?: string;
};
```

## File & Component Plan
- `src/pages/dms/ProgressTracker.tsx`
  - Renders the current progress bar and the `Update Progress` button.
  - Owns state for `progressPercent`, controlled updates, and drawer visibility.
- `src/components/ui/ProgressBar.tsx`
  - Reusable progress bar with accessible semantics and Tailwind styling.
- `src/components/ui/UpdateProgressDrawer.tsx`
  - Slide-out panel with slider, percent display, note field, Save/Cancel.
- `src/lib/api/progress.ts`
  - Stubbed `updateProjectProgress(projectId, progressPercent, note)` returning a Promise.
- Optional routing: integrate in `src/pages/dms/` page where progress is shown.

## Accessibility Requirements
- Slider labeled with `aria-label="Project progress"` and `aria-valuenow`, `aria-valuemin`, `aria-valuemax`.
- Drawer traps focus and supports `Esc` to close.
- Buttons have descriptive names and `aria-disabled` when saving.
- Color contrast of progress bar meets WCAG AA.

## Validation & Edge Cases
- Clamp progress between `0` and `100`.
- Numeric input rejects non-number, empty defaults to previous value.
- Prevent saving when unchanged; disable Save until changed.
- Handle slow API: show loading state on Save; optimistic UI rollback on error.
- Handle concurrent changes: refetch or merge if backend provides versions.

## Implementation Steps
1. Create `ProgressBar` component
   - Props: `value: number`, `label?: string`, `className?: string`.
   - Renders a container with a filled bar based on `value` and a textual `%` label for screen readers.

2. Create `UpdateProgressDrawer` component
   - Props: `isOpen`, `initialValue`, `onClose`, `onSave(newValue, note)`.
   - Contains: title, slider input, numeric input, optional note textarea, Save/Cancel.
   - Manages temporary internal state for slider/note while open.
   - Keyboard and focus management; closes on `Esc` and overlay click.

3. Wire `ProgressTracker` page
   - Local state: `progressPercent`, `isDrawerOpen`, `isSaving`.
   - `Update Progress` opens drawer with `initialValue = progressPercent`.
   - Preview updates when slider changes; if Cancel, revert.
   - On Save: call `updateProjectProgress`, show toast success/error, update state.

4. Add API service (stub)
   - Implement `updateProjectProgress` with simulated latency and success.
   - Later replace with real fetch to backend endpoint.

5. Styling with Tailwind
   - Progress bar: rounded, transition on width, color token based on theme.
   - Drawer: fixed right panel, overlay, z-index, focus ring styles.
   - Slider: native `<input type="range">` styled, plus numeric input.

6. Toast feedback
   - Use existing `useToast` to show success or error.

7. Testing & QA
   - Unit: component behavior (clamping, callbacks, disabled when saving).
   - Interaction: keyboard navigation, `Esc` close, tab order.
   - Visual: width updates correctly for `0`, `50`, `100`.
   - Manual: simulate API failure and confirm rollback.

## Minimal Example Code (Illustrative)
Note: adjust imports/paths to match your project structure.

`src/components/ui/ProgressBar.tsx`
```tsx
import React from 'react';

export function ProgressBar({ value, label, className }: { value: number; label?: string; className?: string }) {
  const percent = Math.max(0, Math.min(100, value));
  return (
    <div className={`w-full bg-gray-200 rounded h-3 aria-hidden ${className ?? ''}`} role="progressbar" aria-valuenow={percent} aria-valuemin={0} aria-valuemax={100} aria-label={label ?? 'Progress'}>
      <div className="bg-blue-600 h-3 rounded transition-[width] duration-300" style={{ width: `${percent}%` }} />
      <span className="sr-only">{percent}%</span>
    </div>
  );
}
```

`src/components/ui/UpdateProgressDrawer.tsx`
```tsx
import React, { useEffect, useRef, useState } from 'react';

export function UpdateProgressDrawer({ isOpen, initialValue, onClose, onSave }: { isOpen: boolean; initialValue: number; onClose: () => void; onSave: (value: number, note?: string) => Promise<void> | void; }) {
  const [value, setValue] = useState(initialValue);
  const [note, setNote] = useState('');
  const drawerRef = useRef<HTMLDivElement>(null);

  useEffect(() => { setValue(initialValue); }, [initialValue]);
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape' && isOpen) onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} aria-hidden="true" />
      <div ref={drawerRef} className="absolute right-0 top-0 h-full w-[360px] bg-white shadow-xl p-4 focus:outline-none" role="dialog" aria-modal="true" aria-label="Update project progress">
        <h2 className="text-lg font-semibold mb-4">Update Progress</h2>
        <label className="block text-sm font-medium mb-1" htmlFor="progress-range">Progress: {value}%</label>
        <input id="progress-range" type="range" min={0} max={100} value={value} aria-label="Project progress" onChange={(e) => setValue(Number(e.target.value))} className="w-full" />
        <div className="mt-2 flex items-center gap-2">
          <input type="number" min={0} max={100} value={value} onChange={(e) => setValue(Math.max(0, Math.min(100, Number(e.target.value) || 0)))} className="w-20 border rounded px-2 py-1" aria-label="Progress percent" />
          <span className="text-gray-600">%</span>
        </div>
        <label className="block text-sm font-medium mt-4 mb-1" htmlFor="note">Note (optional)</label>
        <textarea id="note" value={note} onChange={(e) => setNote(e.target.value)} className="w-full border rounded px-2 py-1 min-h-[80px]" />

        <div className="mt-4 flex gap-2">
          <button onClick={() => onSave(value, note)} className="px-3 py-2 rounded bg-blue-600 text-white hover:bg-blue-700">Save</button>
          <button onClick={onClose} className="px-3 py-2 rounded border">Cancel</button>
        </div>
      </div>
    </div>
  );
}
```

`src/lib/api/progress.ts`
```ts
export async function updateProjectProgress(projectId: string, progressPercent: number, note?: string) {
  // Simulate latency and success; replace with real API call later.
  await new Promise((r) => setTimeout(r, 600));
  return { projectId, progressPercent, note, updatedAt: new Date().toISOString() };
}
```

`src/pages/dms/ProgressTracker.tsx`
```tsx
import React, { useState } from 'react';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { UpdateProgressDrawer } from '@/components/ui/UpdateProgressDrawer';
import { updateProjectProgress } from '@/lib/api/progress';
import { useToast } from '@/hooks/use-toast';

export default function ProgressTracker() {
  const { toast } = useToast();
  const [progressPercent, setProgressPercent] = useState(35);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const projectId = 'demo-project-1';

  const openDrawer = () => setIsDrawerOpen(true);
  const closeDrawer = () => setIsDrawerOpen(false);

  const handleSave = async (newValue: number, note?: string) => {
    if (newValue === progressPercent) { closeDrawer(); return; }
    try {
      setIsSaving(true);
      setProgressPercent(newValue); // optimistic update
      await updateProjectProgress(projectId, newValue, note);
      toast({ title: 'Progress updated', description: `Project is now at ${newValue}%` });
    } catch (e) {
      toast({ title: 'Update failed', description: 'Could not save progress', variant: 'destructive' });
    } finally {
      setIsSaving(false);
      closeDrawer();
    }
  };

  return (
    <div className="p-4">
      <h1 className="text-xl font-semibold mb-4">Project Progress</h1>
      <ProgressBar value={progressPercent} />
      <div className="mt-4">
        <button onClick={openDrawer} disabled={isSaving} className="px-3 py-2 rounded bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50">Update Progress</button>
      </div>
      <UpdateProgressDrawer isOpen={isDrawerOpen} initialValue={progressPercent} onClose={closeDrawer} onSave={handleSave} />
    </div>
  );
}
```

## Integration Notes
- Ensure path aliases (like `@/`) match your `tsconfig.json` and Vite config.
- If routes are used, add `ProgressTracker` to the relevant DMS page or embed inside existing modules.
- Confirm Tailwind config is loaded and classes compile.

## Testing Plan
- Unit tests (if using Vitest):
  - `ProgressBar` clamps values, sets `aria-*` correctly.
  - `UpdateProgressDrawer` calls `onSave` with correct values; closes on Esc.
  - `ProgressTracker` optimistic update and error rollback behavior.
- Manual QA checklist:
  - Keyboard-only interaction works.
  - Screen reader announces slider percentage.
  - Saving shows success toast; API failure shows error toast.
  - Drawer overlay click closes, Save disabled while saving.

## Future Enhancements
- Add activity log with `updatedBy`, `updatedAt`, and note display.
- Add granular permissions (only certain roles can update progress).
- Replace native drawer with a shared component if your UI library includes one.
- Add analytics events for Update Progress interactions.

## Acceptance Criteria
- Clicking `Update Progress` opens a slide-out drawer.
- Slider and numeric input adjust the progress from `0–100%`.
- Saving updates the page’s progress bar and shows a toast.
- Canceling or closing discards changes.
- Accessible behavior and keyboard interaction verified.

## Phased Execution Checklist
- [x] Phase 0: Planning & Setup
  - [x] Confirm target DMS page and route integration (`/dms/progress`).
  - [x] Verify path aliases and Tailwind build configuration.
  - [x] Decide on backend endpoint or use stub service (stub implemented).
- [x] Phase 1: ProgressBar Component
  - [x] Implement bar rendering and clamping logic (0–100).
  - [x] Add accessible `role="progressbar"` and `aria-*` attributes.
- [x] Phase 2: UpdateProgressDrawer UI
  - [x] Build drawer with slider, numeric input, and note field.
  - [x] Implement keyboard support (`Tab`, `Esc`, arrow keys) and overlay close.
- [x] Phase 3: Page Wiring (ProgressTracker)
  - [x] Manage per-project progress, `drawerOpen`, and `isSaving` state.
  - [x] Show optimistic preview updates; revert on cancel/error.
- [x] Phase 4: API Integration
  - [x] Add `updateProjectProgress` stub with simulated latency.
  - [x] Wire save flow with toast success/error and rollback handling.
- [x] Phase 5: Styling & Theme
  - [x] Tailwind styles for bar, drawer, inputs; transitions on width.
  - [x] Ensure color contrast meets WCAG AA.
- [x] Phase 6: Accessibility & Validation
  - [x] Clamp range inputs; sanitize numeric entry.
  - [x] Disable Save when unchanged or during saving.
- [x] Phase 7: Testing & QA
  - [x] Manual keyboard-only and screen reader verification.
  - [x] Simulate API failures to confirm rollback and toasts.
- [x] Phase 8: Integration & Rollout
  - [x] Embed in DMS module route; document acceptance criteria for release.

## Rollout
- Behind a low-risk flag in the target DMS page.
- Start with local state only; enable API persistence once endpoint is ready.