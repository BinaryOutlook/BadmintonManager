# TIX-014: Calendar View Commitments Tab

Status: Draft implementation ticket
Priority: High
Target project: `BadmintonManager`
Target screen: Career `Calendar`
Prepared on: 2026-05-19
Primary files: `components/CareerWorkbench.tsx`, `game/career/matchSchedule.ts`, `game/career/events.ts`, `game/career/models.ts`, `styles.css`, `tests/unit/career-calendar-ranking.test.ts`, `tests/unit/app-career-shell.test.tsx`, `e2e/app.spec.ts`
Reference input: `docs/scratchpad.md` item 7

## 1. Commander Intent

Add a third Calendar subtab named `Calendar View`.

It should show the managed player's commitments like a real schedule: dates, competition, round, opponent, and past W/L result.

The existing tabs remain:

```text
Upcoming | Past Events | Calendar View
```

## 2. Display Contract

Each calendar commitment should read like:

```text
Harbor Open: Semi-Final
Backhand Mirage
```

If no opponent is decided yet:

```text
Harbor Open: Semi-Final
TBD
```

Past matches should include result:

```text
Harbor Open: Semi-Final (W)
Backhand Mirage
```

or:

```text
Harbor Open: Semi-Final (L)
Backhand Mirage
```

The competition/round line should be bold.

## 3. Data Contract

Create a view model that resolves:

- future scheduled managed matches from entered events and match schedule,
- active tournament next opponent when known,
- `TBD` when the bracket has not produced an opponent,
- completed managed matches from career match/history records,
- W/L marker for completed matches.

Minimum shape:

```ts
type CalendarCommitment = {
  date: string;
  eventId: string;
  eventName: string;
  round: "R16" | "QF" | "SF" | "F";
  opponentId: string | null;
  opponentLabel: string;
  result: "W" | "L" | null;
};
```

## 4. UI Contract

The tab should feel like a calendar, not another event table.

Required layout:

- date-grouped rows or week blocks,
- bold competition/round line,
- opponent line below,
- `TBD` for undecided opponents,
- `(W)` or `(L)` marker for past results,
- player profile link for known opponents,
- empty state when no commitments exist.

## 5. Relationship To Tournament Home

This tab is a schedule index. It does not replace the tournament home.

Clicking a commitment should open the tournament home for that event when practical:

**Commitment → Tournament Home**

Player name clicks should still open player profiles.

## 6. Absolute Rules

- Do not duplicate the full Upcoming event table.
- Do not hide Upcoming or Past Events tabs.
- Do not fabricate opponents before the draw exists.
- Do not show past result markers without recorded outcomes.
- Do not break the existing scheduled-match day resolver.
- Keep the tab mobile readable with no horizontal overflow.

## 7. Acceptance Criteria

- [ ] Calendar has `Upcoming`, `Past Events`, and `Calendar View` tabs.
- [ ] Calendar View shows future commitments grouped by date.
- [ ] Calendar View shows `Competition Name: Round` in bold.
- [ ] Known opponents appear below and open player profiles.
- [ ] Undecided opponents render as `TBD`.
- [ ] Past commitments include `(W)` or `(L)`.
- [ ] Commitment rows open the tournament home or event details for the event.
- [ ] Existing Upcoming and Past Events behavior remains intact.

## 8. Verification

Run:

```bash
npm run test -- tests/unit/career-calendar-ranking.test.ts
npm run test -- tests/unit/app-career-shell.test.tsx
npx playwright test e2e/app.spec.ts
npm run build
```

## 9. Definition Of Done

The Calendar gains a true schedule lens:

**date → competition round → opponent/result**

