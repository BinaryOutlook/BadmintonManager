# TIX-027: Tournament Page Optimization

Status: Draft design and implementation ticket
Priority: High
Target project: `BadmintonManager`
Target screens: Tournament Home, Current Knockout Draw, Current Event Bracket
Prepared on: 2026-05-21
Primary files: `components/CareerWorkbench.tsx`, `components/KnockoutTree.tsx`, `styles.css`, `game/tournament/tournament.ts`, `game/career/models.ts`, `game/career/events.ts`, `game/career/universe.ts`, `game/career/matchSchedule.ts`, `tests/unit/knockout-tree.test.tsx`, `tests/unit/app-career-shell.test.tsx`, `e2e/app.spec.ts`
Reference input: 2026-05-21 human UI review screenshots and bracket-density discussion
Remediates: `docs/arc_tix/TIX-008-universal-tournament-home-system.md`
Further sharpens: `docs/arc_tix/TIX-017-parallel-universe-tournament-simulation.md`, `docs/arc_tix/TIX-021-autonomous-universe-simulation-contract.md`

## 1. Commander Intent

Redesign Tournament Home so the bracket becomes the page's main work surface and can realistically scale beyond the current 16-player draw.

The current knockout tree reads well at 16 players, but it spends too much vertical and horizontal space per match. A normal badminton event often needs a 32-player draw:

$$
\text{Round of 32 matches} = \frac{32}{2} = 16
$$

The optimized Tournament Home should make that possible without turning the page into a long scroll of oversized cards.

Desired shape:

$$
\text{Tournament Home}
=
\text{compact event header}
+ \text{dense knockout bracket}
+ \text{selected-match details}
$$

not:

$$
\text{Tournament Home}
=
\text{diagnostic panels}
+ \text{large evidence cards}
+ \text{oversized bracket cards}
$$

## 2. Why This Ticket Exists

Human review identified two related problems:

- the bracket is constrained to the current 16-player presentation;
- the page burns space in both directions, especially through tall bracket cards and large Tournament Home summary panels.

The visible screenshot shows the bracket pushed below:

- `Match Results And Scoreline Evidence`,
- `Decision Summary`,
- `Field Changes`.

Those sections were useful while proving the tournament system, but they now behave like implementation evidence on a page that should prioritize live event management.

The bracket itself also uses full names and narrative card structure. For a 32 draw, that approach compounds quickly:

$$
16 \text{ opening matches} \times \text{large match card height}
\Rightarrow
\text{excessive vertical scroll}
$$

## 3. Page Priority Contract

Tournament Home should open with a compact event identity area, then expose the draw immediately.

Keep:

- event name,
- tier or circuit label,
- date window,
- venue,
- status,
- primary action such as `Review Match` when relevant.

Remove or collapse from the default view:

- `Match Results And Scoreline Evidence`,
- `Decision Summary`,
- `Field Changes`.

If any of that information remains available, move it behind a compact affordance such as a drawer, details toggle, or secondary `Event Notes` panel. It must not sit above the bracket by default.

The default page should answer:

$$
\text{Who is in the draw, what is the current path, and what match matters next?}
$$

before it answers:

$$
\text{Which internal evidence rows did the simulator record?}
$$

## 4. Compact Bracket Cell Contract

Replace the current large match-card presentation with a compact two-row score cell for bracket rounds, especially early rounds.

Preferred cell shape:

```text
G. Southpaw   21 21  *
P. Reyes      12 13
```

Rules:

- one row per player;
- abbreviated display names by default;
- set scores shown in aligned columns;
- winner marker shown as a compact symbol, not a full `W` badge that widens the row;
- live/up-next state shown compactly;
- full player names available through hover, title text, click target, or selected-match detail;
- clicking a player name must still open the player profile.

The compact cell should use tabular score columns:

$$
\text{name column} + \text{score}_{1} + \text{score}_{2} + \text{score}_{3} + \text{status}
$$

For unplayed matches:

```text
G. Southpaw   -- --  up next
V. Lion       -- --
```

For unknown future slots:

```text
Winner R16-1  -- --
Winner R16-2  -- --
```

## 5. Name Abbreviation Contract

Introduce a deterministic bracket display name formatter.

Examples:

| Full name | Compact bracket name |
| --- | --- |
| `Grand-Slam Southpaw` | `G. Southpaw` |
| `Pablo Reyes` | `P. Reyes` |
| `Eight-Crown Monarch` | `E. Monarch` |
| `Kerala Counterhand` | `K. Counterhand` |
| `Louis Mercier` | `L. Mercier` |

Collision rule:

$$
\text{same compact name in same draw}
\Rightarrow
\text{expand only the minimum needed to disambiguate}
$$

For example, if `Pablo Reyes` and `Pedro Reyes` both appear, use a slightly longer variant such as `Pab. Reyes` and `Ped. Reyes`, or another deterministic local pattern.

Do not abbreviate in places where the full player identity is the primary content, such as player profile pages.

## 6. 32-Draw Readiness Contract

The bracket UI should be able to render:

$$
32 \rightarrow 16 \rightarrow 8 \rightarrow 4 \rightarrow 2 \rightarrow 1
$$

This means supporting a five-round structure:

| Round | Matches |
| --- | ---: |
| Round of 32 | 16 |
| Round of 16 | 8 |
| Quarter-Finals | 4 |
| Semi-Finals | 2 |
| Final | 1 |

The current `RoundName` and bracket rendering are centered around `R16`, `QF`, `SF`, and `F`. If this ticket changes actual tournament data, add `R32` across the tournament state, persistence schemas, ranking result handling, universe simulation, and tests.

If implementation is staged, it is acceptable to first make the bracket layout 32-ready while keeping current event definitions at 16. The UI should not bake in a design that would need to be thrown away once `drawSize = 32` arrives.

## 7. Space Usage Contract

Optimize both axes.

Vertical:

- reduce match-cell height substantially;
- remove narrative `small` lines from every bracket cell by default;
- keep summaries and background context in the selected-match detail area;
- make Round of 32 and Round of 16 the densest rounds;
- allow later rounds to have slightly more breathing room only if the whole bracket remains compact.

Horizontal:

- shorten names through the bracket formatter;
- shrink round column minimum widths;
- keep score columns narrow and aligned;
- prefer horizontal scrolling over crushed text when all rounds cannot fit;
- keep connector lines thin and subordinate.

The density target is:

$$
\text{opening-round match cell height} \le 56\text{px}
$$

on desktop, with responsive adjustments allowed for touch readability.

## 8. Selected-Match Detail Contract

Move information that does not need to be visible on every bracket node into a selected-match detail surface.

The detail surface should show, when available:

- full player names,
- full scoreline,
- match status,
- round,
- source label or simulation evidence,
- background summary,
- managed-player state,
- profile links.

This can be a right-side panel on desktop and a bottom drawer or stacked panel on mobile.

The bracket cells provide the overview:

$$
\text{compact node} = \text{identity} + \text{score} + \text{state}
$$

The detail surface provides the explanation:

$$
\text{selected detail} = \text{full context} + \text{evidence} + \text{actions}
$$

## 9. Visual Contract

- The bracket should be visible much earlier on Tournament Home than it is in the screenshot.
- The first viewport should signal the event and the draw, not three stacked explanation panels.
- Compact cells must remain legible at desktop and mobile sizes.
- Scores must align cleanly across rows.
- Player click targets must remain usable even when names are abbreviated.
- Managed-player path and live/up-next states must remain easy to spot.
- Do not use oversized cards for every bracket match.
- Do not let text overlap connector lines, columns, or neighboring cells.
- Preserve the dark, utilitarian manager-workbench tone already used by the app.

## 10. Absolute Rules

- Do not remove Tournament Home.
- Do not break player-profile navigation from bracket names.
- Do not hide tournament results permanently; move lower-priority evidence behind detail surfaces when needed.
- Do not leave `Match Results And Scoreline Evidence`, `Decision Summary`, and `Field Changes` as large default panels above the bracket.
- Do not hard-code abbreviations for only the current fixture list.
- Do not make the 32-draw path depend on real athlete likenesses or licensed data.
- Do not introduce decorative bracket visuals that reduce information density.

## 11. Acceptance Criteria

- [ ] Tournament Home shows the knockout draw much earlier in the page, without the three large evidence/summary/field panels above it by default.
- [ ] `Match Results And Scoreline Evidence`, `Decision Summary`, and `Field Changes` are removed from the default vertical stack or collapsed into a secondary detail surface.
- [ ] Bracket match nodes use compact two-row score cells.
- [ ] Player names in bracket cells use deterministic abbreviation such as `G. Southpaw` and `P. Reyes`.
- [ ] Full names remain available through profile navigation and selected-match detail.
- [ ] Completed matches show per-game scores in aligned columns.
- [ ] Winner, live, and up-next states are compact but visually clear.
- [ ] Match summaries no longer consume vertical space inside every bracket cell by default.
- [ ] The bracket layout is prepared for a five-round 32-player draw.
- [ ] Existing 16-player events still render correctly.
- [ ] Desktop rendering avoids excessive empty space and unnecessary scrolling.
- [ ] Mobile rendering avoids overlap, clipping, and unusable tap targets.

## 12. Verification

Run:

```bash
npm run test -- tests/unit/knockout-tree.test.tsx
npm run test -- tests/unit/app-career-shell.test.tsx
npx playwright test e2e/app.spec.ts
npm run build
```

Add or update tests for:

- compact name formatting,
- abbreviation collision handling,
- compact score-cell rendering,
- preserved player profile clicks from abbreviated names,
- absence or collapsed state of the three large Tournament Home panels,
- current 16-player bracket compatibility,
- 32-player bracket rendering if `R32` support is implemented in this ticket.

Use Playwright screenshots for at least:

- Tournament Home desktop viewport,
- Tournament Home mobile viewport,
- current 16-player active event,
- 32-player fixture or harness state when available.

## 13. Definition Of Done

Tournament Home should feel like a real tournament operations screen:

$$
\text{less narration}
+ \text{denser bracket}
+ \text{clearer path}
=
\text{better tournament management}
$$

The bracket should preserve the app's premium visual tone while becoming compact enough to support normal badminton draw sizes.
