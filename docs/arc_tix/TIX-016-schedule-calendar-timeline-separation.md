# TIX-016: Schedule Calendar And Timeline Separation

Status: Draft mediation ticket
Priority: High
Target project: `BadmintonManager`
Target screens: career shell sidebar, career schedule route, schedule subtabs, calendar grid, timeline view
Prepared on: 2026-05-19
Primary files: `app/App.tsx`, `app/pages.ts`, `components/CareerWorkbench.tsx`, `game/career/matchSchedule.ts`, `game/career/events.ts`, `game/career/models.ts`, `styles.css`, `tests/unit/career-calendar-ranking.test.ts`, `tests/unit/app-career-shell.test.tsx`, `e2e/app.spec.ts`
Reference input: `docs/scratchpad.md` lines 4-31
Related archived tickets: `docs/arc_tix/TIX-010-command-rail-competition-route-cleanup.md`, `docs/arc_tix/TIX-014-calendar-view-commitments-tab.md`

## 1. Commander Intent

Rename the current career `Calendar` command to `Schedule`.

`Schedule` becomes the broader planning hub. Inside it, keep the existing event-list behavior, preserve the current chronological calendar-style display as `Timeline`, and add a new true `Calendar` subtab that behaves like a Football Manager-style month grid.

The key separation is:

$$
\text{Schedule} = \text{Upcoming} + \text{Past Events} + \text{Timeline} + \text{Calendar}
$$

where:

$$
\text{Timeline} = \text{chronological event log}
$$

and:

$$
\text{Calendar} = \text{month-grid of confirmed commitments}
$$

The calendar must show confirmed reality, not possible futures.

## 2. Problem Statement

The current `Calendar View` reads more like a chronological event log than a real manager calendar. It lists tournament milestones and possible knockout rounds in sequence, which makes the page feel like a chronicle rather than a trusted schedule.

For a sports-management game, the calendar should behave like the manager's working diary. It should answer:

- What have I already played?
- What am I definitely committed to?
- What deadline or scheduled event is actually on the books?

It should not imply that future knockout rounds are confirmed personal fixtures before the player has qualified for them.

## 3. Navigation Contract

Rename the left command rail item:

```text
Calendar -> Schedule
```

The `Schedule` route should contain these subtabs, in this order:

```text
Upcoming | Past Events | Timeline | Calendar
```

Subtab responsibilities:

| Subtab | Responsibility |
| --- | --- |
| `Upcoming` | Future entered events, open deadlines, and confirmed upcoming commitments in list form. |
| `Past Events` | Completed tournaments, archived outcomes, results, rewards, and historical records. |
| `Timeline` | The current chronological event-log style view, moved out of the calendar identity. |
| `Calendar` | New real month-grid schedule showing only confirmed commitments. |

Do not remove useful existing content. Re-home it under the clearer label.

## 4. Calendar Data Contract

The new `Calendar` subtab should only show commitments that are actually confirmed.

Include:

- matches already played,
- matches definitely scheduled because the managed player has entered and qualified for that round,
- confirmed first-round matches once the draw exists,
- entry deadlines for entered or manager-relevant events,
- draw publication dates for entered events,
- travel, recovery, or training blocks only when they are real commitments in the career schedule.

Exclude:

- possible future knockout rounds before qualification,
- speculative opponents,
- projected finals paths,
- generic tournament-wide milestones that do not create a manager commitment,
- bracket possibilities that belong on the tournament home or timeline.

The operating rule is:

$$
\text{Calendar Entry} \iff \text{played} \lor \text{confirmed scheduled commitment}
$$

For knockout events:

$$
\text{Future Round Visible} \iff \text{managed player has qualified for that round}
$$

## 5. Timeline Data Contract

The existing chronological display should become `Timeline`.

Timeline may include broader event progression such as:

- ranking cutoff,
- seeding snapshot,
- entry deadline,
- withdrawal deadline,
- draw published,
- event start,
- event end,
- tournament-wide round structure,
- archived event notes.

Timeline is allowed to describe the event's structure and history. Calendar should only claim confirmed manager commitments.

## 6. UI Contract

The `Calendar` subtab should use a real month-grid layout rather than date-grouped rows.

Required behavior:

- separate months with clear month headings,
- render a grid with weekday columns,
- show confirmed commitments inside date cells,
- visually distinguish completed results from future confirmed commitments,
- keep event badges compact enough for desktop and mobile,
- make commitment badges open the relevant tournament home or match detail when practical,
- avoid horizontal overflow on mobile.

Suggested badge states:

| State | Visual Meaning |
| --- | --- |
| Completed match | Result badge with `W` or `L`. |
| Confirmed future match | Solid upcoming commitment badge. |
| Deadline | Distinct deadline badge. |
| Travel/recovery/training | Secondary schedule badge, if implemented. |

Do not show faint or dotted speculative knockout rounds in the main calendar. Those belong in tournament pages or timeline surfaces.

## 7. Relationship To Tournament Home

Tournament pages remain responsible for possible paths, bracket projections, full draws, and scenario pressure.

The schedule calendar should not duplicate the full bracket.

Use this split:

$$
\text{Tournament Home} = \text{possible path} + \text{draw} + \text{stakes}
$$

$$
\text{Schedule Calendar} = \text{confirmed date commitments}
$$

If a manager wants to inspect unearned future rounds, they should open the tournament page, not the calendar.

## 8. Absolute Rules

- Do not label the current chronological event log as the final calendar.
- Do not show future knockout matches in `Calendar` before the managed player qualifies for them.
- Do not fabricate opponents before the draw or bracket state confirms them.
- Do not remove `Upcoming` or `Past Events`.
- Do not lose the existing chronological display; move it to `Timeline`.
- Do not leave sidebar, route, tests, or page labels using `Calendar` as the top-level command after it becomes `Schedule`.
- Do not break existing match-day routing, tournament home links, or player profile links.

## 9. Acceptance Criteria

- [ ] The left command rail shows `Schedule` instead of `Calendar`.
- [ ] The schedule screen has `Upcoming`, `Past Events`, `Timeline`, and `Calendar` subtabs in that order.
- [ ] The current chronological calendar/event-log display is available under `Timeline`.
- [ ] The new `Calendar` subtab uses a real month-grid layout.
- [ ] The month-grid calendar only shows played matches and definitely scheduled future commitments.
- [ ] Future knockout rounds are hidden until the managed player has qualified for them.
- [ ] Confirmed first-round matches appear once the player is entered and the draw is published.
- [ ] Completed matches show result state, including `W` or `L` where available.
- [ ] Calendar commitment clicks open the relevant tournament or match detail when practical.
- [ ] Existing `Upcoming` and `Past Events` behavior remains intact.
- [ ] Desktop and mobile layouts have no horizontal overflow.

## 10. Verification

Run:

```bash
npm run test -- tests/unit/career-calendar-ranking.test.ts
npm run test -- tests/unit/app-career-shell.test.tsx
npx playwright test e2e/app.spec.ts
npm run build
```

Add or update tests for:

- sidebar label change from `Calendar` to `Schedule`,
- schedule subtab order,
- timeline preservation,
- month-grid rendering,
- knockout-round gating.

## 11. Definition Of Done

The schedule area reads like a manager's diary, not a chronicle:

$$
\text{Schedule}
\rightarrow
\begin{cases}
\text{Timeline: what happened and when} \\
\text{Calendar: what is confirmed on my actual dates}
\end{cases}
$$

The user can trust that anything shown in the `Calendar` grid is either already played or genuinely scheduled.
