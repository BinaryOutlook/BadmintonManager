# TIX-028: Top Bar Optimization

Status: Draft design and implementation ticket
Priority: Medium
Target project: `BadmintonManager`
Target screens: Career Command Center, global career shell top bar
Prepared on: 2026-05-21
Primary files: `app/App.tsx`, `styles.css`, `tests/unit/app-career-shell.test.tsx`, `e2e/app.spec.ts`
Reference input: 2026-05-21 human UI review screenshot of Career Command Center top bar
Further sharpens: `docs/arc_tix/TIX-001-compact-one-page-career-portal.md`

## 1. Commander Intent

Reorder and tighten the global top bar so the career clock reads as the final right-edge action group.

The desired order is:

```text
Career Save | Settings | Date | Advance Day
```

The rightmost corner should belong to:

**Career Clock = Date + Advance Day**

with `Advance Day` as the far-right anchor and strongest action.

## 2. Why This Ticket Exists

The current top bar places the date and `Advance Day` before `Career Save` and `Settings`, which makes the bar read as:

```text
Date | Advance Day | Career Save | Settings
```

That weakens the hierarchy. `Date` and `Advance Day` are not just utility controls; they are the career-flow clock. They should sit together at the edge where a player naturally expects the next-day progression command.

The better mental model is:

**System Utilities → Career Clock**

not:

**Career Clock → System Utilities**

## 3. Layout Contract

The top bar should keep the existing left-side identity and command search area, then arrange the right-side controls as two compact groups:

```text
[Career Save] [Settings]   [2026-09-27] [Advance Day]
```

Rules:

- `Career Save` sits left of `Settings`.
- `Settings` sits left of the date.
- `Date` sits immediately left of `Advance Day`.
- `Advance Day` is the far-right control.
- Add slightly stronger spacing between `Settings` and `Date` than between controls within the same group.
- Preserve the existing dark command-center tone and compact button language.

## 4. Interaction Contract

`Career Save` should remain a utility affordance for save management.

`Settings` should continue opening the settings overlay.

`Date` should remain readable status, not a competing primary action.

`Advance Day` should remain visually primary when the career can progress. If the daily action is disabled or requires attention, keep the existing tone semantics, but do not move the control away from the far-right clock position.

## 5. Responsive Contract

Desktop should keep the full ordered row:

```text
Career Save | Settings | Date | Advance Day
```

Mobile may wrap into multiple rows, but the logical order must still be preserved:

```text
Career Save
Settings
Date
Advance Day
```

When horizontal space is tight:

- keep `Date` and `Advance Day` together where possible;
- avoid clipping the date label;
- avoid wrapping button text inside fixed-height controls;
- do not allow the search input to crush the right-side command group.

## 6. Visual Contract

- The right edge should feel intentional, with `Advance Day` as the final commitment button.
- `Career Save` and `Settings` should read as utility controls, not part of the clock.
- The date should use status styling that supports the primary action instead of competing with it.
- The bar should avoid unnecessary empty gaps at desktop widths.
- Buttons must remain aligned and vertically centered.
- No top-bar text should overlap, truncate awkwardly, or shift layout on hover/focus.

## 7. Absolute Rules

- Do not move `Advance Day` away from the far-right position.
- Do not separate `Date` from `Advance Day` in the desktop layout.
- Do not remove the command search field.
- Do not remove access to save management or settings.
- Do not make `Career Save` visually stronger than `Advance Day`.
- Do not introduce a large secondary top bar just to solve ordering.

## 8. Acceptance Criteria

- [ ] Career shell top bar renders controls in this order: `Career Save`, `Settings`, `Date`, `Advance Day`.
- [ ] `Advance Day` is the far-right top-bar control on desktop.
- [ ] `Date` is directly left of `Advance Day`.
- [ ] `Career Save` is left of `Settings`.
- [ ] Utility controls and career-clock controls have a readable visual gap between groups.
- [ ] Existing save-manager and settings interactions still work.
- [ ] Existing daily-action tone states still render correctly.
- [ ] Desktop layout does not introduce awkward empty space or clipped labels.
- [ ] Mobile layout preserves the same logical order without overlap.

## 9. Verification

Run:

```bash
npm run test -- tests/unit/app-career-shell.test.tsx
npx playwright test e2e/app.spec.ts
npm run build
```

Add or update tests for:

- top-bar control order;
- save manager access from the top bar;
- settings overlay access from the top bar;
- enabled and disabled daily-action states;
- desktop screenshot or layout assertion proving `Advance Day` is the rightmost control;
- mobile screenshot or layout assertion proving the controls do not overlap.

## 10. Definition Of Done

The top bar should feel crisp and deliberate:

**Career Save + Settings + Date + Advance Day = clear utility path + clear progression path**

The player should be able to glance right and immediately understand both the current career date and the next action that moves time forward.
