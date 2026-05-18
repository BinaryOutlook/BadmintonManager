# TIX-005: Polish Start Screen Hierarchy And Visual QA

Status: Draft implementation ticket
Priority: High
Target project: `BadmintonManager`
Target screen: `Start Screen` / launch entry
Prepared on: 2026-05-18
Primary files: `components/SetupView.tsx`, `app/App.tsx`, `styles.css`, `tests/unit/setup-view.test.tsx`, `tests/unit/app-career-shell.test.tsx`, `e2e/app.spec.ts`
Reference input: `docs/rescue_MVP/plan4.md`, `docs/rescue_MVP/arc_tix/TIX-003-better-start-screen.md`

## 1. Problem Statement

The archived start-screen ticket already identified the correct product direction: the launch page should not feel like a flat grid of equal cards. The current implementation has moved toward a proper launch hub, with classes such as:

```text
start-screen-redesign
start-hero
start-layout
start-resume-panel
start-new-panel
start-utility-strip
start-save-trust-strip
```

However, the plan4 note is still valid:

> the start screen is now present, but it still needs to be sharper; it feels cluttered, under-tested, and not yet fully resolved as UI/UX.

This ticket is a focused polish and verification pass. It should not restart the start-screen concept from scratch. It should take the current launch hub and make it feel deliberately composed, tested across states, and clear at first glance.

## 2. User-Facing Diagnosis

The risk with the current start screen is that it can still become visually busy even after the rebuild:

1. **Too many panels may compete.** Hero, active slot, new session, utilities, save trust, and recovery notices can all carry borders and headings.
2. **Save trust can become repetitive.** `Local slot`, `Storage`, `Quarantine`, and `Export` are useful, but they should not duplicate the hero status and recovery strip in a noisy way.
3. **The active save needs to dominate only when it exists.** With no save, `Start Career` and `Quick Tournament` should become the main decision. With a save, `Continue Career` or `Continue Tournament` should clearly be first.
4. **Launch shell chrome must stay quiet.** The start screen should feel like the front door, not a normal career page wearing a launch label.
5. **The page needs real visual QA.** It must be inspected in all important states, not just the happy path at one desktop size.

The goal is not more decoration. It is better decision clarity.

\[
\text{Launch Quality}
=
\frac{\text{primary action clarity} + \text{save confidence} + \text{clean hierarchy}}
{\text{panel noise} + \text{copy clutter} + \text{unverified states}}
\]

## 3. Objective

Polish the start screen so it feels like an intentional launch surface:

```text
No active save:
Badminton Manager
Start Career | Quick Tournament
Save Tools | Preferences

Active career save:
Resume Career
Three-Lung Dynamo
Next: Play R16 match
Continue Career
Start Something New | Save Tools | Preferences
```

The finished screen should answer these questions in under three seconds:

- What can I continue?
- What can I start?
- Is my local save safe?
- Which action is primary right now?

## 4. Scope

### In Scope

- Audit and polish the current `SetupView` launch layout.
- Reduce visual clutter from competing panels, headings, borders, and repeated status strips.
- Tune the no-save, active-career-save, active-quick-tournament, and corrupt-save states.
- Tighten visible copy so it is player-facing and concise.
- Make the active save panel feel trustworthy and useful without becoming oversized.
- Ensure `Start Career` and `Quick Tournament` remain distinct launch paths.
- Keep `Save Tools` and `Preferences` visible but secondary.
- Confirm launch shell topbar/sidebar behavior does not dominate the start screen.
- Add or update unit and e2e tests.
- Add screenshot verification notes or artifacts for key launch states.

### Out Of Scope

- No change to save serialization.
- No new cloud save, account, backend, or authentication flow.
- No change to career creation rules.
- No change to quick tournament match rules.
- No new athlete data model.
- No copied Football Manager, BWF, or third-party trade dress.
- No broad redesign of career portal pages.

## 5. Product Principle

The start screen is a decision gate, not a dashboard.

\[
\text{Start Screen}
\neq
\text{Career Command Center}
\]

It should not try to show every system. It should guide the player into one of four launch actions:

1. continue,
2. start career,
3. start quick tournament,
4. manage local setup.

Any element that does not support one of those jobs should be shortened, merged, or removed.

## 6. Required Launch States

### 6.1 No Active Save

This state should be calm and direct.

Target hierarchy:

```text
Badminton Manager
Build a career or jump into a disposable tournament.

Career Program        Quick Tournament
[Start Career]        [Quick Tournament]

Save Tools            Preferences
```

Requirements:

- `Start Career` and `Quick Tournament` are the primary choices.
- `Start Career` can be slightly more prominent because it is the deeper product path.
- Do not show a large empty resume panel.
- Do not show a heavy `Local slot` dossier that says little more than "empty".
- Save tools remain reachable.
- Preferences remain reachable.

### 6.2 Active Career Save

The resume panel should become the focal point.

Target:

```text
Resume Career
Three-Lung Dynamo
2026-07-22 | National Command Championship R16 | Readiness 68
Next: Play R16 match
[Continue Career]
```

Requirements:

- The panel shows managed name, date, stage/context, next action, save health, and readiness if available.
- The `Continue Career` button is unmistakably primary.
- `Start Career` is still available but visually secondary and protected by existing confirmation behavior.
- `Quick Tournament` remains available as a separate disposable path.
- The panel should not become so tall that utilities disappear on common laptop viewports.

### 6.3 Active Quick Tournament Save

If the saved slot is a quick run, the resume panel should say so.

Target:

```text
Continue Tournament
Selected athlete
Current round or next match
Next: Enter Match
[Continue Tournament]
```

Requirements:

- Do not label this as a career.
- Show enough tournament context for the player to trust the continuation.
- Keep career creation available as a secondary path.

### 6.4 Corrupt Or Quarantined Save

Recovery state must be visible, but it should not blow up the page.

Target:

```text
Recovery available. A quarantined local file needs review.
[Review Recovery]
```

Requirements:

- Use one clear warning strip or compact warning block.
- Avoid showing the same recovery warning in three places.
- Link the action to Save Tools or the existing recovery view.
- The warning must be keyboard reachable and screen-reader visible.

## 7. Layout And Visual Requirements

### 7.1 Reduce Panel Competition

The launch screen should not be a stack of equally loud cards.

Recommended hierarchy:

```text
Level 1: primary resume or primary new-session choice
Level 2: alternate start mode
Level 3: save tools and preferences
Level 4: supporting save trust details
```

Implementation guidance:

- Use fewer heavy borders.
- Keep one dominant panel at most.
- Avoid cards inside cards.
- Use compact rows for utility/status details.
- Keep section headings short.
- Make whitespace intentional rather than empty.

### 7.2 Save Trust Strip

The existing `start-save-trust-strip` is useful, but it should be checked for duplication.

Keep it only if it earns its space.

Possible compact version:

```text
Local slot: Career ready | Storage: Browser local | Quarantine: None | Export: Save Tools
```

Requirements:

- On desktop, this can be a one-line strip or two compact rows.
- On mobile, it can stack.
- Do not repeat a warning already shown in the recovery strip unless the copy is meaningfully different.
- If no save exists, use restrained copy such as `Local slot: Empty`.

### 7.3 Copy Polish

Visible text should be player-facing, not implementation-facing.

Keep:

```text
Resume your save, build a career, or jump into a tournament.
Choose a locked athlete and build a long-term career program.
Pick an athlete and tactic for a one-off bracket run.
Import, export, preview, or recover local saves.
```

Avoid:

```text
blocking launch modal
session-level controls
write a slot first
selection modal
```

If `Write a slot first` appears in the save trust strip, replace it with a calmer phrase:

```text
No export yet
```

or:

```text
Available after save
```

### 7.4 Launch Shell

The launch shell should stay quieter than the launch content.

Requirements:

- `LaunchTopBar` keeps brand, local save status, and settings.
- The topbar should not show event or match CTAs that belong inside an active save.
- Sidebar should be absent or minimized in pure launch mode.
- If a save exists and the shell appears, it must not visually overpower the start decision.

## 8. Implementation Notes

### 8.1 `SetupView.tsx`

The current rendered structure begins around:

```tsx
<section className="screen-shell start-screen start-screen-redesign">
```

Key areas to inspect:

- `start-hero`
- `start-hero-status`
- `start-recovery-strip`
- `launchLayoutClass`
- `start-resume-panel`
- `start-new-panel`
- `start-mode-grid`
- `start-utility-strip`
- `start-save-trust-strip`
- `renderSelectionModal()`

Do not break the athlete selection modal. This ticket is primarily about the launch surface around it.

### 8.2 `App.tsx`

Inspect:

- `buildLaunchSaveSummary`
- `shouldRenderLaunchShell`
- `LaunchTopBar`
- props passed into `SetupView`

If the start page lacks metadata for a useful resume panel, pass a small summary object rather than coupling `SetupView` to deep app state.

Existing shape:

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

Keep this small and presentational.

### 8.3 CSS Targets

Primary CSS file:

- `styles.css`

Likely selectors:

- `.command-shell-launch`
- `.launch-topbar`
- `.launch-topbar-status`
- `.start-screen-redesign`
- `.start-hero`
- `.start-hero-copy`
- `.start-hero-status`
- `.start-recovery-strip`
- `.start-layout`
- `.start-layout-empty`
- `.start-layout-has-save`
- `.start-resume-panel`
- `.start-new-panel`
- `.start-mode-grid`
- `.start-mode-card`
- `.start-utility-strip`
- `.start-utility-card`
- `.start-save-trust-strip`

Prefer scoped updates under `.start-screen-redesign` so normal career pages are not accidentally compressed.

## 9. Responsive Requirements

### Desktop

Target viewports:

```text
2048 x 1152
1440 x 900
1366 x 768
```

Requirements:

- No awkward dead lower half.
- Primary action visible without scrolling.
- Save tools and preferences visible without hunting.
- No text overlap.
- No horizontal page overflow.
- Active save panel does not swallow the whole first viewport.

### Tablet

Target:

```text
820 x 1180
768 x 1024
```

Requirements:

- Layout can become one column or two columns depending on available width.
- Primary action still appears before utility controls.
- Mode cards remain distinguishable.

### Mobile

Target:

```text
390 x 844
375 x 667
```

Required order:

1. headline and concise launch copy,
2. recovery warning if urgent,
3. resume panel if present,
4. start career,
5. quick tournament,
6. save tools,
7. preferences,
8. save trust details.

Mobile may scroll. It must not require horizontal scrolling.

## 10. Accessibility Requirements

- Keep a visible `h1` with `Badminton Manager`.
- Preserve keyboard access to:
  - `Continue Career`,
  - `Continue Tournament`,
  - `Start Career`,
  - `Quick Tournament`,
  - `Save Tools`,
  - `Preferences`,
  - recovery action.
- Do not use hover-only explanations.
- Keep focus outlines visible.
- Avoid duplicate button labels where possible; if duplicates are unavoidable, provide accessible context.
- Recovery warning should use `role="status"` or another appropriate semantic pattern.
- Long player names and event names must wrap or truncate without hiding controls.

## 11. Unit Test Requirements

Update `tests/unit/setup-view.test.tsx`.

Required coverage:

- No-save state shows `Badminton Manager`, `Start Career`, `Quick Tournament`, `Save Tools`, and `Preferences`.
- No-save state does not render an empty resume panel as the primary object.
- Active career save renders `Resume Career`, managed name, date/stage details, readiness if supplied, and `Continue Career`.
- Active quick tournament save renders tournament-specific continuation copy and `Continue Tournament`.
- Corrupt save state renders one recovery warning and a recovery action.
- Career selection modal still opens and requires explicit athlete confirmation.
- Quick tournament modal still opens and requires explicit selection.

Update `tests/unit/app-career-shell.test.tsx` if shell behavior changes.

## 12. E2E Test Requirements

Update `e2e/app.spec.ts` or add a focused launch spec if the suite is becoming crowded.

Required scenarios:

- Clean local storage starts at the launch screen.
- `Start Career` opens the athlete selection dialog.
- `Quick Tournament` opens the playstyle dialog.
- `Save Tools` opens the save manager.
- `Preferences` opens settings.
- Active career save returns to launch with a visible resume panel.
- Corrupt save or quarantine state shows recovery action.
- Mobile viewport has no horizontal overflow.

Recommended browser-side assertion:

```ts
const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
expect(overflow).toBeLessThanOrEqual(0);
```

## 13. Visual QA Checklist

Capture screenshots for:

```text
start-empty-desktop
start-empty-mobile
start-career-save-desktop
start-career-save-mobile
start-quick-save-desktop
start-recovery-warning-desktop
```

Inspect each screenshot for:

- one clear primary action,
- no obvious panel clutter,
- no repeated warnings,
- no implementation-facing copy,
- no nested-card visual noise,
- no text clipping inside buttons,
- no topbar/sidebar dominance,
- no horizontal overflow,
- balanced first viewport.

## 14. Acceptance Criteria

- [ ] The start screen no longer feels like a cluttered collection of equally weighted panels.
- [ ] No-save state makes `Start Career` and `Quick Tournament` the obvious launch choices.
- [ ] Active save state makes `Continue Career` or `Continue Tournament` the obvious primary action.
- [ ] Save trust and recovery information is visible but not repetitive.
- [ ] `Save Tools` and `Preferences` are easy to find while staying visually secondary.
- [ ] Visible copy is player-facing and does not mention implementation mechanics.
- [ ] Launch shell chrome does not overpower the start content.
- [ ] Athlete selection and quick tournament selection flows still work.
- [ ] Unit tests cover the major launch states.
- [ ] E2E or screenshot verification covers desktop and mobile.
- [ ] No text overlap, clipping, or horizontal overflow appears in verified viewports.

## 15. Verification Commands

Run from `BadmintonManager`:

```bash
npm run build
npm run test
npm run test:e2e
```

During iteration, these focused checks are acceptable:

```bash
npm run test -- tests/unit/setup-view.test.tsx
npm run test -- tests/unit/app-career-shell.test.tsx
npx playwright test e2e/app.spec.ts
```

Finish with the full verification suite before handoff.

## 16. Suggested Implementation Sequence

1. Audit screenshots for all launch states at desktop and mobile.
2. Identify repeated copy/status between hero, recovery strip, resume panel, and save trust strip.
3. Simplify the layout hierarchy in `SetupView.tsx`.
4. Scope CSS polish under `.start-screen-redesign`.
5. Tune desktop spacing first, then tablet/mobile.
6. Update unit tests for launch states.
7. Update e2e coverage for clean launch and core actions.
8. Capture final screenshots and adjust any visible clutter.
9. Run full verification.

## 17. Definition Of Done

This ticket is done when the start screen feels like a confident front door:

\[
\text{Resume if possible}
+ \text{start deliberately}
+ \text{manage local save safely}
\]

with the player never needing to decode implementation language, scan competing panels, or wonder which button is the real next step.

