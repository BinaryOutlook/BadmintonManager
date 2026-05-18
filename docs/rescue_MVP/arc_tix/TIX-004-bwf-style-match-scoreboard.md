# TIX-004: Convert Match Scoreboard To BWF-Style Set Scoreline

Status: Draft implementation ticket
Priority: High
Target project: `BadmintonManager`
Target screen: `Match Command Center`
Prepared on: 2026-05-18
Primary files: `components/MatchView.tsx`, `styles.css`, `tests/unit/match-view.test.tsx`, `e2e/match-command-center.spec.ts`
Reference input: `docs/rescue_MVP/plan4.md`, screenshots from 2026-05-18 18:18 and 18:19

## 1. Problem Statement

The current live match scoreboard is much better than the original oversized block, but the screenshot still shows a structural mismatch with real badminton broadcasts:

```text
Player / Side          Srv   S1   S2   Current
Three-Lung Dynamo       *    -    -       0
Nordic Tower                 -    -       0
```

The issue is not just the word `Current`. The whole table is still exposing an internal implementation idea:

\[
\text{Completed set columns} + \text{separate live-score column}
\]

A badminton viewer expects:

\[
\text{Set 1 score} + \text{Set 2 score} + \text{Set 3 score if needed}
\]

The live game score should live inside the active set column. Future sets should not be visually advertised before the match reaches them.

In the provided screenshot, the eye reads `S1`, `S2`, and `Current` as three different score concepts. That makes the match state feel less like a BWF-sanctioned broadcast scoreline and more like a debug dashboard.

## 2. User-Facing Diagnosis

The screenshots expose four concrete problems:

1. **`Current` is the wrong mental model.** The ongoing game is not a separate scoreboard dimension. It is the current set.
2. **Future set labels appear too early.** At `0-0` in set 1, `S2` should not be readable yet. `S3` should only become relevant if the match reaches a deciding game.
3. **Player identity is missing nationality context.** The roster already carries three-letter nationality codes such as `CHN`, `MAS`, `JPN`, and `SGP`; the scoreboard should use them before each name.
4. **The name column is too loose.** The screenshot shows unused horizontal space after player names, while the scoreboard still spends a full column on `Srv` and a separate `Current` column.

The desired direction is:

```text
Player / Side             S1
SGP Three-Lung Dynamo *    0
SWE Nordic Tower           0
```

Then, after set 1 completes and set 2 is live:

```text
Player / Side             S1   S2
SGP Three-Lung Dynamo *   21    8
SWE Nordic Tower          17    6
```

And only if a third set is reached:

```text
Player / Side             S1   S2   S3
SGP Three-Lung Dynamo     21   18    9
SWE Nordic Tower          17   21   11
```

## 3. Objective

Replace the current `S1 / S2 / Current` scoreboard with a true best-of-three set scoreline.

The target model is:

\[
\text{Broadcast Scoreline}
=
\text{Nationality + Name + Server}
+ \text{Visible Set Columns}
\]

Where:

\[
\text{Visible Set Columns}
=
\text{played sets}
+ \text{active set}
\]

and:

\[
\text{future unplayed sets} = \text{not visibly labeled}
\]

This is a presentation and UX semantics ticket. It should not change scoring rules, match engine probability, rally resolution, set completion logic, or career/tournament progression.

## 4. Scope

### In Scope

- Update `ScoreboardPanel` in `components/MatchView.tsx`.
- Remove the visible `Current` or `Final` column.
- Render the active game score under the active set number.
- Hide or ghost future set columns until they are played or active.
- Support up to three set columns for best-of-three badminton.
- Add each player's `nationality` code before the name.
- Reclaim horizontal space in the player/server area.
- Update CSS for the new dynamic column structure.
- Update unit and e2e tests to cover set 1, set 2, and set 3 display states.
- Visually verify desktop and mobile screenshots.

### Out Of Scope

- No change to point scoring rules.
- No change to set-winning rules.
- No change to match completion rules.
- No change to the tactical viewer, telemetry, directives, or live feed.
- No new flag images or external country assets.
- No broad redesign of the whole Match Command Center beyond spacing needed for the scoreboard.

## 5. Design Principle

The scoreboard should read like a sports broadcast, not like a data table.

\[
\text{Good Match Scoreboard}
=
\frac{\text{instant score comprehension} + \text{player identity}}
{\text{implementation labels} + \text{unused columns}}
\]

That means:

- no `Current` label,
- no future set label while the set is irrelevant,
- no redundant match-state explanation in the table,
- compact identity cells with nationality, name, and server state.

## 6. Required Scoreboard Behavior

### 6.1 Set 1 Before Any Point

At match start, only `S1` should be visibly labeled.

Target:

```text
Player / Side             S1
SGP Three-Lung Dynamo *    0
SWE Nordic Tower           0
```

Requirements:

- Show current score `0` and `0` under `S1`.
- Do not show visible `S2` or `S3` labels.
- Do not show a `Current` column.
- Keep server status visible.
- Keep the `Games 0-0` topline if useful, but do not use it to compensate for unclear set columns.

### 6.2 Set 1 In Progress

During set 1:

```text
Player / Side             S1
SGP Three-Lung Dynamo *   11
SWE Nordic Tower           8
```

Requirements:

- Keep the active score under `S1`.
- Server marker updates as service changes.
- No future set text appears.

### 6.3 Set 2 In Progress

After set 1 is complete and set 2 is live:

```text
Player / Side             S1   S2
SGP Three-Lung Dynamo     21    5
SWE Nordic Tower          17    7
```

Requirements:

- `S1` displays the completed set score from `setSummaries[0]`.
- `S2` displays `currentScoreA/currentScoreB`.
- `S3` remains visually absent until the match reaches set 3.
- If the app enters a between-set intermission before set 2 starts, do not show a misleading third concept such as `Current`; either keep the next active set at `0-0` if the session model has already advanced, or show only completed sets plus the upcoming-set action context in the controls.

### 6.4 Set 3 In Progress

If the match reaches a deciding set:

```text
Player / Side             S1   S2   S3
SGP Three-Lung Dynamo     21   18   13
SWE Nordic Tower          17   21   11
```

Requirements:

- `S1` and `S2` display completed summaries.
- `S3` displays the active game score.
- No `Current` column exists.

### 6.5 Match Complete

At match completion, show only the sets that were played.

Two-set match:

```text
Player / Side             S1   S2
SGP Three-Lung Dynamo     21   21
SWE Nordic Tower          17   19
```

Three-set match:

```text
Player / Side             S1   S2   S3
SGP Three-Lung Dynamo     21   18   21
SWE Nordic Tower          17   21   16
```

Requirements:

- Do not add a `Final` column.
- The completed set columns themselves express the final state.
- The primary action area can say `Advance`; the scoreboard does not need to.

## 7. Player Identity Requirements

Each player row should include nationality before the name.

Current:

```text
Three-Lung Dynamo
Nordic Tower
```

Target:

```text
SGP Three-Lung Dynamo
SWE Nordic Tower
```

Requirements:

- Use `session.input.playerA.nationality` and `session.input.playerB.nationality`.
- Render the nationality as a compact three-letter code before the name.
- The code should be visually distinct but not louder than the player name.
- The player name remains clickable and opens the profile.
- Long names must truncate or wrap gracefully without pushing set columns out of alignment.
- Do not add country flag images in this ticket.

Recommended markup shape:

```tsx
<span className="scoreboard-player-cell" role="cell">
  <span className="scoreboard-nation-code">SGP</span>
  <button className="profile-name-button scoreboard-name-button" type="button">
    Three-Lung Dynamo
  </button>
  <span className="scoreboard-server-dot" aria-label="Serving">*</span>
</span>
```

The exact structure can differ, but nationality, name, click target, and server state must remain accessible.

## 8. Server Marker And Horizontal Space

The current dedicated `Srv` column works, but the screenshot shows that horizontal space can be used better.

Preferred approach:

- Fold the server marker into the player identity cell.
- Remove the separate visible `Srv` column.
- Use a compact marker after the player name or between nationality and name.

Possible target:

```text
Player / Side             S1
SGP * Three-Lung Dynamo    0
SWE   Nordic Tower         0
```

or:

```text
Player / Side             S1
SGP Three-Lung Dynamo *    0
SWE Nordic Tower           0
```

Requirements:

- Preserve an accessible `aria-label` for serving/receiving.
- Avoid increasing the row height.
- Keep alignment stable when the server marker changes sides.
- Do not let the marker cause name text to jump.

If keeping `Srv` is simpler for the first pass, the implementation may retain it only if the name column is still compact and the final scoreboard no longer shows `Current`.

## 9. Implementation Notes

### 9.1 Current Component

The current component in `components/MatchView.tsx` hard-codes:

```tsx
const setColumns = [0, 1];
const currentColumnLabel = props.session.complete ? "Final" : "Current";
```

This is the main source of the screenshot issue.

Replace it with a derived set-column model.

### 9.2 Suggested Set Column Model

Use a small view-model helper inside `MatchView.tsx`, or near `ScoreboardPanel` if the file should stay simple:

```ts
interface BroadcastSetColumn {
  setNumber: 1 | 2 | 3;
  scoreA: number | null;
  scoreB: number | null;
  state: "completed" | "active";
}
```

Suggested derivation:

```ts
function buildBroadcastSetColumns(session: LiveMatchSession): BroadcastSetColumn[] {
  const completed = session.setSummaries.map((summary, index) => ({
    setNumber: (index + 1) as 1 | 2 | 3,
    scoreA: summary.scoreA,
    scoreB: summary.scoreB,
    state: "completed" as const
  }));

  if (!session.complete) {
    const activeSetNumber = Math.min(Math.max(session.currentSetNumber, 1), 3) as 1 | 2 | 3;
    const alreadyCompleted = completed.some((column) => column.setNumber === activeSetNumber);

    if (!alreadyCompleted) {
      completed.push({
        setNumber: activeSetNumber,
        scoreA: session.currentScoreA,
        scoreB: session.currentScoreB,
        state: "active"
      });
    }
  }

  return completed.slice(0, 3);
}
```

The exact code should be adapted to the existing `LiveMatchSession` behavior, especially intermission handling.

### 9.3 CSS Targets

Current selectors likely involved:

- `.broadcast-scoreboard`
- `.broadcast-scoreboard-row`
- `.broadcast-scoreboard-head`
- `.scoreboard-player-cell`
- `.scoreboard-name-button`
- `.server-marker`
- `.current-score-cell`
- `.match-scoreboard-panel`

Recommended new or adjusted selectors:

- `.broadcast-scoreboard-row[data-set-count="1"]`
- `.broadcast-scoreboard-row[data-set-count="2"]`
- `.broadcast-scoreboard-row[data-set-count="3"]`
- `.scoreboard-nation-code`
- `.scoreboard-server-marker`
- `.scoreboard-set-cell`
- `.scoreboard-set-cell-active`
- `.scoreboard-set-cell-completed`

Use CSS grid columns based on set count:

```css
.broadcast-scoreboard-row[data-set-count="1"] {
  grid-template-columns: minmax(8rem, 1fr) minmax(2.6rem, 0.22fr);
}

.broadcast-scoreboard-row[data-set-count="2"] {
  grid-template-columns: minmax(8rem, 1fr) repeat(2, minmax(2.6rem, 0.22fr));
}

.broadcast-scoreboard-row[data-set-count="3"] {
  grid-template-columns: minmax(8rem, 1fr) repeat(3, minmax(2.6rem, 0.22fr));
}
```

Tune values after screenshot review. The point is to avoid a permanent empty `Current` column.

### 9.4 Ghost Columns If Needed

If the layout jumps too much between set states, it is acceptable to keep invisible ghost columns for grid stability.

Rules:

- ghost cells must be `aria-hidden="true"`,
- ghost labels must not be visible,
- ghost text should not be selectable or screen-reader announced,
- ghost cells should visually blend into the panel background,
- the player should perceive only the sets that are active or played.

This can satisfy the user request that future set text not appear while keeping the top band stable.

## 10. Test Requirements

### 10.1 Unit Tests

Update `tests/unit/match-view.test.tsx`.

Required cases:

- Initial set 1 renders `S1`, does not render `Current`, does not render visible `S2` or `S3`.
- Set 2 in progress renders `S1` and `S2`, where `S1` is completed and `S2` is active.
- Set 3 in progress renders `S1`, `S2`, and `S3`.
- Completed two-set match renders only `S1` and `S2`, not `S3`, not `Final`.
- Completed three-set match renders `S1`, `S2`, and `S3`.
- Player rows include nationality codes before or beside player names.
- The active server remains accessible.

Example expectations:

```ts
const scoreboard = screen.getByLabelText("Broadcast match score");
expect(within(scoreboard).getByRole("columnheader", { name: "S1" })).toBeInTheDocument();
expect(within(scoreboard).queryByRole("columnheader", { name: "Current" })).not.toBeInTheDocument();
expect(scoreboard).toHaveTextContent("SGP");
```

### 10.2 E2E Tests

Update `e2e/match-command-center.spec.ts`.

Required e2e coverage:

- At initial match load, no `Current` column is visible.
- The command surface still fits inside desktop viewport at `1440 x 900` and `1366 x 768`.
- After several `Next Point` clicks, the active set score remains under the set column.
- After `Finish Set`, the next visible set behavior is correct.
- No horizontal page overflow is introduced.

## 11. Visual QA Checklist

Capture or inspect screenshots at:

```text
2048 x 1152
1440 x 900
1366 x 768
390 x 844
```

Check:

- `Current` is gone.
- `S2` is not visibly present at the start of set 1.
- `S3` is not visibly present unless the match reaches set 3.
- nationality codes appear before names.
- name cells do not waste excessive horizontal space.
- long names do not overlap score cells.
- server marker is visible and does not cause layout jump.
- scoreboard and match controls still sit in the same top command band.
- no text is clipped in the screenshot thumbnail or full desktop screenshot.

## 12. Acceptance Criteria

- [ ] The scoreboard no longer renders a visible `Current` or `Final` column.
- [ ] The live game score appears under the active set column.
- [ ] Set 1 start state visibly shows only `S1`.
- [ ] Set 2 appears only when it has been played or is the active game.
- [ ] Set 3 appears only when it has been played or is the active deciding game.
- [ ] Completed matches show only the sets that were actually played.
- [ ] Each player row includes the player's three-letter nationality code before the name.
- [ ] Server state remains visible and accessible.
- [ ] Horizontal spacing is tighter than the screenshot baseline, especially around the player-name area.
- [ ] Existing `Next Point`, `Finish Set`, `Open Next Set`, and `Advance` controls keep working.
- [ ] Unit and e2e tests cover the new scoreboard semantics.
- [ ] Desktop and mobile screenshots show no overlap, clipping, or horizontal overflow.

## 13. Verification Commands

Run from `BadmintonManager`:

```bash
npm run build
npm run test
npm run test:e2e
```

If the full e2e suite is too slow during iteration, run the focused match command spec first:

```bash
npx playwright test e2e/match-command-center.spec.ts
```

Then run the full verification before handoff.

## 14. Definition Of Done

This ticket is done when the match scoreline reads like:

\[
\text{Nation + Player + Serve Marker}
+ \text{S1}
+ \text{S2 if relevant}
+ \text{S3 if relevant}
\]

not like:

\[
\text{Player}
+ \text{Srv}
+ \text{S1}
+ \text{S2}
+ \text{Current}
\]

The screenshot should immediately communicate a badminton match state without asking the player to interpret internal UI vocabulary.

