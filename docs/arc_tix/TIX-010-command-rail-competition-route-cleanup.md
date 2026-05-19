# TIX-010: Command Rail Competition Route Cleanup

Status: Draft implementation ticket
Priority: High
Target project: `BadmintonManager`
Target screens: career shell sidebar, pre-match bracket, live-match route, Calendar, quick tournament bracket
Prepared on: 2026-05-19
Primary files: `app/App.tsx`, `app/pages.ts`, `components/CareerWorkbench.tsx`, `components/OverviewView.tsx`, `tests/unit/app-career-shell.test.tsx`, `e2e/app.spec.ts`
Reference input: `docs/scratchpad.md` item 3

## 1. Commander Intent

Remove `Competitions` from the left command rail.

Preserve the current bracket/pre-match screen, but route it through `Live Match` before a live match begins.

The new command model is:

$$
\text{Calendar} = \text{event list and commitments}
$$

$$
\text{Live Match} = \text{pre-match briefing} \rightarrow \text{live match}
$$

`Competitions` should no longer exist as a permanent sidebar command.

## 2. Problem Statement

The `Competitions` sidebar button currently overlaps with Calendar, bracket, quick tournament, and pre-match routing. It is a legacy command that adds ambiguity after the career shell has become more structured.

The screen it points to is still useful, especially before a live match starts. The command label is the problem, not the pre-match/bracket surface.

## 3. Required Routing Behavior

Remove:

- `CommandId = "competitions"`,
- the `Competitions` shell command,
- command rail tests expecting `Competitions`.

Preserve:

- quick tournament bracket access,
- career pre-match briefing,
- active bracket tree,
- day-advance route safety,
- post-match continuation route safety.

Route behavior must become:

| State | `Live Match` command opens |
| --- | --- |
| career `pre_match` | pre-match briefing / bracket screen |
| active live match | live match command center |
| no due match | match planning |
| quick tournament bracket ready | bracket overview |
| quick tournament live | live match command center |

## 4. Absolute Rules

- Do not remove the bracket/pre-match screen.
- Do not break `Advance Day`, `Play Match`, `Review Match`, or scheduled-match routing.
- Do not send a due career match back to Calendar when the player clicked `Live Match`.
- Do not leave dead `competitions` branches in `activateCommand`, `commandIdForPage`, or tests.
- Keep `Calendar` responsible for event browsing and entry.

## 5. Acceptance Criteria

- [ ] The sidebar no longer shows `Competitions`.
- [ ] `Live Match` opens `Opponent Briefing` when a career match is due and not yet started.
- [ ] `Live Match` opens the live command center during a live match.
- [ ] `Live Match` opens match planning when no match is due.
- [ ] Quick tournament bracket/pre-match access remains available through phase-aware routing.
- [ ] `commandIdForPage({ id: "bracket" })` maps to `live`, not `competitions`.
- [ ] Unit and e2e tests no longer query or assert `Competitions`.

## 6. Verification

Run:

```bash
npm run test -- tests/unit/app-career-shell.test.tsx
npx playwright test e2e/app.spec.ts
npm run build
```

## 7. Definition Of Done

The command rail reads cleanly:

$$
\text{Calendar for schedule}
\quad
\text{Live Match for match path}
$$

No duplicate competition command remains.

