DocFix Plan: DMS Tree Removal & Full-Screen Toggle

Overview
- Remove the left-side Tree component from the Documents page to improve visual balance and free space for core content.
- Add a hamburger icon in the DMS navigation bar to toggle the sidebar, enabling full-screen content viewing.

Scope
- Frontend UI only; no backend changes required.

Changes
- Documents page
  - Remove the Tree section and its grid column.
  - Rebalance layout to two columns on large screens: Content and Details.
  - Maintain all existing interactions: breadcrumb, grid/list toggle, create/rename/move/delete, upload.

- DMS Layout
  - Add a persistent hamburger icon in the header to toggle the sidebar on all breakpoints.
  - Update sidebar CSS classes to collapse on desktop as well (translate-x and width adjustments).
  - Ensure main content expands to full width when sidebar is hidden.

UX Behavior
- Clicking the hamburger when the sidebar is visible hides it and expands content to full width.
- Clicking again restores the sidebar.
- Mobile toggle remains supported; desktop gains the same toggle.

Files Touched
- `src/pages/dms/Documents.tsx`: remove Tree panel, update grid to `grid-cols-1 lg:grid-cols-2`.
- `src/components/layout/DMSLayout.tsx`: add header hamburger, make sidebar collapsible on desktop.

Acceptance Criteria
- No Tree column visible on the Documents page.
- Hamburger icon in the header toggles sidebar visibility on desktop and mobile.
- Content area fills full width when sidebar is hidden.
- No visual regressions in Documents actions and navigation.

QA Steps
- Start dev server and navigate to `/dms/documents` and any folder route.
- Verify balanced two-column layout (Content, Details) on large screens.
- Toggle hamburger to hide/show sidebar; observe content width changes.
- Test grid/list toggle, breadcrumb navigation, folder ops, uploads.

Risks & Mitigation
- Potential layout shifts: use responsive grid and transitions; test across breakpoints.
- Sidebar collapse could hide nav: provide clear hamburger to restore.

Rollback
- Revert `Documents.tsx` grid changes and reintroduce Tree panel.
- Revert `DMSLayout.tsx` header button and sidebar classes.

Next Enhancements (optional)
- Persist sidebar visibility preference in `localStorage`.
- Add keyboard shortcut for toggle (e.g., `Ctrl+\`).