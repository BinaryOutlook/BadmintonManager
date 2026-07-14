# Game Mechanics Reference

This document explains **Badminton Manager** as a playable system. It is not marketing copy; it is the durable gameplay contract for maintainers.

Core product equation:

**meaningful management = clear choices + trustworthy simulation + inspectable consequences**

## Player Fantasy

The player is a coach and program manager, not the athlete holding the racket.

The game should reward:

- choosing the right athlete and tactical plan
- preparing the program through training, recovery, scouting, staff, facilities, and calendar choices
- making live match decisions such as directives and between-set talks
- reading engine-backed evidence after the match

The game should not drift into reflex controls, manual shot steering, or direct racket execution.

## Controlled Inputs

The player can influence the world through management intent:

- **Athlete choice**: start a locked-athlete career or a separate quick tournament run.
- **Tactics**: pick quick-run tactics or maintain career match plans that convert into engine `MatchTactic` inputs.
- **Training and recovery**: choose load/recovery blocks that affect readiness, fatigue, cash, and injury risk.
- **Event entry**: enter fictional circuit events when deadline, rank, readiness, economy, and eligibility gates allow it.
- **Match decisions**: start scheduled managed matches, apply live directives, choose between-set team talks, finish sets, and advance after match completion.
- **Program actions**: manage one locked lead plus rotation/development athletes, schedule roster preparation, inspect
  recruitment evidence and consequences, meet weekly payroll, and use bounded staff, scouting, youth, facilities,
  promises, media, and rival-circuit signals.

These inputs should remain coaching and program-management decisions.

## Simulated Outputs

The simulation controls outcomes the player cannot directly execute:

- rally winners and terminal errors
- detailed match scorelines for managed live matches
- quick scorelines for non-managed background matches
- tournament progression and champion truth
- rankings, season points, and ranking history rows
- event history, match history, player achievements, and profile records
- save-state snapshots and portable JSON exports

Presentation should describe these outputs; it must not invent alternative truth.

## Match Flow

### Pre-Match

A managed match begins from an event or quick-tournament bracket state. The app builds a managed match input from:

- selected or locked managed athlete
- opponent from the current bracket context
- tactic selected by the player or generated for autoplay opponents
- deterministic seed state from the tournament

Career matches may also expose a pre-match brief, medical gate, schedule date, and tactical planning bridge. Before creating the live session, persisted career development is projected onto the managed athlete's direct match ratings (`smash`, `stamina`, and `composure`). The canonical content player is never mutated, and quick tournaments remain on catalog ratings.

### Live Match

Managed matches use the detailed engine path:

```text
seed + players + tactics
  -> live match session
  -> point-by-point rally resolution
  -> feed, stamina, momentum, stats, set state
```

The player can apply bounded live directives and queue interval team talks. The engine still decides rallies from ratings, tactics, stamina, pressure, score state, and seeded randomness.

### Between-Set Adjustments

Between sets, the player may apply a team talk. The engine applies talks at the next set opening, not as a rally-by-rally override. This keeps coaching agency meaningful without turning the match into manual shot calling.

### Post-Match Review

A completed managed match produces:

- scoreline and set summaries
- winner and tournament advancement
- career settlement when a career event is active
- fatigue/readiness, cash, ranking, and achievement consequences where applicable
- tactical evidence such as Rally Pattern Map data
- durable match records for player-profile history when the career system records the event

Post-match UI should explain why the result happened using engine and career facts.

## Career Flow

A stable career run follows this shape:

```text
launch -> managed athlete -> career command center
       -> training / schedule / match planning
       -> event entry -> scheduled match day
       -> live match -> post-match review
       -> day advancement / next round / archive
```

Key rules:

- A career has one locked managed athlete.
- My Program can contain rotation and development athletes without changing that locked competition lead. World
  Directory and recruited-athlete profile viewing are read-only identity contexts.
- The career date starts from a fictional season timeline and advances through store actions.
- Training choices schedule one exact block for the current day; they do not change cash or athlete state until `Advance Day` resolves that block once.
- Recruited-athlete preparation uses the same plan snapshots, medical gates, staff/facility modifiers, ledger, and
  development history as lead preparation.
- Candidate/prospect state evolves once per resolved date from seed-stable signals. Weekly roster/staff payroll resolves
  through the same day pipeline and posts one dated ledger fact.
- Inbox items are actionable projections of real career facts. They navigate to the owning desk and resolve only when
  that system changes state.
- Reports is a read-only archive of persisted match, event, scouting, and development evidence. It does not reuse the
  post-match Continue action or fabricate missing tactical history.
- Advance-day forecasts call the same pure day resolver as the real action, so displayed cash, readiness, fatigue, risk, and development deltas cannot drift into a second formula.
- Entered events become playable only when schedule helpers say the managed round is due or overdue.
- Direct day advancement must not skip a due managed match.
- Non-final managed wins usually move the career into `between_rounds` until the next scheduled round date.
- Finished, skipped, missed, or withdrawn events move into event history/archives.

## World Model

The managed athlete is one participant inside a broader fictional circuit.

The current world is intentionally bounded:

- local fictional player pool
- 16-player knockout event brackets
- quick-simulated non-managed tournament matches
- simplified fictional event tiers and ranking points
- rival programs that create pressure and ranking movement without a full remote universe
- player profile records derived from persisted universe match and achievement facts

The product should be honest when evidence is incomplete. Old summary-only archives should not pretend to contain full bracket or match-record truth.

## Deterministic Principle

For a fixed simulation path, identical inputs should produce stable outcomes:

**same seed + same players + same tactics + same choices → same output**

Detailed and quick fidelity modes do not need to match each other point-for-point. They do need deterministic behavior inside the chosen fidelity and calibrated macro behavior across the sport model.

## Local-First Principle

Browser-local storage and portable JSON saves are core MVP mechanics, not temporary glue.

Current implications:

- no required backend, auth, account, or cloud save
- one active local save slot
- corrupt active-save quarantine on boot
- explicit import preview before active-save replacement
- versioned save payloads and migrations
- JSON export as the portable backup path

Any change that weakens this local-first promise needs an ADR and a save/persistence reference update.

## Boundary To Preserve

**React UI → player intent → game state → simulation engine → events, records, saves, presentation**

React components may render choices and dispatch intent. Game modules decide outcomes, mutate career/tournament state through typed actions, and produce durable records.
