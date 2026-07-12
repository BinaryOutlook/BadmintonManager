# Program Ecosystem Reference

This document owns the durable contract for the small multi-athlete program introduced during Version Two work.
The career still has one competition lead, but recruitment, preparation, finance, and talent development now operate as
one inspectable local simulation rather than unrelated UI actions.

## Identity Contract

- `career.program.managedPlayerId` is the locked competition lead. Viewing another athlete never changes it.
- `career.ecosystem.recruitment.roster` owns program membership and contract terms.
- `career.athletes` owns playable career state for every active roster athlete.
- Persisted legacy roles remain `lead | senior | academy`; the manager-facing vocabulary is Lead, Rotation, and
  Development. This avoids a save migration solely for copy while keeping the mapping in `game/career/program.ts`.
- Career Squad defaults to **My Program**. **World Directory** is a separate, view-only surface.
- Recruited athletes have a career-generated profile sourced from roster, athlete, schedule, and development-history
  facts. It must not invent canonical content-player data.

## Preparation Authority

`game/career/preparation.ts` is the only athlete-training resolver.

```text
manager schedules roster athlete
  -> role-default immutable plan snapshot
  -> Portal + Timeline + Calendar commitment
  -> Advance Day
  -> medical and cash gate
  -> shared staff/facility modifiers
  -> athlete + ledger + development-history resolution
```

Scheduling a block must not immediately change athlete attributes or cash. One athlete can have one block on the
current date; a new selection deterministically replaces that athlete's current-date block. A secondary-athlete block
must not change the lead athlete's selected training plan. Preview and resolution use the same preparation function.

Current role defaults are:

| Manager role | Persisted role | Default block |
| --- | --- | --- |
| Lead | `lead` | manager-selected through Training |
| Rotation | `senior` | Rally Base |
| Development | `academy` | Pressure Patterns |

## Recruitment Trust

- Candidate source, report confidence, report age/expiry, and cost knowledge must be visible.
- Fit, interest, and risk are not shown as trusted exact facts without a current report.
- `recruitmentOfferPreview()` owns the same cost, affordability, role, promise, and deterministic decision calculation
  consumed by `makeRecruitmentOffer()`.
- Signing consequences show the immediate signing fee and derived weekly contract before commitment.
- Replaying an accepted or rejected offer is a domain no-op; it cannot duplicate cash charges, roster membership,
  promises, athletes, or history.

## Weekly Finance

`weeklyProgramPayroll()` derives obligations from active roster contracts and hired staff; it does not trust a second UI
formula. Payroll posts each Monday through `resolveCareerDay()` as one `contract` ledger entry. The dated ledger label is
the idempotency boundary across forecasts, reloads, and repeated resolver calls.

Staff hiring has an immediate onboarding fee equal to the listed salary and adds the same amount to weekly payroll.
The UI must describe both consequences. Payroll may take cash negative; that deterministic shortfall is recorded in
career notes rather than silently suppressing the charge.

No persistence version bump was required: roster contracts, hired staff, ledger entries, and
`economy.contractCostPerWeek` already exist in save version 12 / career version 10.

## Evolving Talent Pools

`advanceProgramPools()` runs once for each resolved career date.

- Candidate interest and risk move from a stable signal keyed by career seed, date, candidate ID, and field.
- Prospect readiness and morale move from the same stable-signal approach plus the authoritative staff and facility
  modifiers.
- Output is sorted by stable ID so identical seed/date/state produces identical results even if source arrays differ in
  order.
- Accepted candidates are not mutated by the market.
- A dated program-log marker prevents same-date replay without adding save fields.

Potential and traits remain unverified until a current academy report exists. The youth desk exposes daily resolution
and report evidence; the earlier repeatable instant-development and instant-event controls are no longer presented.

## Known Limits

- Recruitment is a deterministic offer decision, not a multi-step negotiation system.
- Staff training benefits are shared program modifiers; explicit same-day coach-capacity allocation is future work.
- Talent pools evolve in place; intake, graduation, release, and replacement windows are not yet modeled.
- Lower-event domain records remain compatible with existing saves, but new lower-event scheduling needs a dated
  commitment design before returning as a manager action.

These limits must be described honestly rather than hidden behind decorative controls.

## Verification Contract

At minimum, prove:

- offer replay is idempotent;
- scheduling a rotation athlete changes no immediate athlete, lead-plan, or economy state;
- exact preview equals preparation resolution;
- Advance Day writes one history record and one training ledger charge;
- payroll posts once on the weekly boundary;
- identical seed/date produces identical ordered pool evolution;
- pending preparation survives local-save reload;
- My Program and World Directory preserve locked-lead identity.
