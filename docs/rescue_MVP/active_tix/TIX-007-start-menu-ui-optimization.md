# TIX-007: Optimize Start Menu Visual Hierarchy And Badminton Identity

Status: Draft implementation ticket
Priority: High
Target project: `BadmintonManager`
Target screen: `Start Screen` / launch entry / start menu
Prepared on: 2026-05-19
Primary files: `components/SetupView.tsx`, `app/App.tsx`, `styles.css`, `tests/unit/setup-view.test.tsx`, `tests/unit/app-career-shell.test.tsx`, `e2e/app.spec.ts`
Reference input: user screenshot review from 2026-05-19; `docs/rescue_MVP/arc_tix/TIX-003-better-start-screen.md`; `docs/rescue_MVP/arc_tix/TIX-005-start-screen-polish-and-qa.md`

## 1. Problem Statement

The current start menu is much stronger than the original flat card grid. It already has a launch hub, an active save panel, start-new paths, utility controls, and local save trust details.

However, the screenshot still reads more like a restrained admin dashboard than a confident game launch surface. The composition is clean, but it can be sharper:

- the top hero consumes valuable space without carrying much decision-making weight,
- the active save panel is important, but its action and next-step information could feel more immediate,
- the right-side `Start Something New` group competes with the resume panel instead of clearly becoming secondary,
- utility cards and save trust details still occupy nearly the same visual language as launch choices,
- the screen says `Badminton Manager`, but it does not yet express enough badminton-specific identity.

The target improvement is:

\[
\text{Start Menu Quality}
=
\frac{\text{primary action clarity} + \text{save confidence} + \text{badminton identity}}
{\text{visual competition} + \text{generic dashboard feel} + \text{wasted first-viewport space}}
\]

This ticket is a refinement pass. It should not restart the launch hub from scratch.

## 2. Current UX Diagnosis

From the reviewed screenshot, the start menu has a strong dark-management mood and a useful green accent, but the hierarchy is still slightly soft.

1. **The hero block is oversized for the information it provides.** `Launch Hub`, `Badminton Manager`, and the short support line are useful, but they do not need to dominate the upper third of the page.
2. **The resume card should be the saved-state hero.** When a career save exists, `Resume Career`, the athlete name, the next action, and `Continue Career` should become the unmistakable center of gravity.
3. **The primary button needs more command presence.** `Continue Career` is bright, but its placement in the lower-right of the resume card makes it feel slightly detached from the athlete and next action.
4. **Secondary paths need cleaner grouping.** `New Session` and `Secondary Paths` are accurate labels, but they create a split read. The player should simply understand: continue, start new, or manage setup.
5. **Utility controls are still card-heavy.** `Save Tools` and `Preferences` are important, but they should not visually compete with resume/start choices.
6. **Badminton identity is underused.** The screen could use subtle court-line geometry, racket/shuttle iconography, or save-specific sporting details without becoming decorative noise.
7. **Large dark margins make the page feel more empty than cinematic.** On wide desktop, the center content is clean but could feel more intentionally staged.

The UI should guide the player in under three seconds:

\[
\text{Continue if possible}
\quad\rightarrow\quad
\text{start something new}
\quad\rightarrow\quad
\text{manage local setup}
\]

## 3. Objective

Polish the start menu into a career-first, badminton-specific launch surface that makes the correct next click obvious.

Target saved-career read:

```text
Badminton Manager
Grand-Slam Southpaw
Next: Advance Day to 2026-08-05

[Continue Career]

Start New: Career Program | Quick Tournament
Manage: Save Tools | Preferences
```

Target no-save read:

```text
Badminton Manager
Choose your first program or run a quick tournament.

[Start Career]    [Quick Tournament]
Save Tools        Preferences
```

The finished design should keep the existing dark command-console tone, but add more game-specific texture and better decision hierarchy.

## 4. Scope

### In Scope

- Rebalance the `SetupView` start menu layout around the current `start-screen-redesign` structure.
- Make the active save panel the dominant object when `launchSaveSummary` exists.
- Tighten or compress the top hero so it supports the launch decision instead of competing with it.
- Rework the visual grouping of `Start Career`, `Quick Tournament`, `Save Tools`, and `Preferences`.
- Add restrained badminton identity through visual treatment, iconography, court-line styling, or save metadata.
- Improve the placement and emphasis of `Continue Career` / `Continue Tournament`.
- Reduce card heaviness for utility and save-trust areas.
- Preserve clean no-save, active-career-save, active-quick-tournament, and corrupt-save states.
- Update unit and e2e coverage if markup, labels, or behavior changes.
- Capture or refresh visual QA screenshots for desktop and mobile launch states.

### Out Of Scope

- No change to career simulation rules.
- No change to quick tournament rules.
- No save schema migration unless the current summary object lacks a small presentational field that is truly required.
- No backend, cloud save, auth, or account system.
- No copied Badminton World Federation, Football Manager, or third-party trade dress.
- No broad redesign of career portal pages.
- No new athlete likenesses or licensed content.

## 5. Product Principle

The start menu is a launch decision, not an information dashboard.

\[
\text{Start Menu}
\neq
\text{Career Command Center}
\]

Every visible element should help the player choose one of four actions:

1. continue an existing save,
2. start a career,
3. run a quick tournament,
4. manage local setup.

If an element does not support one of those actions, shorten it, merge it, or make it visually quieter.

## 6. Layout Requirements

### 6.1 Saved-Career State

When `launchSaveSummary.mode === "career"`, the resume panel should own the page.

Requirements:

- `Resume Career` or an equivalent saved-career heading remains visible.
- Managed athlete name is prominent and remains readable for long names.
- The next action appears close to the primary button, not as a distant side note.
- `Continue Career` is the only green primary command in the saved-career state.
- `Start Career` and `Quick Tournament` remain visible but clearly secondary.
- The resume panel should include the most useful save facts:
  - date,
  - stage or event,
  - save health,
  - rank if available,
  - readiness if available,
  - next required action.

Potential composition:

```text
Resume Career
Grand-Slam Southpaw
2026-08-04 | Event complete | Rank #5

Readiness 60
Next: Advance Day to 2026-08-05

[Continue Career]
```

### 6.2 Saved-Quick-Tournament State

When `launchSaveSummary.mode === "quickTournament"`, the panel must not use career language.

Requirements:

- Use `Continue Tournament` or equivalent tournament-specific copy.
- Show selected athlete, round/bracket context, opponent if available, and next action.
- Keep `Career Program` as a secondary path.
- Avoid implying that quick tournament progress has career-calendar persistence.

### 6.3 No-Save State

When no active save exists, the new-session choices should become the main content.

Requirements:

- Do not render an empty resume panel.
- `Start Career` is primary.
- `Quick Tournament` is secondary but prominent enough for fast play.
- Save trust copy should be compact, such as `Local slot: Empty`.
- The page should not feel like it has a missing left column.

### 6.4 Corrupt Or Quarantined Save State

Recovery must be visible, but it should not dominate the whole menu.

Requirements:

- Render one clear recovery strip or compact recovery block.
- Point the user to `Save Tools` / `Review Recovery`.
- Avoid repeating the same warning in the hero, trust strip, and utility area.
- Keep the warning keyboard reachable and screen-reader visible.

## 7. Visual Design Requirements

### 7.1 Compress The Hero

The current hero can become more useful by becoming tighter and more contextual.

Recommended direction:

- Keep `Badminton Manager` as the visible `h1`.
- Reduce top hero padding and height.
- Consider moving save status into a compact inline treatment.
- Avoid a second large card-like block above the real launch decision.

The hero should behave like a title bar for the launch decision, not a landing-page hero.

### 7.2 Strengthen The Primary Action

The primary launch action should be unmistakable.

Requirements:

- In active-save states, `Continue Career` / `Continue Tournament` should be visually largest among buttons.
- Only one button should use the strongest green treatment.
- Hover and focus states should feel tactile without changing layout size.
- Button text must not wrap awkwardly at mobile widths.

Priority model:

\[
\text{Visual Priority}
=
\frac{\text{importance} \times \text{usage frequency}}
{\text{nearby visual competition}}
\]

By that model, continuing the active save should outrank every other visible action.

### 7.3 Introduce Badminton-Specific Atmosphere

The start menu should feel like it belongs to a badminton management game, not a generic operations tool.

Acceptable additions:

- subtle badminton court-line geometry in the background,
- a small racket or shuttle-inspired mark in the hero or resume panel,
- restrained linework behind the resume panel,
- rank or event details that read like a sports save dossier,
- tournament/career labels that feel like sport modes rather than app settings.

Avoid:

- decorative clutter,
- fake licensed branding,
- stock-photo darkness,
- oversized illustrations,
- animated background effects that distract from the menu.

The visual identity should be quiet but specific:

\[
\text{Atmosphere}
=
\text{sport signal}
+ \text{management discipline}
- \text{decorative noise}
\]

### 7.4 Simplify Secondary Groups

The right column can be made easier to scan.

Recommended grouping:

```text
Start New
Career Program
Quick Tournament

Manage
Save Tools
Preferences
```

or:

```text
Start Something New
[Career Program] [Quick Tournament]

Local Setup
[Save Tools] [Preferences]
```

Requirements:

- Avoid making `Secondary Paths` a dominant label.
- Keep section labels short.
- Make start modes visually distinct from utilities.
- Do not use nested cards.

### 7.5 Make The Save Trust Strip Earn Its Space

The save trust strip is useful, but it should stay lightweight.

Requirements:

- Keep it compact on desktop.
- Stack cleanly on mobile.
- Do not duplicate the recovery warning if the recovery strip is already visible.
- Prefer short values:

```text
Local slot: Career ready
Storage: Browser local
Quarantine: None
Export: Save Tools
```

If it creates visual clutter, consider merging it into a footer-like strip below the utilities.

## 8. Implementation Notes

### 8.1 `SetupView.tsx`

Current structure begins with:

```tsx
<section className="screen-shell start-screen start-screen-redesign">
```

Key areas:

- `start-hero`
- `start-recovery-strip`
- `launchLayoutClass`
- `start-resume-panel`
- `start-resume-main`
- `start-resume-action-block`
- `start-new-panel`
- `start-mode-grid`
- `start-utility-strip`
- `start-save-trust-strip`
- `renderSelectionModal()`

Keep the athlete selection modal stable. This ticket concerns the start menu surface around it.

### 8.2 `App.tsx`

Inspect:

- `buildLaunchSaveSummary`
- `LaunchSaveSummary`
- `shouldRenderLaunchShell`
- `LaunchTopBar`
- props passed into `SetupView`

The existing `LaunchSaveSummary` shape is intentionally small and presentational:

```ts
interface LaunchSaveSummary {
  mode: "career" | "quickTournament";
  title: string;
  managedName: string;
  context: string;
  nextAction: string;
  primaryActionLabel: string;
  readiness?: number;
  details: Array<{ label: string; value: string }>;
}
```

Prefer improving presentation with the current fields. Add fields only if needed for a meaningful player-facing save summary.

### 8.3 `styles.css`

Keep CSS changes scoped under `.start-screen-redesign` and launch-shell selectors where possible.

Likely selectors:

- `.command-shell-launch`
- `.launch-topbar`
- `.start-screen-redesign`
- `.start-hero`
- `.start-layout`
- `.start-layout-empty`
- `.start-layout-has-save`
- `.start-resume-panel`
- `.start-resume-action-block`
- `.start-new-panel`
- `.start-mode-card`
- `.start-utility-strip`
- `.start-utility-card`
- `.start-save-trust-strip`
- `.start-recovery-strip`

Do not accidentally compress career portal pages or managed match screens.

## 9. Responsive Requirements

### Desktop

Target viewports:

```text
2048 x 1152
1440 x 900
1366 x 768
```

Requirements:

- Primary action visible without scrolling.
- Hero does not consume excessive height.
- Active save panel feels dominant but not oversized.
- Right-side start paths remain readable.
- Utilities and save trust do not create a heavy lower dashboard.
- No text overlap or horizontal overflow.

### Tablet

Target viewports:

```text
820 x 1180
768 x 1024
```

Requirements:

- Resume panel appears before secondary paths.
- Start mode cards can become a two-column or single-column group depending on width.
- Utility controls stay reachable without visual crowding.

### Mobile

Target viewports:

```text
390 x 844
375 x 667
```

Required order:

1. `Badminton Manager` title and concise launch copy,
2. recovery warning if present,
3. resume panel if present,
4. `Start Career`,
5. `Quick Tournament`,
6. `Save Tools`,
7. `Preferences`,
8. save trust details.

Mobile may scroll. It must not require horizontal scrolling.

## 10. Accessibility Requirements

- Keep one visible `h1` with `Badminton Manager`.
- Preserve keyboard access to:
  - `Continue Career`,
  - `Continue Tournament`,
  - `Start Career`,
  - `Quick Tournament`,
  - `Save Tools`,
  - `Preferences`,
  - `Review Recovery`.
- Keep focus outlines visible.
- Do not rely on hover-only labels.
- Avoid duplicate button labels where possible.
- Long athlete names, event names, and next-action text must wrap or truncate without hiding controls.
- Background court-line styling must not reduce text contrast.

## 11. Unit Test Requirements

Update `tests/unit/setup-view.test.tsx` if markup or labels change.

Required coverage:

- No-save state shows `Badminton Manager`, `Start Career`, `Quick Tournament`, `Save Tools`, and `Preferences`.
- No-save state does not show a blank resume panel.
- Active career save shows managed name, context, readiness if supplied, next action, and `Continue Career`.
- Active quick tournament save uses tournament language and `Continue Tournament`.
- Corrupt save state shows one recovery notice and the recovery action.
- Career selection modal still opens and requires explicit athlete confirmation.
- Quick tournament modal still opens and requires explicit athlete/tactic confirmation.

Update `tests/unit/app-career-shell.test.tsx` if launch-shell rendering changes.

## 12. E2E Requirements

Update `e2e/app.spec.ts` or add a focused launch spec.

Required scenarios:

- Clean local storage starts at the launch screen.
- `Start Career` opens the athlete selection dialog.
- `Quick Tournament` opens the quick tournament flow.
- `Save Tools` opens the save manager.
- `Preferences` opens settings.
- Active career save returns to launch with a clearly dominant resume panel.
- Corrupt or quarantined save exposes recovery without duplicating warnings.
- Mobile viewport has no horizontal overflow.

Recommended overflow assertion:

```ts
const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
expect(overflow).toBeLessThanOrEqual(0);
```

## 13. Visual QA Checklist

Capture or refresh screenshots for:

```text
start-empty-desktop
start-empty-mobile
start-career-save-desktop
start-career-save-mobile
start-quick-save-desktop
start-recovery-warning-desktop
```

Inspect each screenshot for:

- one obvious primary action,
- active save panel dominance when a save exists,
- no oversized hero competing with launch choices,
- no nested-card visual noise,
- no duplicated recovery warning,
- no text clipping inside buttons,
- no low-contrast critical labels,
- badminton-specific visual identity is present but restrained,
- utilities remain findable but secondary,
- no horizontal overflow.

## 14. Acceptance Criteria

- [ ] Saved-career state makes `Continue Career` the clear primary action.
- [ ] Saved-quick-tournament state uses tournament-specific continuation language.
- [ ] No-save state makes `Start Career` and `Quick Tournament` the main launch choices.
- [ ] The hero is tighter and does not compete with the main decision area.
- [ ] Secondary paths and utilities are grouped more naturally.
- [ ] `Save Tools` and `Preferences` remain easy to find while visually secondary.
- [ ] The start menu includes restrained badminton-specific visual identity.
- [ ] Save trust and recovery information is visible without repetition.
- [ ] Visible copy stays player-facing and does not mention implementation mechanics.
- [ ] Unit tests cover major launch states.
- [ ] E2E or screenshot QA covers desktop and mobile.
- [ ] No verified viewport shows text overlap, clipping, or horizontal overflow.

## 15. Verification Commands

Run from `BadmintonManager`:

```bash
npm run build
npm run test
npm run test:e2e
```

Focused checks during iteration:

```bash
npm run test -- tests/unit/setup-view.test.tsx
npm run test -- tests/unit/app-career-shell.test.tsx
npx playwright test e2e/app.spec.ts
```

## 16. Suggested Implementation Sequence

1. Capture the current start menu in saved-career, no-save, quick-save, and recovery states.
2. Reduce hero height and rebalance the first viewport.
3. Reposition or restyle next-action copy near the primary continue button.
4. Simplify secondary path grouping and utility visual weight.
5. Add restrained badminton-specific visual treatment.
6. Tune desktop first, then tablet and mobile.
7. Update unit tests for any changed labels or structure.
8. Update e2e coverage and screenshot QA artifacts.
9. Run full verification.

## 17. Definition Of Done

This ticket is done when the start menu feels like a polished front door for a badminton management game:

\[
\text{resume with confidence}
+ \text{start deliberately}
+ \text{manage local saves safely}
+ \text{feel the sport immediately}
\]

The player should never need to decode competing panels, wonder which button matters most, or mistake the launch menu for a generic dashboard.
