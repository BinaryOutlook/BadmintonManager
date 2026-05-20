# TIX-023: Rolling Ranking Window And Event Entry Selection

Status: Draft foundational redesign ticket
Priority: Critical
Target project: `BadmintonManager`
Target systems: career rankings, universe simulation, event entry, tournament draws, tournament seeding, player profiles, save migration, calibration tests
Prepared on: 2026-05-20
Primary files: `game/career/rankings.ts`, `game/career/universe.ts`, `game/career/events.ts`, `game/career/models.ts`, `game/career/state.ts`, `game/career/matchSchedule.ts`, `game/career/hubs.ts`, `game/tournament/tournament.ts`, `game/store/store.ts`, `game/store/save.ts`, `game/selectors/player.ts`, `components/CareerWorkbench.tsx`, `tests/unit/career-calendar-ranking.test.ts`, `tests/unit/career.test.ts`, `tests/unit/player-profile.test.ts`, `tests/unit/app-career-shell.test.tsx`
Reference input: user ranking-gridlock discussion on 2026-05-20
Depends on: `docs/active_tix/TIX-021-autonomous-universe-simulation-contract.md`
Supersedes part of: `docs/arc_tix/TIX-011-rankings-page.md`, `docs/arc_tix/TIX-017-parallel-universe-tournament-simulation.md`, `docs/arc_tix/TIX-019-universe-wide-player-records.md`
Required durable-doc updates when implemented: `docs/reference/career-calendar-ranking.md`, `docs/reference/tournament-system.md`, `docs/reference/save-and-persistence.md`, `docs/reference/code-structure.md`, and a new ADR under `docs/decisions/`

## 1. Commander Intent

Replace the current fixed starting-points ladder and rank-window-biased entrant selection with a living badminton circuit model.

The current ranking model begins from a synthetic formula:

$$
\text{initial points}=\max(220,\ 1900 - 32\times\text{seed})
$$

That formula is simple, but it creates two serious career-world problems:

1. It assigns rank more than it earns rank.
2. It can lock lower-ranked players out of events, so they never build match records, never earn points, and never move.

The new model must start every save from a simulated prior-year ranking ledger, then let that artificial history expire through a rolling ranking window as the save's real universe produces results.

The product direction is:

$$
\text{ranking} =
\text{recent results inside a rolling window}
$$

not:

$$
\text{ranking} =
\text{static seed ladder} + \text{permanent accumulated points}
$$

The event-entry direction is:

$$
\text{field}
=
\text{rank invitations}
\rightarrow
\text{non-entry/dropout}
\rightarrow
\text{alternates}
\rightarrow
\text{rank-based seeding}
$$

The career world should feel like a fictional badminton tour. Strong players usually belong near the top, but lower-ranked players must have believable routes into draws when higher-ranked athletes skip, rest, withdraw, choose other events, or miss a tier.

## 2. BWF Fidelity Anchors

This system remains fictional. Do not copy real event names, sponsors, exact official calendars, real athlete identities, or official point tables unless the product direction changes.

However, the model should align with the public principles of the BWF ranking system:

| Source anchor | Relevant rule to mirror | Implementation stance |
| --- | --- | --- |
| [BWF Corporate Rankings](https://corporate.bwfbadminton.com/players/rankings/) | Rankings are point lists that indicate performance over a period of time. | Rankings should be derived from dated results, not hard-coded seed position. |
| [BWF Corporate Rankings](https://corporate.bwfbadminton.com/players/rankings/) | Ranking points come from graded tournaments; higher tournament levels and deeper finishes are worth more. | Keep fictional tiers, but preserve strict tier ordering and placement-based points. |
| [BWF Corporate Rankings](https://corporate.bwfbadminton.com/players/rankings/) | Rankings include up to the highest-scoring results over the last 52 weeks. | Implement a 52-week window and a configurable best-result cap, defaulting to `10`. |
| [BWF Corporate Rankings](https://corporate.bwfbadminton.com/players/rankings/) | Players are seeded based on ranking. | Final event fields must be seeded after withdrawals/substitutions using current rank. |
| [BWF Statutes Section 5.3.3.1](https://system.bwfbadminton.com/documents/folder_1_81/Statutes/CHAPTER-5---TECHNICAL-REGULATIONS/Section%205.3.3.1%20World%20Ranking%20System.pdf) | For 10 or fewer events, all results count; for 11 or more, only the best 10 in the previous 52 weeks count. | Use the same conceptual rule unless gameplay tuning explicitly changes `maxCountedResults`. |
| [BWF World Tour About](https://bwfworldtour.bwfbadminton.com/about) | The tour is tiered, with elite levels carrying stronger prize and points pressure. | Keep fictional `Circuit 300/500/750/1000/Finals`, but make entry/dropout probabilities tier-aware. |

The fidelity target is:

$$
\text{BWF-inspired mechanics}
\ne
\text{official BWF reproduction}
$$

## 3. Current Failure Modes

### 3.1 Static Initial Rank

`createInitialRankings` currently creates ranking points from content seed order. This is convenient but too brittle.

Current behavior:

```ts
points: Math.max(220, 1900 - entry.seed * 32)
```

The resulting table is a starting fiction, not an earned competitive history.

### 3.2 Permanent Accumulation

`awardRankingPoints` adds points permanently. There is no expiry.

The current effective rule is:

$$
P_i(t)=P_i(0)+\sum\text{all future points}
$$

The required rule is:

$$
P_i(t)=\sum \operatorname{TopK}\{r.points \mid r.playerId=i,\ t-52\text{ weeks}\le r.date\le t\}
$$

with:

$$
K=10
$$

unless product tuning changes the cap.

### 3.3 Entrant Gridlock

`deterministicUniverseEntrants` currently creates a candidate window from top-ranked players, then fills a `16`-player event. Because most events fill before fallback candidates are needed, lower-ranked players can remain outside the field forever.

The loop becomes:

$$
\text{low rank}
\rightarrow
\text{no event entry}
\rightarrow
\text{no matches}
\rightarrow
\text{no points}
\rightarrow
\text{low rank}
$$

That is the gridlock this ticket must remove.

### 3.4 Profile Records Starve

Player profiles derive W-L and head-to-head data from `career.matchHistory`. If players never enter universe events, they never receive match records.

This breaks the universe-wide player record direction established by `TIX-019` and `TIX-021`.

## 4. Non-Negotiable Outcome

After implementation, a new career save must begin with a believable ranking ecosystem generated from a deterministic one-year head start.

The invariant is:

$$
\text{New Save}
\Rightarrow
\text{prior-year ranking ledger exists}
\Rightarrow
\text{current rank is derived from that ledger}
$$

As the save progresses:

$$
\text{bootstrap results expire}
\quad\land\quad
\text{played/simulated universe results replace them}
$$

Event fields must no longer be monopolized by the same top window. Every eligible player should have a plausible route into the post-save universe.

## 5. Architecture Decision Required

This ticket is expensive to reverse. Implementation must add a new ADR before or during the code work.

Suggested ADR title:

```text
ADR-004: Use Rolling Ranking Results And Deterministic Event Entry Simulation
```

The ADR must record:

- why the static `1900 - seed * 32` starting ladder is being retired,
- why ranking is derived from result rows rather than directly mutated totals,
- why bootstrap ranking rows are separate from normal career match history,
- why event field construction includes non-entry/dropout and alternates,
- what BWF-inspired behavior is intentionally approximated rather than copied.

## 6. Source-Of-Truth Model

### 6.1 Ranking Results

Introduce a result-ledger model that can represent bootstrap history, played career events, autonomous universe events, and future imported archive rows.

Suggested schema:

```ts
type RankingResultSource =
  | "bootstrap_sim"
  | "played"
  | "quick_sim"
  | "universe_sim"
  | "backfill_sim"
  | "archive_import";

type RankingResult = {
  id: string;
  seasonId: string;
  playerId: string;
  eventId: string;
  eventName: string;
  tier: CareerTier;
  date: string;
  resultRound: "R32" | "R16" | "QF" | "SF" | "F" | "champion";
  points: number;
  source: RankingResultSource;
  artificial: boolean;
};
```

`artificial` means:

- `true` for pre-save bootstrap rows,
- `false` for results that happen inside the user's career universe.

Bootstrap rows must be ranking facts, not full profile match facts. They may support a "prior-year form" surface later, but they must not flood `career.matchHistory` unless a separate product ticket explicitly chooses that behavior.

### 6.2 Ranking Table Rows

`RankingEntry` should stop being the only source of truth for points. It can remain as a cached snapshot for UI and migration safety, but current rank must be derived from the rolling result ledger.

Suggested derived shape:

```ts
type RankingSnapshotEntry = {
  playerId: string;
  rank: number;
  points: number;
  countedResults: number;
  eligibleResults: number;
  seasonPoints: number;
  bestResultPoints: number;
  nextExpiryDate: string | null;
  movement: number | null;
  countedResultIds: string[];
};
```

The durable state should include:

```ts
type CareerState = {
  // existing fields...
  rankingResults: RankingResult[];
  rankings: RankingSnapshotEntry[];
  rankingSettings: {
    windowDays: 364;
    maxCountedResults: 10;
    bootstrapWeeks: 52;
  };
};
```

If `rankings` remains persisted, it must be treated as a cached snapshot that is rebuilt whenever ranking results change.

## 7. Rolling Ranking Calculation Contract

### 7.1 Window Filter

For an as-of date \(t\):

$$
R_i(t)=
\{r \mid r.playerId=i,\ t-364\le r.date\le t\}
$$

Use `364` days for a fixed 52-week gameplay window. Do not approximate by calendar year.

### 7.2 Best-Result Cap

For each player:

$$
C_i(t)=\operatorname{TopK}(R_i(t),\ r.points)
$$

where:

$$
K=\texttt{career.rankingSettings.maxCountedResults}
$$

Default:

$$
K=10
$$

Then:

$$
P_i(t)=\sum_{r\in C_i(t)}r.points
$$

### 7.3 Season Race Points

`seasonPoints` should remain available, but it is not identical to world/circuit ranking points.

Recommended model:

$$
\text{seasonPoints}_i(t)
=
\sum\{r.points \mid r.playerId=i,\ r.seasonId=\text{career.seasonId},\ r.artificial=false\}
$$

This keeps Finals qualification and season narrative separate from the rolling world/circuit rank.

### 7.4 Tie Breaks

BWF allows equal ranks when points and tournament counts match. For a game UI, equal ranks may be implemented later, but deterministic ordering is still needed for arrays and tests.

Recommended internal tie-break:

```text
points descending
countedResults descending
bestResultPoints descending
previousRank ascending if available
playerId ascending
```

If equal-rank display is implemented, keep internal order stable while showing shared rank numbers.

### 7.5 Idempotency

Ranking calculation must be pure:

$$
\operatorname{rankings}(career,t)
=
\operatorname{rankings}(career,t)
$$

No call to ranking calculation may append rows, mutate match records, or create event records.

## 8. Bootstrap Prior-Year Simulation

### 8.1 Purpose

At career creation, generate a seeded fictional prior year so the first ranking table is earned by simulated results.

Current save creation:

$$
\text{selected athlete} + \text{random seed}
\rightarrow
\text{static ranking table}
$$

Required save creation:

$$
\text{selected athlete} + \text{random seed}
\rightarrow
\text{52-week bootstrap circuit}
\rightarrow
\text{rolling ranking table}
$$

### 8.2 Determinism

The bootstrap simulation must be deterministic from career seed material.

Suggested seed material:

```ts
`${careerSeed}:bootstrap:${weekNumber}:${eventTemplateId}:${salt}`
```

Two new saves with the same seed and selected athlete must produce the same bootstrap ranking ledger.

### 8.3 Bootstrap Calendar

Create a fictional prior-year schedule using the current `careerEventCatalog` as a template, or define a separate bootstrap template if the catalog is too sparse.

Minimum acceptable bootstrap schedule:

- at least `26` bootstrap events across the prior 52 weeks,
- at least one event every two weeks on average,
- a mix of `National`, `Invitational`, `Circuit 300`, `Circuit 500`, `Circuit 750`, `Circuit 1000`, and one high-value finale/major-style event if supported,
- draw sizes matching current engine support, initially `16`, then `32` when the engine supports `R32`.

Recommended bootstrap distribution for the current 47-player pool:

| Fictional tier | Count in bootstrap year | Purpose |
| --- | ---: | --- |
| `National` / `Invitational` | 6-8 | Lower and developing players get ranking oxygen. |
| `Circuit 300` | 7-9 | Broad tour entry and churn. |
| `Circuit 500` | 5-7 | Mid-tier rank sorting. |
| `Circuit 750` | 3-5 | Strong-player separation. |
| `Circuit 1000` | 2-4 | Elite anchor results. |
| `Finals` or finale-like event | 0-1 | Optional; only if season race inputs are modeled honestly. |

### 8.4 Bootstrap Result Fidelity

Bootstrap results should correlate with actual player skill without becoming deterministic chalk.

The target is:

$$
\operatorname{corr}(\text{OVR/derived strength},\ \text{bootstrap rank})
\quad\text{is strong but imperfect}
$$

Implementation guidance:

- use existing quick simulation or a faster skill-weighted event simulator,
- allow upsets,
- include fatigue/participation pressure if already available cheaply,
- avoid writing full `career.matchHistory` for bootstrap rows,
- mark every bootstrap ranking row with `source: "bootstrap_sim"` and `artificial: true`.

### 8.5 Bootstrap Expiry

Bootstrap rows must expire through the same rolling window as normal rows.

If the career starts on `2026-06-01`, a bootstrap result dated `2025-06-10` should leave the rankings around `2026-06-09` or `2026-06-10`, depending on inclusive date handling.

Required test:

$$
\text{advance career date by } 370\text{ days}
\Rightarrow
\text{all original bootstrap rows are outside the ranking window}
$$

At that point, rank must be driven by post-save universe results and any still-valid non-bootstrap rows.

## 9. Event Entry And Non-Entry Contract

### 9.1 Pipeline

Every event field must be constructed through the same conceptual pipeline:

```text
eligible players
  -> invited list
  -> non-entry/dropout resolution
  -> alternate substitution
  -> final field
  -> seeding by current rank
  -> bracket placement
```

Do not seed the bracket before dropout/substitution. In real tournament logic, seeding belongs to the final field, not the initial wish list.

### 9.2 Eligible Players

Eligibility should consider:

- current rolling rank,
- event tier gates,
- event-specific min rank/min points/readiness requirements,
- player availability/fatigue/injury when available,
- managed athlete entry state,
- event calendar conflicts when implemented.

The managed athlete must not be randomly dropped from an event the user intentionally entered unless a future explicit withdrawal/injury ticket adds that product behavior.

### 9.3 Invited List

For a draw size \(D\), build an initial invited list of \(D\) players.

Recommended first implementation:

$$
\text{invited} = \text{top }D\text{ eligible ranked players}
$$

This keeps the base field realistic. The randomness enters through non-entry and alternates, not through making the entire event chaotic.

### 9.4 Guaranteed Non-Entry Count

For non-managed invited players, guarantee a minimum number of non-entries:

$$
\text{guaranteedNonEntries}
=
\min(5,\lceil0.15D\rceil)
$$

Examples:

| Draw size | Calculation | Guaranteed non-managed non-entries |
| ---: | --- | ---: |
| `16` | \(\min(5,\lceil2.4\rceil)\) | `3` |
| `32` | \(\min(5,\lceil4.8\rceil)\) | `5` |

If fewer than that many non-managed invited players are available, cap at the available non-managed count.

### 9.5 Tier-Sensitive Dropout Pressure

The guaranteed count is the floor. Additional non-entry probability may vary by tier.

Recommended defaults:

| Tier | Base non-entry pressure | Design reason |
| --- | ---: | --- |
| `National` | `0.22` | Lower stakes, more churn. |
| `Invitational` | `0.20` | Selective, story-friendly churn. |
| `Circuit 300` | `0.18` | Lower-tier entry oxygen. |
| `Circuit 500` | `0.14` | Meaningful but still porous. |
| `Circuit 750` | `0.10` | Stronger field, fewer skips. |
| `Circuit 1000` | `0.06` | Elite events should hold stars. |
| `Finals` | `0.00-0.04` | Only qualified players, minimal random absence. |

This table is tuning guidance, not a hard product law. The implementation must remain deterministic for a given save.

### 9.6 Non-Entry Reasons

Store or derive a reason for every non-managed dropout. Reasons add credibility and help tournament homes explain why lower-ranked players entered.

Suggested type:

```ts
type EventNonEntryReason =
  | "rest"
  | "travel"
  | "fatigue"
  | "injury_management"
  | "schedule_choice"
  | "tier_priority"
  | "wildcard_not_taken";

type EventFieldChange = {
  eventId: string;
  playerId: string;
  action: "non_entry" | "alternate_in";
  reason: EventNonEntryReason | "alternate_queue";
  replacedPlayerId?: string;
};
```

Tournament homes can later show a compact field-change note such as:

```text
3 ranked invitees skipped; alternates entered from the queue.
```

Do not clutter the UI with implementation jargon.

## 10. Alternate Selection Contract

### 10.1 Why Alternates Matter

Alternates are the mechanism that breaks gridlock.

The intended loop is:

$$
\text{top invitee skips}
\rightarrow
\text{alternate enters}
\rightarrow
\text{lower-ranked player records matches}
\rightarrow
\text{rank can move}
$$

### 10.2 Alternate Pool

Build alternates from players who are:

- eligible,
- not already in the final field,
- not withdrawn from this event,
- not the managed athlete unless the managed athlete explicitly entered or the event system supports late user entry.

The pool must not be restricted to only the immediate next few ranks. Include a broader range so lower-ranked players can surface.

Recommended pool:

$$
\text{alternatePool}
=
\text{eligible not invited players}
$$

Then select using deterministic weighted randomness.

### 10.3 Weighted Alternate Formula

Use weighted sampling without replacement.

Suggested weight:

$$
w_i = R_i \times A_i \times I_i \times T_i
$$

where:

$$
R_i = \frac{1}{(\operatorname{rank}_i)^\alpha}
$$

Ranking still matters.

$$
A_i = 1 + \lambda \times \max(0,\ \text{targetAppearances}-\text{appearancesLast52Weeks}_i)
$$

Appearance debt helps players who have barely played.

$$
I_i =
\begin{cases}
1.25 & \text{inactive for many weeks}\\
1.00 & \text{normal}\\
0.70 & \text{played very recently}
\end{cases}
$$

Inactivity creates comeback opportunities; recent play slightly reduces overuse.

$$
T_i =
\begin{cases}
1.25 & \text{tier is low and player is lower-ranked}\\
1.00 & \text{normal}\\
0.75 & \text{tier is elite and player is far outside expected standard}
\end{cases}
$$

Tier fit protects elite-event credibility.

Initial tuning:

```ts
alpha = 0.65
lambda = 0.35
targetAppearances = expectedAppearancesForTierBand(playerRankBand)
```

Do not overfit this in the first pass. Add calibration tests and tune after the model is visible.

### 10.4 Appearance Debt

Appearance debt should be computed from post-save universe events plus optionally bootstrap events for initial stability.

Recommended first pass:

```ts
appearancesLast52Weeks(playerId, asOfDate) =
  rankingResults.filter(result =>
    result.playerId === playerId &&
    isWithinRankingWindow(result.date, asOfDate)
  ).length
```

If bootstrap appearances dominate too much, count only non-artificial results for event-entry appearance debt after the first career month.

## 11. Final Field And Seeding Contract

### 11.1 Final Field

After non-entries and alternates:

$$
|\text{finalField}| = D
$$

where \(D\) is event draw size.

No duplicate player ids are allowed.

If the field cannot be filled from eligible players, fail loudly in tests and use a safe UI note in runtime. Do not silently create duplicate entrants.

### 11.2 Seeding

Final seeds are assigned by current rolling ranking:

$$
\text{seed}_i = \operatorname{orderBy}(\text{finalField}, \text{currentRank ascending})
$$

This means a lower-ranked alternate can enter the event, but they do not inherit the seed of the player they replaced.

Example:

```text
Rank #4 withdraws.
Rank #28 enters as alternate.
Rank #28 is seeded according to rank #28, not as seed #4.
```

### 11.3 Bracket Placement

Use deterministic bracket placement based on seed position.

Current `16`-player bracket:

```text
1 v 16
8 v 9
5 v 12
4 v 13
6 v 11
3 v 14
7 v 10
2 v 15
```

Future `32`-player support must add `R32` and a proper `32`-seed placement order. Do not fake `32` by running two unrelated `16`-player brackets.

## 12. Worked Functional Example

Assume:

```text
Pool size: 47
Draw size: 16
Event tier: Circuit 300
Managed athlete: not entered
```

Step 1: Invite the top `16` eligible players by rolling rank.

```text
Invited ranks: 1-16
```

Step 2: Determine guaranteed non-entries.

$$
\text{guaranteedNonEntries}
=
\min(5,\lceil0.15\times16\rceil)
=
3
$$

Step 3: Using deterministic event seed material, mark three non-managed invitees as not entering.

Example:

```text
Rank #4: rest
Rank #9: schedule_choice
Rank #15: fatigue
```

Step 4: Select alternates from the eligible non-invited pool using weighted sampling.

Example:

```text
Rank #18 enters.
Rank #27 enters.
Rank #36 enters.
```

Step 5: Final field is sorted by rolling rank and seeded.

```text
Seeds: #1, #2, #3, #5, #6, #7, #8, #10, #11, #12, #13, #14, #16, #18, #27, #36
```

Step 6: Bracket placement uses seed positions, not original rank numbers.

The outcome is believable:

$$
\text{top field integrity}
\quad+\quad
\text{lower-rank oxygen}
$$

For a future `32`-player event:

$$
\text{guaranteedNonEntries}
=
\min(5,\lceil0.15\times32\rceil)
=
5
$$

## 13. Implementation Sequence

### Phase 1: Decision And Model Foundation

1. Add ADR-004.
2. Add ranking result schemas to `game/career/models.ts`.
3. Add save migration for the new fields and bump the save version.
4. Add pure ranking-window utilities in `game/career/rankings.ts`.

Required functions:

```ts
function isWithinRankingWindow(args: {
  resultDate: string;
  asOfDate: string;
  windowDays: number;
}): boolean;

function rankingResultsForPlayer(args: {
  results: RankingResult[];
  playerId: string;
  asOfDate: string;
  windowDays: number;
  maxCountedResults: number;
}): {
  eligible: RankingResult[];
  counted: RankingResult[];
  nextExpiryDate: string | null;
};

function buildRankingSnapshot(args: {
  players: SeededPlayer[];
  results: RankingResult[];
  asOfDate: string;
  previousRankings?: RankingSnapshotEntry[];
  settings: CareerState["rankingSettings"];
}): RankingSnapshotEntry[];
```

Checkpoint:

- [ ] Ranking snapshot can be built from a hand-authored ledger.
- [ ] Results outside 52 weeks do not count.
- [ ] Only best `10` results count when more than `10` exist.

### Phase 2: Bootstrap Prior-Year Simulation

1. Add `createBootstrapRankingResults`.
2. Replace `createInitialRankings` usage in `createInitialCareerState` with bootstrap-driven ranking snapshot creation.
3. Preserve deterministic save creation for the same seed.

Suggested service:

```ts
function createBootstrapRankingResults(args: {
  players: SeededPlayer[];
  careerStartDate: string;
  seed: number;
  settings: CareerState["rankingSettings"];
  eventTemplates: CareerEventDefinition[];
}): RankingResult[];
```

Checkpoint:

- [ ] New saves no longer depend on `1900 - seed * 32` for actual ranking points.
- [ ] Every player has a plausible bootstrap ranking ledger.
- [ ] Top-ranked players generally have stronger derived profiles than bottom-ranked players, while allowing exceptions.

### Phase 3: Event Field Selection Service

1. Extract event field creation out of `deterministicUniverseEntrants`.
2. Implement invited list, dropout, alternate, and final seeding records.
3. Store field-change information in universe records or a related event field snapshot.

Suggested type:

```ts
type EventFieldSnapshot = {
  eventId: string;
  drawSize: number;
  asOfDate: string;
  invitedPlayerIds: string[];
  nonEntries: EventFieldChange[];
  alternateEntries: EventFieldChange[];
  finalPlayerIds: string[];
  seeds: Array<{
    seed: number;
    playerId: string;
    rank: number;
    points: number;
  }>;
};
```

Checkpoint:

- [ ] `16`-player events guarantee `3` non-managed non-entries when possible.
- [ ] `32`-player tests can be authored even if full `32`-draw UI is deferred.
- [ ] Alternates include lower-ranked players over repeated events.

### Phase 4: Universe Simulation Integration

1. Update `simulateUniverseThroughDate` to use `EventFieldSnapshot`.
2. Update universe bracket simulation to use final seeded field.
3. Write ranking result rows from completed universe placements.
4. Rebuild ranking snapshot after every event completion.
5. Preserve all `TIX-021` idempotency rules.

Checkpoint:

- [ ] Re-running universe simulation does not duplicate ranking results.
- [ ] Re-running universe simulation does not duplicate match records.
- [ ] Managed played results remain immutable.

### Phase 5: UI And Explanation Surfaces

Update rankings page:

- show `Rolling 52-week window`,
- show counted result count,
- show season race separately,
- show next expiry date when available,
- avoid implying permanent points.

Update tournament home:

- show final field seed basis,
- show non-entry/alternate summary,
- make player names profile-addressable,
- keep detailed field-change rows compact or behind an existing section.

Update post-match review copy:

- do not claim ranking points settle from every match if the event is still alive,
- distinguish "event result pending" from "ranking ledger updated."

Checkpoint:

- [ ] User can understand why winning one match may not immediately change rank.
- [ ] User can understand why a lower-ranked player entered a draw.

### Phase 6: Calibration And Documentation

1. Update subsystem references.
2. Add calibration tests for participation distribution.
3. Add regression tests for rolling expiry.
4. Update save documentation for version bump and migration fallback.

Checkpoint:

- [ ] Ticket implementation can be understood without this chat transcript.

## 14. Persistence And Migration Contract

This change requires a save-version bump.

Likely version:

```text
10 -> 11
```

Migration rules:

- old saves without `rankingResults` must still load,
- old `rankings` rows may be converted into synthetic `archive_import` or `legacy_snapshot` ranking rows only if that can be done honestly,
- if old saves cannot reconstruct result dates, keep their old points as a legacy snapshot and begin rolling-window truth from future events,
- never fabricate precise old tournament histories from only aggregate ranking points,
- new saves must always use bootstrap ranking results.

Suggested migration fallback:

```ts
type RankingResultSource =
  | "legacy_snapshot"
  | "bootstrap_sim"
  | "played"
  | "quick_sim"
  | "universe_sim"
  | "backfill_sim"
  | "archive_import";
```

If `legacy_snapshot` is used, it must be documented as a bridge and must not masquerade as match truth.

## 15. Absolute Rules

- Do not keep `1900 - seed * 32` as the source of new-save ranking truth.
- Do not make ranking points permanent.
- Do not make event entry depend only on the same top ranking window.
- Do not randomly drop the user-managed athlete from an event the user entered.
- Do not seed a player according to the rank of the player they replaced.
- Do not write bootstrap matches into `career.matchHistory` unless a separate ticket explicitly asks for pre-save match archives.
- Do not double-count ranking result rows after reload, import, day advance, tournament-home open, or post-match review.
- Do not move simulation logic into React.
- Do not make BWF fidelity claims that exceed the implementation. Use "BWF-inspired" where the model is approximate.
- Do not copy real event names or official point tables into the fictional product without a legal/product decision.

## 16. Acceptance Criteria

- [ ] New career saves generate ranking points from deterministic bootstrap results, not the static `1900 - seed * 32` ladder.
- [ ] Ranking snapshots are derived from results inside a 52-week window.
- [ ] Only the best `10` results count by default when a player has more than `10` eligible results.
- [ ] Bootstrap results expire naturally as the career date advances beyond their window.
- [ ] `seasonPoints` remains separate from rolling ranking points.
- [ ] Completed universe events write ranking result rows with stable ids.
- [ ] Re-running simulation for the same date does not duplicate ranking results, match records, achievements, or points.
- [ ] A `16`-player event guarantees `min(5, ceil(0.15 * 16)) = 3` non-managed non-entries when enough non-managed invited players exist.
- [ ] A `32`-player event selection test guarantees `min(5, ceil(0.15 * 32)) = 5` non-managed non-entries even if full `32`-draw UI ships later.
- [ ] Alternates are selected from a broad eligible pool using deterministic weighted randomness.
- [ ] Lower-ranked eligible players appear in event fields across a simulated season.
- [ ] Final event seeds are assigned after non-entry and alternates, using current rolling rank.
- [ ] Player profiles gain post-save records for non-managed players through universe events.
- [ ] Rankings page explains rolling window and counted results without implying permanent cumulative points.
- [ ] Tournament homes can explain field changes compactly.
- [ ] Old saves remain loadable and use honest migration fallback behavior.

## 17. Verification

Run:

```bash
npm run test -- tests/unit/career-calendar-ranking.test.ts
npm run test -- tests/unit/career.test.ts
npm run test -- tests/unit/player-profile.test.ts
npm run test -- tests/unit/app-career-shell.test.tsx
npm run build
```

Add focused unit tests for:

- `buildRankingSnapshot` filters out results older than `364` days,
- `buildRankingSnapshot` counts all results when a player has `10` or fewer eligible rows,
- `buildRankingSnapshot` counts only the best `10` when a player has `11+` eligible rows,
- bootstrap simulation is deterministic for the same seed,
- bootstrap rows expire after the rolling window,
- new-save rank correlates with skill without exact seed-order determinism,
- event field selection guarantees non-managed non-entries for `16` and `32`,
- alternate selection is deterministic for the same event seed,
- alternates do not inherit replaced-player seeds,
- final field has no duplicates,
- managed entered athlete is not randomly dropped,
- universe completion writes ranking result rows once,
- legacy save migration preserves loadability.

Add a distribution/calibration test:

```text
Given the 47-player fictional pool
and one full fictional season of events
when universe simulation runs with multiple fixed seeds
then lower-third players must receive measurable event appearances
and no eligible player should be permanently excluded solely because they began outside the top 32.
```

Suggested measurable first-pass band:

- over `10` fixed seeds,
- at least `85%` of eligible players receive one post-save event appearance by season end,
- at least `60%` of bottom-third eligible players receive one post-save event appearance by season end,
- no event produces duplicate entrants,
- no event violates draw size.

These bands are tuning targets. If the roster or calendar size changes, update the test thresholds with a short rationale.

## 18. Visual And UX QA

After implementation, capture at least:

- rankings page desktop after new save,
- rankings page after several completed events,
- rankings page near bootstrap expiry,
- tournament home showing field-change summary,
- player profile for a formerly lower-ranked non-managed player with new match records,
- mobile rankings page with no horizontal overflow.

The UI should answer:

$$
\text{Why am I ranked here?}
$$

with:

- current rolling points,
- counted results,
- season race points,
- next major expiry when available,
- player ahead/behind gap.

The UI should answer:

$$
\text{Why is this lower-ranked player in the event?}
$$

with:

- final seed/rank,
- alternate or field-change explanation,
- no visible implementation jargon.

## 19. Open Questions

- Should equal rank display be implemented now, or should internal deterministic rank order remain visible?
- Should `legacy_snapshot` ranking rows expire after 52 weeks from import/load date, or remain as an explicit old-save bridge until enough new events occur?
- Should bootstrap results contribute to "prior form" UI, or stay invisible except through ranking calculation?
- Should top-ranked players have mandatory participation pressure in elite events, or is low dropout pressure enough for now?
- Should appearance-debt alternate weighting count bootstrap appearances during the first career month?

These questions should be answered in ADR-004 or in the implementation PR notes.

## 20. Definition Of Done

The career ranking system should feel like a living tour:

$$
\text{prior-year simulation}
\rightarrow
\text{rolling ranking window}
\rightarrow
\text{tiered event entry}
\rightarrow
\text{dropouts and alternates}
\rightarrow
\text{rank-seeded brackets}
\rightarrow
\text{new results replacing old history}
$$

The old static ladder is gone for new saves. Lower-ranked players can breathe into the circuit. Strong players remain favored because skill and results matter, not because the initial seed formula gave them permanent oxygen.

The final user-facing standard is:

$$
\text{Rankings explain the world}
\quad\text{and}\quad
\text{the world can change the rankings}
$$
