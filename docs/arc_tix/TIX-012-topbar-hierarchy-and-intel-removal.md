# TIX-012: Topbar Hierarchy And Intel Removal

Status: Draft implementation ticket
Priority: High
Target project: `BadmintonManager`
Target screens: career shell topbar
Prepared on: 2026-05-19
Primary files: `app/App.tsx`, `components/TacticalIntelPanel.tsx`, `styles.css`, `tests/unit/app-career-shell.test.tsx`, `e2e/app.spec.ts`
Reference input: `docs/scratchpad.md` item 5

## 1. Commander Intent

Rework the topbar hierarchy without changing its core function.

The managed player belongs beside the logo. The date belongs beside `Advance Day`. Both date and daily action should be visually stronger than passive status text.

Remove the `Intel` topbar button for now.

## 2. Layout Contract

Target order:

```text
BM | Managed Player | Search/Command                 Date | Advance Day | Save | Settings
```

The date and advance/play action should behave like one daily-control cluster:

**Date + Daily CTA = career clock control**

The managed player should appear directly after the brand mark so the topbar starts with identity, not utility.

## 3. Required Changes

- Move managed athlete name from right-side status into the left brand area.
- Move date beside the daily action button.
- Increase visual weight of the date and daily action compared with save status.
- Keep `Settings`.
- Remove the visible `Intel` button.
- Remove or park `intelOpen` and `TacticalIntelPanel` only if no other live route uses them.
- Preserve daily action tones: ready, required, disabled.

## 4. Absolute Rules

- Do not break `Advance Day`, `Play Match`, `Resume Match`, or `Review Match`.
- Do not make the date smaller or less visible than passive save text.
- Do not leave an empty gap where `Intel` used to be.
- Do not remove tactical information from actual match/planning screens.
- Keep the topbar compact and non-wrapping on standard desktop widths.

## 5. Acceptance Criteria

- [ ] Managed player appears immediately beside the `BM` brand area.
- [ ] Date appears directly beside the daily action.
- [ ] Daily action and date have stronger visual emphasis than save status.
- [ ] `Intel` is not visible in the topbar.
- [ ] `Settings` remains reachable.
- [ ] Daily action still routes correctly for advance day, due match, live match, and review match.
- [ ] Mobile layout wraps or stacks cleanly with no horizontal overflow.

## 6. Verification

Run:

```bash
npm run test -- tests/unit/app-career-shell.test.tsx
npx playwright test e2e/app.spec.ts
npm run build
```

## 7. Definition Of Done

The topbar reads like a manager clock:

**who we manage + what day it is + what happens next**

