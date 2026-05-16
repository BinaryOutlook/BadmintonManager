# Rescue MVP Plan 2: Smart Advance Day and Full Athlete Selection

Status: Draft technical brief  
Target project: `BadmintonManager`  
Builds on: `docs/rescue_MVP/plan0.md` and `docs/rescue_MVP/plan1.md`  
Prepared on: 2026-05-16

## 1. Executive Summary

The global `Advance Day` button is now in the right place, but it still needs to behave like the central career guide in Football Manager. The user should not need to know which page contains the next required action. The game should answer one question every time:

$$
\text{What is the most important unresolved action for the current career day?}
$$

If the answer is "nothing remains today", the topbar button should be green and advance the date. If the answer is "a match or event action remains today", the topbar button should be red and take the user directly to that required match or event flow. This turns `Advance Day` from a passive date button into the career's daily command surface.

The second priority is athlete selection. Both career and disposable-run starts must force an explicit managed-athlete choice before the game proceeds. The current modal is close, but `Browse All Athletes` is still nested inside a constrained popup and does not sufficiently guarantee that any roster athlete can be selected. It should become a larger, dedicated selection UI, potentially full-screen, with reliable selection coverage for every athlete in the roster.

## 2. Current Code Findings

### 2.1 Event Entry Exists, But Entered Event Rows Are Still Inert

`components/CareerWorkbench.tsx` currently renders the Calendar event action as:

```tsx
<button
  className={entered ? "command-button command-button-secondary" : "command-button command-button-primary"}
  type="button"
  disabled={entered || completed || eventBlocked}
  onClick={() => props.onEnterEvent(event.id)}
>
  {calendarEventActionLabel(...)}
</button>
```

This explains the user-facing bug. Once the event is entered, the row can display labels such as `Match Ready`, `Event Active`, or `Draw Published`, but the button is disabled because `entered` is true. The state may know about the event, yet the UI gives the player no playable click target.

### 2.2 Store-Level Match-Day Protection Exists

`game/career/matchSchedule.ts` now provides the important scheduling foundation:

- `scheduledDateForRound(event, round)`
- `currentManagedMatchSchedule({ career, tournament })`
- `canAdvanceCareerDay({ career, tournament, liveMatchActive })`

The store already blocks direct date advancement when an unplayed match is due:

```ts
if (schedule?.playable) {
  return {
    allowed: false,
    reason: `Match day blocked: play ${schedule.event.name} ${schedule.round} before advancing.`,
    route: "pre_match",
    schedule
  };
}
```

This is correct domain protection. The missing layer is a player-facing action model that shows the block before the user clicks, styles it as required work, and routes them directly to the correct game.

### 2.3 Topbar Still Uses A Simple Stage Gate

`app/App.tsx` currently decides whether the topbar says `Advance Day` with:

```ts
const advanceableCareerStages = new Set([
  "planning",
  "event_entered",
  "between_rounds",
  "event_complete"
]);

export function canAdvanceCareerDate(career, phase) {
  return Boolean(career && phase !== "match" && advanceableCareerStages.has(career.stage));
}
```

That helper answers "is this stage generally advanceable?" It does not answer "does today contain an unfinished required task?" The store guard catches the unsafe advance, but the topbar still appears green until clicked. The UI should know the same truth as the store.

### 2.4 Athlete Selection Is A Modal, But Browse Is Too Constrained

`components/SetupView.tsx` now has a shared selection modal for career and quick disposable runs:

- `selectionPurpose: "career" | "quickTournament" | null`
- `modalSelectedPlayerId`
- `modalSelectionMade`
- `rosterBrowseOpen`
- `selectModalPlayer(playerId)`
- `confirmSelectionModal()`

This is the right direction. The remaining issue is interaction quality. `Browse All Athletes` is rendered as an extra section inside the same modal after the recommendation board. The modal has:

```css
.athlete-selection-modal {
  width: min(82rem, 100%);
  max-height: min(52rem, calc(100vh - 2rem));
  overflow: auto;
}
```

That can make the full roster feel buried, vertically cramped, and hard to use. The selection flow needs a dedicated full-roster mode so selecting any athlete is a first-class action, not a fallback panel hidden at the bottom of a scroll container.

## 3. Product Rule

Career mode should use one authoritative daily action. The button's meaning is:

$$
\text{Daily Action} =
\begin{cases}
\text{Required Action}, & \text{if an unfinished live match, review, or playable event exists today} \\
\text{Advance Day}, & \text{if all required work for today is complete}
\end{cases}
$$

Color should communicate the rule:

$$
\text{Button Tone} =
\begin{cases}
\text{red}, & \text{required work blocks date advancement} \\
\text{green}, & \text{date advancement is currently allowed}
\end{cases}
$$

This makes the player loop simple:

```text
Check topbar -> click the one highlighted action -> finish required work -> advance when green
```

## 4. Workstream Split

| Workstream | Owner Type | Primary Scope | Main Files | Risk |
| --- | --- | --- | --- | --- |
| A. Daily action resolver | Career/domain engineer | Define one shared answer for green advance vs red required action | `game/career/dailyAction.ts`, `game/career/matchSchedule.ts`, `game/store/store.ts` | High |
| B. Topbar smart action | Shell UI engineer | Replace stage-only continue logic with resolver-driven label, tone, and routing | `app/App.tsx`, `styles.css`, shell tests | High |
| C. Calendar event playability | Career UI engineer | Make entered events clickable when they have a playable draw or match | `components/CareerWorkbench.tsx`, Calendar tests | High |
| D. Athlete selection full roster | Setup UI engineer | Convert `Browse All Athletes` into a full-screen or near full-screen selection mode | `components/SetupView.tsx`, `styles.css`, setup tests | Medium |
| E. Selection gate hardening | App/state engineer | Ensure career and disposable runs cannot start without explicit athlete confirmation | `app/App.tsx`, `components/SetupView.tsx`, store tests | Medium |
| F. Integration proof | QA engineer | Verify the complete career loop across Calendar, topbar, match entry, and selection | `tests/unit/*`, browser smoke path | Medium |

## 5. Issue A: Add A Shared Career Daily Action Resolver

### Problem

The app currently has multiple partial answers:

- `canAdvanceCareerDate(...)` says whether a stage can advance.
- `canAdvanceCareerDay(...)` says whether the store should block advancement.
- `calendarEventActionLabel(...)` says what text appears in Calendar.
- `handleShellContinue()` decides what the topbar click does.

These should not drift. The career needs one resolver that all screens can consume.

### Proposed Contract

Create a domain-level resolver, ideally in `game/career/dailyAction.ts`:

```ts
import type { CareerState } from "./models";
import type { TournamentState } from "../tournament/tournament";

export type CareerActionPhase = "setup" | "overview" | "match" | "complete";

export type CareerDailyActionTone = "ready" | "required" | "disabled";

export type CareerDailyAction =
  | {
      kind: "advance_day";
      tone: "ready";
      label: "Advance Day";
      reason: string;
      targetDate: string;
    }
  | {
      kind: "play_scheduled_match";
      tone: "required";
      label: string;
      reason: string;
      eventId: string;
      round: RoundName;
      route: "pre_match";
    }
  | {
      kind: "resume_live_match";
      tone: "required";
      label: "Resume Match";
      reason: string;
      route: "live_match";
    }
  | {
      kind: "review_match";
      tone: "required";
      label: "Review Match";
      reason: string;
      route: "review";
    }
  | {
      kind: "continue_career";
      tone: "ready";
      label: "Continue Career";
      reason: string;
      route: "home";
    };
```

The resolver should accept all state needed to decide without touching React:

```ts
export function getCareerDailyAction(args: {
  career: CareerState | null;
  tournament: TournamentState | null;
  phase: CareerActionPhase;
  liveMatchActive: boolean;
}): CareerDailyAction;
```

### Priority Order

Resolve actions in this order:

1. If `phase === "match"` or `liveMatchActive`, return `resume_live_match`.
2. If `career.stage === "post_match"`, return `review_match`.
3. If `currentManagedMatchSchedule(...).playable` is true, return `play_scheduled_match`.
4. If the career exists and no blocking task remains today, return `advance_day`.
5. If no career exists, return existing local-save/start behavior outside this resolver.

The key rule is:

$$
\text{play\_scheduled\_match} \succ \text{advance\_day}
$$

An unplayed match always has higher priority than date advancement.

### Acceptance Criteria

- [ ] A career with an entered event on the event start date resolves to `play_scheduled_match`.
- [ ] A career between rounds before the next scheduled round resolves to `advance_day`.
- [ ] A career in `post_match` resolves to `review_match`.
- [ ] A live match resolves to `resume_live_match`.
- [ ] The resolver is covered by unit tests independent of React rendering.

### Verification

- [ ] Add `tests/unit/career-daily-action.test.ts`.
- [ ] Test at least these stages: `event_entered`, `between_rounds`, `pre_match`, `post_match`, and active live match.
- [ ] Confirm resolver output includes event id, round, and label for playable matches.

### Dependencies

None. This is the foundation for all other Plan 2 work.

### Files Likely Touched

- `game/career/dailyAction.ts`
- `game/career/matchSchedule.ts`
- `tests/unit/career-daily-action.test.ts`

### Estimated Scope

Medium: 2-3 files.

## 6. Issue B: Replace The Topbar Stage Gate With The Daily Action

### Problem

The topbar currently says `Advance Day` whenever the career stage is generally advanceable. That makes the button look green even when clicking it will be blocked and rerouted to a match. The user should see the real required action before clicking.

### Desired Behavior

Examples:

| State | Button Label | Color | Click Result |
| --- | --- | --- | --- |
| No unfinished work today | `Advance Day` | Green | Advances career date |
| Entered event match due today | `Play Metro Open R16` | Red | Opens pre-match bracket/briefing |
| Live match in progress | `Resume Match` | Red | Opens live Match Command Center |
| Post-match report pending | `Review Match` | Red | Opens review page |
| Between rounds, next match tomorrow | `Advance Day` | Green | Moves to next date |

### Implementation Notes

Update `app/App.tsx` so `handleShellContinue()` switches on `getCareerDailyAction(...)`:

```ts
function handleShellContinue() {
  const action = getCareerDailyAction({
    career,
    tournament,
    phase,
    liveMatchActive: Boolean(liveMatch)
  });

  switch (action.kind) {
    case "advance_day":
      handleAdvanceCareerDay();
      return;
    case "play_scheduled_match":
      openScheduledCareerMatch();
      return;
    case "resume_live_match":
      setActivePage({ id: "liveMatch" });
      return;
    case "review_match":
      setActivePage({ id: "review" });
      return;
  }
}
```

Do not use the old stage-only `canAdvanceCareerDate(...)` as the final authority for career saves. It can either be removed, reduced to a backward-compatible helper for tests, or rewritten to delegate to the daily action resolver.

### Store Action For Red Match Routing

Add an explicit store action, for example:

```ts
openScheduledCareerMatch: () => void
```

Its job:

- if a playable schedule exists, set `career.stage = "pre_match"`
- ensure a tournament exists through the same internal helper used by `advanceCareerDay`
- keep the career date unchanged
- set `phase = "overview"`
- persist the state

This avoids using an action named `advanceCareerDay()` to perform a red "play match" route. The existing guard inside `advanceCareerDay()` should remain as a safety net, but the main UI path should be semantically clear.

### Styling

Extend `TopStatusBar` to accept tone:

```ts
continueTone: "ready" | "required" | "disabled";
```

Suggested classes:

- `topbar-continue-ready`: existing lime/green primary styling
- `topbar-continue-required`: red danger styling
- `topbar-continue-disabled`: disabled/inert styling if needed

Use accessible contrast. The red button should read as an urgent requirement, not as a destructive delete action. Text examples:

- `Play Metro Open R16`
- `Resume Match`
- `Review Match`

### Acceptance Criteria

- [ ] When a match is due today, the topbar button is red before click.
- [ ] The due-match label includes the event name and round.
- [ ] Clicking the red match button opens the pre-match bracket/briefing without changing date.
- [ ] Clicking the green button advances exactly one career day.
- [ ] If advancing into a date with a scheduled match, the new state routes to the pre-match page and the next rendered action becomes match-focused.

### Verification

- [ ] Extend `tests/unit/app-career-shell.test.tsx`.
- [ ] Assert button class or `data-tone="required"` for the due-match case.
- [ ] Assert button class or `data-tone="ready"` for the no-blocker case.
- [ ] Assert the red action does not increment `career.date`.
- [ ] Assert the green action does increment `career.date`.

### Dependencies

Depends on Issue A.

### Files Likely Touched

- `app/App.tsx`
- `game/store/store.ts`
- `game/store/save.ts` if store action typings require persisted interface updates
- `styles.css`
- `tests/unit/app-career-shell.test.tsx`

### Estimated Scope

Medium: 4-5 files.

## 7. Issue C: Make Entered Calendar Events Playable

### Problem

The Calendar event row disables the action button as soon as an event is entered. This blocks the exact flow the player expects:

```text
Enter event -> wait until event day -> click event -> play match
```

The event card should not treat `entered` as a terminal state. It is an active commitment.

### Replace Label-Only Logic With Action Logic

Replace `calendarEventActionLabel(...)` with an action resolver:

```ts
type CalendarEventAction =
  | {
      kind: "enter_event";
      label: "Enter Event";
      disabled: false;
      tone: "primary";
    }
  | {
      kind: "play_match";
      label: string;
      disabled: false;
      tone: "required";
      eventId: string;
    }
  | {
      kind: "open_draw";
      label: "View Draw";
      disabled: false;
      tone: "secondary";
      eventId: string;
    }
  | {
      kind: "review_match";
      label: "Review Ready";
      disabled: false;
      tone: "required";
    }
  | {
      kind: "completed";
      label: "Completed";
      disabled: true;
      tone: "muted";
    }
  | {
      kind: "blocked";
      label: string;
      disabled: true;
      tone: "muted";
      reason: string;
    };
```

Rules:

- `completed` stays disabled.
- unaffordable, medical-hold, or tier-locked events are disabled only before entry.
- `entered` and match due today becomes `play_match`.
- `entered` but before draw/start can become `open_draw` or `Await Draw`, depending on whether there is useful content to show.
- `entered` and active `post_match` becomes `review_match`.

The critical change is:

$$
\text{entered} \not\Rightarrow \text{disabled}
$$

### Calendar Click Handling

The action click handler should route by action kind:

```ts
function handleCalendarEventAction(action: CalendarEventAction) {
  switch (action.kind) {
    case "enter_event":
      props.onEnterEvent(action.eventId);
      return;
    case "play_match":
      props.onOpenScheduledCareerMatch(action.eventId);
      return;
    case "open_draw":
      props.onOpenEventDraw(action.eventId);
      return;
    case "review_match":
      props.onOpenReview();
      return;
  }
}
```

If `open_draw` is too large for this rescue pass, route to the current pre-match bracket when a tournament exists, and use the existing Calendar details when it does not. The important rescue requirement is that a due match can be played from the row.

### Acceptance Criteria

- [ ] Entered event rows are not automatically disabled.
- [ ] An entered event on its match day shows an enabled red `Play ...` action.
- [ ] Clicking that action creates or opens the event tournament and routes to the pre-match page.
- [ ] Future entered events do not show a misleading play action before their scheduled date.
- [ ] Completed events remain disabled or route to Past Events, depending on final UX choice.

### Verification

- [ ] Add or extend a React test for `CareerCalendarPage`.
- [ ] Build a state with `activeEventId`, `enteredEventIds`, `date = event.startDate`, and `tournament = null`.
- [ ] Assert the Calendar row button is enabled and says `Play`.
- [ ] Click it and assert the app shows `Opponent Briefing` and a knockout tree.
- [ ] Assert the same row is not clickable as `Enter Event` after entry.

### Dependencies

Depends on Issue A for schedule truth and Issue B for route/store action.

### Files Likely Touched

- `components/CareerWorkbench.tsx`
- `app/App.tsx`
- `game/store/store.ts`
- `tests/unit/app-career-shell.test.tsx`
- optional: a new `tests/unit/career-calendar-actions.test.tsx`

### Estimated Scope

Medium: 3-5 files.

## 8. Issue D: Keep `Advance Day` Realistic Across Event Rounds

### Problem

Plan 1 introduced next-day round scheduling. Plan 2 should make sure the new smart button communicates this schedule in a realistic way. Winning a match should not offer an immediate same-day next match. The player should review, return to the career day, and only advance into the next round date.

### Desired Flow

```text
R16 match day
  -> play R16
  -> review result
  -> return to career day with next round scheduled
  -> green Advance Day
  -> QF match day
  -> red Play QF
```

For a 16-player event:

$$
\text{scheduledDate}(\text{round}) =
\text{event.startDate} + \text{roundOffset}
$$

where:

| Round | Offset |
| --- | ---: |
| `R16` | 0 |
| `QF` | 1 |
| `SF` | 2 |
| `F` | 3 |

### Implementation Notes

The current `game/career/matchSchedule.ts` already models these offsets. Plan 2 should protect the player-facing loop:

- after a non-final win, `continueCareerAfterPostMatch()` should leave the career in `between_rounds` if the next scheduled round is tomorrow
- `startManagedMatch()` should reject starting before `schedule.playable`
- the daily action resolver should show green `Advance Day` during `between_rounds`
- after advancing to the scheduled date, the resolver should show red `Play <event> <round>`

### Acceptance Criteria

- [ ] A non-final win never opens the next round on the same career date.
- [ ] The topbar is green while the next round is not yet playable.
- [ ] The topbar becomes red on the next round's scheduled date.
- [ ] Direct store calls still cannot start a match before its scheduled date.

### Verification

- [ ] Keep existing tests in `tests/unit/career.test.ts` for R16/QF/SF/F spacing.
- [ ] Add topbar assertions that mirror the same schedule.
- [ ] Confirm no page exposes a same-day `Start Match` button for a future round.

### Dependencies

Depends on Issue A and Issue B.

### Files Likely Touched

- `app/App.tsx`
- `components/CareerWorkbench.tsx`
- `game/store/store.ts`
- `tests/unit/career.test.ts`
- `tests/unit/app-career-shell.test.tsx`

### Estimated Scope

Small to Medium: mostly tests and UI alignment if Plan 1 code is already stable.

## 9. Issue E: Convert `Browse All Athletes` Into A Full Selection Surface

### Problem

The current selection modal shows recommendations first and nests full-roster browsing below them. This is not strong enough for a mandatory identity choice. The user needs confidence that they can select any athlete, including athletes not surfaced by recommendation modes.

### Desired UX

`Browse All Athletes` should become a dedicated selection mode inside the same blocking modal:

```text
Start New Career / Quick Tournament
  -> blocking athlete selection popup
    -> Recommendations mode
    -> Browse All Athletes mode
       -> full-height searchable roster
       -> select any athlete
       -> sticky confirm footer
```

The popup can take the whole viewport. This is appropriate because athlete identity is a mandatory setup decision, not a small confirmation.

### Proposed State Change

Replace `rosterBrowseOpen: boolean` with a clearer modal view state:

```ts
type AthleteSelectionView = "recommendations" | "browse";

const [selectionView, setSelectionView] = useState<AthleteSelectionView>("recommendations");
```

The browse button switches views rather than expanding content at the bottom:

```tsx
<button onClick={() => setSelectionView("browse")}>
  Browse All Athletes
</button>
```

In browse view:

- use the modal header to show `Browse All Athletes`
- keep search/filter/sort visible near the top
- make the roster grid/table the primary content
- keep the selected athlete summary and confirm button sticky at the bottom
- include a clear `Back to Recommendations` action

### Layout Notes

Update CSS toward a viewport-scale modal:

```css
.athlete-selection-modal {
  width: min(96rem, calc(100vw - 2rem));
  height: min(58rem, calc(100vh - 2rem));
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.athlete-selection-scroll-region {
  min-height: 0;
  overflow: auto;
}

.athlete-selection-actions {
  position: sticky;
  bottom: 0;
}
```

For browse mode, a table may be better than cards if the roster grows. A compact table makes it easier to scan name, country, style, rank, and key stats. Cards are acceptable if they remain dense and responsive.

### Selection Reliability

Every roster item from `rankRosterByOverall()` must have an explicit select control:

```tsx
filteredRoster.map((item) => (
  <button
    type="button"
    aria-label={`Select ${item.entry.player.name}`}
    onClick={() => selectModalPlayer(item.entry.player.id)}
  >
    Select
  </button>
))
```

The selected athlete should stay selected when:

- filters change
- sort order changes
- the user moves between recommendations and browse
- the user opens and closes a non-routing profile preview, if profile preview remains inside the modal

Avoid route-changing profile actions from inside a mandatory modal unless the modal state is preserved on return. A route change to `PlayerProfilePage` can interrupt the selection flow and make the popup feel non-blocking.

### Acceptance Criteria

- [ ] `Browse All Athletes` opens a full-screen or near full-screen selection view.
- [ ] Every athlete in `rankRosterByOverall()` can be selected from browse mode.
- [ ] Selecting the last-ranked athlete enables the confirm button.
- [ ] Career confirm calls `onStartCareer(lastRankedId)`.
- [ ] Disposable run confirm calls `onStartTournament(lastRankedId)`.
- [ ] Quick disposable selection still calls `onSelectPlayer(playerId)` when a player is selected, preserving current tournament-draft behavior.
- [ ] Filters never make an already selected athlete invalid unless the user explicitly changes selection.

### Verification

- [ ] Extend `tests/unit/setup-view.test.tsx`.
- [ ] Add a test that opens career selection, enters browse mode, selects the last athlete in `rankRosterByOverall()`, and confirms career start.
- [ ] Add the same test for quick disposable run.
- [ ] Add a filtered selection test for an athlete outside the recommendation set.
- [ ] Add a snapshot-style assertion that browse mode is not rendered as a nested fallback below recommendations.

### Dependencies

None. This can run in parallel with Issues A-C after the team agrees on the final modal shape.

### Files Likely Touched

- `components/SetupView.tsx`
- `components/useModalFocus.ts` if focus trapping needs a full-screen browse adjustment
- `styles.css`
- `tests/unit/setup-view.test.tsx`

### Estimated Scope

Medium: 3-4 files.

## 10. Issue F: Harden Athlete Selection As A Mandatory Gate

### Problem

The start flow should never create a career or disposable tournament until the player has deliberately selected the controlled athlete. This is important because the selected athlete defines the whole save identity.

### Desired Rules

For career:

$$
\text{createCareerSave} \iff \text{modalSelectedPlayerId exists and user confirms}
$$

For disposable run:

$$
\text{startTournament} \iff \text{modalSelectedPlayerId exists and user confirms}
$$

The user may cancel the popup, but cancel means aborting the start action and returning to the start screen. It must not continue with a default athlete.

### Implementation Notes

The current `confirmSelectionModal()` already follows the right pattern:

```ts
if (!selectionPurpose || !modalSelectionMade || !modalSelectedPlayerId) {
  return;
}
```

Keep that rule and make it harder to bypass:

- `onStartCareer` should require a `managedPlayerId: string`.
- `onStartTournament` should require a selected player id from the modal for setup starts.
- replacement-save confirmation should store the selected id and not fall back to global `selectedPlayerId` unless the user truly selected that id.
- tests should assert that pressing confirm while disabled cannot create a save.

### Acceptance Criteria

- [ ] No new career can start from setup without selecting an athlete in the popup.
- [ ] No disposable run can start from setup without selecting an athlete in the popup.
- [ ] Cancel and Escape close the modal and do not create or alter a save.
- [ ] Replacement confirm flows preserve the athlete selected in the popup.
- [ ] Profile viewing cannot accidentally start, confirm, or reset the selected athlete.

### Verification

- [ ] Extend setup tests for no-selection confirm.
- [ ] Extend app tests for replacement flows if existing save prompts are involved.
- [ ] Manually check keyboard flow: open modal, Tab through controls, Escape, reopen, select, confirm.

### Dependencies

Can run in parallel with Issue E, but both teams must coordinate on `SetupView` state names to avoid conflicts.

### Files Likely Touched

- `components/SetupView.tsx`
- `app/App.tsx`
- `tests/unit/setup-view.test.tsx`
- optional: `tests/unit/app-career-shell.test.tsx`

### Estimated Scope

Small to Medium: 2-4 files.

## 11. Integration Flow To Prove

The following scenario should pass end-to-end:

```text
1. Start New Career.
2. Browse All Athletes.
3. Select an athlete outside the recommendation set.
4. Confirm career.
5. Enter Metro Open.
6. Advance days until event start.
7. On event start date, topbar is red: Play Metro Open R16.
8. Click red button.
9. Opponent Briefing opens with knockout tree.
10. Start and complete match.
11. Review result.
12. Continue after review.
13. Topbar is green if next round is tomorrow.
14. Advance to next day.
15. Topbar is red for next round.
```

This scenario directly proves the requested mechanism:

$$
\text{red button} = \text{unfinished required event work}
$$

and:

$$
\text{green button} = \text{safe to advance the calendar}
$$

## 12. Testing Matrix

| Area | Test Type | Scenario | Expected Result |
| --- | --- | --- | --- |
| Daily resolver | Unit | entered event due today | `play_scheduled_match`, tone `required` |
| Daily resolver | Unit | between rounds before next date | `advance_day`, tone `ready` |
| Topbar | React unit | match due today | red button, `Play <event> <round>` |
| Topbar | React unit | no required work | green `Advance Day` |
| Calendar | React unit | entered event on start date | enabled `Play` action |
| Calendar | React unit | completed event | not playable |
| Store | Unit | red match route | date unchanged, `stage = "pre_match"`, tournament exists |
| Store | Unit | green advance | date increments one day |
| Athlete modal | React unit | select last-ranked career athlete | `onStartCareer(lastRankedId)` |
| Athlete modal | React unit | select last-ranked quick athlete | `onStartTournament(lastRankedId)` |
| Athlete modal | React unit | cancel before selection | no start callback |
| Accessibility | Manual/React | keyboard browse and confirm | focus remains inside modal |

## 13. Suggested Implementation Order

### Phase 1: Foundation

- [ ] Add `getCareerDailyAction(...)`.
- [ ] Add unit tests for daily action priority.
- [ ] Add explicit store action for opening a scheduled career match.

Checkpoint:

- [ ] Store still blocks direct unsafe advancement.
- [ ] Resolver and store agree on when a match is due.

### Phase 2: Smart Topbar

- [ ] Wire topbar label and tone to `getCareerDailyAction(...)`.
- [ ] Replace `handleShellContinue()` career logic with action-kind routing.
- [ ] Add red/green styles and tests.

Checkpoint:

- [ ] Due match is red before click.
- [ ] Safe day is green before click.

### Phase 3: Playable Calendar Events

- [ ] Replace `calendarEventActionLabel(...)` with `calendarEventActionFor(...)`.
- [ ] Stop disabling all entered event rows.
- [ ] Route due event actions to scheduled match opening.
- [ ] Add Calendar action tests.

Checkpoint:

- [ ] Entered event can be played from Calendar and from the topbar.

### Phase 4: Full Athlete Browse

- [ ] Convert `rosterBrowseOpen` into a modal view state.
- [ ] Render browse as a full-screen or near full-screen selection surface.
- [ ] Preserve selection across filtering, sorting, and mode switches.
- [ ] Add tests for selecting non-recommended and last-ranked athletes.

Checkpoint:

- [ ] Every roster athlete is selectable for career and quick disposable run.

### Phase 5: Gate And Polish

- [ ] Confirm no start path bypasses explicit athlete selection.
- [ ] Verify replacement-save prompts preserve the selected athlete.
- [ ] Perform the full integration flow from section 11.

Checkpoint:

- [ ] Ready for review and manual playtest.

## 14. Parallelization Guidance

Safe parallel work:

- Issue A can be owned by a domain engineer.
- Issue E can be owned by a setup UI engineer at the same time.
- Test scaffolding for athlete selection can begin immediately.

Must coordinate:

- Issue B and Issue C both need the scheduled-match opening action.
- Issue E and Issue F both touch `SetupView` state.
- Any changes to store action signatures must be reflected in App and tests together.

Recommended split for three engineers:

| Engineer | Scope |
| --- | --- |
| Engineer 1 | Daily action resolver, store scheduled-match action, core tests |
| Engineer 2 | Topbar + Calendar event action wiring |
| Engineer 3 | Full-screen athlete browse + mandatory selection tests |

## 15. Risks And Mitigations

| Risk | Impact | Mitigation |
| --- | --- | --- |
| Resolver and store guard disagree | High | Make resolver call the same schedule helper as `advanceCareerDay` |
| Red topbar action accidentally advances date | High | Add store test that due-match route leaves `career.date` unchanged |
| Calendar still uses disabled entered rows | High | Replace label-only function with action object and test entered due event |
| Browse mode becomes visually too large or scroll-heavy | Medium | Use full-height modal with sticky header/footer and one scroll region |
| Selection state is lost when filters change | Medium | Keep selected id independent from filtered results |
| Profile route interrupts mandatory modal | Medium | Prefer inline profile/dossier preview or preserve modal state on return |
| Replacement-save prompt falls back to old selected player | Medium | Persist pending selected id through confirmation flow |

## 16. Definition Of Done

Plan 2 is complete when:

- [ ] The topbar button is green only when today's required work is complete.
- [ ] The topbar button is red when an unplayed game or event action blocks date advancement.
- [ ] The red button routes to the exact match or review action, not to a generic Calendar page.
- [ ] Entered Calendar events can be clicked and played when due.
- [ ] The event row no longer treats `entered` as a disabled terminal state.
- [ ] Career and disposable-run starts both require explicit athlete selection.
- [ ] `Browse All Athletes` is large enough to function as a dedicated selection UI.
- [ ] Any athlete in the roster can be selected and confirmed.
- [ ] Unit tests cover the resolver, topbar, Calendar event action, store route, and athlete browse selection.

## 17. Out Of Scope For This Pass

Keep Plan 2 focused. These are valuable but should not block the rescue MVP unless already nearly done:

- full official tournament draw simulation for all non-managed matches by exact real-world match order
- multi-event entry queues
- calendar inbox/news module
- animated transition system for day advancement
- advanced player profile compare mode inside athlete selection
- full e2e automation beyond a focused smoke route

The rescue target is crisp:

```text
One smart button guides the career day.
Entered events can actually be played.
Every new run starts with an explicit controlled athlete.
```
