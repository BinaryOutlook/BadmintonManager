# TIX-029: Main Screen Optimization

Status: Draft design and implementation ticket
Priority: High
Target project: `BadmintonManager`
Target screens: Career Command Center / Portal Home
Prepared on: 2026-05-21
Primary files: `components/CareerWorkbench.tsx`, `styles.css`, `tests/unit/app-career-shell.test.tsx`, `e2e/app.spec.ts`
Reference input: 2026-05-21 human UI review screenshot and discussion of repeated home-screen signals
Further sharpens: `docs/arc_tix/TIX-001-compact-one-page-career-portal.md`, `docs/active_tix/TIX-028-top-bar-optimization.md`

## 1. Commander Intent

Rework the Career Command Center from a flat dashboard of available systems into a sharper decision center for the current career day.

The home screen should answer:

**What should I do today, and what happens if I do it?**

before it answers:

**Which subsystems have data available?**

The current page has strong atmosphere and a credible management-sim tone, but it spreads attention too evenly across tasks, route metadata, readiness, ledger rows, ecosystem counters, recent evidence, ranking pressure, and calendar fragments. The optimized screen should keep the serious command-center feel while becoming more ruthless about hierarchy.

Desired shape:

**Career Home = today's decision + player condition + near-term schedule + urgent context**

not:

**Career Home = all tracked systems with similar visual weight**

## 2. Why This Ticket Exists

Human review identified that the current arrangement feels over-dashboarded. The problem is not that the data is useless; the problem is that too much of it competes for prime attention at the same moment.

Several signals are repeated without adding enough new meaning:

- `Northern Lights Challenge` appears in the header summary, route strip, inbox, and main decision card.
- `Readiness` appears as a header/meta chip and again as a full panel.
- save state appears in the route strip and the task inbox, while save controls also live in the top bar.
- rank, total points, and race points appear in the header and again in `Ranking Pressure`.
- cash appears as a header/meta chip while `Ledger` consumes a full right-column panel.

Repetition is useful when each placement serves a different job. Here, some repetition becomes friction:

**Screen Value = (Decision-Relevant Information) / (Cognitive Load)**

This ticket should improve that ratio. The page should feel dense because the decisions are rich, not because every subsystem is shouting at the same volume.

## 3. Primary Page Question

The Career Command Center should be organized around this order of importance:

1. next decision;
2. managed athlete condition;
3. upcoming calendar pressure;
4. urgent tasks;
5. ranking pressure;
6. recent match evidence;
7. finance summary;
8. program ecosystem.

The main screen should make the player think:

**Enter? Skip? Train? Recover? Scout? Advance?**

not:

**Where did the page put the same event name this time?**

## 4. Layout Contract

Rebuild the Portal Home content hierarchy into three mental zones.

### 4.1 Now

This zone gets the strongest visual treatment and should be visible immediately on desktop and mobile.

Required contents:

- `Next Decision` as the primary panel;
- managed athlete condition/readiness beside or directly attached to the decision;
- urgent task count or compact inbox summary;
- clear action buttons that map to the next meaningful step.

The `Next Decision` panel should no longer behave like one card among many. It is the page's central work surface.

### 4.2 Soon

This zone supports short-term planning.

Required contents:

- an upgraded calendar preview;
- event entry deadline;
- travel or match-day pressure when applicable;
- selected training block;
- recovery risk if the current plan overloads the athlete.

The calendar should not simply say `Train` across a row of dates unless that is genuinely the best available state. It should expose useful planning pressure such as:

- event deadline;
- travel day;
- match day;
- recovery day;
- training block;
- injury-risk day;
- sponsor, media, scouting, or program obligation.

### 4.3 Later

This zone contains useful but lower-urgency context.

Move or compress:

- `Ledger`;
- `Program Ecosystem`;
- low-priority save metadata;
- non-urgent subsystem counters.

These can remain on the home screen, but they should read as secondary status, not first-screen decision material.

## 5. Next Decision Contract

The `Next Decision` panel must become the most useful and visually dominant panel on the page.

It should summarize the next event or next career step using consequence-first language:

**Enter Event ⇒ +950 pts -12% condition -$7,450**

The exact numbers should come from existing career state where available. If a number is projected, label it as projected instead of presenting it as resolved truth.

Required decision fields:

| Field | Purpose |
| --- | --- |
| action | what the manager can do now |
| reward | ranking, race, prize, or progression upside |
| cost | cash, fatigue, travel, opportunity cost |
| risk | readiness, injury, schedule congestion |
| deadline | when the decision closes |
| recommendation | concise state-based guidance, when the system has enough information |

The panel should support event and non-event states:

- event entry available;
- event entered, awaiting travel or start;
- pre-match briefing ready;
- post-match review waiting;
- no event available, season planning active.

## 6. Duplication Reduction Contract

Reduce duplicate surface area. Keep repeated information only when the repeated placement has a distinct role.

Rules:

- The event name may appear in the primary decision panel and once in the header or route context, but should not dominate four separate surfaces.
- `Readiness` should be primarily owned by the athlete condition panel. Header/meta readiness may be removed or reduced if it adds no new action value.
- save state should not occupy both route-strip and inbox priority unless there is a warning, corrupt save, missing active save, or recovery issue.
- cash should remain available in the top bar or header meta, while the home card should show only a compact finance summary unless there is a meaningful cashflow decision.
- ranking totals should be either header-level identity or a compact `Ranking Pressure` module, without verbose duplication in both places.

The target is:

**One signal → one primary home-screen owner**

with exceptions only for genuinely navigational context.

## 7. Panel Priority Contract

The default desktop home screen should use visual weight roughly as follows:

| Priority | Panel | Treatment |
| ---: | --- | --- |
| 1 | `Next Decision` | largest, strongest, consequence-first |
| 2 | `Player Condition` / `Readiness` | close to decision, compact but prominent |
| 3 | `Calendar Snapshot` | upgraded into near-term planning strip |
| 4 | `Tasks / Inbox` | compact urgent-only list |
| 5 | `Ranking Pressure` | concise career consequence module |
| 6 | `Recent Match Evidence` | tactical context tied to next action |
| 7 | finance summary | smaller than current `Ledger` panel |
| 8 | `Program Ecosystem` | collapsed, lower, or compact metric row |

The current `Ledger` and `Program Ecosystem` panels are not forbidden, but they should not compete with the central decision unless they contain urgent warnings.

## 8. Badminton Identity Contract

The home screen should feel more like the command center of an elite badminton career and less like a generic operations console.

Add or expose badminton-specific signals where data already exists or can be derived safely:

- athlete form;
- fatigue and explosiveness implications;
- injury risk;
- tournament draw or likely opponent preview;
- recent match pattern;
- tactical strengths such as net play, smash pressure, defense, footwork, or deception;
- rival or scouting prompt when relevant;
- readiness impact of travel and training load.

Do not invent decorative sport flavor that is disconnected from state. The page should use badminton language to clarify actual decisions, not to paint over generic metrics.

## 9. Calendar Snapshot Contract

Upgrade `Calendar Snapshot` from a passive week strip into a near-term planning tool.

The strip should prioritize meaningful labels:

| State | Example label |
| --- | --- |
| current day | `Today` |
| event deadline | `Entry closes` |
| travel | `Travel` |
| match day | `Match` |
| active training | `Training` |
| planned recovery | `Recovery` |
| no special item | `Open` |

If multiple items fall on the same day, choose the most decision-relevant label and expose the rest through tooltip text, compact detail text, or click-through.

## 10. Recent Evidence Contract

`Recent Match Evidence` should justify or inform the next decision.

Examples:

- If readiness is low, connect evidence to workload cost.
- If the next opponent or event is known, show evidence that affects preparation.
- If there is no recent match, shrink the panel or replace it with a more useful prompt.

Avoid giving a large panel to stale evidence that does not influence today's action.

## 11. Finance And Ecosystem Contract

Replace the large `Ledger` treatment with a compact finance summary unless a finance issue is urgent.

Preferred default:

**Cash = $206,150; 30-day change = +$34,600; Next Cost = $7,450**

The full transaction list should live in a dedicated finance, operations, or reports destination if the game needs one later.

`Program Ecosystem` should become either:

- a compact row of clickable system chips; or
- a lower-priority panel that only expands when a subsystem has a live issue.

Prime home-screen space should be earned by urgent gameplay consequence, not by passive subsystem inventory.

## 12. Responsive Contract

Desktop should present the decision center without routine vertical scrolling at common laptop and desktop sizes where practical.

Mobile should preserve the same priority order:

```text
Next Decision
Player Condition
Urgent Tasks
Calendar Snapshot
Ranking Pressure
Recent Evidence
Finance Summary
Program Ecosystem
```

Rules:

- `Next Decision` must appear before secondary admin panels.
- action buttons must not wrap into unreadable blocks.
- important numbers must not truncate awkwardly.
- no panel should rely on hover-only details for essential mobile understanding.
- if lower-priority panels are collapsed on mobile, their counts or warning states must remain discoverable.

## 13. Visual Contract

Keep the current dark, compact command-center style, but improve hierarchy.

Required visual outcomes:

- stronger focal treatment for `Next Decision`;
- smaller and calmer treatment for admin/status panels;
- fewer same-weight rectangles;
- clear grouping between `Now`, `Soon`, and `Later`;
- no visible text overlap;
- no oversized card shells around tiny amounts of data;
- no new decorative gradients, orbs, or generic filler visuals.

The screen should feel disciplined:

**dense ≠ flat**

Dense means there is a lot to manage. Flat means the page refuses to tell the player what matters first.

## 14. Implementation Notes

Likely implementation work lives in `CareerHomePage` inside `components/CareerWorkbench.tsx`.

Expected edits:

- refactor the `career-dashboard-grid` panel ordering and CSS grid areas;
- revise `taskRows` so save-state is only urgent when there is an actual save issue;
- add a decision consequence summary derived from event reward, entry cost, readiness, fatigue, and injury risk;
- replace the full `Ledger` home panel with a compact finance summary;
- compact or demote `Program Ecosystem`;
- make `Calendar Snapshot` label days by event deadline, travel/match state, recovery, or training pressure when available;
- update tests that currently assert old panel presence or order.

Do not move simulation logic into React. If new derived values become nontrivial, introduce selectors or helper functions outside the component boundary.

The architecture boundary remains:

**React UI → intent → career state → derived display model**

## 15. Absolute Rules

- Do not remove the ability to reach training, program hub, circuit room, match planning, save management, or settings.
- Do not hide urgent injury, save, event, or post-match states behind a secondary page.
- Do not make the home screen a marketing-style landing page.
- Do not add decorative sport flavor that is not connected to career state.
- Do not increase the number of repeated status labels while rearranging panels.
- Do not let `Ledger` or `Program Ecosystem` outrank the next decision by default.
- Do not regress keyboard or screen-reader access to the major home actions.

## 16. Acceptance Criteria

- [ ] `Next Decision` is the dominant main-screen panel on desktop.
- [ ] The first visible desktop viewport clearly answers what the manager should do today.
- [ ] The next decision includes consequence-oriented reward, cost, risk, and deadline information when an event exists.
- [ ] The same event name is not repeated across four separate high-visibility surfaces.
- [ ] readiness has one clear primary owner in the home-screen hierarchy.
- [ ] save-state information appears as urgent home content only when there is a save issue or recovery state.
- [ ] `Ledger` is reduced to a compact finance summary or moved below higher-priority gameplay panels.
- [ ] `Program Ecosystem` is compacted, collapsed, or demoted below decision, condition, calendar, tasks, ranking, and evidence.
- [ ] `Calendar Snapshot` shows meaningful upcoming obligations instead of defaulting every non-event day to `Train`.
- [ ] `Recent Match Evidence` is visually tied to preparation or reduced when it has no current decision value.
- [ ] mobile order preserves the same priority: decision, condition, urgent tasks, calendar, ranking/evidence, then admin.
- [ ] no visible text overlaps, clipped button labels, or panel layout shifts appear at tested desktop and mobile widths.
- [ ] existing navigation from home actions still works.

## 17. Verification

Run:

```bash
npm run test -- tests/unit/app-career-shell.test.tsx
npx playwright test e2e/app.spec.ts
npm run build
```

Add or update tests for:

- main-screen panel priority or DOM order;
- next-decision consequence summary;
- calendar labels for deadline, event, match, recovery, and open days;
- save-state demotion when the save is healthy;
- finance summary replacing the full ledger treatment;
- mobile ordering and absence of overlap.

Capture visual QA screenshots for at least:

- desktop 1440x900;
- desktop 2048x1152;
- mobile narrow viewport.

## 18. Definition Of Done

The Career Command Center should feel less like:

**Dashboard of Everything**

and more like:

**Decision Center for Today**

The player should immediately understand the next meaningful badminton decision, the athlete's ability to handle it, and the consequence of committing. Secondary systems should remain reachable, but they should stop competing with the heart of the management loop.
