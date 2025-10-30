# DMS Dark Mode Fix Plan

## Overview
- Goal: Make the DMS module fully theme-aware so it looks correct in both light and dark modes without hacks.
- Scope: `src/components/layout/DMSLayout.tsx`, DMS pages under `src/pages/dms/*`, global theme config, and base CSS tokens.

## Phased Implementation Checklist

### Phase 0: Setup and Baseline
- [x] Confirm `ThemeProvider` and `dark` class toggling via Settings → Appearance
- [x] Verify `tailwind.config.ts` content paths include `src/**/*.{ts,tsx}`
- [x] Review `src/index.css` light/dark tokens for completeness and consistency

### Phase 1: DMSLayout Refactor
- [x] Change header surface to `bg-card text-card-foreground` and keep `border-border`
- [x] Change sidebar surface to `bg-card text-card-foreground border-r`
- [x] Use `text-primary` for headings and `text-muted-foreground` for secondary text
- [x] Verify navigation button variants and active state contrast in dark mode

### Phase 2: DMSLogin Adjustments
- [x] Keep root gradient using `from-primary via-primary/95 to-primary/90`
- [x] Replace heading/subtext `text-white` with `text-foreground` or add `dark:text-foreground` when on gradient
- [x] Ensure `Card` surface uses `bg-card text-card-foreground` with appropriate `border-border`
- [x] Validate demo panel `bg-secondary/10 border border-secondary/20` contrast in dark mode

### Phase 3: DMSDashboard Updates
- [x] Replace static palette gradients with token-aware variants (`from-primary to-primary/90` or extended `primary` shades)
- [x] Ensure all cards use `bg-card text-card-foreground` for the main surface
- [x] Adjust metrics panels to `bg-muted` or `bg-muted/30` for proper contrast
- [x] Verify featured ring and “Open Module” link contrast in dark mode

### Phase 4: Projects Page
- [ ] Replace progress track `bg-gray-200` with `bg-muted` (or `bg-muted/40`)
- [ ] Review progress color function; add `dark:brightness-110` if needed for `emerald/amber/rose` classes
- [ ] Tokenize table and card surfaces to `bg-card text-card-foreground`
- [ ] Ensure buttons and chips use semantic tokens (`bg-secondary`, `text-secondary-foreground`)

### Phase 5: ProgressTracker Page
- [ ] Replace inline `style` border-left color with semantic border class mapping (e.g., `border-primary`)
- [ ] Change `border-white` on avatars to `border-card` or `border-border`
- [ ] Use token pairs for badges (`bg-primary text-primary-foreground`, etc.)
- [ ] Verify progress bar colors and legibility in dark mode

### Phase 6: Tasks Page
- [ ] Audit icon/chip static palette colors; add `dark:` variants for contrast
- [ ] Tokenize list and card surfaces to `bg-card text-card-foreground`
- [ ] Validate New Task panel surfaces and input tokens

### Phase 7: Documents Page
- [ ] Review file type color classes; add `dark:brightness-110` where necessary
- [ ] Tokenize card/list surfaces to `bg-card text-card-foreground`
- [ ] Verify hover and focus states across themes

### Phase 8: Token Hygiene and Utilities
- [ ] Replace any remaining `bg-white`, `text-white`, `bg-gray-*` on structural surfaces
- [ ] Standardize borders with `border-border` and secondary text with `text-muted-foreground`
- [ ] Keep brand accents using `bg-primary text-primary-foreground` and `bg-secondary text-secondary-foreground`

### Phase 9: Testing and QA
- [ ] Test each DMS page in light mode
- [ ] Test each DMS page in dark mode
- [ ] Validate WCAG AA contrast for text and UI components
- [ ] Check focus outlines and hover states for accessibility
- [ ] Verify mobile responsiveness and behavior on common breakpoints

### Phase 10: Optional Fallback (Always-Light DMS)
- [ ] Add `dms-container` wrapper to DMS layout root element
- [ ] Add scoped CSS variable overrides for `dms-container` in `src/index.css`
- [ ] Apply `dms-container` class on DMS pages (Login, Dashboard, Projects, Tasks, Documents, ProgressTracker)
- [ ] Use this fallback only if the theme-aware approach is insufficient

## Current State Summary
- Global theming uses `next-themes` with `attribute="class"` and Tailwind `darkMode: ['class']` (good).
- Semantic tokens are defined in `src/index.css` for `:root` and `.dark` (good).
- DMS has several hardcoded colors (e.g., `bg-white`, `bg-gray-200`, `text-white`) and static palette classes (e.g., `from-blue-500`) that don’t adapt with the theme.
- Result: In dark mode, some DMS surfaces remain light or clash with dark tokens, and text contrast can be off.

## Root Causes
- Hardcoded light colors in layout surfaces: header and sidebar use `bg-white`.
- Static grayscale usage: progress bars and separators use `bg-gray-*` instead of `bg-muted` or token-driven classes.
- Fixed “white” text (`text-white`, `border-white`) on components that should use `foreground`/`card-foreground`.
- Mixed use of semantic tokens and static Tailwind palette values for gradients and accents.

## Fix Strategy (Preferred)
Make DMS fully theme-aware by replacing hardcoded colors with semantic tokens, adding `dark:` variants when needed, and aligning gradients with the configured theme.

### Global Checks (no changes expected)
- `ThemeProvider` wraps the app (`src/App.tsx`) and uses `NextThemesProvider` with `attribute="class"`.
- `tailwind.config.ts` and `src/index.css` define tokens for light and dark modes.
- Keep `darkMode: ['class']` as-is.

### File-by-File Plan

1) `src/components/layout/DMSLayout.tsx`
- Replace hardcoded header and sidebar backgrounds:
  - `header className="bg-white border-b border-border ..."` → `header className="bg-card text-card-foreground border-b border-border ..."`
  - Sidebar `bg-white border-r` → `bg-card text-card-foreground border-r`.
- Keep accent typography using semantic colors:
  - Titles: keep `text-primary` for brand accent; body text → `text-muted-foreground` or `text-card-foreground`.
- Rationale: `bg-card`/`text-card-foreground` adapt via CSS variables for `.dark`.

2) `src/pages/dms/DMSLogin.tsx`
- Root gradient:
  - Keep `bg-gradient-to-br` but use semantic colors consistently: `from-primary via-primary/95 to-primary/90`. This already exists and is theme-stable.
- Text colors:
  - Replace `text-white` on headings/subtext with token-friendly alternatives:
    - `text-foreground` (if card/surface is token-based) or add `dark:text-foreground` when content sits on brand gradient.
  - For icon badges using `text-white`, prefer `text-primary-foreground` on `bg-primary` or `text-secondary-foreground` on `bg-secondary`.
- Card surface:
  - Ensure `Card` inherits `bg-card text-card-foreground` by default; avoid custom `border-0` if it breaks contrast; use `border-border` where borders are needed.
- Demo panel:
  - `bg-secondary/10 border border-secondary/20` is fine across themes; verify contrast in dark.

3) `src/pages/dms/DMSDashboard.tsx`
- Module accent gradients:
  - Replace static palette gradients with theme-aware variants:
    - e.g., `from-blue-500 to-blue-600` → `from-primary to-primary/90` (or use extended `primary.{500,600}` if you want exact shades).
- Ensure all cards use `bg-card text-card-foreground` for their main surface (leave gradient stripes as accents).
- Metrics panels:
  - Replace `bg-muted/50` with `bg-muted` or `bg-muted/30` depending on contrast needs.

4) `src/pages/dms/Projects.tsx`
- Progress bar track:
  - `bg-gray-200` → `bg-muted` (or `bg-muted/40` for subtler track).
- Progress color function:
  - Keep color signal but prefer semantic hues or add `dark:` variants:
    - `bg-green-500`, `bg-yellow-500`, `bg-red-500` → consider `bg-emerald-500`, `bg-amber-500`, `bg-rose-500` with `dark:brightness-110` if needed.
- Tables/cards:
  - Ensure outer `Card` and table containers use `bg-card text-card-foreground`.

5) `src/pages/dms/ProgressTracker.tsx`
- Card border-left color:
  - Uses `style` derived from class names; switch to semantic class application:
    - Instead of converting `bg-*` to hex via `replace`, define a mapping to semantic classes and apply with Tailwind: `className={cn("border-l-4", colors.borderClass)}` and set `colors.borderClass` to `border-primary`/`border-emerald-500` etc.
- Avatar rings:
  - `border-white` → `border-card` or `border-border` to adapt in dark.
- Badges:
  - Keep `variant="outline"` and tokens; ensure any custom badge colors use `bg-primary text-primary-foreground` or `bg-secondary text-secondary-foreground`.

6) `src/pages/dms/Tasks.tsx`
- Icon colors and chips:
  - If using `type.color` with static palette, audit contrast in dark; prefer tokens or add `dark:` variants.
- Containers:
  - Ensure list and card surfaces use `bg-card text-card-foreground`.

7) `src/pages/dms/Documents.tsx`
- File type colors:
  - Static `text-red-600`, `text-green-600`, `text-blue-600` are fine for signals but add `dark:brightness-110` if low contrast.
- Surfaces:
  - Use `bg-card text-card-foreground` for cards/lists.

### Token & Utility Guidelines
- Prefer semantic tokens:
  - Backgrounds: `bg-background`, `bg-card`, `bg-popover`.
  - Text: `text-foreground`, `text-card-foreground`, `text-muted-foreground`.
  - Borders: `border-border`.
  - Accents: `bg-primary text-primary-foreground`, `bg-secondary text-secondary-foreground`.
- Avoid hardcoded `bg-white`, `text-white`, `bg-gray-*` on structural surfaces.
- If using static palette classes for accents (e.g., charts, badges), verify contrast and add `dark:` variants where necessary.

### Optional: Keep DMS Always Light (fallback strategy)
If you decide DMS should remain light regardless of global theme, use a scoped container class (e.g., `dms-container`) and override CSS variables inside. See `removedarkmodekilo.md` for a ready-made approach. Note: This is a workaround; the preferred strategy is to make DMS theme-aware.

## Testing Plan
- Toggle theme via `Settings → Appearance` and test all DMS pages.
- Verify:
  - Layout header/sidebar surfaces adapt: readable in both modes.
  - Cards, tables, forms use token-based backgrounds and text.
  - Progress bars and badges remain legible with adequate contrast.
  - Gradients do not produce unreadable text; adjust foreground tokens if needed.
- Accessibility checks:
  - Ensure minimum contrast ratio (WCAG AA) for text on all surfaces.
  - Focus states visible in both themes.

## Implementation Checklist
- Replace hardcoded colors with tokens in `DMSLayout.tsx`.
- Audit and update surfaces and text across `DMSLogin`, `DMSDashboard`, `Projects`, `ProgressTracker`, `Tasks`, `Documents`.
- Add `dark:` variants for any remaining static palette accents that fail contrast.
- Run through the testing plan and iterate on contrast tweaks.

## Effort Estimate
- Refactor DMSLayout surfaces: 30–60 minutes.
- Update each DMS page (6 pages): 2.5–4 hours total.
- Testing and polish: 1–2 hours.
- Total: ~4–7 hours.

## Notes
- The global theme architecture is solid; the fix focuses on replacing hardcoded styles with semantic, token-driven classes.
- Keep brand accents (`primary`, `secondary`) but ensure foreground tokens are used for readable text on accent backgrounds.