# TIX-001: Compact One-Page Career Portal Dashboard

Status: Draft implementation ticket
Priority: High
Target project: `BadmintonManager`
Target screen: Career `Portal Home` / `Career Command Center`
Prepared on: 2026-05-18
Primary files: `components/CareerWorkbench.tsx`, `styles.css`, `e2e/app.spec.ts`

## 1. Problem Statement

The current main career screen has the right ingredients, but the layout feels heavier than the information it carries. The page uses a lot of large panels, generous gaps, repeated borders, tall card padding, and wide isolated sections. On a desktop viewport, the result is paradoxical: the player sees many boxes, but not enough useful career state at once.

The screen should feel like a management cockpit, not a loose collection of presentation cards.

The product goal is:

\[
\text{One-page portal value}
=
\frac{\text{decisions surfaced} + \text{status clarity} + \text{direct actions}}
{\text{scrolling} + \text{empty area} + \text{visual fragmentation}}
\]

Right now, the denominator is too high. The redesign should reduce wasted area while preserving the dark, high-contrast command style already established in the app.

## 2. User-Facing Diagnosis

The current portal feels cumbersome for five reasons:

1. **The screen spends too much space on framing.** Most content is wrapped in full cards with similar borders, radius, and internal padding. This makes every section compete visually, even when the data is small.
2. **The page hierarchy is too tall.** Topbar, sidebar, screen header, status strip, card headers, and card bodies stack into a large vertical ramp before the player reaches the full decision set.
3. **Low-density widgets are over-sized.** `Calendar Snapshot`, `Recent Match Evidence`, `Readiness`, `Ranking Pressure`, and `Program Ecosystem` contain compact data but occupy broad rectangular zones.
4. **Important signals are scattered.** Cash, readiness, stage, event, deadline, next action, tasks, calendar, ranking, evidence, and ecosystem health are split across separate panels instead of being arranged as a tight operational summary.
5. **The main screen does not yet honor the promise of a portal.** A portal should answer "what matters now?" at a glance. The current version answers it, but only after too much scanning.

## 3. Objective

Rebuild the `Career Command Center` into a denser one-page dashboard that fits the major career signals into a single desktop viewport where possible, with no routine vertical scrolling on common laptop and desktop sizes.

The target experience:

\[
\text{Portal Home}
\rightarrow
\text{status at top}
\rightarrow
\text{next decision in center}
\rightarrow
\text{tasks, calendar, readiness, ledger, evidence, and ecosystem visible together}
\]

This is a layout and information architecture ticket. It should not alter career simulation rules, save data, rankings, match logic, event eligibility, or economy calculations.

## 4. Scope

### In Scope

- Compact the `CareerPortalHomePage` layout in `components/CareerWorkbench.tsx`.
- Revise dashboard CSS in `styles.css`.
- Reduce excess vertical and horizontal padding.
- Convert large card-like sections into tighter tables, strips, and metric rows where appropriate.
- Preserve existing visible information, but reorganize it for faster scanning.
- Keep all current portal actions reachable.
- Add or update e2e coverage for the redesigned portal.
- Verify desktop and mobile layouts do not overlap, clip, or become unreadably dense.

### Out Of Scope

- No change to career store behavior.
- No change to event schedule mechanics.
- No new backend, persistence, or cloud save behavior.
- No redesign of every career subpage.
- No new decorative landing page.
- No change to the game economy, injury model, scouting model, or match engine.

## 5. Design Principle

Every visible block on the portal must do at least one of these jobs:

- show current state,
- expose a risk,
- support a decision,
- open a high-frequency action,
- summarize recent evidence.

If a block does none of those, remove it or fold it into another block.

The layout target is:

\[
\text{Compact} \neq \text{cramped}
\]

The screen should become denser through alignment, grouping, and less ceremony, not through tiny unreadable text.

## 6. Proposed Information Architecture

### 6.1 Topbar

Keep the current app topbar concept, but avoid making the page header duplicate the same facts.

The topbar should continue carrying global state:

```text
BM | Search / Command | Date | Save | Team | Intel | Settings | Advance Day
```

Recommended density target:

- topbar height: approximately `48px` to `56px`,
- primary button remains visually strong,
- status chips should use compact padding,
- avoid wrapping on desktop unless the viewport is narrow.

### 6.2 Sidebar

The sidebar is useful, but it consumes a large amount of horizontal room. For this ticket, do not rebuild the whole navigation model, but make sure the portal layout assumes the sidebar remains present.

If sidebar edits are included, keep them modest:

- reduce vertical spacing between nav rows,
- keep group headings compact,
- preserve active state clarity,
- avoid expanding the sidebar width further.

### 6.3 Portal Header

Replace the tall hero-like header with a compact title and inline status summary.

Current pattern:

```text
Portal Home
Career Command Center
2026-06-12 - Three-Lung Dynamo sits circuit rank 6...
Cash | Readiness | Event complete
```

Target pattern:

```text
Career Command Center
2026-06-12 | Rank 6 | 1,864 pts | Season race 898 pts | Next: Harbor Masters
Cash $79,850 | Readiness 68 | Event complete
```

The title can remain prominent, but it should not consume a large block by itself.

### 6.4 Status Strip

The current `career-status-strip` is useful but too tall. Convert it into a single compact row with tighter cells.

Target cells:

```text
Route: Career Home
Next: Harbor Masters
Deadline: 2026-06-06
Action: Completed
Save: Active
```

Implementation direction:

- use short labels,
- avoid long repeated phrases,
- truncate or wrap only the value text,
- keep cell height around one compact row,
- prefer `grid-template-columns` with known minimums over oversized auto-fit cards.

## 7. Proposed One-Page Grid

Use a dense dashboard grid with named zones. The page should visually resolve into three major columns beneath the compact header.

Suggested desktop layout:

```text
+--------------------------------------------------------------------------------+
| Compact title/status row                                                       |
+--------------------------------------------------------------------------------+
| Status strip: route | next | deadline | action | save                          |
+-------------------------------+----------------------------+-------------------+
| Tasks / Inbox                 | Next Decision              | Readiness         |
| Calendar Snapshot             | Next Decision              | Ledger            |
| Ranking Pressure              | Recent Match Evidence      | Program Ecosystem |
+-------------------------------+----------------------------+-------------------+
```

Recommended CSS concept:

```css
.career-dashboard-grid {
  display: grid;
  grid-template-columns: minmax(18rem, 0.95fr) minmax(24rem, 1.25fr) minmax(18rem, 0.9fr);
  grid-template-areas:
    "tasks decision readiness"
    "calendar decision ledger"
    "ranking evidence ecosystem";
  gap: 0.65rem;
}
```

The exact proportions can be adjusted after screenshot verification, but the guiding idea is stable: the next decision gets the center column, while supporting state forms compact strips and tables around it.

## 8. Section Requirements

### 8.1 Tasks / Inbox

Current behavior is close to useful. Make it denser.

Target presentation:

```text
Type          Item                             Action
Program      Harbor Masters planning           Open
Training     No training block selected        Reduce load
Save         Active browser slot online        Export
```

Requirements:

- Keep this as a compact table.
- Reduce row padding.
- Keep three-column alignment.
- Do not make each row feel like a separate card.
- Use short action labels where possible.

### 8.2 Next Decision

This should remain the primary visual center of the portal. It is the one panel allowed to be larger than the others.

Target content:

```text
Harbor Masters
Entry clear | Rank 6 | Cutoff 2026-06-03 | Prize $26,000 / Cost $6,300

Calendar | Training | Program | Circuit | Match Plan
```

Requirements:

- Keep event name prominent.
- Compress event metadata into badges or mini facts.
- Reduce paragraph length.
- Put action buttons in one compact row or a two-row command cluster.
- Avoid a tall stack of large buttons.
- Preserve all existing actions:
  - Calendar
  - Training Desk
  - Program Hub
  - Circuit Room
  - Match Planning

### 8.3 Readiness

Readiness is important, but the card can be much shorter.

Target presentation:

```text
Readiness 68% | Fatigue 71% | Injury Risk 9%
Medical: Available
```

Requirements:

- Keep meter bars, but reduce bar height and vertical gaps.
- Medical desk text should become a compact status row.
- The injury status must remain obvious when not healthy.
- Danger styling for fatigue and injury risk should remain.

### 8.4 Ledger

Ledger should feel like a transaction list, not a large report.

Target presentation:

```text
Harbor Masters placement prize       +$1,200
Metro Open placement prize            +$4,200
Aero String Labs fulfilled            +$8,000
```

Requirements:

- Right-align amounts.
- Reduce row padding.
- Keep positive and negative amounts visually distinct if that styling exists or is easy to add.
- If there are no entries, show one compact empty-state row.

### 8.5 Calendar Snapshot

The current calendar snapshot wastes space because each day tile is too tall for a tiny date and label.

Target presentation:

```text
06-12 Circuit 500 | 06-13 Train | 06-14 Train | 06-15 Train | 06-16 Train | 06-17 Train
```

Requirements:

- Convert day cards into a compact horizontal timeline strip.
- The active day remains green-accented.
- Each day should fit date plus short label.
- Avoid tall square cards.
- Use horizontal overflow only on very narrow screens; desktop should fit the week.

### 8.6 Recent Match Evidence

The evidence data is valuable, but the current rows are visually heavy. Keep it table-like.

Target presentation:

```text
R16 Evidence
1  Winners vs 35 unforced errors        18-21, 23-25
2  58% stamina drain over 87 points     18-21, 23-25
3  Pressure created more opponent errors 18-21, 23-25
```

Requirements:

- Use a compact table or list.
- Keep evidence number, evidence text, and scoreline aligned.
- Do not render each evidence item as a tall card.
- Long evidence text should wrap gracefully without increasing the entire section into a huge block.

### 8.7 Ranking Pressure

Ranking pressure should become a compact stat block.

Target presentation:

```text
Rank 6 | Total 1,864 pts | Race 898 pts | Events 2
```

Requirements:

- Prefer one compact row or a two-by-two micro grid.
- Keep the finals gate note, but shorten it or move it into a smaller `small`/summary line.
- Do not allow the explanation text to dominate the portal.

### 8.8 Program Ecosystem

This section is currently the clearest example of over-framing. It occupies a wide band for a small set of metrics.

Target presentation:

```text
Reports 1 | Roster 1/4 | Youth 1 | Staff 0/5 | Promises 0
Rivals 81 | Tactics Command Balance | Facilities 0 | Media 67
```

Requirements:

- Convert the ecosystem to dense metric chips or a compact two-row grid.
- Preserve clickability for every subsystem.
- Keep labels readable.
- Avoid a full-width giant card unless the layout genuinely needs it at mobile sizes.
- The ecosystem should occupy no more than one compact dashboard cell on desktop.

## 9. Component Implementation Notes

### 9.1 Main Component

Primary implementation target:

- `BadmintonManager/components/CareerWorkbench.tsx`

The portal lives in `CareerPortalHomePage`. The existing component already computes the needed data:

- `taskRows`
- `recentLedger`
- `week`
- `event`
- `eventGate`
- `seedingSnapshot`
- `ranking`
- `athlete`
- `activeAdvancedTacticPlan(props.career)`

Prefer reorganizing this existing data over adding new domain helpers.

### 9.2 Suggested Markup Changes

Add targeted class names instead of relying only on generic `command-panel` behavior:

```tsx
<div className="career-dashboard-grid career-dashboard-grid-compact">
  <section className="command-panel career-dashboard-card career-dashboard-card-tasks">...</section>
  <section className="command-panel career-dashboard-card career-dashboard-card-decision">...</section>
  <section className="command-panel career-dashboard-card career-dashboard-card-readiness">...</section>
  <section className="command-panel career-dashboard-card career-dashboard-card-calendar">...</section>
  <section className="command-panel career-dashboard-card career-dashboard-card-ledger">...</section>
  <section className="command-panel career-dashboard-card career-dashboard-card-ranking">...</section>
  <section className="command-panel career-dashboard-card career-dashboard-card-evidence">...</section>
  <section className="command-panel career-dashboard-card career-dashboard-card-ecosystem">...</section>
</div>
```

Named classes make the grid easier to tune without disturbing other career pages that reuse `career-dashboard-grid`.

### 9.3 CSS Targets

Primary CSS file:

- `BadmintonManager/styles.css`

Likely selectors to update or add:

- `.screen-header`
- `.screen-title`
- `.screen-copy`
- `.screen-meta`
- `.career-status-strip`
- `.career-dashboard-grid`
- `.career-priority-panel`
- `.management-table`
- `.management-table-row`
- `.career-action-row`
- `.career-decision-block`
- `.career-meter-list`
- `.career-ledger`
- `.career-ledger-row`
- `.career-week-strip`
- `.career-day`
- `.career-ecosystem-strip`
- `.career-system-tile`

Avoid broad changes that accidentally compress every screen. If a selector is shared across many views, add portal-specific classes and scope the compact rules to `data-page-contract="portal-home"` or `.career-dashboard-grid-compact`.

## 10. Density Targets

Use these as practical tuning numbers, not rigid law:

| Element | Current Feel | Target Feel |
| --- | --- | --- |
| Screen header | tall title block | compact title/status row |
| Status strip cells | mini cards | one-row facts |
| Dashboard gap | roomy | `0.55rem` to `0.75rem` |
| Panel padding | presentation-card scale | `0.75rem` to `1rem` |
| Table row padding | card row | `0.42rem` to `0.6rem` |
| Calendar day | tall tile | compact timeline cell |
| Ecosystem | full-width band | one compact cell |
| Evidence | tall rows | compact table rows |

Do not reduce body text below a readable size. The visual language can be compact without becoming brittle.

## 11. Responsive Behavior

### Desktop

Target a no-routine-scroll experience at common desktop/laptop dimensions. Use the screenshots as evidence that the current layout wastes substantial space at a wide viewport.

Recommended behavior:

- three-column dashboard grid,
- center `Next Decision` panel spans two rows if useful,
- all major sections visible above the fold on a wide viewport,
- no incoherent overlap,
- no giant blank lower-right area.

### Tablet

At medium widths, collapse to two columns:

```text
Tasks              Next Decision
Calendar           Next Decision
Readiness          Ledger
Ranking            Evidence
Program Ecosystem  Program Ecosystem
```

### Mobile

At mobile width, stack sections in priority order:

1. compact title/status,
2. status strip,
3. next decision,
4. tasks,
5. readiness,
6. calendar,
7. evidence,
8. ledger,
9. ranking,
10. program ecosystem.

Mobile can scroll. The goal there is not "everything above the fold"; the goal is stable ordering, readable cells, no clipped text, and no horizontal page overflow.

## 12. Accessibility And Interaction Requirements

- Preserve existing headings where e2e tests depend on them unless tests are intentionally updated.
- Use semantic tables only if the markup truly behaves like tabular data; otherwise accessible lists with clear labels are acceptable.
- Preserve button semantics for ecosystem tiles and action commands.
- Keep visible focus states.
- Ensure compact chips and rows have sufficient hit area for clickable controls.
- Do not hide important state exclusively behind hover.
- Text must wrap gracefully for long save names, event names, evidence strings, and tactic names.

## 13. Acceptance Criteria

- [ ] `Career Command Center` is visually compressed into a one-page dashboard on desktop without losing current information.
- [ ] The portal header no longer duplicates a large amount of status content across multiple tall regions.
- [ ] `career-status-strip` reads as a compact status row, not a row of large cards.
- [ ] `Next Decision` remains the primary focal panel.
- [ ] `Tasks / Inbox` is a tight table with aligned columns.
- [ ] `Calendar Snapshot` is a compact week strip, not a series of tall square tiles.
- [ ] `Recent Match Evidence` is a compact evidence table/list.
- [ ] `Program Ecosystem` is reduced to dense clickable metric chips or a compact grid.
- [ ] `Readiness`, `Ledger`, and `Ranking Pressure` all fit as compact dashboard cells.
- [ ] All existing portal navigation actions still work.
- [ ] No text overlaps, clips, or spills outside its parent at desktop, tablet, or mobile widths.
- [ ] No unrelated career domain behavior changes.

## 14. Verification Plan

Run:

```bash
npm run build
npm run test
npm run test:e2e
```

Update or extend `BadmintonManager/e2e/app.spec.ts` to cover:

- portal still renders `Career Command Center`,
- portal still renders `Tasks / Inbox`,
- portal still renders `Calendar Snapshot`,
- portal still renders `Recent Match Evidence`,
- portal still renders `Program Ecosystem`,
- action buttons from the portal still route to the correct pages.

Add screenshot verification for at least:

- desktop wide viewport,
- laptop-ish viewport,
- mobile viewport.

Suggested viewport set:

```text
2048 x 1152
1440 x 900
390 x 844
```

For screenshots, inspect:

- no large empty zones,
- no overlapped text,
- no unreadable compression,
- active calendar day remains visually distinct,
- ecosystem buttons are still clearly clickable,
- `Advance Day` remains available in the global topbar.

## 15. Suggested Implementation Steps

1. Add portal-specific compact classes in `CareerPortalHomePage`.
2. Reorder dashboard sections into named grid zones.
3. Compact the portal header and status strip.
4. Convert `Calendar Snapshot` into a timeline-style strip.
5. Compact `Recent Match Evidence`, `Ledger`, and `Tasks / Inbox` row padding.
6. Reduce `Program Ecosystem` from full-width band to compact metric grid.
7. Tune responsive breakpoints.
8. Run e2e screenshots and adjust spacing until the page is dense but still calm.
9. Run the full verification commands.

## 16. Risks

- Over-compression could make the screen feel noisy. Mitigate with clear grouping, stable alignment, and restrained typography.
- Shared CSS selectors may affect other pages. Mitigate by scoping new rules to portal-specific classes.
- E2E tests may rely on existing text order or visibility. Update tests only where the user-facing layout intentionally changes.
- Long event names, tactic names, or evidence strings may break the grid. Use `min-width: 0`, `overflow-wrap: anywhere`, and tested responsive constraints.

## 17. Definition Of Done

This ticket is done when the career portal feels like a dense, readable command center:

\[
\text{Current day}
+ \text{next event}
+ \text{next decision}
+ \text{risks}
+ \text{recent evidence}
+ \text{program state}
\]

are all visible together on desktop, with the player able to understand the save state and choose the next action within a few seconds.
