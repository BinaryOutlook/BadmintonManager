# TIX-003: Rebuild Start Screen Into A Proper Launch Experience

Status: Draft implementation ticket
Priority: High
Target project: `BadmintonManager`
Target screen: `Start Screen` / launch entry
Prepared on: 2026-05-18
Primary files: `components/SetupView.tsx`, `app/App.tsx`, `styles.css`, `e2e/app.spec.ts`

## 1. Problem Statement

The current start screen works mechanically, but it does not feel like a designed launch experience. It reads as a generic array of action cards dropped into the normal management shell:

```text
Continue | Start New Career | Quick Tournament | Load Save | Preferences
```

That structure is too flat. It gives almost the same visual treatment to very different jobs:

- resume an active save,
- start a permanent career,
- launch a disposable tournament,
- manage local files,
- adjust preferences.

The result feels awkward because the player is not being guided through a launch decision. They are being shown a card grid.

The start screen should answer:

**What can I continue?; What can I start?; What is safe to change?; What happens if I click this?**

The current screen answers those questions, but weakly. It wastes space, lacks a strong focal point, and inherits too much career-era chrome for a pre-launch context.

## 2. Current UX Diagnosis

The screenshot exposes several problems:

1. **The page is visually flat.** `Continue`, `Start New Career`, `Quick Tournament`, `Load Save`, and `Preferences` are all treated as similar rectangular tiles, even though they have different importance.
2. **The layout feels like an array.** The cards sit in a grid because the code maps well to boxes, not because the user decision naturally wants that shape.
3. **The active save is under-explained.** `Continue` is primary, but the screen does not show enough about what will be resumed: athlete, date, next match, career stage, save health, and current risk should be visible.
4. **The normal career shell competes with launch mode.** The sidebar, topbar status, and global CTA can make a start screen feel like an in-career page instead of the front door.
5. **The right side and lower page waste space.** The grid occupies a small band, then leaves a large empty field. This looks unfinished rather than calm.
6. **The topbar can show contradictory action weight.** A launch screen should not visually compete with a topbar CTA such as `Play National Command Championship R16` unless the user is already inside a save context.
7. **The copy is too implementation-facing.** Phrases like "blocking launch modal" describe the software design, not the player's choice.

## 3. Objective

Rebuild the start screen into a proper launch hub with clear hierarchy:

**Primary resume + career start + quick run + save tools + preferences → confident first action**

The screen should feel intentional, game-like, and management-grade. It should not become a marketing landing page, but it should have a stronger sense of place than five cards on a dark canvas.

## 4. Scope

### In Scope

- Redesign the `SetupView` start screen layout.
- Add a proper launch-mode visual hierarchy.
- Make the active save panel richer and more informative.
- Make `Start New Career` and `Quick Tournament` clearly distinct paths.
- Move `Load Save` and `Preferences` into lower-weight utility controls.
- Reduce or adjust shell chrome when the app is in pure launch mode.
- Replace implementation-facing copy with player-facing labels.
- Add responsive behavior for desktop, tablet, and mobile.
- Update e2e tests and screenshots.

### Out Of Scope

- No change to the athlete selection modal behavior unless labels need to be updated.
- No change to save serialization.
- No change to career creation rules.
- No change to quick tournament simulation rules.
- No backend, accounts, cloud saves, or authentication.
- No copied Football Manager or BWF branding, trade dress, assets, or wording.

## 5. Product Principle

The start screen is not a dashboard. It is a decision gate.

The UX should optimize:

**Launch Clarity = (confidence in next click + save trust) / (choice ambiguity + chrome noise)**

Everything on the screen should help the player either resume safely, start deliberately, or manage local data.

## 6. Proposed Information Architecture

### 6.1 Launch Shell

The start screen should have a lighter shell than the career portal.

Recommended behavior:

- If no active save is loaded, hide or minimize the full command rail.
- If an active career save exists, allow the shell to show status, but do not let in-career navigation dominate the launch screen.
- The topbar should keep brand, command/search, settings, and maybe save state.
- The topbar should not show a live-match or event CTA as the visual king of the start screen unless the primary page action is explicitly "Resume active save".

Suggested launch shell:

```text
BM | Search / Command                         Save: Career loaded | Settings
```

Avoid this on the launch page:

```text
BM | Search | Date | Career Save | Team | Intel | Settings | PLAY EVENT R16
```

That second version makes the start screen feel like a career page with a reset grid pasted into it.

### 6.2 Screen Identity

Replace `Start Screen` as the main headline. It is technically accurate, but bland.

Better headline options:

| Current | Better |
| --- | --- |
| Start Screen | Badminton Manager |
| Start Screen | Command Center |
| Start Screen | Career Launch |
| Launch Control | Save Launch |

Recommended MVP headline:

```text
Badminton Manager
```

Supporting copy:

```text
Resume your local save, build a locked career, or run a disposable tournament.
```

This is player-facing and concise.

### 6.3 Primary Resume Panel

If an active compatible save exists, the resume panel should be the dominant object.

It should show:

- save type: career or quick tournament,
- managed athlete/team name,
- current date,
- current stage,
- next required action,
- event or bracket context,
- readiness or risk if career data exists,
- last saved/local slot health.

Target presentation:

```text
Resume Career
Three-Lung Dynamo
2026-07-22 | National Command Championship R16 | Readiness 68
Next: Play R16 match

[Continue]
```

This gives the player confidence. `Continue` should not be a giant green button floating in a mostly empty panel without save context.

### 6.4 New Session Choices

`Start New Career` and `Quick Tournament` should be grouped as mode choices, not isolated cards.

Target presentation:

```text
Start Something New

Career Save
Locked athlete, persistent local program, calendar, training, scouting, event progression.
[Start Career]

Quick Tournament
One-off athlete, tactic pick, bracket run, no career calendar commitment.
[Quick Run]
```

The two paths should be visually related, with clear differences:

- Career is long-term and persistent.
- Quick Tournament is disposable and immediate.

### 6.5 Save And System Utilities

`Load Save` and `Preferences` are utilities. They should not compete with resume or start choices.

Target presentation:

```text
Save Tools: Load / Import / Export / Recover
Preferences: Accent / display / session settings
```

Possible UI:

- compact utility row,
- small command strip,
- secondary buttons in the lower-right area,
- or a slim footer beneath the main launch decision area.

They should remain easy to find, but they should not look like equal launch modes.

### 6.6 Save Trust Strip

The launch page should surface local save trust clearly.

Target content:

```text
Local slot: Career save loaded
Storage: Browser local
Quarantine: None
Export: Available from Save Tools
```

If corrupted/quarantined save data exists, show a clear warning:

```text
Quarantine present. Open Save Tools to review recovery options.
```

This supports the local-first product promise without making the page feel like a debug console.

## 7. Proposed Desktop Layout

Use a composed launch layout rather than a uniform grid.

Recommended desktop structure:

```text
+--------------------------------------------------------------------------------+
| Badminton Manager                                            Local slot status |
| Resume your local save, build a career, or run a tournament.                   |
+-----------------------------------------+--------------------------------------+
| Resume Career                           | Start Something New                  |
| Three-Lung Dynamo                       | Career Save                          |
| 2026-07-22 | R16 | Readiness 68         | Long-term program                    |
| Next: Play R16 match                    | [Start Career]                       |
| [Continue]                              |                                      |
|                                         | Quick Tournament                     |
|                                         | Disposable bracket run               |
|                                         | [Quick Run]                          |
+-----------------------------------------+--------------------------------------+
| Save Tools: Load / Import / Export / Recover       Preferences                 |
+--------------------------------------------------------------------------------+
```

If there is no active save, the layout should rebalance:

```text
+--------------------------------------------------------------------------------+
| Badminton Manager                                                              |
| Build a career or jump into a disposable tournament.                           |
+-----------------------------------------+--------------------------------------+
| Start Career                            | Quick Tournament                     |
| Locked athlete, calendar, program       | One-off athlete and tactic modal     |
| [Start Career]                          | [Quick Run]                          |
+-----------------------------------------+--------------------------------------+
| Save Tools                                           Preferences               |
+--------------------------------------------------------------------------------+
```

## 8. Visual Direction

The page should still belong to the existing app: dark, sharp, green-accented, management-focused. But it needs one strong first-viewport signal.

Recommended visual options:

1. **Subtle badminton court backdrop.** Use a low-contrast court texture, rendered CSS grid, or generated bitmap background. It should not make text harder to read.
2. **Save dossier panel.** The active save panel can feel like a dossier: athlete name, date, next action, health, cash, event.
3. **Mode selector panel.** Career and quick tournament can appear as two deliberate launch options with different icons or compact visual marks.

Avoid:

- decorative gradient blobs,
- oversized hero cards,
- generic marketing hero copy,
- copying FM screens,
- visual assets that obscure the actual controls,
- making every card the same size just because CSS grid makes it easy.

## 9. Copy Direction

Replace implementation-facing language with player-facing language.

| Current Copy | Issue | Suggested Copy |
| --- | --- | --- |
| `Continue the local slot, create one locked career athlete, or open a disposable tournament selection modal.` | Too technical and wordy | `Resume your save, build a career, or jump into a tournament.` |
| `Open the playstyle-first athlete lock modal before creating a career program.` | Talks about modal mechanics | `Choose a locked athlete and build a long-term career program.` |
| `Choose the one-off athlete and tactic inside a blocking launch modal.` | "blocking modal" is implementation language | `Pick an athlete and tactic for a one-off bracket run.` |
| `Preview imports, export the current slot, or recover a quarantined local file.` | Useful, but too heavy for a card | `Import, export, or recover local saves.` |
| `Adjust display accent and session-level controls before starting.` | Serviceable but bland | `Tune display, accent, and session settings.` |

## 10. Component Implementation Notes

### 10.1 Main Component

Primary target:

- `BadmintonManager/components/SetupView.tsx`

Current start screen begins around:

```tsx
<section className="screen-shell start-screen">
```

Current action grid:

```tsx
<section className="start-action-grid" aria-label="Start screen actions">
```

Replace the flat card grid with a composed layout, for example:

```tsx
<section className="screen-shell start-screen start-screen-redesign">
  <div className="start-hero">
    ...
  </div>

  <section className="start-layout" aria-label="Launch options">
    <article className="start-resume-panel">...</article>
    <section className="start-new-panel">...</section>
    <section className="start-utility-strip">...</section>
  </section>

  {renderSelectionModal()}
</section>
```

### 10.2 App Shell Coordination

Potential target:

- `BadmintonManager/app/App.tsx`

Investigate whether the start route should receive a launch-shell state. The ticket should not force a full shell rewrite, but the implementation should prevent the start page from feeling like an active career screen.

Possible approach:

```ts
const isLaunchPage = phase === "setup" && activePage.id === "portal";
```

Then use `isLaunchPage` to:

- simplify topbar status,
- suppress irrelevant live career CTA,
- optionally collapse or hide sidebar groups that cannot be used before launching,
- keep settings reachable.

If hiding the sidebar is too risky, keep it but visually de-emphasize disabled career commands during launch.

### 10.3 Save Metadata

Use existing props and store data rather than inventing new persistence:

- `props.activeSavePresent`
- `props.corruptSavePresent`
- `props.careerPresent`
- current career state from app props if available,
- selected player if no career exists,
- save manager actions already passed to `SetupView`.

If `SetupView` does not currently receive enough metadata to render a useful active save dossier, pass a small summary object rather than the whole store:

```ts
interface LaunchSaveSummary {
  mode: "career" | "quickTournament" | "empty";
  title: string;
  date?: string;
  managedName?: string;
  nextAction?: string;
  eventLabel?: string;
  readiness?: number;
  stage?: string;
}
```

This keeps `SetupView` presentational and avoids coupling it to deep career internals.

## 11. CSS Implementation Notes

Primary CSS target:

- `BadmintonManager/styles.css`

Current selectors:

- `.start-action-grid`
- `.start-action-panel`
- `.start-action-panel-primary`

Prefer adding new scoped classes instead of heavily mutating shared command panel styling:

```css
.start-screen-redesign { ... }
.start-hero { ... }
.start-layout { ... }
.start-resume-panel { ... }
.start-new-panel { ... }
.start-mode-card { ... }
.start-utility-strip { ... }
.start-save-trust-strip { ... }
```

Possible desktop grid:

```css
.start-layout {
  display: grid;
  grid-template-columns: minmax(0, 1.25fr) minmax(22rem, 0.75fr);
  grid-template-areas:
    "resume modes"
    "utilities utilities";
  gap: 0.85rem;
}
```

If no active save exists:

```css
.start-layout-empty {
  grid-template-columns: repeat(2, minmax(0, 1fr));
  grid-template-areas:
    "career quick"
    "utilities utilities";
}
```

## 12. State-Based Layout Requirements

### 12.1 Active Career Save Exists

Primary action:

```text
Continue Career
```

Required visible facts:

- athlete/team name,
- career date,
- current stage,
- next action,
- event or match if relevant,
- readiness if available.

`Start New Career` must still be available, but visually secondary and protected by the existing replacement confirmation if applicable.

### 12.2 Active Quick Tournament Exists

Primary action:

```text
Continue Tournament
```

Required visible facts:

- selected athlete,
- current round or next opponent,
- bracket state if available,
- whether a match is waiting.

### 12.3 No Active Save

Primary actions:

```text
Start Career
Quick Tournament
```

These should be equal or near-equal in weight, with a slight preference for `Start Career` because it is the deeper product path.

### 12.4 Corrupt Save Or Quarantine Present

Show a visible warning strip:

```text
Recovery available. A quarantined local file needs review.
```

The warning should point to Save Tools without hijacking the whole screen.

## 13. Responsive Behavior

### Desktop

Target:

- no awkward empty lower half,
- resume and new-session paths visible above the fold,
- utilities visible without scrolling,
- topbar does not overpower the launch content.

### Tablet

Use a two-column layout if width allows:

```text
Resume
Career | Quick
Utilities
```

If the sidebar remains visible, ensure the content does not become squeezed.

### Mobile

Stack in this priority:

1. headline and local slot status,
2. resume panel if present,
3. start career,
4. quick tournament,
5. save tools,
6. preferences,
7. recovery warning if present, unless urgent.

Mobile can scroll, but must not horizontally overflow.

## 14. Accessibility Requirements

- Keep a visible `h1`; if the headline changes from `Start Screen` to `Badminton Manager`, update tests accordingly.
- Use clear button labels:
  - `Continue Career`
  - `Continue Tournament`
  - `Start Career`
  - `Quick Tournament`
  - `Save Tools`
  - `Preferences`
- Avoid duplicate identical button names where possible. If duplicate labels are necessary, provide accessible context.
- Preserve keyboard access for all launch actions.
- Keep focus visible, especially around the primary resume panel.
- Do not hide save warnings behind hover.
- Make long save names wrap without breaking the layout.

## 15. Acceptance Criteria

- [ ] The start screen no longer appears as a flat array of similarly weighted cards.
- [ ] The screen has a clear primary action based on save state.
- [ ] Active saves show enough metadata for the player to trust `Continue`.
- [ ] `Start Career` and `Quick Tournament` are presented as distinct launch modes.
- [ ] `Load Save` and `Preferences` are demoted into utility controls without becoming hard to find.
- [ ] Implementation-facing copy such as "blocking launch modal" is removed from visible start-screen text.
- [ ] The launch screen does not feel visually dominated by career sidebar/topbar actions.
- [ ] Corrupt/quarantined save state remains visible and actionable.
- [ ] The athlete selection modal still opens for career and quick tournament flows.
- [ ] The page is stable at desktop, tablet, and mobile widths with no text overlap or horizontal overflow.

## 16. Verification Plan

Run:

```bash
npm run build
npm run test
npm run test:e2e
```

Update `BadmintonManager/e2e/app.spec.ts`:

- If the `h1` changes, replace `Start Screen` expectations with the new heading.
- Keep coverage that verifies:
  - career launch modal opens,
  - quick tournament modal opens,
  - save tools open,
  - preferences open,
  - mobile layout does not overflow.

Add or update screenshots:

```text
start-screen-empty-desktop
start-screen-empty-mobile
start-screen-active-save-desktop
start-screen-active-save-mobile
start-screen-recovery-warning
```

Viewport checks:

```text
2048 x 1152
1440 x 900
390 x 844
```

Manual visual checks:

- primary action is obvious within two seconds,
- no giant blank area after the launch controls,
- utility actions feel secondary,
- active save metadata is readable,
- no copied FM/BWF branding or trade dress,
- topbar and sidebar do not contradict launch state.

## 17. Suggested Implementation Steps

1. Add a `LaunchSaveSummary` or equivalent summary in `App.tsx`.
2. Pass the summary into `SetupView`.
3. Replace the `start-action-grid` card array with a composed launch layout.
4. Rewrite visible copy to be player-facing.
5. Add scoped start-screen CSS classes.
6. Add active-save, empty-save, and quarantine layout states.
7. Adjust shell behavior for launch mode if needed.
8. Update e2e heading/button expectations.
9. Capture screenshots and tune spacing.
10. Run the full verification commands.

## 18. Risks

- Hiding too much shell chrome could make navigation feel inconsistent. Mitigate by keeping brand, settings, and save tools visible.
- Showing too much active-save data could turn the start screen into another dashboard. Mitigate by limiting the resume panel to the next action and a few trust signals.
- Changing button labels can break e2e tests. Update helpers such as `startNewCareer(...)` and `startQuickTournamentFromModal(...)` carefully.
- New visual background assets could hurt readability. Keep any court/backdrop treatment subtle and verify contrast.

## 19. Definition Of Done

The ticket is done when the start screen feels like a deliberate front door:

**Resume safely; or; start a career; or; run a quick tournament**

is immediately legible, while save tools and preferences remain available without competing for the player's first click.
