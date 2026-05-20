# ADR-004: Use Rolling Ranking Results And Deterministic Event Entry Simulation

## Status

Accepted

## Date

2026-05-20

## Context

The career world previously began from a fixed ladder:

$$
\text{initial points}=\max(220,\ 1900 - 32\times\text{seed})
$$

That was useful for early UI work, but it created a brittle simulation. Rank was assigned more than earned, points accumulated permanently, and event fields tended to draw from the same top-ranked window. Lower-ranked fictional athletes could be trapped outside events, which meant no match records, no ranking movement, and poor player-profile evidence.

The product direction for TIX-023 is a living badminton-circuit model:

$$
\text{ranking}(t)=\sum \operatorname{TopK}(\text{dated result rows inside }52\text{ weeks})
$$

with deterministic fictional history at save creation and deterministic event fields that include non-entry and alternates.

The system remains BWF-inspired, not a reproduction of official BWF names, points tables, sponsors, or statutes.

## Decision

Badminton Manager will use a ranking-result ledger as ranking truth.

New career saves generate deterministic prior-year `bootstrap_sim` ranking rows from the fictional player pool and event catalog. Current rankings are cached snapshots rebuilt from `career.rankingResults` using:

- a 364-day rolling window,
- a default best-result cap of `10`,
- season race points separated from rolling ranking points,
- deterministic internal tie-breaks.

Event field construction now follows this pipeline:

```text
eligible/ranked players
  -> invited list
  -> non-entry resolution
  -> alternate substitution
  -> final field
  -> rank-based seeding
  -> bracket placement
```

The managed athlete is never randomly dropped from an event the user entered. Non-managed invitees can skip events for fictional reasons, and alternates are sampled from a broad eligible pool with appearance-debt weighting so lower-ranked players can gain match records.

Bootstrap rows are ranking facts, not profile-match facts. They do not populate `career.matchHistory`; only post-save played, quick-simulated, universe-simulated, backfill, or import records feed profile W-L and head-to-head truth.

## Alternatives Considered

### Keep the static seed ladder

Pros:

- simple to compute
- easy to reason about in early tests
- no save migration needed

Cons:

- rank is assigned rather than earned
- static points can dominate too long
- lower-ranked players can starve outside the event system

Rejected because it does not support a living career universe.

### Mutate ranking totals directly forever

Pros:

- small change from the previous implementation
- cheap to render

Cons:

- no natural expiry
- no honest explanation of why a rank changed
- no way to model best-10 / 52-week behavior
- old points become permanent oxygen

Rejected because rankings need to be derived from dated results.

### Write bootstrap as full match history

Pros:

- player profiles would show immediate records
- one data stream could explain both rank and W-L

Cons:

- fabricates pre-save match archives the user did not experience
- floods profiles with artificial facts
- makes future archive/import boundaries harder to explain

Rejected. Bootstrap is ranking context only.

### Select fields only from top rank windows

Pros:

- produces strong elite fields
- deterministic and simple

Cons:

- repeats the same entrants too often
- lower-ranked players have no route into the circuit
- profile records starve for the bottom half of the roster

Rejected. Non-entry plus alternates preserves field credibility while giving the circuit oxygen.

## Consequences

Positive consequences:

- new saves start with a believable earned ranking ecosystem
- bootstrap history expires naturally through the same rolling window as normal results
- rankings can explain counted results, next expiry, and season race separately
- universe events write ranking rows idempotently instead of permanent point additions
- lower-ranked players can appear through alternate selection and build post-save records
- final seeds reflect the final field, not the player an alternate replaced

Trade-offs:

- save migration must bridge old aggregate ranking rows honestly with `legacy_snapshot` rows
- ranking recalculation becomes a required maintenance step after result-ledger changes
- tests need to assert floors and invariants rather than exact event-field churn when tier pressure adds extra skips
- tournament homes must explain field changes compactly without exposing implementation jargon

## BWF-Inspired Boundary

The implementation approximates public badminton ranking principles: recent dated results, graded fictional tiers, best-result caps, and ranking-based seeding. It intentionally does not copy official event names, sponsors, athlete identities, exact official calendars, or official point tables.
