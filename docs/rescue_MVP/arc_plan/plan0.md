# Rescue MVP Plan 0: Career Flow, Bracket Reuse, Selection Modals, and Match Command Center

Status: Draft technical brief  
Target project: `BadmintonManager`  
Reference image: `docs/rescue_MVP/Targeted_command_center.png`  
Prepared on: 2026-05-16

## 1. Executive Summary

This rescue pass should remove four pieces of friction that currently slow the player down or hide crucial tournament context:

1. Replace the career shell's global `Continue Career` primary action with a global `Advance Day` action where calendar advancement is valid, then remove the calendar-only `Advance Day` button from the Calendar/Event Desk.
2. Extract the successful disposable-run knockout tree from `OverviewView` into a reusable component and render it in career competition screens before and after a managed match.
3. Turn both career creation and disposable-run athlete selection into blocking pop-up flows based on the existing `Pick Your Playstyle` quick setup experience.
4. Rebuild the `Match Command Center` layout around horizontal use of space so the scoreboard, primary simulation action, live feed, tactical viewer, telemetry, and tactical options fit without routine scrolling.

The intended product equation for this pass is:

$$
\text{Fewer navigation chores} + \text{visible tournament context} + \text{forced athlete identity} + \text{one-screen match control}
\rightarrow \text{clearer coaching flow}
$$

No match-engine behavior should change in this pass. The work is primarily React composition, shell routing, layout CSS, and focused regression coverage.

## 2. Current Code Findings

### 2.1 Career Advance Day Is Calendar-Local

The calendar action exists in `components/CareerWorkbench.tsx` inside `CareerCalendarPage`, where the header renders `Career Home` and `Advance Day`. The action calls `props.onAdvanceDay`.

`app/App.tsx` wires that prop through `handleAdvanceCareerDay()`, which currently advances the store and then routes the player to either `bracket` or `calendar`:

```ts
function handleAdvanceCareerDay() {
  advanceCareerDay();
  const next = useTournamentStore.getState();
  setActivePage(next.career?.stage === "pre_match" ? { id: "bracket" } : { id: "calendar" });
}
```

The persistent topbar has a primary button, but in career mode its label is usually `Continue Career`, and `handleShellContinue()` only navigates to the career route. It does not advance the calendar.

### 2.2 The Disposable Knockout Tree Is Already Strong

The full bracket is implemented directly in `components/OverviewView.tsx`.

Important local pieces:

- `bracketRounds`
- `previousRoundName`
- `placeholderLabel(...)`
- `gridRowForMatch(...)`
- the JSX under `<div className="bracket-tree" aria-label="Knockout tree">`
- CSS under `.bracket-tree`, `.bracket-round-labels`, `.bracket-match-grid`, `.bracket-node`, and `.bracket-card-tree`

Career competition screens receive `tournament` through `CareerPageProps`, but `CareerPreMatchHubPage` and `CareerPostMatchHubPage` do not render the bracket. That is why the career event loses the clear before/after knockout context even though the underlying `TournamentState` exists.

### 2.3 Career and Quick Selection Have Diverged

`SetupView.tsx` currently has two selection experiences:

- Career creation uses `renderNewCareerAthleteDialog()`, a modal with only six recommended athletes and a compact preview.
- Quick tournament selection uses `setupMode === "quick"`, which is a full page containing the richer `Pick Your Playstyle` recommendation stage, selected operative dossier, tactic selection, and roster browse modal.

The user requirement is that both flows become blocking pop-ups. The career modal should reuse the playstyle-first quick selection quality, while the quick tournament flow should stop being a full page.

### 2.4 Match Command Center Is Vertically Stacked

`components/MatchView.tsx` currently renders:

1. screen header
2. management status strip
3. full-width scoreboard
4. full-width tactical viewer
5. three columns for telemetry, feed, and directives

The primary point simulation action is at the bottom of the directive panel. This creates a tall page and forces the player to hunt downward for the most frequent action.

The target image instead implies:

$$
\text{scoreboard} \parallel \text{primary point action}
\quad\text{above}\quad
\text{feed} \parallel \text{viewer} \parallel \text{telemetry/options}
$$

## 3. Workstream Split

| Workstream | Owner Type | Main Files | Risk | Parallelizable |
| --- | --- | --- | --- | --- |
| A. Global career day action | App shell engineer | `app/App.tsx`, `components/CareerWorkbench.tsx`, tests | Medium | Yes, after agreeing stage rules |
| B. Shared athlete selection modal | Setup/UI engineer | `components/SetupView.tsx`, `styles.css`, setup tests | Medium-high | Yes |
| C. Reusable knockout tree in career | Tournament/UI engineer | `components/OverviewView.tsx`, new bracket component, career pages, tests | Medium | Yes |
| D. Match command center layout | Live match UI engineer | `components/MatchView.tsx`, `styles.css`, e2e screenshots | High | Yes |
| E. Integration and proof | QA engineer | `tests/unit/*`, `e2e/*`, visual checks | Medium | After A-D land |

## 4. Issue A: Global Career `Advance Day`

### Problem

The player has to navigate into Calendar/Event Desk to advance the career date. The shell already has a persistent topbar primary button, but it is used as `Continue Career`, so the global control does not perform the key day-to-day manager action.

### Desired Behavior

When a career save exists and the app is not inside an unresolved match transition, the topbar primary button should read `Advance Day` and call the same store action as the calendar page.

Recommended stage rules:

| Career / phase state | Topbar primary label | Action |
| --- | --- | --- |
| `career.stage` is `planning`, `event_entered`, or `event_complete` | `Advance Day` | Call `handleAdvanceCareerDay()` |
| `career.stage` is `pre_match` and `phase !== "match"` | `Open Live Desk` or `Enter Match` | Route to bracket/pre-match hub |
| `career.stage` is `post_match` | `Review Match` | Route to post-match review |
| `phase === "match"` | match-specific continuation | Keep live match behavior |
| no career, active quick save | `Continue Save` | Existing quick-save behavior |

This preserves game integrity: advancing the date is available from any normal career page, while pre-match/post-match states still force the player to resolve the competition state instead of accidentally skipping it.

### Implementation Notes

- Update `continueLabel` and `handleShellContinue()` in `app/App.tsx`.
- Add a helper such as `canAdvanceCareerDate(career, phase)` to avoid duplicating stage logic.
- Use `handleAdvanceCareerDay()` as the topbar action when `canAdvanceCareerDate(...)` is true.
- Remove the in-page `Advance Day` button from `CareerCalendarPage` in `components/CareerWorkbench.tsx`.
- Keep calendar page as the detailed event desk, not the exclusive control point.

### Acceptance Criteria

- [ ] In career mode on Home, Training, Calendar, Match Planning, Program, Facilities, Media, Scouting, Recruitment, Youth, Staff, Promises, Squad, and Player Profile, the persistent topbar can advance the day when the career is in an advanceable stage.
- [ ] Calendar/Event Desk no longer has a special header-level `Advance Day` button.
- [ ] If advancing into match day changes `career.stage` to `pre_match`, the app routes to the bracket/pre-match hub.
- [ ] Pre-match, live-match, and post-match states keep the correct competition continuation CTA instead of silently advancing the calendar.
- [ ] Date, recovery, scouting, rivals, facilities, media, and assistant advice still flow through `advanceCareerDay()` in `game/store/store.ts`.

### Verification

- [ ] Unit or component test proves topbar `Advance Day` calls `advanceCareerDay()` from a non-calendar career page.
- [ ] E2E test starts a career, advances from Home, then advances again from Training or Squad without opening Calendar.
- [ ] Existing career store tests still pass: `npm run test -- tests/unit/career.test.ts`.
- [ ] Build passes: `npm run build`.

### Likely Files

- `app/App.tsx`
- `components/CareerWorkbench.tsx`
- `tests/unit/career.test.ts`
- `e2e/app.spec.ts`

## 5. Issue B: Shared Blocking Athlete Selection Modal

### Problem

Identifying the controlled athlete is a core game decision, but the current flows do not treat it consistently:

- Career creation has a small confirm dialog that does not match the richer quick-run selection experience.
- Disposable quick tournament setup is a full page, so the player can drift through the setup instead of being forced through a clear selection moment.

The selection flow should feel like:

$$
\text{Start mode} \rightarrow \text{blocking athlete selection modal} \rightarrow \text{explicit confirmation}
$$

### Desired Behavior

Starting a new career opens a modal using the `Pick Your Playstyle` selection design. Starting a quick/disposable tournament opens a modal using the same athlete selection design, with tactic selection included before launch.

The player must make an explicit athlete selection inside the modal before continuing. A default highlighted recommendation can exist, but the final action should remain disabled until the player clicks a selection control.

### Component Strategy

Create a shared modal component inside `SetupView.tsx` first, or extract to a new file if the component becomes too large:

- `components/AthleteSelectionModal.tsx`

Suggested props:

```ts
type AthleteSelectionPurpose = "career" | "quickTournament";

interface AthleteSelectionModalProps {
  open: boolean;
  purpose: AthleteSelectionPurpose;
  selectedPlayerId: string;
  plannedTacticKey: TacticKey;
  requireExplicitSelection: boolean;
  onSelectPlayer: (playerId: string) => void;
  onChooseTactic: (tacticKey: TacticKey) => void;
  onOpenPlayerProfile: (playerId: string) => void;
  onConfirm: (playerId: string) => void;
  onCancel: () => void;
}
```

Keep the data helpers from `SetupView.tsx` reusable:

- `rankRosterByOverall()`
- `buildRecommendationModes(...)`
- `filterAndSortRoster(...)`
- `buildFeaturedRecommendationCopy(...)`
- `renderAthleteCard(...)`, if kept local

### Career Modal Requirements

- Use the same `Pick Your Playstyle` recommendation tabs as quick tournament.
- Include featured recommendation, supporting alternatives, selected athlete dossier, and full roster browse fallback.
- Hide or de-emphasize tactic selection unless the team decides career should seed the initial `AdvancedTacticPlan`.
- Confirm button text should be specific, for example `Confirm Career Athlete`.
- The modal is `aria-modal="true"` and blocks continuation until confirmation.
- Escape/cancel can close the modal before a career is created, but no career save is written unless confirm is clicked.

### Quick Tournament Modal Requirements

- Clicking `Quick Tournament` from the Start Screen opens the modal, not the `Quick Tournament Setup` page.
- The modal includes athlete selection plus `Strategic Override` tactic selection.
- The launch button should be disabled until an athlete has been explicitly selected in that modal session.
- Confirm calls `props.onStartTournament` using the chosen athlete. If an active career exists, preserve the existing replacement confirmation path in `App.tsx`.
- The current full-page quick setup mode should be removed or reduced to a compatibility wrapper that immediately opens the modal.

### Acceptance Criteria

- [ ] `Start New Career` opens a blocking playstyle-first modal, not the old six-athlete `Confirm Career Athlete` modal.
- [ ] `Quick Tournament` opens a blocking playstyle-first modal, not a full setup page.
- [ ] Both modals require a deliberate athlete selection before the final confirm/start action enables.
- [ ] Career confirmation writes `career.program.managedPlayerId` to the chosen athlete.
- [ ] Quick tournament confirmation starts the disposable run with the chosen athlete and does not mutate an active career until replacement is confirmed.
- [ ] Full roster browse remains available from inside the modal.
- [ ] Modal focus trapping and Escape behavior stay aligned with existing overlay remediation.

### Verification

- [ ] Update `tests/unit/setup-view.test.tsx` for modal behavior and explicit-selection gating.
- [ ] Add or update a store/UI test for active-career quick tournament draft preservation.
- [ ] E2E proof: start a career through the new modal; start a disposable run through the new modal.
- [ ] Keyboard check: Tab stays inside the active selection modal, Escape closes only when safe.

### Likely Files

- `components/SetupView.tsx`
- optional new `components/AthleteSelectionModal.tsx`
- `components/useModalFocus.ts`
- `styles.css`
- `tests/unit/setup-view.test.tsx`
- `tests/unit/career.test.ts`
- `e2e/app.spec.ts`

## 6. Issue C: Reusable Knockout Tree In Career Competitions

### Problem

Disposable runs have a strong knockout tree, but career event pages do not show it before or after career matches. The player loses sight of their event path exactly when career context makes the bracket more important.

### Desired Behavior

Career competition screens should show the same full knockout tree as disposable runs:

- Before a career match: visible in the pre-match hub so the player sees the current opponent and possible future route.
- After a career match: visible in the post-match hub so the player sees the result, whether they are still alive, and the next round or closeout state.

### Component Strategy

Extract the bracket tree from `OverviewView.tsx` into a reusable presentational component:

- `components/KnockoutTree.tsx`

Suggested props:

```ts
interface KnockoutTreeProps {
  tournament: TournamentState;
  selectedPlayerId: string;
  title?: string;
  subtitle?: string;
  onOpenPlayerProfile: (playerId: string) => void;
}
```

Move or export these local helpers:

- `bracketRounds`
- `previousRoundName`
- `placeholderLabel(...)`
- `gridRowForMatch(...)`

`OverviewView` should then render `<KnockoutTree ... />` instead of owning the bracket JSX. `CareerPreMatchHubPage` and `CareerPostMatchHubPage` should render the same component when `props.tournament` is non-null.

### Placement Recommendation

For career pre-match:

- Keep the existing opponent briefing and planning bridge at the top.
- Add a full-width `Current Event Bracket` panel below them, or make it the right-side/second-row anchor if the layout has space.

For career post-match:

- Put `Current Event Bracket` before or directly after the status strip.
- Keep `Evidence And Recommendations` and the tactical viewer visible below.
- If the event is complete and `props.tournament` is null after closeout, show no bracket, or show a compact final path from the last known report only if the store keeps it. Do not invent bracket state.

### Acceptance Criteria

- [ ] Disposable-run bracket screen looks unchanged or better after extraction.
- [ ] Career pre-match hub renders the full knockout tree when `props.tournament` exists.
- [ ] Career post-match hub renders the updated tree immediately after `advanceAfterMatch()` while `career.stage === "post_match"`.
- [ ] Managed athlete path, pending managed match, winners, scorelines, placeholders, and champion styling match disposable-run behavior.
- [ ] Player names in career bracket remain clickable.
- [ ] Background match summaries still appear for completed non-managed matches.

### Verification

- [ ] Component/unit test renders `KnockoutTree` with placeholders before QF/SF/F are known.
- [ ] Career store test still proves non-final wins keep `tournament` active between rounds.
- [ ] E2E test imports or creates a between-round career save and expects `Knockout tree` to be visible in pre-match and post-match states.
- [ ] Build passes.

### Likely Files

- new `components/KnockoutTree.tsx`
- `components/OverviewView.tsx`
- `components/CareerWorkbench.tsx`
- `styles.css`
- `tests/unit/career.test.ts`
- `e2e/app.spec.ts`

## 7. Issue D: Match Command Center Horizontal Layout

### Problem

The live match page uses too much vertical space. The most frequent action, `Simulate Next Point`, sits at the bottom of a directive panel, while the scoreboard and tactical viewer consume full-width rows. The player should not need to scroll during match command.

### Target Layout

Use `docs/rescue_MVP/Targeted_command_center.png` as the working visual reference.

Proposed desktop grid:

```text
Header: Live / Match Command Center                         meta chips

Top row:
[ compact scoreboard, about 55-65% width ] [ primary match action ]

Second row:
[ compact status strip across left/middle area ]

Main command row:
[ live feed ] [ 2D tactical viewer ] [ managed telemetry ]
[ tactical controls/team talk or compact options ] [ viewer ] [ opponent telemetry + tactical options ]
```

More concrete CSS grid areas:

```css
.match-command-layout-v2 {
  display: grid;
  grid-template-columns: minmax(18rem, 0.9fr) minmax(24rem, 1.15fr) minmax(18rem, 0.95fr);
  grid-template-areas:
    "score score action"
    "status status status"
    "feed viewer telemetry"
    "options viewer telemetry";
}
```

The final exact tracks can be tuned, but the governing rule is:

$$
\text{primary action distance from scoreboard} \approx 0
$$

### Required UI Changes

- Move the primary point button out of the bottom directive panel and place it directly to the right of the scoreboard.
- Reduce scoreboard height:
  - smaller score numbers
  - tighter athlete rows
  - compact set chips
  - no excessive full-width empty padding
- Keep the live tactical feed on the left side directly below the score/status area.
- Place the 2D tactical viewer in the middle column.
- Place both player telemetry panels on the right side, stacked or split into compact cards.
- Place tactical option changes at the bottom-right, near telemetry.
- Remove duplicate primary buttons. The page should have one dominant point/action button.
- Preserve between-set talk behavior, but present it compactly when locked.
- Avoid routine scrolling at desktop `1440 x 900` and `1366 x 768` after one or several simulated points.

### Implementation Notes

- Refactor `MatchView.tsx` into clear sub-sections inside the same file first:
  - `ScoreboardPanel`
  - `PrimaryMatchAction`
  - `LiveFeedPanel`
  - `TelemetryPanel`
  - `TacticalOptionsPanel`
- Keep behavior props unchanged:
  - `onApplyDirective`
  - `onApplyTalk`
  - `onSimulateNextPoint`
  - `onAdvanceAfterMatch`
- Update CSS around:
  - `.match-command-layout`
  - `.scoreboard-panel`
  - `.scoreboard-main`
  - `.score-value`
  - `.tactical-viewer-live-panel`
  - `.telemetry-stack`
  - `.directive-panel`
  - `.feed-panel`
- Replace viewport-width font scaling for the score with stable sizes and breakpoint adjustments. The current `font-size: clamp(3.3rem, 8vw, 5.4rem)` makes score sizing depend on viewport width and works against predictable dense console layout.

### Acceptance Criteria

- [ ] `Simulate Next Point`, `Open Next Set`, `Apply Talk + Open Next Set`, or `Advance Bracket` appears directly to the right of the scoreboard.
- [ ] The scoreboard occupies roughly half to two-thirds of the top row, not a full vertical block.
- [ ] Live feed sits on the left below the score/status area.
- [ ] Tactical viewer sits in the middle/right-middle area and remains readable.
- [ ] Managed and opponent telemetry are visible alongside the tactical viewer without scrolling on common desktop viewports.
- [ ] Tactical options/directives are available at the lower-right area.
- [ ] No duplicate primary simulation buttons exist.
- [ ] At `1440 x 900` and `1366 x 768`, a player can see the match command surface without routine vertical scrolling.
- [ ] Mobile remains reachable and does not horizontally clip critical controls.

### Verification

- [ ] Playwright screenshot at `1440 x 900` after first load of a live match.
- [ ] Playwright screenshot at `1366 x 768` after simulating at least three points.
- [ ] Playwright screenshot during between-set intermission.
- [ ] Playwright screenshot after match completion showing `Advance Bracket`.
- [ ] Unit tests for button labels remain green if they exist; add component-level checks if missing.
- [ ] Manual browser check against `Targeted_command_center.png`.

### Likely Files

- `components/MatchView.tsx`
- `components/TacticalMatchViewer.tsx` only if viewer sizing requires a prop
- `styles.css`
- `e2e/app.spec.ts`

## 8. Issue E: Integration And Regression Proof

### Cross-Feature Risks

| Risk | Impact | Mitigation |
| --- | --- | --- |
| Global `Advance Day` skips match obligations | High | Gate by `career.stage` and keep pre/post match CTAs routed to competition resolution |
| Shared modal mutates active career draft athlete | High | Keep the existing `quickTournamentDraftPlayerId` separation in `App.tsx` |
| Bracket extraction breaks disposable run | Medium | Snapshot existing Overview behavior with component tests before extraction |
| Match layout hides controls on short desktop | High | Test `1366 x 768`, not only large desktop |
| Modal focus handling regresses | Medium | Reuse `useModalFocus` and add keyboard checks |

### Regression Matrix

| Flow | Must Prove |
| --- | --- |
| New career | Start Screen -> selection modal -> explicit athlete -> Career Home |
| Quick disposable run | Start Screen -> selection modal -> explicit athlete/tactic -> Tournament Command Center |
| Career day advance | Home/Training/Squad/Profile -> topbar `Advance Day` -> date increments |
| Career event entry | Calendar/Event Desk -> enter event -> global day advance eventually opens pre-match hub |
| Career pre-match | Bracket tree visible before entering match |
| Career post-match non-final win | Bracket tree visible with completed result and next placeholder/opponent |
| Career closeout | Post-match CTA closes event exactly once |
| Live match | No-scroll desktop command center with primary action beside scoreboard |

### Recommended Command Sequence

```bash
npm run typecheck
npm run test
npm run test:e2e
npm run build
```

If full E2E is too slow during iteration, use focused runs around setup/career/live match first, then finish with the full command sequence.

## 9. Implementation Order

### Phase 1: Contracts And Extraction

1. Define `canAdvanceCareerDate(...)` shell behavior.
2. Extract `KnockoutTree` from `OverviewView` without changing output.
3. Identify modal focus requirements for the shared athlete selection modal.

Checkpoint:

- [ ] Disposable tournament bracket still renders.
- [ ] No store behavior changed.
- [ ] Typecheck passes.

### Phase 2: User Flow Fixes

4. Wire global career `Advance Day` into the topbar and remove calendar-only action.
5. Add `KnockoutTree` to career pre-match and post-match hubs.
6. Convert career and quick setup into shared blocking modal flows.

Checkpoint:

- [ ] Career can advance day outside Calendar.
- [ ] Career competition has bracket context before and after match.
- [ ] Both start flows force explicit athlete selection.

### Phase 3: Live Match Layout

7. Refactor `MatchView` sections.
8. Apply the horizontal desktop grid.
9. Tune short desktop and mobile fallbacks.

Checkpoint:

- [ ] Primary match action sits beside scoreboard.
- [ ] No duplicate action button.
- [ ] Desktop screenshots show no routine scroll requirement.

### Phase 4: Proof And Polish

10. Update unit tests.
11. Update E2E proofs.
12. Run full verification and capture screenshots if the team keeps evidence packs.

Checkpoint:

- [ ] `npm run test` passes.
- [ ] `npm run build` passes.
- [ ] E2E focused flows pass.

## 10. Out Of Scope

Do not bundle these into this rescue pass:

- Changing match simulation probabilities.
- Adding new tournament formats beyond the existing 16-player knockout.
- Adding URL routing.
- Adding backend, auth, cloud saves, or multiplayer.
- Rebalancing career economy, rankings, or rewards.
- Rewriting the tactical viewer data model.

## 11. Open Decisions For The Team

1. Should the global topbar ever allow `Advance Day` during `pre_match` or `post_match`, or should those states always force match resolution first?
2. Should career creation also choose an initial tactical identity, or should it only lock the athlete and leave tactics to `Advanced Tactics Creator`?
3. Should the quick tournament modal preserve the current full tactic-card selection, or use a compact segmented control inside the modal?
4. Should `KnockoutTree` support a compact career variant, or should career pages render the full disposable-run tree exactly?

My recommendation:

- Do not advance days through unresolved match states.
- Keep career creation athlete-only for this pass.
- Keep quick tournament tactic selection inside the modal but compact it.
- Extract one full `KnockoutTree` first; add compact variants only after the shared version is stable.
