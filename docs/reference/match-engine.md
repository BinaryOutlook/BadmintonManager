# Match Engine Reference

This document defines the intended simulation model for singles matches in **Badminton Manager**.

## Design Goal

The match engine should create believable badminton without full physics.

It should reward:

- strong players
- smart tactics
- stable decision-making under pressure
- good stamina management

It should still leave room for:

- variance
- momentum swings
- tactical upsets
- pressure collapses

## Chosen Model

The engine uses a **seeded risk and reward event model**.

It does not simulate:

- shuttle trajectory in 3D space
- racket swing timing
- exact foot placement

It does simulate:

- shot intent
- target difficulty
- execution quality
- leave-or-play judgment
- retrieval success
- rally pressure
- score pressure
- stamina degradation

## Match Structure

The MVP should use:

- best-of-three sets
- rally scoring to `21`
- win by `2`
- `30` point hard cap

These are product rules for the first version and should stay fixed during `v0.1`.

## Core Runtime Shape

```ts
interface MatchState {
  seed: number;
  setIndex: number;
  scoreA: number;
  scoreB: number;
  gamesA: number;
  gamesB: number;
  staminaA: number;
  staminaB: number;
  pressureA: number;
  pressureB: number;
  server: "A" | "B";
  events: MatchEvent[];
}

interface RallyState {
  rallyLength: number;
  initiative: "A" | "B";
  lastShot?: ShotEvent;
  pressureLevel: number;
}

interface ShotEvent {
  actor: "A" | "B";
  shotType: ShotType;
  targetZone: CourtZone;
  targetDifficulty: number;
  executionScore: number;
  quality: number;
  outcome:
    | "in_play"
    | "winner"
    | "out"
    | "net"
    | "forced_error"
    | "unforced_error"
    | "weak_return";
}
```

## Shot Families

The first version only needs a compact shot vocabulary.

Suggested shot types:

- `serve`
- `clear`
- `drop`
- `smash`
- `net`
- `block`
- `lift`
- `drive`

This is enough to create readable rally patterns without building a giant move list.

## Court Representation

The engine should use zones, not coordinates.

Suggested zone model:

- front left
- front center
- front right
- mid left
- mid center
- mid right
- back left
- back center
- back right

This allows tactical targeting without a geometry engine.

## Rally Resolution Loop

Each rally should follow this order:

1. determine the active player
2. choose shot intent based on tactic, role in rally, and current pressure
3. assign a target zone and target difficulty
4. calculate execution score
5. resolve whether the shot lands in, hits the net, or goes out
6. if the shot is threatening or drifting long, allow defender judgment
7. if the ball stays live, resolve defender retrieval
8. if retrieved, create the next shot state and continue
9. end the rally when a terminal outcome occurs

## Shot Choice Logic

Shot choice should be weighted, not hard-coded.

Weights should depend on:

- the player's ratings
- aggression
- current stamina
- scoreboard pressure
- the selected tactic
- the quality of the previous contact

Examples:

- a weak lift should heavily increase smash probability for the attacker
- low stamina should reduce high-commitment attack frequency
- a conservative tactic should increase clears and safer drops

## Target Difficulty

Every shot should include a difficulty value representing how hard the intended placement is.

Examples:

- center-target safety shot: low difficulty
- deep sideline or tight net cord shot: high difficulty

The target difficulty should be influenced by:

- shot type
- intended zone
- current contact quality
- tactical risk setting

## Execution Model

Each shot resolves through a score comparison.

One acceptable shape is:

- `executionScore` \(=\) relevant skill + tactical modifier + situational modifier + RNG

If `executionScore` falls below `targetDifficulty`, the shot should fail as either:

- `out`
- `net`

Outcome split guidance:

- front-court precision failures should bias toward `net`
- deep attack failures should bias toward `out`

## Judgment Model

The engine should explicitly model the defender's decision to leave a drifting shot.

This is important because badminton includes misjudged balls that were actually going long.

Suggested logic:

1. when a shot is near or beyond the line threshold, run a `judgment` check
2. use anticipation, focus, pressure, and RNG
3. if the defender reads it correctly, the rally ends with the attacker losing the point
4. if the defender misjudges and plays it anyway, apply a strong quality penalty to the reply

That penalty often creates the kind of weak return that leads to an easy winner.

## Retrieval Model

If the shot lands in and is not left alone, the defender must try to reach and return it.

Retrieval success should compare:

- incoming shot pressure
- defender footwork
- defender agility
- defender stamina
- defender anticipation

The result should be one of:

- clean reply
- neutral reply
- weak reply
- no reply

Weak replies should shift initiative heavily to the attacker on the next shot.

## Pressure Model

The engine should track pressure on two levels.

### Rally pressure

Rally pressure rises when:

- the defender is late
- the shot quality is high
- the rally contact quality is poor

### Score pressure

Score pressure rises as the set tightens, especially near:

- `17+`
- deuce states
- set point
- match point

Composure and focus should matter much more in these states than at `4-3`.

## Fatigue Model

Stamina should degrade across:

- rally length
- set duration
- match duration

The engine should convert stamina loss into penalties on:

- footwork
- explosiveness
- recovery quality
- error resistance

The effect should be gradual, not binary.

## Unforced Errors

Not every point should end from direct winner pressure.

The engine should also generate unforced errors from:

- low focus
- excessive tactical risk
- late-match fatigue
- high pressure

These should feel contextual rather than arbitrary.

## Commentary Rule

The engine should emit structured events first.

Commentary strings should be generated after simulation from those events.

That preserves:

- deterministic truth
- easier testing
- easier future UI upgrades

## Tuning Rule

Balance should be tested through seeded batch simulation, not only by feel.

The engine should be able to answer questions like:

- how often does an `85`-rated attacker beat a `70`-rated defender
- how much does low stamina matter over three sets
- how much value does an aggressive tactic add or cost

## Non-Goals For `v0.1`

The first engine pass should not attempt:

- exact shuttle physics
- biomechanical animation logic
- doubles partner coordination
- injury simulation inside a match
- live user micromanagement point by point
