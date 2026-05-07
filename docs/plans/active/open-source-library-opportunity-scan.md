# Open-Source Library Opportunity Scan

Status: Planning reference
Date: 2026-05-07
Scope: Documentation and code scan only. No product code changes.

## 1. Purpose

This document records open-source libraries that can shortcut or strengthen current and planned
work in **Badminton Manager**.

The scan covered:

- `docs/README.md`
- `docs/product/PRD.md`
- `docs/product/ROADMAP.md`
- `docs/product/versions/v0.1/` through `v0.2.4/`
- `docs/architecture/overview.md`
- `docs/reference/`
- `docs/decisions/`
- `src/app/`
- `src/components/`
- `src/game/`
- `tests/`
- `e2e/`
- `package.json` and `package-lock.json`

The goal is not to collect fashionable dependencies. The useful question is:

$$
\text{library value} =
\frac{\text{feature acceleration} + \text{correctness gain} + \text{maintenance gain}}
{\text{adaptation cost} + \text{architectural risk}}
$$

## 2. Current Stack Snapshot

The project is already on a strong local-first foundation.

Installed runtime dependencies from `package-lock.json`:

| Library | Installed version | Current use |
| --- | ---: | --- |
| `react` | `19.2.5` | UI composition |
| `react-dom` | `19.2.5` | Browser rendering |
| `zod` | `4.3.6` | player and save validation |
| `zustand` | `5.0.12` | app state |

Installed development dependencies include:

| Library | Installed version | Current use |
| --- | ---: | --- |
| `vite` | `7.3.2` | local dev and build |
| `vitest` | `4.1.5` | unit and calibration tests |
| `@playwright/test` | `1.59.1` | browser smoke tests |
| `@testing-library/react` | `16.3.2` | component tests |
| `typescript` | `5.9.3` | static type checking |
| `jsdom` | `26.1.0` | browser-like test environment |

The current architecture remains:

```text
React UI -> intent -> Zustand store -> game engine -> state + events
```

That boundary is healthy. Most recommended libraries should attach around it, not replace it.

## 3. Requirements Distilled From The Scan

The documentation and source point to five active needs:

1. **Simulation fidelity and calibration**
   - `src/game/core/match.ts` is a large hand-tuned deterministic simulator.
   - `tests/calibration/` already performs seeded sweeps, but reporting is still console-table based.
   - Planned work includes target-band assertions, quick/detailed parity, archetype balance, and wider seeded checks.

2. **UI framework and overlays**
   - `v0.2.4` plans page-level workspaces, a typed overlay host, confirmation overlays, event details, athlete dossiers, and tactical intel pop-ups.
   - `src/app/App.tsx` currently owns top navigation, sidebar state, `intelOpen`, phase rendering, and shell layout directly.

3. **Roster, event, season, and calendar scaling**
   - The roster is already `47` athletes.
   - `v0.2.4` plans around `32` selectable events or competitions, plus season and calendar scaffolds.
   - Future work needs filtering, comparison, and date layout before it needs a backend.

4. **Telemetry and analysis presentation**
   - Match and recap stats are real engine outputs.
   - Future surfaces want richer scouting reads, telemetry, calibration visibility, and post-match analysis.

5. **Local persistence hardening**
   - Saves are versioned and Zod-validated.
   - Future season/calendar state may grow beyond the current localStorage shape.
   - Any material persistence change still requires an explicit decision.

## 4. Library Fit Map

```text
Need                               Best-fit shortcut
--------------------------------   --------------------------------
Typed save and content contracts   Zod, already installed
Store persistence/migrations       Zustand persist, already available
Complex UI/page flow               XState, or TanStack Router if URLs matter
Accessible overlays/pop-ups        Radix UI Primitives
Icons for dense controls           lucide-react
Roster/event tables                TanStack Table
Roster/event search                Fuse.js
Season/calendar date utilities     date-fns
Telemetry charts                   Recharts
Calibration math                   simple-statistics
Property/invariant testing         fast-check + @fast-check/vitest
Component state QA                 Storybook
Future large local saves           Dexie.js, deferred
Restrained UI motion               Motion, optional
```

## 5. Recommended Libraries

### 5.1 Zod

Source: <https://zod.dev/>

Current status: already installed and useful.

Why employ it:

- Zod is already validating players and persisted saves.
- Future page, overlay, event, season, and calendar definitions can use Zod as the runtime contract instead of relying only on TypeScript.
- Save migration work needs a clear distinction between trusted in-memory state and untrusted hydrated JSON.

Adaptation scale: **Low to medium**.

- Low for new content schemas such as `EventDefinition`.
- Medium if existing save schemas are reorganized around versioned migration helpers.

Specific gains:

- Fewer corrupt-save edge cases.
- Shared validation for content, persistence, and test fixtures.
- Better future migration hygiene when `seasonPlan` or `calendarEvents` enter the save shape.

Best next use:

- Keep Zod as the canonical validation layer for any `v0.2.4` event, page, overlay, or future save payload contracts.

### 5.2 Zustand Middleware: `persist` and possibly `immer`

Sources:

- <https://zustand.docs.pmnd.rs/middlewares/persist>
- <https://zustand.docs.pmnd.rs/integrations/immer-middleware>

Current status: Zustand is installed; the store currently uses custom localStorage persistence.

Why employ it:

- The store manually serializes, parses, validates, and writes save state.
- Zustand `persist` can centralize persistence, partial persistence, versions, and migrations.
- `immer` middleware can reduce nested state update boilerplate if page, overlay, and season state become more complex.

Adaptation scale: **Medium**.

- This touches `src/game/store/store.ts` and `src/game/store/save.ts`.
- It should preserve Zod validation, not replace it.
- It does not require replacing the state library.

Specific gains:

- Less hand-written persistence code.
- A clearer migration path for save versions.
- More maintainable store updates once `activePage`, `activeOverlay`, `seasonPlan`, and `calendarEvents` appear.

Best next use:

- Consider `persist` during the next save-schema change.
- Defer `immer` until nested store updates become visibly repetitive.

### 5.3 Radix UI Primitives

Sources:

- <https://www.radix-ui.com/primitives/docs/overview/introduction>
- <https://www.radix-ui.com/primitives/docs/components/dialog>
- <https://www.radix-ui.com/primitives/docs/components/alert-dialog>

Current status: not installed.

Why employ it:

- `v0.2.4` explicitly plans a typed overlay host, tactical intel overlay, athlete dossier overlay, event details overlay, match summary overlay, and confirmation flows.
- Building accessible dialogs, focus trapping, escape behavior, screen reader naming, and popovers by hand is easy to get subtly wrong.
- Radix is unstyled, so it fits the command-center visual system instead of imposing a large design system.

Adaptation scale: **Low to medium**.

- Low for `Dialog`, `AlertDialog`, `Tooltip`, and `Popover` primitives.
- Medium if all existing and future overlays are unified behind a typed `OverlayHost`.

Specific gains:

- Faster overlay implementation.
- Better accessibility defaults.
- Cleaner separation between overlay behavior and app-specific styling.
- Confirmation reset flow can stop being a plain button path.

Best next use:

- Adopt for `v0.2.4` Task 3, "Build the overlay host."

### 5.4 lucide-react

Source: <https://lucide.dev/guide/react>

Current status: not installed.

Why employ it:

- The current shell and controls are heavily text-driven.
- Planned page navigation, overlays, event cards, calendar controls, and tactical actions will benefit from compact icon affordances.
- Lucide icons are standalone React components and tree-shakable.

Adaptation scale: **Low**.

- Add only the icons used in buttons, navigation, overlays, calendar controls, and telemetry labels.
- No architecture impact.

Specific gains:

- Denser, easier-to-scan operational UI.
- More polished buttons without inventing local SVGs.
- Consistent icon language for page navigation and action controls.

Best next use:

- Pair with `v0.2.4` shell and overlay work.

### 5.5 XState and `@xstate/react`

Sources:

- <https://stately.ai/docs/xstate>
- <https://stately.ai/docs/xstate-react>

Current status: not installed.

Why employ it:

- `AppPhase` is currently a string union: `setup | overview | match | complete`.
- `v0.2.4` plans a larger page graph plus overlays, live match transitions, intermission-only team talks, reset confirmation, and future season/calendar states.
- XState is valuable when the problem is "which events are legal in which state?"

Adaptation scale: **Medium to high**.

- Medium if used only for a page/overlay/navigation machine while Zustand remains the persistence store.
- High if it replaces the current store or owns live match orchestration.
- Replacing Zustand should not happen without an ADR and explicit approval.

Specific gains:

- Illegal transitions become visible and testable.
- Intermission-only actions, reset confirmation, page availability, and match lifecycle can be modeled directly.
- Future season progression can become a statechart instead of scattered conditionals.

Best next use:

- Consider a narrow `appFlowMachine` proof during `v0.2.4` Task 1.
- Keep simulation formulas in `src/game/core/`; XState should orchestrate intent, not resolve match outcomes.

### 5.6 TanStack Router

Source: <https://tanstack.com/router/latest/docs/overview>

Current status: not installed.

Why employ it:

- `v0.2.4` leaves open whether the app should adopt URL routes or keep internal page state.
- If the product wants deep-linkable pages, route-level browser history, URL search state for filters, or clearer E2E navigation, TanStack Router is a strong typed-router candidate.

Adaptation scale: **Medium to high**.

- Medium for page shell routes only.
- High if route search params become part of gameplay or save state.
- This is a product architecture decision, not a casual dependency.

Specific gains:

- Type-safe page navigation.
- Easier browser history and deep links for `Squad`, `Games`, `Season`, `Calendar`, `Bracket`, and `Review`.
- Route search params can preserve filters for roster/event tables.

Best next use:

- Decide in `v0.2.4` Task 1.
- If URL routing is not needed yet, keep typed internal page state and defer this dependency.

### 5.7 TanStack Table

Source: <https://tanstack.com/table/latest/docs/overview>

Current status: not installed.

Why employ it:

- The current roster card grid works for selection, but future `Squad`, `Games`, calibration, and recap views need sorting, filtering, grouping, column visibility, and controlled row state.
- TanStack Table is headless, so it keeps the custom command-center styling.

Adaptation scale: **Medium**.

- Medium for converting roster/event list internals to table models.
- Low architectural risk if presentation stays custom and no gameplay formulas move into UI components.

Specific gains:

- Faster sortable athlete lists.
- Scalable event browsing for around `32` entries.
- Better calibration and stat-comparison tables.
- Less one-off sorting/filtering logic in React components.

Best next use:

- Use for `SquadPage` and `GamesPage` if those pages gain sortable columns or filters.

### 5.8 Fuse.js

Source: <https://www.fusejs.io/>

Current status: not installed.

Why employ it:

- A 47-athlete roster and planned 32-event page are small enough for client-side fuzzy search.
- Fuse has zero dependencies and supports weighted keys, nested data, logical search, and typo-tolerant matching.

Adaptation scale: **Low**.

- Add a search helper for athlete and event definitions.
- No state-library or persistence changes required.

Specific gains:

- Fast roster and event search without a backend.
- Better UX for future large local content pools.
- Search can cover names, nationality, style labels, traits, event category, week, and status.

Best next use:

- Add when `SquadPage` or `GamesPage` receives search input.

### 5.9 date-fns

Source: <https://datefns.com/>

Current status: not installed.

Why employ it:

- `v0.2.4` plans season and calendar scaffolds.
- Calendar work needs date arithmetic, formatting, comparisons, and week/month layout helpers.
- date-fns is modular, immutable, TypeScript-friendly, and works on native `Date` values.

Adaptation scale: **Low**.

- Use in a future `src/game/content/events.ts`, `CalendarGrid`, or calendar view-model helper.
- If dates are seed-generated, keep seed generation in the game layer and use date-fns only for date math and formatting.

Specific gains:

- Avoids hand-rolled calendar arithmetic.
- Reduces off-by-one date layout bugs.
- Keeps calendar scaffolds readable without introducing a backend or scheduler service.

Best next use:

- Use for `v0.2.4` Calendar page scaffold.

### 5.10 Recharts

Source: <https://recharts.github.io/>

Current status: not installed.

Why employ it:

- The project already has meaningful engine stats: points, longest rally, winners, errors, smashes, stamina drain, momentum, and calibration buckets.
- Planned analysis surfaces need richer telemetry without inventing charts from scratch.
- Recharts uses React components and SVG, matching the current app model.

Adaptation scale: **Medium**.

- Low for simple sparklines and bar charts.
- Medium for reusable chart theming and responsive dashboard panels.

Specific gains:

- Faster telemetry visualization.
- Better calibration report readability.
- More satisfying recap and scouting surfaces.
- Can visualize quick/detailed parity, three-game rates, rally-length tails, and archetype matchup matrices.

Best next use:

- Adopt after `v0.2.4` page framework stabilizes, when telemetry has a stable home.

### 5.11 fast-check and `@fast-check/vitest`

Sources:

- <https://fast-check.dev/docs/introduction/what-is-property-based-testing/>
- <https://fast-check.dev/docs/tutorials/setting-up-your-test-environment/property-based-testing-with-vitest/>

Current status: not installed.

Why employ it:

- The engine needs invariants across many generated seeds, players, tactics, and score states.
- Current tests use examples and seeded sweeps, but property tests can find small counterexamples when scoring, save validation, or tournament advancement breaks.
- The official Vitest connector allows incremental adoption.

Adaptation scale: **Low to medium**.

- Low for score-rule and tournament-shape properties.
- Medium for generated player/tactic schemas with realistic constraints.

Specific gains:

- Better confidence that every simulated set reaches `21 by 2` or `30` cap correctly.
- Stronger save migration tests with generated valid and invalid payloads.
- More resilient deterministic engine checks.
- Smaller failure cases when a generated scenario breaks an invariant.

Best next use:

- Add property tests for match scoring, bracket advancement, and save hydration before wider season state enters the system.

### 5.12 simple-statistics

Sources:

- <https://simple-statistics.github.io/>
- <https://simple-statistics.github.io/docs/>

Current status: not installed.

Why employ it:

- Calibration currently computes buckets manually and prints console tables.
- The planned balancing work needs means, quantiles, variance, confidence-style summaries, correlations, and distribution comparisons.
- simple-statistics is small, readable, and covers common statistical methods without pulling in a heavy data-science stack.

Adaptation scale: **Low**.

- Use inside calibration tests or future report helpers.
- No production app dependency is required unless charts move calibration data into the UI.

Specific gains:

- Cleaner calibration reports.
- Faster analysis of upset bands, rally tails, and stat-composition imbalance.
- Less bespoke math in test files.

Best next use:

- Add to calibration tooling when implementing target-band assertions.

### 5.13 Storybook

Sources:

- <https://storybook.js.org/docs/get-started/whats-a-story>
- <https://storybook.js.org/docs/writing-stories>
- <https://storybook.js.org/docs/writing-tests/visual-testing>

Current status: not installed.

Why employ it:

- `v0.2.4` requires many page and overlay states: setup, home, squad, games, season, calendar, bracket, live match, review, empty states, locked states, intermission states, confirmation overlays, and narrower layouts.
- Storybook can document these component states as stories and support visual regression workflows.

Adaptation scale: **Medium to high**.

- Medium for isolated components and overlays.
- High if full app state mocking becomes elaborate.
- It is development tooling, not gameplay architecture.

Specific gains:

- Faster UI QA for dense operational screens.
- Reusable visual state catalog for future agents.
- Better regression detection for the upcoming page framework and overlay system.

Best next use:

- Consider after the `v0.2.4` shell extraction, when page components have clearer inputs.

### 5.14 Dexie.js

Source: <https://dexie.org/docs/index>

Current status: not installed.

Why employ it:

- Current localStorage persistence is appropriate for the MVP.
- Future season history, event catalogs, match archives, calibration snapshots, or richer local records may outgrow localStorage.
- Dexie wraps IndexedDB and gives a more capable local database path without adding a backend.

Adaptation scale: **High**.

- This is a material persistence model change.
- It needs explicit approval and likely an ADR.
- It should not enter `v0.2.4` unless season/calendar persistence becomes real scope.

Specific gains:

- Larger local save capacity.
- Queryable local match/event history.
- Better foundation for offline-first archive features.

Best next use:

- Defer until `v0.4` architecture hardening or a concrete season-save requirement.

### 5.15 Motion

Source: <https://motion.dev/docs/react>

Current status: not installed.

Why employ it:

- UI docs ask for restrained motion: panel arrivals, selected-state emphasis, feed updates, and premium responsiveness.
- Motion can handle enter/exit, layout, hover/tap, and SVG animations more cleanly than ad hoc animation code.

Adaptation scale: **Medium**.

- Low for isolated overlay and feed transitions.
- Medium if layout animations are spread across page transitions.

Specific gains:

- Polished overlay open/close and feed-update motion.
- More deliberate live match feedback.
- Less custom animation plumbing.

Best next use:

- Defer until the page/overlay structure is stable.
- Prefer CSS transitions for simple hover and color states.

## 6. Recommended Adoption Order

```text
1. v0.2.3 / v0.4 calibration
   fast-check + @fast-check/vitest
   simple-statistics

2. v0.2.4 framework foundation
   Radix UI Primitives
   lucide-react
   optional narrow XState page/overlay machine

3. v0.2.4 feature pages
   date-fns
   Fuse.js
   TanStack Table

4. post-framework telemetry
   Recharts
   optional Motion
   optional Storybook

5. later persistence hardening
   Zustand persist migration
   Dexie only after explicit persistence decision
```

## 7. Libraries To Defer Or Avoid For Now

### Full component frameworks

Examples: Material UI, Chakra UI, Ant Design.

Reason to defer:

- The product already has a specific command-center visual identity.
- `v0.2.4` explicitly says "UI framework" means app structure, not replacing React or adopting a large design system.
- Headless or unstyled primitives are a better fit.

### Physics and animation engines

Examples: Matter.js, Phaser, Three.js for match rendering.

Reason to defer:

- The PRD and reference docs reject direct physics and 3D broadcast simulation for the current phase.
- The game needs coach-legible event simulation, not shuttle physics.

### Backend-first data stacks

Examples: Supabase, Prisma, server auth libraries.

Reason to defer:

- The architecture decision is local-first.
- The docs say to ask before adding backend, auth, database, or cloud save requirements.

### State-library replacement

Examples: Redux Toolkit, Jotai, XState as a wholesale store replacement.

Reason to defer:

- Zustand is already adequate.
- Replacing the state library requires explicit approval.
- XState can still be valuable as a focused flow/orchestration layer.

## 8. Practical Decision Notes

Use this filter before adding any dependency:

```text
Does it preserve deterministic engine truth?
Does it reduce hand-rolled UI, testing, date, or calibration work?
Can it be adopted incrementally?
Does it avoid changing persistence or state-library boundaries by surprise?
```

The strongest immediate candidates are:

| Priority | Library | Why now |
| ---: | --- | --- |
| 1 | Radix UI Primitives | Directly matches `v0.2.4` overlay and confirmation requirements |
| 2 | fast-check | Directly strengthens deterministic engine and save invariants |
| 3 | simple-statistics | Directly improves calibration planning and reports |
| 4 | date-fns | Directly supports season/calendar scaffolds |
| 5 | lucide-react | Low-risk UI polish for navigation and controls |
| 6 | Fuse.js | Low-risk roster/event search once content grows |

The highest-leverage but decision-heavy candidates are:

| Library | Decision needed |
| --- | --- |
| XState | Use narrowly for page/overlay flow, or leave page state in Zustand? |
| TanStack Router | Should `v0.2.4` adopt URL routes or keep internal SPA page state? |
| Dexie.js | Is localStorage no longer enough for future save/archive data? |
| Storybook | Is component-state documentation worth the tooling overhead now? |

## 9. Summary

The current codebase does not need a dramatic library pivot. It needs a few precise aids:

- **Radix UI** for accessible overlays and confirmation flows.
- **fast-check** and **simple-statistics** for stronger simulation confidence.
- **date-fns**, **Fuse.js**, and **TanStack Table** for season/calendar, roster, event, and analysis pages.
- **Recharts** when telemetry and calibration data need visual treatment.
- **XState** or **TanStack Router** only after the `v0.2.4` routing/page-state decision is made.
- **Dexie** only when local persistence genuinely outgrows localStorage.

The engine should remain custom, deterministic, and game-specific. The best libraries here do not
replace that engine; they clear the runway around it.

