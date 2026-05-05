# Match Simulation Fidelity Plan

Status: Proposed implementation reference
Owner: BinaryOutlook
Last updated: 2026-05-05

This document expands the match-engine reference into a technical plan for a stronger simulation
algorithm and a two-tier match display system.

It does not replace `docs/reference/match-engine.md`. The match-engine reference remains the compact
subsystem contract. This document explains how to evolve that contract into:

- a high-fidelity simulator for the match the player is actively managing
- a quick simulator for unseen tournament matches
- a shared result contract so both modes feel like the same sport

The guiding product rule still applies:

$$
\text{player agency} = \text{coach decisions} \ne \text{manual racket control}
$$

## 1. Problem Statement

The current match engine already uses a seeded rally model with shot intent, target zones, execution,
retrieval, score pressure, fatigue, directives, and team talks.

That is the right foundation, but two needs are now starting to diverge:

1. The active match should become richer, more legible, and closer to real badminton dynamics.
2. Background matches should resolve quickly without spending detail the player never sees.

The design goal is therefore not "one huge simulator everywhere."

The goal is:

```text
same badminton truth
        |
        +-- detailed path for watched matches
        |
        +-- quick path for unseen matches
```

Both paths must stay deterministic, testable, and explainable.

## 2. Current Baseline

The current implementation has one simulation path:

```text
simulateMatch(input)
    |
    v
createMatchSession(input)
    |
    v
simulateNextPoint(session) until match complete
```

Managed matches expose `simulateNextPoint()` to the UI. Non-managed tournament matches call
`simulateMatch()` immediately.

That means background matches currently pay for the same point and rally detail as the active match.
For a small 16-player event this is acceptable. For larger seasons, multi-event simulation, or richer
future rally logic, it becomes wasteful.

## 3. Desired Two-Tier System

The target architecture should split fidelity from presentation:

```text
                         Match Request
                              |
                              v
                     choose simulation fidelity
                              |
              +---------------+---------------+
              |                               |
              v                               v
     DetailedMatchSimulator            QuickMatchSimulator
              |                               |
              v                               v
   shot events, point feed, stats      scoreline, winner, stats
              |                               |
              +---------------+---------------+
                              |
                              v
                         MatchResult
```

The UI should not care how a result was produced unless it needs detailed point history.

Suggested public shape:

```ts
type SimulationFidelity = "detailed" | "quick";

interface MatchSimulationRequest {
  seed: number;
  playerA: Player;
  playerB: Player;
  tacticA: MatchTactic;
  tacticB: MatchTactic;
  fidelity: SimulationFidelity;
  context: {
    managed: boolean;
    roundName?: RoundName;
    displayMode: "live_command_center" | "background_bracket";
  };
}

interface MatchSimulationEnvelope {
  fidelity: SimulationFidelity;
  result: MatchResult;
  summaryEvents: MatchSummaryEvent[];
  detailedSession?: LiveMatchSession;
}
```

The invariant:

$$
\text{same seed} + \text{same input} + \text{same fidelity}
\rightarrow \text{same output}
$$

Detailed and quick modes do not need identical outputs for the same seed. They need calibrated
macro behavior.

### 3.1 Real-Life Fidelity Standard

For this project, "closer to real-life badminton" means the simulator should reproduce observable
match dynamics at coach level.

It should prioritize:

- tactical cause and effect
- realistic score pressure
- style-driven point construction
- plausible fatigue arcs
- contextual errors
- bounded upsets
- readable momentum swings

It should avoid pretending to know details it does not model:

- exact shuttle spin
- exact racket-face angle
- centimeter-perfect foot position
- broadcast-accurate shot trajectory

The fidelity target is:

$$
\text{IRL match feel}
\approx
\text{shot patterns}
+ \text{movement stress}
+ \text{mental pressure}
+ \text{fatigue}
+ \text{tactical adaptation}
$$

That gives the engine a clear test: if the UI says a player won because they pinned the opponent's
backhand, the event log should show repeated backhand-lane pressure, weaker replies, and a scoring
advantage. The commentary should be a readable explanation of engine truth, not decoration.

## 4. High-Fidelity Algorithm

The detailed simulator should remain a risk and reward event model, not a physics engine.

It should model the decisions and outcomes that a coach can understand:

- opening quality
- shot intent
- court pressure
- target risk
- initiative
- recovery quality
- judgment
- fatigue
- score pressure
- tactical stress

It should not model:

- 3D shuttle trajectory
- exact racket path
- player skeleton animation
- centimeter-level foot placement

The better algorithm should therefore use richer event state, not raw physics.

### 4.1 Rally State

The current rally state is implicit inside `resolveRally()`. The upgraded model should make it
explicit:

```ts
interface RallyState {
  rallyIndex: number;
  shotIndex: number;
  server: Side;
  initiative: Side;
  initiativeStrength: number;
  tempo: number;
  contactQualityA: number;
  contactQualityB: number;
  courtStressA: number;
  courtStressB: number;
  lastShot?: ShotEvent;
}
```

The important addition is that a player can be under stress even if they survive a shot.

That lets the simulator create more real-feeling chains:

```text
tight net shot -> late lift -> steep smash -> weak block -> net kill
```

Instead of treating every shot as nearly independent.

### 4.2 Shot Intent Model

Shot choice should be weighted by player identity, tactic, rally state, and contact quality.

Example intent categories:

| Intent | Typical shots | Coaching meaning |
| --- | --- | --- |
| Reset | clear, lift, block | escape pressure |
| Probe | drop, drive, net | test movement and judgment |
| Build | clear, drive, drop | shift court position |
| Finish | smash, tight net | seek immediate point |

Suggested formula:

$$
w_s =
B_s
+ I_s
+ T_s
+ C_s
+ R_s
+ D_s
+ \epsilon_s
$$

Where:

- \(B_s\) is base shot weight
- \(I_s\) is player identity and rating preference
- \(T_s\) is tactic modifier
- \(C_s\) is contact-quality modifier
- \(R_s\) is rally-state modifier
- \(D_s\) is live directive modifier
- \(\epsilon_s\) is small seeded randomness

The simulator should then use weighted selection, not a hard branch.

### 4.3 Target Model

The current zone model is good for MVP readability:

```text
front_left   front_center   front_right
mid_left     mid_center     mid_right
back_left    back_center    back_right
```

The next step is to track target intent separately from zone:

```ts
type TargetIntent =
  | "safe_center"
  | "body_jam"
  | "wide_channel"
  | "deep_corner"
  | "tight_net"
  | "backhand_lane";
```

Target difficulty should be:

$$
D =
D_{\text{shot}}
+ D_{\text{zone}}
+ D_{\text{intent}}
+ D_{\text{contact}}
+ D_{\text{risk}}
+ D_{\text{pressure}}
$$

Examples:

- `safe_center` reduces difficulty but reduces winner chance.
- `deep_corner` raises difficulty and creates more out errors.
- `tight_net` raises net-error risk and can force weak lifts.
- `body_jam` is lower placement risk but can create forced blocks.
- `backhand_lane` depends on opponent handedness and future backhand weakness data.

### 4.4 Execution Model

Every shot should resolve through skill, state, and seeded variance.

Recommended shape:

$$
E =
S_{\text{shot}}
+ A_{\text{profile}}
+ T_{\text{tactic}}
+ Q_{\text{contact}}
+ M_{\text{mental}}
- F_{\text{fatigue}}
- P_{\text{score}}
+ \epsilon
$$

Then:

$$
\text{quality} = E - D
$$

Where:

- \(S_{\text{shot}}\) is the relevant shot skill
- \(A_{\text{profile}}\) is derived attack/front-court/recovery profile contribution
- \(T_{\text{tactic}}\) is tactic support for the chosen shot
- \(Q_{\text{contact}}\) is current contact quality
- \(M_{\text{mental}}\) is focus/composure/aggression effect
- \(F_{\text{fatigue}}\) is stamina and movement-load penalty
- \(P_{\text{score}}\) is late-set pressure penalty
- \(\epsilon\) is bounded seeded noise

Quality bands should become explicit:

| Quality band | Suggested range | Meaning |
| --- | ---: | --- |
| Mishit | \(q < -10\) | net, out, or severe error |
| Poor | \(-10 \le q < 0\) | playable but attackable |
| Neutral | \(0 \le q < 8\) | standard rally ball |
| Strong | \(8 \le q < 18\) | pressure shot |
| Elite | \(q \ge 18\) | winner threat or forced weak reply |

### 4.5 Error Model

Errors should be contextual, not decorative.

There should be separate error families:

| Error family | Primary causes |
| --- | --- |
| Net error | front-court precision failure, tight net attempt, tired lunge |
| Long error | deep target overhit, high aggression, late contact |
| Wide error | sideline target risk, poor balance, pressure |
| Body error | rushed defense, bad contact, jammed reply |
| Mental error | focus lapse, score pressure, frustration |

Suggested probability split after a failed execution:

$$
P(e_i) =
\frac{\max(0, b_i + z_i + s_i + f_i + p_i)}
{\sum_j \max(0, b_j + z_j + s_j + f_j + p_j)}
$$

This keeps errors explainable: a tired player aiming for a deep corner should miss long more often
than they randomly hit the net.

### 4.6 Judgment Model

Line judgment is important because it creates believable badminton moments without physics.

Run judgment checks for shots near the back or side boundary:

$$
J =
J_{\text{profile}}
+ Q_{\text{read}}
+ M_{\text{focus}}
- P_{\text{score}}
- S_{\text{deception}}
+ \epsilon
$$

Outcomes:

- correct leave: attacker loses the point
- wrong leave: attacker wins with a landing shot
- correct play: rally continues
- wrong play: defender returns a shot they should have left, causing a weak reply

This model also creates tactical identity. Deceptive players should force more bad leaves and bad
plays. High-anticipation defenders should steal points by reading drifting shots.

### 4.7 Retrieval Model

Retrieval should compare incoming pressure against defensive capacity.

$$
R =
0.42D_{\text{retrieval}}
+ 0.24P_{\text{footwork}}
+ 0.18P_{\text{agility}}
+ 0.16M_{\text{anticipation}}
+ Q_{\text{position}}
- F_{\text{fatigue}}
+ \epsilon
$$

Incoming pressure:

$$
I =
q
+ S_{\text{shotPressure}}
+ T_{\text{tempo}}
+ Z_{\text{targetStretch}}
+ N_{\text{initiative}}
$$

Return quality can then be banded:

| Comparison | Result |
| --- | --- |
| \(R + 8 < I\) | no reply, winner, or forced error |
| \(R < I + 6\) | weak reply |
| \(R < I + 14\) | neutral reply under pressure |
| \(R \ge I + 14\) | clean reply or counter |

Weak replies should not automatically end the rally. They should increase the attacker's next
initiative and finishing probability.

### 4.8 Fatigue Model

Fatigue should degrade gradually through movement load, not only point count.

Suggested point burn:

$$
B =
B_0
+ L_{\text{rally}}
+ L_{\text{movement}}
+ L_{\text{explosive}}
+ L_{\text{defense}}
$$

Then apply tactic and player stamina:

$$
\Delta \text{stamina}
=
B
\cdot T_{\text{tempo}}
\cdot D_{\text{directive}}
\cdot \left(1 - \frac{S_{\text{stamina}} - 50}{160}\right)
$$

High stamina should reduce burn, not eliminate it.

Fatigue penalties should affect:

- late shot execution
- recovery after wide targets
- smash frequency
- focus checks
- defense retrieval

### 4.9 Score Pressure

Pressure should remain easy to reason about.

Suggested model:

$$
P_{\text{score}} =
P_{\text{late}}
+ P_{\text{close}}
+ P_{\text{setPoint}}
+ P_{\text{matchPoint}}
$$

With composure and focus reducing the penalty:

$$
\text{pressurePenalty}
=
P_{\text{score}}
\cdot
\left(1 - \frac{0.6C_{\text{composure}} + 0.4C_{\text{focus}}}{100}\right)
$$

This should make `19-19` feel different from `4-3` without making every close point chaotic.

### 4.10 Tactical Directives

Live directives should be short-lived tactical nudges. They should not rewrite the athlete.

Current examples are good:

- `target_backhand`
- `safe_play_lift`
- `push_pace`

Future directives should follow the same shape:

```ts
interface DirectiveEffect {
  durationPoints: number;
  shotWeightModifiers: Partial<Record<ShotType, number>>;
  targetIntentModifiers: Partial<Record<TargetIntent, number>>;
  riskModifier: number;
  staminaBurnModifier: number;
  pressureModifier?: number;
}
```

Good directive design creates trade-offs:

- safer shots lower errors but may concede initiative
- pace creates pressure but burns stamina
- backhand targeting raises tactical focus but can become predictable

### 4.11 Opponent Adaptation

Opponent adaptation should be modest at first.

A simple memory model is enough:

```ts
interface MatchPatternMemory {
  backhandTargetsFaced: number;
  frontCourtTargetsFaced: number;
  smashesFaced: number;
  longRallyCount: number;
  successfulCounters: number;
}
```

Then apply small counters:

- repeated backhand targeting slightly improves defender anticipation after enough attempts
- repeated all-out attack increases defender block/lift readiness
- long-rally pressure increases fatigue risk for both players

The principle:

$$
\text{adaptation} < \text{ratings} + \text{tactics}
$$

Adaptation should color the match. It should not erase scouting.

## 5. Quick Background Algorithm

The quick simulator should skip shot events while preserving match-level truth.

The best first version is a quick point simulator, not a pure match coin flip. Point simulation is
cheap, preserves real scoring rules, and makes deuce/set-point dynamics natural.

### 5.1 Quick Match Shape

```text
for each set
    derive point win probability from matchup state
    sample each rally as one point
    update light stamina and pressure state
    stop at 21 by 2 or 30 cap
stop when one player wins two sets
generate synthetic stats and summary events
```

This is much cheaper than detailed mode because it does not loop through shots.

### 5.2 Point Probability

Use a logistic function:

$$
P(A \text{ wins point}) = \sigma\left(\frac{X}{K}\right)
$$

Where:

$$
X =
R_A - R_B
+ T_A - T_B
+ M_A - M_B
+ F_A - F_B
+ P_A - P_B
+ S_A
+ \epsilon
$$

And:

- \(R\) is blended player strength
- \(T\) is tactic fit
- \(M\) is matchup style edge
- \(F\) is fatigue edge
- \(P\) is pressure resistance edge
- \(S_A\) is a small server/opening edge if desired
- \(K\) controls upset frequency
- \(\epsilon\) is seeded match noise

The logistic function is:

$$
\sigma(x) = \frac{1}{1 + e^{-x}}
$$

### 5.3 Quick Rating Blend

The quick simulator needs one matchup rating, but it should not use a naive OVR only.

Suggested blend:

$$
R =
0.24A_{\text{attack}}
+ 0.20D_{\text{defense}}
+ 0.16F_{\text{frontCourt}}
+ 0.14L_{\text{rallyTolerance}}
+ 0.14P_{\text{pressureResistance}}
+ 0.12J_{\text{judgment}}
$$

This can reuse `deriveProfile()`.

### 5.4 Tactic Fit

Tactic fit should compare player strengths to opponent weaknesses:

| Tactic | Fit signals |
| --- | --- |
| `all_out_attack` | own smash/explosiveness vs opponent retrieval/agility |
| `front_court_control` | own net/serve return vs opponent anticipation/net defense |
| `wide_pressure` | own footwork/drop/drive vs opponent agility/stamina |
| `defensive_absorb` | own defense/stamina/focus vs opponent aggression/focus |
| `rear_court_grind` | own stamina/clear/focus vs opponent stamina/composure |
| `backhand_pressure` | own drive/smash/drop plus opponent handedness and weakness tags |

Suggested shape:

$$
T =
\operatorname{clamp}
\left(
\frac{\text{own tactic tools} - \text{opponent answers}}{8},
-6,
6
\right)
$$

### 5.5 Quick Fatigue

Quick fatigue should update once per point:

$$
\Delta stamina =
\left(0.9 + 0.25 \cdot \text{expectedRallyLoad}\right)
\cdot T_{\text{tempo}}
\cdot \left(1 - \frac{S_{\text{stamina}} - 50}{170}\right)
$$

Expected rally load can come from styles:

- defensive vs defensive: higher
- attack vs weak defense: lower
- grind tactic: higher
- fast tempo: medium-high

### 5.6 Synthetic Stats

Quick mode should generate summary stats from distributions, not detailed shots.

For example:

$$
\text{winnersA} \sim \operatorname{round}
\left(
\text{pointsWonA}
\cdot
\operatorname{clamp}(0.18 + \frac{A_{\text{attack}} - D_B}{240}, 0.10, 0.38)
\right)
$$

Unforced errors:

$$
\text{errorsA} \sim \operatorname{round}
\left(
\text{pointsLostA}
\cdot
\operatorname{clamp}(0.22 + \frac{Risk_A - Focus_A}{260}, 0.12, 0.42)
\right)
$$

Stats should be plausible enough for bracket recaps. They do not need to support shot-by-shot
commentary.

## 6. Display System

Simulation fidelity and display fidelity are related but separate.

### 6.1 Active Match Display

The active match should use detailed mode and show:

- score and server
- current set state
- point feed
- tactical directives
- between-set talks
- stamina and momentum
- key stats
- short explanations tied to engine events

Display contract:

```text
detailed engine event -> structured summary -> commentary text -> UI feed
```

The UI should never invent causes that the engine did not emit.

### 6.2 Background Match Display

Background matches should use quick mode and show:

- winner
- scoreline
- upset tag when seed/rating gap is meaningfully overcome
- broad match style tag, such as "long rally match" or "attacking win"
- generated aggregate stats only when useful

Suggested background summary event:

```ts
interface MatchSummaryEvent {
  kind:
    | "upset"
    | "straight_games"
    | "decider"
    | "stamina_battle"
    | "attack_pressure"
    | "error_collapse";
  side?: Side;
  title: string;
  detail: string;
}
```

Background display should not show fake shot-by-shot feeds.

## 7. Shared Result Contract

Both simulators should return the existing `MatchResult` shape as much as possible.

If the result contract expands, keep additions optional:

```ts
interface MatchResult {
  winner: Side;
  setsWonA: number;
  setsWonB: number;
  setSummaries: SetSummary[];
  stats: MatchStats;
  scoreline: string;
  fidelity?: SimulationFidelity;
  summaryEvents?: MatchSummaryEvent[];
}
```

Detailed mode can populate point histories. Quick mode can either:

- populate lightweight point records with empty `shots`
- omit point histories behind an optional field in a later model revision

The safer near-term choice is to keep `SetSummary.points` populated with lightweight point summaries
so existing UI and tests do not break.

## 8. Calibration Targets

The quick and detailed engines should be compared by batch simulation, not by feel.

Track these metrics:

| Metric | Why it matters |
| --- | --- |
| Stronger-player win rate | Prevents chaos or deterministic chalk |
| Upset frequency by rating gap | Controls tournament drama |
| Straight-game vs three-game rate | Shapes match tension |
| Average total points | Prevents bloated or too-short matches |
| Deuce frequency | Captures badminton pressure texture |
| Error-to-winner ratio | Keeps styles believable |
| Rally length distribution in detailed mode | Preserves sport rhythm |
| Tactic EV by matchup | Ensures coaching choices matter |

Suggested batch harness questions:

- How often does an `88` blended-rating player beat a `76` player?
- How often can a defensive underdog beat an aggressive favorite?
- Does `high_risk` create more winners and more errors?
- Does low stamina matter more in third sets than first sets?
- Do quick and detailed modes agree within an acceptable macro band?

Acceptable parity should be statistical, not exact:

$$
\left|P_{\text{detailed}}(\text{A wins}) - P_{\text{quick}}(\text{A wins})\right| \le 0.05
$$

For important matchup bands, start with a five percentage point tolerance.

## 9. Implementation Sequence

Recommended order:

1. Rename the current full path conceptually to `simulateDetailedMatch()`.
2. Add `SimulationFidelity` and a small dispatcher such as `simulateMatchByFidelity()`.
3. Implement `simulateQuickMatch()` using quick point simulation.
4. Change non-managed tournament matches to request `quick` fidelity.
5. Keep managed matches on `detailed` fidelity.
6. Add summary events for quick matches.
7. Add batch tests comparing quick and detailed win-rate bands.
8. Only then deepen the detailed rally model.

This keeps the change small and reversible:

```text
phase 1: split paths, preserve behavior where possible
phase 2: quick background simulation
phase 3: richer detailed model
phase 4: calibration and tuning tools
```

## 10. Testing Requirements

Minimum tests:

- same seed plus same inputs produces identical detailed results
- same seed plus same inputs produces identical quick results
- managed tournament matches use detailed mode
- non-managed tournament matches use quick mode
- quick mode still obeys best-of-three, 21 by 2, 30 cap
- quick mode returns valid `MatchResult`
- detailed mode still supports directives and team talks
- stronger player wins most seed batches in both modes
- quick and detailed outcomes stay within calibration tolerance for sampled matchup bands

Useful property checks:

- no set exceeds `30`
- no set ends before `21` unless invalid test input is used
- match ends when either side reaches two sets
- every `winner` matches the set score
- `stats.totalPoints` equals summed set points

## 11. Tuning Data

Tuning constants should live in one module, not scattered across match code.

Suggested file:

```text
src/game/core/simulationTuning.ts
```

It can hold:

- quality bands
- difficulty modifiers
- pressure thresholds
- fatigue constants
- quick logistic scale
- tactic fit weights
- summary stat generation ranges

The tuning module should be boring on purpose. Designers and future agents should be able to find
the knobs without spelunking through the rally loop.

## 12. Non-Goals

This plan does not require:

- a backend
- real athlete data
- licensed likenesses
- 3D animation
- exact shuttle physics
- direct swing controls
- a massive opponent AI tree

The target is not perfect physical reproduction.

The target is:

$$
\text{believable badminton} =
\text{ratings} + \text{tactics} + \text{pressure} + \text{fatigue} + \text{bounded variance}
$$

The player should feel that the match was earned, legible, and coachable.

## 13. Open Questions

- Should quick mode generate lightweight point histories immediately, or should `MatchResult` allow
  set summaries without points?
- Should fatigue persist across tournament rounds in a later version?
- How much opponent adaptation should be visible in the UI?
- Should quick mode use one tactical choice per player or adapt tactics between sets?
- What calibration bands feel best for Trophy Titans, Honorable Mentions, and ordinary roster depth?

These questions should be answered with seeded batch runs and UI readability checks, not only with
single-match anecdotes.
