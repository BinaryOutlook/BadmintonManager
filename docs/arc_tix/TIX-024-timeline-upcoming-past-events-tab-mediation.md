# TIX-024: Timeline Upcoming And Past Events Tab Mediation

Status: Draft mediation ticket
Priority: Critical
Target project: `BadmintonManager`
Target screens: left command rail, Timeline route, Timeline event tabs
Prepared on: 2026-05-20
Primary files: `app/App.tsx`, `app/pages.ts`, `components/CareerWorkbench.tsx`, `game/career/events.ts`, `game/career/matchSchedule.ts`, `game/career/calendar.ts`, `styles.css`, `tests/unit/app-career-shell.test.tsx`, `tests/unit/career-calendar-ranking.test.ts`, `e2e/app.spec.ts`
Reference input: `docs/scratchpad.md` line 1
Remediates: `docs/arc_tix/TIX-020-standalone-calendar-month-navigation-remediation.md`
Further sharpens: `docs/arc_tix/TIX-016-schedule-calendar-timeline-separation.md`, `docs/arc_tix/TIX-018-sidebar-schedule-rail-mediation.md`
Related tickets: `docs/arc_tix/TIX-014-calendar-view-commitments-tab.md`, `docs/arc_tix/TIX-015-universal-tournament-addressing-system.md`

## 1. Commander Intent

Make `Timeline` a direct sidebar destination with a clean two-tab event surface:

```text
Upcoming | Past Events
```

`Upcoming` must be the first and default tab. `Past Events` must be a selectable tab beside it, not a loose block buried lower on the page.

The desired product shape is:

$$
\text{Timeline} = \text{Upcoming Event Schedule} + \text{Past Events}
$$

not:

$$
\text{Timeline} =
\text{Event Brief}
+ \text{Week Strip}
+ \text{Milestones}
+ \text{Seeding}
+ \text{Eligibility}
+ \text{Costs}
$$

The Timeline should feel like the manager's event ledger: what is coming next, and what has already happened.

## 2. Mediation Context

`TIX-020` correctly pushed `Calendar` toward a standalone month-grid page. The remaining Timeline surface is still too crowded and contains blocks that belong either on tournament homes, ranking/event detail pages, or nowhere in the main daily workflow.

This ticket keeps the successful direction from `TIX-020` but sharpens the Timeline contract after human review:

- `Timeline` stays in the left sidebar.
- `Upcoming` is the default Timeline tab.
- `Past Events` becomes a real selectable Timeline tab.
- page-level explanatory/detail blocks are removed from Timeline.

## 3. Navigation Contract

The left command rail command `Timeline` must open the Timeline page directly.

Required Timeline tab order:

```text
Upcoming | Past Events
```

Required default:

$$
\text{Timeline open} \Rightarrow \text{active tab} = \text{Upcoming}
$$

The tab control should live near the top of the Timeline content, with `Past Events` selectable to the right of `Upcoming` in normal left-to-right layout.

Do not route Timeline through an old generic `Schedule` wrapper just to preserve obsolete blocks.

## 4. Upcoming Tab Contract

The `Upcoming` tab should preserve the useful behavior of the current upcoming event schedule.

It should show future manager-relevant events and commitments in a compact, navigable list. If the current Upcoming Event Schedule already has its own `Prev` / `Next` paging pattern, preserve that pattern and avoid inventing a second pagination style.

The tab should answer:

$$
\text{What should I care about next?}
$$

Minimum expected content:

- upcoming entered events,
- open or imminent event commitments,
- confirmed scheduled match days where available,
- useful event links into tournament homes or detail pages.

## 5. Past Events Tab Contract

The `Past Events` tab should hold completed or archived event rows.

It should answer:

$$
\text{What already happened in my career world?}
$$

Minimum expected content:

- completed managed events,
- completed universe events where records exist,
- champion or managed-player result where available,
- event date or completed date,
- links into tournament homes, archived event details, or relevant records when available.

If the list can become long, use the same compact paging language as the Upcoming Event Schedule.

## 6. Blocks To Remove From Timeline

Remove these blocks from the Timeline page:

- `Event Brief`,
- `Week Strip`,
- `Milestones & Seeding`,
- `Eligibility & Costs`.

These blocks are not part of the main Timeline job after this mediation. If any information remains strategically valuable, re-home it to a more specific surface:

| Removed block | Preferred home |
| --- | --- |
| `Event Brief` | tournament home or event detail page |
| `Week Strip` | Calendar page if it becomes a true diary control, otherwise remove |
| `Milestones & Seeding` | tournament home, rankings context, or event detail page |
| `Eligibility & Costs` | event entry flow or tournament home |

Do not keep these blocks on Timeline under renamed headings.

## 7. Absolute Rules

- Do not remove `Timeline` from the left sidebar.
- Do not nest the standalone `Calendar` grid inside Timeline.
- Do not leave `Past Events` as a passive lower-page section.
- Do not keep `Event Brief`, `Week Strip`, `Milestones & Seeding`, or `Eligibility & Costs` on Timeline.
- Do not break event links, match-day routing, or tournament-home navigation.
- Do not regress the `Upcoming` schedule paging pattern.

## 8. Acceptance Criteria

- [ ] Clicking `Timeline` in the left sidebar opens a Timeline page, not the Calendar page.
- [ ] Timeline exposes exactly the primary event tabs `Upcoming` and `Past Events`.
- [ ] `Upcoming` is the first tab and the default active tab.
- [ ] `Past Events` is selectable beside `Upcoming` and shows completed or archived event rows.
- [ ] `Event Brief` is absent from Timeline.
- [ ] `Week Strip` is absent from Timeline.
- [ ] `Milestones & Seeding` is absent from Timeline.
- [ ] `Eligibility & Costs` is absent from Timeline.
- [ ] Existing useful Upcoming Event Schedule paging remains intact.
- [ ] Desktop and mobile layouts avoid overlap, clipping, and horizontal overflow.

## 9. Verification

Run:

```bash
npm run test -- tests/unit/app-career-shell.test.tsx
npm run test -- tests/unit/career-calendar-ranking.test.ts
npx playwright test e2e/app.spec.ts
npm run build
```

Add or update tests for:

- Timeline defaulting to `Upcoming`,
- selecting the `Past Events` tab,
- removal of the four deprecated Timeline blocks,
- preservation of Upcoming schedule paging,
- Calendar remaining a separate route/page.

## 10. Definition Of Done

Timeline becomes a sharp event ledger:

$$
\text{Timeline}
\rightarrow
\begin{cases}
\text{Upcoming: what is next} \\
\text{Past Events: what already happened}
\end{cases}
$$

Everything else moves to the surface that actually owns it.
