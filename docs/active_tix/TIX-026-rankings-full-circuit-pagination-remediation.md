# TIX-026: Rankings Full Circuit Pagination Remediation

Status: Draft remediation ticket
Priority: High
Target project: `BadmintonManager`
Target screens: Rankings page, Full Circuit Table
Prepared on: 2026-05-20
Primary files: `app/App.tsx`, `app/pages.ts`, `components/CareerWorkbench.tsx`, `game/career/rankings.ts`, `game/selectors/player.ts`, `styles.css`, `tests/unit/app-career-shell.test.tsx`, `tests/unit/career-calendar-ranking.test.ts`, `tests/unit/player-profile.test.ts`, `e2e/app.spec.ts`
Reference input: `docs/scratchpad.md` line 25
Remediates: `docs/arc_tix/TIX-011-rankings-page.md`
Further sharpens: `docs/active_tix/TIX-023-rolling-ranking-window-and-event-entry-selection.md`
Related tickets: `docs/arc_tix/TIX-013-player-career-history-and-head-to-head.md`, `docs/arc_tix/TIX-019-universe-wide-player-records.md`

## 1. Commander Intent

Paginate the Rankings page `Full Circuit Table` so it shows eight players at a time, with `Prev` / `Next` controls matching the interaction language already used by the Timeline `Upcoming Event Schedule`.

The table should remain the full circuit ranking surface, but it should become easier to scan:

$$
\text{Full Circuit Table} =
\text{ranked source data}
\rightarrow
\text{8-row pages}
\rightarrow
\text{Prev/Next navigation}
$$

This intentionally updates the old `TIX-011` rule that lower-ranked players should not be hidden unless pagination is added intentionally. Pagination is now intentional.

## 2. Mediation Context

`TIX-011` established Rankings as a first-class career page. That was the right move, but a full unpaginated table is too heavy for the current manager workspace.

Human review asks for the same paging rhythm as the Upcoming Event Schedule:

```text
first 8 rows -> Next -> next 8 rows -> Prev
```

This ticket keeps the full table available while improving density and visual control.

## 3. Pagination Contract

Use a fixed page size:

$$
\text{pageSize} = 8
$$

Default state:

$$
\text{Rankings open} \Rightarrow \text{page} = 1
$$

Page windows:

| Page | Rows shown |
| --- | --- |
| 1 | ranks `1-8` |
| 2 | ranks `9-16` |
| 3 | ranks `17-24` |
| final | remaining rows, up to eight |

Controls:

| Control | Behavior |
| --- | --- |
| `Prev` | Move one rankings page backward. Disabled on page 1. |
| `Next` | Move one rankings page forward. Disabled on the final page. |

If the Upcoming Event Schedule uses a particular visual treatment for `Prev` / `Next`, reuse it here for consistency.

## 4. Data Contract

The Rankings page must continue to use the canonical ranking snapshot.

Required rule:

$$
\text{visibleRows} =
\operatorname{paginate}(
\operatorname{sortByRank}(\texttt{career.rankings}),
8
)
$$

Do not recalculate points differently in the UI. `TIX-023` may later change how ranking snapshots are derived, but this table should consume the resulting ranking data rather than creating a competing ranking formula.

## 5. Row Contract

Rows must preserve the useful `TIX-011` behavior:

- rank,
- player,
- nationality,
- points,
- season race points if still available,
- recent movement or status if available,
- managed-player highlight when the managed player appears on the current page,
- player-name links to profiles.

If the managed athlete is not on the current page, do not fake a duplicate row inside the table. A later ticket may add a `Jump to manager` affordance, but this ticket's requested work is table pagination.

## 6. Visual Contract

- Show exactly eight table rows on full pages.
- Show fewer than eight only on the final page when the total is not divisible by eight.
- Keep `Prev` / `Next` near the table, not in a distant global page header.
- Include compact page context when useful, such as `1-8 of 32`.
- Preserve mobile readability with no horizontal overflow.
- Avoid making pagination controls visually louder than the rankings themselves.

## 7. Absolute Rules

- Do not remove the `Rankings` sidebar command.
- Do not change ranking source-of-truth logic as part of this UI ticket.
- Do not hide lower-ranked players permanently; they must remain reachable through pagination.
- Do not duplicate the managed-player row outside the paginated table for this ticket.
- Do not break player profile links from ranking rows.
- Do not conflict with the ranking-system redesign in `TIX-023`.

## 8. Acceptance Criteria

- [ ] `Full Circuit Table` shows ranks `1-8` by default.
- [ ] The table uses a page size of eight rows.
- [ ] `Next` reveals the next rank window, beginning with rank `9` on page 2.
- [ ] `Prev` returns to the previous rank window.
- [ ] `Prev` is disabled or clearly unavailable on the first page.
- [ ] `Next` is disabled or clearly unavailable on the final page.
- [ ] All ranked players remain reachable through pagination.
- [ ] Managed-player highlighting still works when that row appears on the visible page.
- [ ] Player profile links still work from ranking rows.
- [ ] Desktop and mobile layouts avoid overlap, clipping, and horizontal overflow.

## 9. Verification

Run:

```bash
npm run test -- tests/unit/app-career-shell.test.tsx
npm run test -- tests/unit/career-calendar-ranking.test.ts
npm run test -- tests/unit/player-profile.test.ts
npx playwright test e2e/app.spec.ts
npm run build
```

Add or update tests for:

- default first page containing eight rows,
- `Next` and `Prev` page movement,
- final-page disabled state,
- managed-player highlight on the relevant page,
- preserved player profile navigation.

## 10. Definition Of Done

Rankings remain complete, but become easier to read:

$$
\text{complete circuit data}
\ne
\text{all rows visible at once}
$$

The manager can scan the top eight immediately, then page through the rest with the same rhythm already used elsewhere in the career UI.
