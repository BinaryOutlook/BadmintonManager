# TIX-011: Rankings Page

Status: Draft implementation ticket
Priority: High
Target project: `BadmintonManager`
Target screens: sidebar command rail, new career Rankings page
Prepared on: 2026-05-19
Primary files: `app/App.tsx`, `app/pages.ts`, `components/CareerWorkbench.tsx`, `game/career/rankings.ts`, `styles.css`, `tests/unit/app-career-shell.test.tsx`, `tests/unit/career-calendar-ranking.test.ts`, `e2e/app.spec.ts`
Reference input: `docs/scratchpad.md` item 4

## 1. Commander Intent

Add a left-sidebar `Rankings` command that opens a full rankings table from top to bottom.

The managed player must be highlighted.

The page should answer:

$$
\text{Who is ahead?}
\quad
\text{Where are we?}
\quad
\text{How many points separate the field?}
$$

## 2. Page Contract

Create a career-only `Rankings` page.

Minimum visible columns:

- rank,
- player,
- nationality,
- points,
- season race points,
- recent movement or status if available.

Required behavior:

- sort by current rank ascending,
- highlight the managed athlete,
- make player names profile-addressable,
- keep the page readable at desktop and mobile widths,
- show an empty career-required state outside career mode.

## 3. Sidebar Contract

Add `Rankings` to the command rail, preferably under `Program` or `Operations` depending on the final grouping.

Required command fields:

```text
Label: Rankings
Short: RNK
Description: Circuit table
```

Do not overload Calendar with rankings table duties.

## 4. Absolute Rules

- Use `career.rankings` as the source of truth.
- Do not recalculate rankings differently in the UI.
- Do not hide lower-ranked players unless pagination is added intentionally.
- Do not remove ranking summary from existing Calendar/Home surfaces; this page is the full table.
- Keep the managed player visually obvious without using color alone.

## 5. Acceptance Criteria

- [ ] Sidebar shows `Rankings` during career mode.
- [ ] Clicking `Rankings` opens a full rankings page.
- [ ] Table is sorted from rank 1 downward.
- [ ] Managed athlete row is highlighted and labelled.
- [ ] Player names open player profiles.
- [ ] Points and season race points are visible.
- [ ] Mobile layout has no horizontal overflow.

## 6. Verification

Run:

```bash
npm run test -- tests/unit/app-career-shell.test.tsx
npm run test -- tests/unit/career-calendar-ranking.test.ts
npx playwright test e2e/app.spec.ts
npm run build
```

## 7. Definition Of Done

Rankings become a first-class career surface:

$$
\text{ranking data}
\rightarrow
\text{sortable readable table}
\rightarrow
\text{player profile addresses}
$$

