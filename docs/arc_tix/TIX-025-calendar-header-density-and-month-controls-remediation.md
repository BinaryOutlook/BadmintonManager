# TIX-025: Calendar Header Density And Month Controls Remediation

Status: Draft remediation ticket
Priority: Critical
Target project: `BadmintonManager`
Target screens: Calendar route, month-grid calendar
Prepared on: 2026-05-20
Primary files: `app/App.tsx`, `app/pages.ts`, `components/CareerWorkbench.tsx`, `game/career/calendar.ts`, `game/career/events.ts`, `game/career/matchSchedule.ts`, `styles.css`, `tests/unit/app-career-shell.test.tsx`, `tests/unit/career-calendar-ranking.test.ts`, `e2e/app.spec.ts`
Reference input: `docs/scratchpad.md` lines 2-23
Remediates: `docs/arc_tix/TIX-020-standalone-calendar-month-navigation-remediation.md`
Further sharpens: `docs/arc_tix/TIX-016-schedule-calendar-timeline-separation.md`, `docs/arc_tix/TIX-014-calendar-view-commitments-tab.md`
Related ticket: `docs/active_tix/TIX-024-timeline-upcoming-past-events-tab-mediation.md`

## 1. Commander Intent

Clean the standalone `Calendar` page so it reads like a focused manager diary, not a diagnostic dashboard.

The Calendar should show one authoritative visible month label, one compact month-control row, and one month grid.

The desired shape is:

$$
\text{Calendar} =
\text{Month label}
+ \texttt{<< Today >>}
+ \text{month grid}
$$

not:

$$
\text{Calendar} =
\text{repeated month labels}
+ \text{career diagnostics}
+ \text{distant header controls}
+ \text{month grid}
$$

## 2. Why This Remediation Exists

Human review of `TIX-020` found the core direction sound, but the page is still too noisy:

- the month/year appears three times,
- the first two month/year occurrences should be removed,
- the diagnostic block beginning with `Career today` should be removed,
- month controls are too far away from the calendar grid,
- `Back Today Forward` should become the compact control language `<< Today >>`.

This ticket turns the Calendar page from an implementation readout into a practical visual diary.

## 3. Month Label Contract

There must be exactly one user-visible month/year label for the active calendar month.

Example:

```text
July 2026
```

If the current page has three visible occurrences, remove the first two and keep the one that sits closest to the actual month grid.

The invariant is:

$$
\operatorname{count}(\text{visible month-year label}) = 1
$$

Do not replace the duplicate labels with synonyms that create the same visual repetition.

## 4. Diagnostic Block Removal

Remove the full Calendar metadata block that currently presents implementation state as page content.

The removed block includes:

```text
Career today
2026-07-31

Visible month
July 2026

Visible range
2026-07-01 - 2026-07-31

Diary entries
3

Scope
Confirmed only
```

This information may remain in tests, dev tools, fixtures, or debug-only helpers, but it should not appear in the normal Calendar UI.

The user-facing Calendar should answer:

$$
\text{What is on my diary this month?}
$$

not:

$$
\text{What view-model fields did the component compute?}
$$

## 5. Month Control Contract

Replace the visible `Back Today Forward` language with:

```text
<< Today >>
```

Behavior:

| Control | Meaning |
| --- | --- |
| `<<` | Move visible calendar month back by one month. |
| `Today` | Reset visible month to the month containing the in-game career date. |
| `>>` | Move visible calendar month forward by one month. |

These controls must be directly above the month grid, not isolated in a high page header.

For accessibility, icon-like controls may use `aria-label` text such as `Previous month` and `Next month`, but the visible control language should stay compact.

## 6. State Contract

Month navigation is view state only. It must not advance the career clock, mutate event outcomes, or simulate the universe.

The rule remains:

$$
\text{month cursor change} \ne \text{career date change}
$$

`Today` refers to the current in-game career date, not the real operating-system date.

## 7. Visual Contract

- Keep the Calendar page title compact.
- Keep the single month label visually tied to the grid it names.
- Place `<< Today >>` directly above the grid, aligned in a way that feels like calendar navigation.
- Preserve the one-month grid behavior from `TIX-020`.
- Do not let date-cell text overlap, clip, or widen the page on mobile.
- Keep confirmed commitments readable inside the month cells.

## 8. Absolute Rules

- Do not show more than one visible month/year label for the active month.
- Do not show the `Career today` diagnostic block in normal UI.
- Do not leave `Back Today Forward` as visible button text.
- Do not place the month controls only in a distant page header.
- Do not mutate simulation state when paging the calendar month.
- Do not reintroduce speculative knockout rounds into Calendar.

## 9. Acceptance Criteria

- [ ] The Calendar page shows exactly one visible month/year label for the current calendar view.
- [ ] The first two duplicate month/year occurrences are removed.
- [ ] The `Career today` / `Visible month` / `Visible range` / `Diary entries` / `Scope` block is absent.
- [ ] Month controls render as visible `<<`, `Today`, and `>>` controls.
- [ ] The controls sit directly above the calendar grid.
- [ ] `<<` and `>>` page the visible month without changing `career.date`.
- [ ] `Today` returns to the month containing the in-game career date.
- [ ] The month grid still shows only confirmed diary commitments.
- [ ] Desktop and mobile layouts avoid overlap, clipping, and horizontal overflow.

## 10. Verification

Run:

```bash
npm run test -- tests/unit/app-career-shell.test.tsx
npm run test -- tests/unit/career-calendar-ranking.test.ts
npx playwright test e2e/app.spec.ts
npm run build
```

Add or update tests for:

- a single visible month/year label,
- absence of the Calendar diagnostic block,
- compact month-control labels,
- month paging without career-date mutation,
- responsive Calendar grid rendering.

## 11. Definition Of Done

The Calendar becomes a clean diary surface:

$$
\text{Calendar page}
\rightarrow
\text{one month}
\rightarrow
\text{local controls}
\rightarrow
\text{confirmed commitments}
$$

No duplicate headings. No debug readout. No navigation controls drifting away from the grid they control.
