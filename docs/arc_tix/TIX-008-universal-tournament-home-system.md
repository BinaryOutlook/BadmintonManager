# TIX-008: Universal Tournament Home System

Status: Draft implementation ticket
Priority: High
Target project: `BadmintonManager`
Target screens: Career `Calendar`, `Event Details`, tournament/event home, past event archive
Prepared on: 2026-05-19
Primary files: `components/CareerWorkbench.tsx`, `components/KnockoutTree.tsx`, `app/App.tsx`, `app/pages.ts`, `game/career/models.ts`, `game/career/events.ts`, `game/store/save.ts`, `styles.css`, `tests/unit/career-calendar-ranking.test.ts`, `tests/unit/career.test.ts`, `tests/unit/knockout-tree.test.tsx`, `e2e/app.spec.ts`
Reference input: Calendar card density review from 2026-05-19; `docs/arc_tix/TIX-001-compact-one-page-career-portal.md`; `docs/reference/career-calendar-ranking.md`; `docs/product/versions/v0.3/v0.3.md`

## 1. Commander Intent

Build a universal home screen for every career tournament.

The Calendar becomes a fast scan surface. The tournament home becomes the complete command page for a competition: entry, deadlines, eligibility, draw, bracket, winner, result archive, rewards, field context, and next action.

The product rule is:

$$
\text{Calendar} = \text{scan and choose}
$$

$$
\text{Tournament Home} = \text{inspect, enter, manage, review}
$$

No information is removed. Information is relocated into the correct surface.

## 2. Problem Statement

The current Calendar event rows carry too much administrative detail at once: deadline chips, eligibility prose, seeding explanation, rival field text, prize/cost, status, and action controls all compete inside each row.

The app already has an `eventDetails` page, but it is not yet strong enough to replace the row detail payload. It also does not serve as a universal competition homepage for active, future, or past events.

The result is an unhelpful information equation:

$$
\text{Calendar Row Load}
=
\text{decision facts}
+ \text{administrative timeline}
+ \text{draw explanation}
+ \text{archive detail}
$$

This ticket moves the last three terms into the tournament home.

## 3. Objective

Create a single tournament home system addressable by event identity and usable from both Upcoming and Past Calendar sections.

Target behavior:

```text
Calendar row -> Open Event -> Tournament Home
```

The tournament home must handle:

- future tournaments not yet entered,
- entered tournaments waiting for draw or match day,
- active tournaments with a current knockout tree,
- completed/past tournaments with winner and result archive,
- missed, skipped, or withdrawn events with honest fallback states.

## 4. Universal Addressing Requirement

Every competition home must be opened through a stable tournament address, not through display text.

Minimum address shape:

```ts
type TournamentAddress = {
  seasonId: string;
  eventId: string;
};
```

Implementation may keep the current internal SPA page pattern:

```ts
{ id: "eventDetails", eventId: string }
```

but the page and helper names should move toward `TournamentHome` / `openTournamentHome`. Do not use tournament names, dates, or row index as identifiers.

The route must be URL-ready even if the app does not adopt browser URL routing in this ticket:

```text
/career/tournaments/:seasonId/:eventId
```

Do not force a full router migration unless the existing app structure already supports it cleanly.

## 5. Calendar Quick View Contract

The Calendar must become lean.

Each event row should show only:

- tournament name,
- tier/category/week/status,
- date window,
- entry deadline or completed result,
- eligibility summary,
- prize/cost summary,
- one primary action: `Open Event`.

Rows may still expose `Play Match`, `Review Match`, or `Enter Event` when those are urgent daily actions, but the default inspection action is `Open Event`.

Remove from default Calendar rows:

- full deadline chip rows,
- long eligibility sentences,
- full seeding explanation,
- rival field paragraphs,
- draw-engine disclaimer paragraphs.

Those details move to the tournament home.

## 6. Tournament Home Required Sections

The tournament home must be useful on first load without requiring deep scrolling.

Required top-level sections:

1. **Header**
   - tournament name,
   - tier/category/week/status,
   - location and venue,
   - date window,
   - main action: `Enter Event`, `Play Match`, `Review Match`, `Withdraw`, or status-only `Completed`.

2. **Decision Summary**
   - entry deadline,
   - eligibility verdict,
   - readiness requirement and current readiness,
   - prize money,
   - entry/travel cost,
   - champion points,
   - net possible gain.

3. **Knockout Draw**
   - display the knockout tree whenever an actual tournament state or archived bracket snapshot exists,
   - show pending/projected bracket state before draw publication,
   - highlight the managed athlete,
   - highlight next opponent when active,
   - show champion clearly when completed.

4. **Timeline**
   - ranking cutoff,
   - seeding snapshot,
   - entry deadline,
   - withdrawal deadline,
   - draw published,
   - match week begins,
   - start/end dates.

5. **Eligibility**
   - structured checks for rank, points, season race, readiness, completed events, affordability, medical gate, and deadline state.

6. **Rewards And Stakes**
   - prize money,
   - entry cost,
   - travel cost,
   - net gain,
   - ranking points,
   - season race impact.

7. **Field And Scouting**
   - rival field pressure,
   - top threat if known,
   - scouting availability,
   - projected or locked seed snapshot,
   - draw status honesty note.

## 7. Past Event Requirement

Past events must not be dead rows.

Each Past Events row must open the tournament home. The home must show:

- winner/champion,
- managed player result,
- points earned,
- prize earned,
- costs and net cash,
- scoreline evidence,
- knockout tree if archived,
- fallback archive summary if the save predates bracket snapshots.

If the current save model cannot reconstruct a past bracket after tournament closeout, add a lightweight persisted bracket snapshot to `CareerEventHistoryRecord`.

Minimum snapshot intent:

```ts
type CareerEventBracketSnapshot = {
  championId: string | null;
  managedPlayerId: string;
  rounds: Array<{
    name: "R16" | "QF" | "SF" | "F";
    matches: Array<{
      id: string;
      sideAId: string;
      sideBId: string;
      winnerId: string | null;
      scoreline: string | null;
      managed: boolean;
    }>;
  }>;
};
```

Migration rule: old saves without a bracket snapshot remain valid and render the archive fallback instead of breaking.

## 8. Tab/Subpage Rule

If one page becomes too dense, use Football Manager-style tabs inside the tournament home.

Allowed tabs:

- `Overview`,
- `Draw`,
- `Entry`,
- `Timeline`,
- `Rewards`,
- `History`.

The `Overview` tab must stand alone. It must always show:

- header identity,
- main action/status,
- decision summary,
- winner/result if completed,
- compact draw preview or pending draw state.

Do not hide the most important decision behind a secondary tab.

## 9. Visual Hierarchy Rules

- Calendar rows are compact operational rows, not mini-homepages.
- Tournament home can be rich, but must not become a loose wall of cards.
- Prefer status strips, tables, timelines, and bracket panels over paragraphs.
- Completed tournaments should read like result archives, not entry screens.
- Active tournaments should prioritize next opponent, draw state, and match action.
- Future tournaments should prioritize entry decision, deadline risk, and readiness.
- Use existing dark management style and compact command-panel language.
- No licensed tournament branding, real federation trade dress, or real athlete likenesses.

## 10. Interaction Rules

- `View Entry` should be replaced by `Open Event` or `Event Home`.
- Completed Calendar rows should show a status badge plus `Open Event`, not a disabled action as the only visible control.
- The entire row may be clickable only if nested buttons remain accessible and there is no accidental double action.
- Keyboard users must be able to open every tournament home from Upcoming and Past sections.
- Player names inside the draw must keep existing profile-link behavior.
- Opening an unavailable or missing tournament address must show a clear not-found state and a `Calendar` return action.

## 11. Data And Persistence Rules

Do not change simulation outcomes for this ticket.

Allowed data changes:

- add optional tournament-home view helpers,
- add optional archived bracket snapshot,
- add save migration defaults for old history records,
- add selectors that resolve `TournamentAddress` into `catalog event`, `active tournament`, `history record`, and `current status`.

Disallowed changes:

- no backend,
- no auth,
- no database,
- no cloud save,
- no real tournament content,
- no draw-engine replacement beyond presentation requirements.

## 12. Acceptance Criteria

- [ ] Calendar rows are visibly reduced and no longer show full deadline chips or long detail paragraphs by default.
- [ ] Every Upcoming event exposes `Open Event` / `Event Home`.
- [ ] Every Past Events record exposes `Open Event` / `Event Home`.
- [ ] The tournament home resolves by stable `seasonId + eventId` identity.
- [ ] Future events show entry decision, timeline, eligibility, rewards, and pending/projected draw state.
- [ ] Entered active events show the live knockout tree when `props.tournament` matches the event.
- [ ] Completed events show champion/winner, managed result, rewards, costs, scoreline evidence, and bracket snapshot when available.
- [ ] Old saves without bracket snapshots do not crash and show an honest archive fallback.
- [ ] The knockout tree remains reusable and still supports player profile links.
- [ ] The page has no text overlap, clipped buttons, or horizontal overflow at desktop and mobile viewports.
- [ ] No tournament simulation, ranking math, or match result behavior changes.

## 13. Verification Plan

Run from `BadmintonManager`:

```bash
npm run build
npm run test
npm run test:e2e
```

Focused checks:

```bash
npm run test -- tests/unit/career-calendar-ranking.test.ts
npm run test -- tests/unit/career.test.ts
npm run test -- tests/unit/knockout-tree.test.tsx
npx playwright test e2e/app.spec.ts
```

Required e2e proof:

- start a career,
- open Calendar,
- open a future tournament home,
- enter an event from the home,
- advance to draw/match day,
- verify active bracket appears on the home,
- complete or close an event,
- open Past Events,
- open the completed tournament home,
- verify winner/result archive appears,
- verify mobile Calendar and tournament home have no horizontal overflow.

## 14. Suggested Implementation Sequence

1. Add a tournament-address resolver for `seasonId + eventId`.
2. Rename or wrap `CareerEventDetailsPage` into `CareerTournamentHomePage`.
3. Reduce Calendar row detail payload and replace `View Entry` with `Open Event`.
4. Build the home overview: header, decision summary, main action, timeline, eligibility, rewards.
5. Integrate `KnockoutTree` for active event state.
6. Add optional archived bracket snapshot for completed event history.
7. Add Past Events `Open Event` behavior.
8. Add tabs only if the single page becomes too dense.
9. Update unit/e2e coverage.
10. Run full verification and inspect screenshots.

## 15. Definition Of Done

This ticket is done when tournament navigation feels universal:

$$
\text{one competition}
\rightarrow
\text{one home}
\rightarrow
\text{entry, draw, result, archive}
$$

The Calendar should feel calm enough to scan. The tournament home should feel complete enough that no event information needs to live in the Calendar row.
