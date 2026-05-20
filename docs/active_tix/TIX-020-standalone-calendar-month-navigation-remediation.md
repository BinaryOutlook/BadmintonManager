# TIX-020: Standalone Calendar Month Navigation Remediation

Status: Draft remediation ticket
Priority: Critical
Target project: `BadmintonManager`
Target screens: left command rail, Timeline route, Calendar route, month-grid calendar
Prepared on: 2026-05-20
Primary files: `app/App.tsx`, `app/pages.ts`, `components/CareerWorkbench.tsx`, `game/career/events.ts`, `game/career/calendar.ts`, `styles.css`, `tests/unit/app-career-shell.test.tsx`, `tests/unit/career-calendar-ranking.test.ts`, `e2e/app.spec.ts`
Reference input: `docs/scratchpad.md` item 1
Remediates: `docs/arc_tix/TIX-016-schedule-calendar-timeline-separation.md`, `docs/arc_tix/TIX-018-sidebar-schedule-rail-mediation.md`

## 1. Commander Intent

Make `Calendar` a standalone sidebar destination, not a tab nested inside `Schedule`, `Timeline`, or any other planning wrapper.

The desired mental model is:

$$
\text{Sidebar command} \rightarrow \text{single-purpose page}
$$

Specifically:

$$
\text{Timeline} \ne \text{Calendar container}
$$

and:

$$
\text{Calendar} \ne \text{Timeline subtab}
$$

The Calendar page must show one month at a time, with compact navigation controls in the top-right:

```text
< Previous | Today | Next >
```

`Today` means the current in-game career date, not the user's real operating-system date.

## 2. Why This Remediation Exists

`TIX-016` moved in the right direction by separating chronological timeline content from confirmed calendar commitments. The implementation still left the user-facing structure too nested:

- `Timeline` and `Calendar` are both sidebar commands,
- but both still route into the same `Schedule` page,
- and `Calendar` still appears as an internal tab beside `Timeline`.

That creates a contradictory product contract:

$$
\text{Calendar is standalone}
\quad \text{and} \quad
\text{Calendar is nested}
$$

This ticket removes that contradiction. If the sidebar has a `Calendar` command, clicking it must open the Calendar itself.

The second issue is density. Printing many calendar months at once makes the page feel like a report, not a manager's diary. The Calendar should be a focused month surface with clear movement controls.

## 3. Navigation Contract

The left command rail must expose `Timeline` and `Calendar` as direct commands.

Required behavior:

| Sidebar command | Opens | Must not open |
| --- | --- | --- |
| `Timeline` | A chronological Timeline page | A tabbed Schedule page containing Calendar |
| `Calendar` | A standalone month Calendar page | A tabbed Timeline/Schedule page |

The app page model should stop treating Calendar as a `section` of the old schedule route.

Recommended page contract:

```ts
export type AppPage =
  | { id: "timeline" }
  | { id: "calendar"; monthCursor?: string }
  // existing pages...
```

If `Upcoming` and `Past Events` still need a temporary home, keep them on the Timeline/event-log surface or introduce a later `Event Desk` route. Do not preserve `Calendar` as a nested tab just to keep the old `Schedule` shell alive.

## 4. Timeline Page Contract

`Timeline` is for chronological event context.

It may contain:

- upcoming event list,
- past event list,
- managed match timeline entries,
- event deadlines,
- draw publication dates,
- event start/end milestones,
- historical notes and archive rows.

It must not contain:

- a `Calendar` subtab,
- a month-grid Calendar panel,
- Calendar paging controls,
- any UI suggesting that the Calendar is a child of Timeline.

The operating rule is:

$$
\text{Timeline} = \text{what happened, what is coming, and when}
$$

not:

$$
\text{Timeline} = \text{all schedule features}
$$

## 5. Calendar Page Contract

`Calendar` is for the manager's month diary.

It must show:

- page heading: `Calendar`,
- current visible month label, for example `May 2026`,
- top-right controls: previous month, today, next month,
- one month grid only,
- seven weekday columns,
- five or six week rows depending on the month,
- compact entries inside date cells,
- muted overflow days from adjacent months if needed for grid alignment.

It must not show:

- multiple months printed down the page,
- a `Timeline` tab,
- an `Upcoming` tab,
- a `Past Events` tab,
- speculative knockout rounds,
- a full bracket or tournament path.

The Calendar page answers one question:

$$
\text{What is actually on my diary this month?}
$$

## 6. Month Navigation Contract

Month navigation must be UI-local. It must not advance the career date or mutate simulation state.

Default month:

$$
\text{default month} = \operatorname{month}(\texttt{career.date})
$$

Control behavior:

| Control | Behavior |
| --- | --- |
| Previous | Move the visible month cursor back by one month. |
| Today | Reset the visible month cursor to the month containing `career.date`. |
| Next | Move the visible month cursor forward by one month. |

Minimum helper shape:

```ts
type CalendarMonthCursor = string; // YYYY-MM-01

type CalendarMonthViewModel = {
  cursor: CalendarMonthCursor;
  label: string;
  weeks: CalendarMonthWeek[];
  visibleRange: {
    startDate: string;
    endDateExclusive: string;
  };
  entries: ScheduleCalendarEntry[];
};

type CalendarMonthWeek = {
  days: Array<{
    date: string;
    dayNumber: number;
    inVisibleMonth: boolean;
    isCareerToday: boolean;
    entries: ScheduleCalendarEntry[];
  }>;
};
```

The visible month cursor may live in React state. If page state stores it, use `YYYY-MM-01` and keep it deterministic.

## 7. Calendar Data Contract

Reuse the confirmed-commitment rule from `TIX-016`, but render only entries inside the visible month.

The rule remains:

$$
\text{Calendar entry} \iff \text{played match} \lor \text{confirmed scheduled commitment} \lor \text{manager-relevant deadline}
$$

For knockout rounds:

$$
\text{future round visible} \iff \text{managed player has qualified for that round}
$$

Implementation guidance:

- `scheduleCalendarEntriesForCareer` may continue to build all confirmed entries.
- Add a month filter/view-model helper rather than making the component slice dates manually.
- Sort entries within a date by playable match, confirmed match, deadline, then secondary item.
- Do not include unearned `QF`, `SF`, or `F` placeholders.
- Do not invent opponents before the draw or match resolver knows them.

Minimum month filter:

```ts
function scheduleCalendarMonthForCareer(args: {
  career: CareerState;
  tournament: TournamentState | null;
  monthCursor: CalendarMonthCursor;
}): CalendarMonthViewModel;
```

## 8. UI Contract

Required top-right control layout:

```text
Calendar                                      <  Today  >
May 2026
```

Use icon buttons if the current UI icon system supports them. If not, text buttons are acceptable for this remediation, but labels must be concise:

- `Back`
- `Today`
- `Forward`

Accessibility requirements:

- previous control has `aria-label="Previous month"`,
- today control has `aria-label="Show current career month"`,
- next control has `aria-label="Next month"`,
- month grid has an accessible label such as `Calendar for May 2026`,
- date cells expose their full date in an accessible label.

Responsive requirements:

- the grid must not horizontally overflow on mobile,
- badge text must truncate or wrap cleanly inside cells,
- controls must remain reachable above the grid,
- date cell dimensions must be stable when entries appear.

## 9. Implementation Notes

Likely code changes:

- split `CareerCalendarPage` into narrower page components, or create wrappers:
  - `CareerTimelinePage`
  - `CareerCalendarMonthPage`
- update `AppPage` so `Timeline` and `Calendar` are first-class pages,
- update `commandIdForPage` so the active rail state maps directly to each route,
- remove the `Timeline` / `Calendar` tab pairing from the Calendar surface,
- replace any multi-month rendering with a single visible month view model,
- keep tournament and player links working inside badges.

Existing tests that expect `Timeline` and `Calendar` to route into the same `Schedule` split should be rewritten. That old behavior is now the bug.

## 10. Absolute Rules

- Do not leave `Calendar` as a tab inside `Timeline`.
- Do not leave `Calendar` as a tab inside `Schedule`.
- Do not make the sidebar `Calendar` command open a page headed `Schedule`.
- Do not render multiple calendar months at once.
- Do not make `Today` use the operating-system date.
- Do not mutate `career.date` when changing visible months.
- Do not show speculative future knockout rounds before qualification.
- Do not break tournament-home links, player-profile links, or playable due-match actions.

## 11. Acceptance Criteria

- [ ] The sidebar `Timeline` command opens a page headed `Timeline`.
- [ ] The sidebar `Calendar` command opens a page headed `Calendar`.
- [ ] `Calendar` is not rendered as a tab inside the Timeline page.
- [ ] `Calendar` is not rendered as a tab inside a Schedule page.
- [ ] The Calendar page renders exactly one visible month grid at a time.
- [ ] The Calendar page has top-right previous, today, and next controls.
- [ ] `Today` resets the visible month to the month containing `career.date`.
- [ ] Previous/next controls change only the visible month, not the career date.
- [ ] Calendar entries are filtered to the visible month.
- [ ] Confirmed commitment gating from `TIX-016` still holds.
- [ ] Mobile and desktop layouts avoid overlap, clipping, and horizontal overflow.
- [ ] Tests no longer assert that Timeline and Calendar route into the same tabbed Schedule split.

## 12. Verification

Run:

```bash
npm run test -- tests/unit/app-career-shell.test.tsx
npm run test -- tests/unit/career-calendar-ranking.test.ts
npx playwright test e2e/app.spec.ts
npm run build
```

Add or update focused tests for:

- sidebar `Timeline` opens a standalone Timeline page,
- sidebar `Calendar` opens a standalone Calendar page,
- no `Calendar` tab appears inside Timeline,
- exactly one `.schedule-calendar-month` or replacement month container renders,
- previous/today/next month controls update the visible month correctly,
- `Today` uses `career.date`,
- future knockout rounds remain gated.

## 13. Definition Of Done

The navigation reads plainly:

$$
\text{Timeline} \rightarrow \text{chronological event context}
$$

$$
\text{Calendar} \rightarrow \text{one-month manager diary}
$$

There is no nested Calendar ambiguity left for the user, and the Calendar page no longer feels like a printed report.
