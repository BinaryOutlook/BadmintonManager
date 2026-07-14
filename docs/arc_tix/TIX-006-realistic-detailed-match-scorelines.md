# TIX-006: Rebalance Detailed Match Engine For Realistic Badminton Scorelines

Status: Draft implementation ticket
Priority: Critical
Target project: `BadmintonManager`
Target subsystem: Detailed managed-match simulation
Prepared on: 2026-05-18
Primary files: `game/core/match.ts`, `game/core/ratings.ts`, `tests/unit/match.test.ts`, `tests/calibration/match-balance.calibration.test.ts`, `docs/reference/match-balance-calibration.md`
Secondary files: `game/tournament/tournament.ts`, `game/store/store.ts`, `game/career/hubs.ts`, `game/career/ecosystem.ts`
Reference input: consultant trace from 2026-05-18 match-engine review; existing calibration docs in `docs/reference/match-balance-calibration.md`

## 1. Problem Statement

Managed live matches can produce legal but implausible badminton scorelines such as:

```text
21-0
21-1
21-2
21-0, 21-4
```

The engine is obeying the laws of the current product scoring model:

**Best of three games; rally scoring to 21; win by 2; cap at 30**

The problem is not illegal scoring. The problem is match-shape realism.

**Believable Badminton ≠ legal endpoint only**

A simulated match can follow scoring rules and still feel wrong if the point distribution allows normal roster matchups to collapse into repeated \(21\text{-}0\) or \(21\text{-}2\) games. This is especially damaging in the managed match flow because the player watches and reacts to the detailed engine point by point.

## 2. User-Facing Diagnosis

The current detailed engine makes the player feel as if:

- a modestly stronger player can become unbeatable for an entire game,
- equivalent or near-equivalent players can donate a game through repeated errors,
- live match control is less credible than background bracket simulation,
- tactical choices are being overwhelmed by invisible engine volatility,
- scorelines look more like a broken probability model than real elite badminton.

The player should still see dominant wins. A strong favorite should be able to win:

```text
21-8, 21-11
21-10, 21-13
21-6, 21-14
```

But routine or semi-routine outcomes should not look like:

```text
21-0, 21-2
21-1, 21-3
```

The target is:

**Favorites still win + underdogs still score points + close matchups breathe**

## 3. Investigation Summary

The review traced three different layers:

1. match engine scoring rules,
2. quick versus detailed simulation behavior,
3. career morale and psychology flow.

The result is clear:

```text
The unrealistic scorelines are primarily a detailed-engine score-shape problem.
They are not primarily a morale-system problem.
They are not currently caused by momentum feedback.
```

### 3.1 Existing Calibration Evidence

The current calibration documentation already shows that detailed mode is too low on close-match shape:

| Bucket | Detailed three-game rate | Quick three-game rate |
| --- | ---: | ---: |
| Equal OVR, balanced | `10.7%` | `40.4%` |
| Equal OVR, autoplay | `12.5%` | `41.4%` |

That means quick and detailed may agree on winner probability, but they do not agree on match shape.

**Winner parity ≠ scoreline parity**

### 3.2 Temporary Score-Shape Trace

A temporary trace test was used during the diagnosis and removed after evidence collection. It measured set loser points across OVR buckets.

The key results:

| Mode | Equal-OVR sets where loser scored \(\le 2\) | Equal-OVR bagel sets |
| --- | ---: | ---: |
| detailed balanced | `16.1%` | `36 / 1157` |
| quick balanced | `0.0%` | `0 / 1299` |

For large \(10+\) OVR gaps:

| Mode | Sets where loser scored \(\le 2\) | Average loser points |
| --- | ---: | ---: |
| detailed balanced | `86.7%` | `1.2` |
| quick balanced | `2.7%` | `9.1` |

This is the smoking gun:

**quick mode ≈ plausible scorelines**

**detailed mode ≈ too many collapses**

### 3.3 Traced Blowout Example

One traced detailed match:

```text
Seed: 800032
Player A: Adrian Koh, OVR 86
Player B: Rahul Menon, OVR 82
Tactics: Balanced Control vs Balanced Control
Scoreline: 21-0, 21-4
```

First game point reasons:

| Reason | Count |
| --- | ---: |
| unforced error | `15` |
| winner | `4` |
| forced error | `2` |

This was not a case of \(21\) clean winners. It was an error-collapse pattern.

The engine is currently too willing to turn ordinary rally stress into repeated terminal errors.

## 4. Root-Cause Hypothesis

### 4.1 Detailed Rally Stress Is Too Punishing

In `game/core/match.ts`, detailed mode uses:

```ts
const RALLY_STRESS_START_SHOT = 6;
const RALLY_STRESS_BASE = 3.4;
```

Then the focus failure branch uses:

\[
\text{focusScore}
<
34
+
1.1 \cdot \text{rallyStress}
\]

For normal \(10\)-to-\(15\)-shot rallies, this becomes a heavy repeated-error generator.

Real badminton does include late-rally mistakes, but normal long exchanges should not automatically become a collapse engine.

### 4.2 Detailed Match Form Range Is Too Large

Detailed mode currently has:

```ts
const DETAILED_MATCH_FORM_RANGE = 13;
```

Quick mode uses:

```ts
const QUICK_MATCH_FORM_RANGE = 5.5;
```

That means watched matches are much more volatile than background matches. This is backwards for player trust. The live match should feel richer and more legible, not more random and brutal.

### 4.3 Quick Mode Has Guardrails That Detailed Mode Lacks

Quick mode clamps per-point probability:

\[
0.20 \le p(\text{A wins point}) \le 0.80
\]

Detailed mode does not have an equivalent score-shape guardrail. It resolves from shot execution, retrieval, fatigue, rally stress, focus, and pressure. That is good for explainability, but without a realism governor it can generate pathological set distributions.

### 4.4 Current Momentum Is Mostly Display, Not The Cause

Momentum is updated in `applyMomentumShift()`, but the current rally resolver does not directly feed momentum back into point outcome probability.

So the issue is not:

**momentum boost → more wins → more momentum → runaway match**

That loop mostly does not exist yet.

Momentum can become part of the fix, but it must be mild, bounded, and decaying. It must not become a new runaway mechanic.

### 4.5 Career Morale Is Not The Primary Cause

Career psychology and morale currently influence pre-match readiness presentation and post-match state:

- `game/career/hubs.ts` uses `psychologyReadinessModifier()` for pre-match brief readiness.
- `game/store/store.ts` creates live match input through `createManagedMatchInput()`.
- `game/career/ecosystem.ts` applies match psychology after the match result.

The morale system is not currently being passed into detailed `MatchInput` as a direct large match-outcome modifier.

Therefore:

```text
Do not spend this ticket trying to fix morale first.
Fix detailed score-shape behavior first.
```

## 5. Product Target

The target is not to make every game close. That would be fake.

The target is to make scores fall into believable badminton bands:

| Matchup | Desired common score feel |
| --- | --- |
| Equal or near-equal players | `21-17`, `21-19`, `18-21`, three-game matches more often |
| Small favorite | `21-14`, `21-16`, occasional `21-10`, still upset-capable |
| Strong favorite | `21-9`, `21-12`, `21-15`, rare very low games |
| Huge mismatch | `21-5` to `21-10` possible, but \(21\text{-}0\) should be extremely rare |

The design target:

\[
P(\text{loser points} \le 2 \mid \text{OVR gap }0\text{-}2)
\approx 0
\]

and:

\[
P(21\text{-}0 \mid \text{normal roster matchup})
\ll 1\%
\]

For practical game tuning, it is acceptable if a true joke mismatch can occasionally create a \(21\text{-}2\), but current roster players should not routinely do it.

## 6. Scope

### In Scope

- Rebalance detailed-mode rally stress.
- Reduce detailed match-form volatility.
- Add detailed-mode score-shape calibration.
- Add guardrails against repeated unforced-error spirals.
- Add mild, decaying momentum only if it improves realism without creating runaway scoring.
- Add interval-based stabilization at \(11\) points if useful.
- Preserve deterministic output for the same seed and inputs.
- Update match-balance documentation with before/after score-shape results.
- Keep quick-mode macro behavior unless parity work requires a tiny adjustment.

### Out Of Scope

- No change to badminton scoring rules.
- No switch to the future \(3 \times 15\) format in this ticket.
- No new physics engine.
- No broad rewrite of the rally engine.
- No career morale overhaul.
- No direct player-controlled shot mechanics.
- No UI redesign beyond any copy needed to explain new calibration evidence.

## 7. Implementation Direction

### 7.1 Reduce Detailed Rally Stress

Start with the lowest-risk tuning pass:

```ts
const RALLY_STRESS_BASE = 3.4;
```

Test values in the range:

```text
1.8 to 2.4
```

Also inspect these branches:

```ts
retrievalScore + 8 < incomingPressure + rallyStress * 0.7
retrievalScore < incomingPressure + 6 + rallyStress * 0.45
focusScore < 34 + rallyStress * 1.1
```

The focus branch is the likely biggest culprit. Candidate target:

\[
\text{focus failure threshold}
=
34
+
0.45\text{ to }0.70 \cdot \text{rallyStress}
\]

Do not eliminate late-rally errors. Reduce their frequency and clustering.

### 7.2 Reduce Detailed Match Form Range

Bring detailed mode closer to quick mode:

```ts
const DETAILED_MATCH_FORM_RANGE = 13;
```

Candidate values:

```text
5.5 to 8
```

Recommended first pass:

```ts
const DETAILED_MATCH_FORM_RANGE = 7;
```

This should reduce hidden pre-match volatility while preserving form flavor.

### 7.3 Add Trailing-Player Stabilization

When a player trails by a large margin, they should become safer, not more doomed.

Suggested behavior:

**large deficit → lower risk + fewer cheap errors - less attacking threat**

Example trigger:

```text
trailing by 6+ points before 15
trailing by 8+ points after 15
```

Possible implementation:

- slightly reduce terminal unforced-error chance for the trailing player,
- slightly increase safe-shot weights (`clear`, `lift`, `block`),
- slightly reduce attack pressure and winner pressure,
- do not give a direct comeback bonus.

This mimics real match behavior:

```text
player is behind -> player tightens margins -> scoreline stabilizes
```

not:

```text
player is behind -> comeback rubber band
```

### 7.4 Add Leader Conservation

When leading heavily, a player should often stop overpressing.

Suggested behavior:

**leader up big → lower aggression + less attack pressure + fewer cheap errors**

This creates realistic late-game states:

```text
21-9
21-11
21-14
```

instead of the leader continuing to redline every point into \(21\text{-}0\).

### 7.5 Use The 11-Point Interval As A Soft Reset

Badminton has an interval at \(11\). The simulation should use this as a realism anchor.

When either player reaches \(11\) in a game:

- damp momentum,
- give both players a small composure reset,
- give the trailing player a tiny focus/composure correction,
- optionally reduce active directive pressure if it is contributing to a blowout.

Suggested formula:

\[
\text{momentumOffset}_{\text{after interval}}
=
0.65 \cdot \text{momentumOffset}_{\text{before interval}}
\]

and:

\[
\text{trailing composure} += 1\text{ to }3
\]

This should feel like coaching and towel-break stabilization, not scripted comeback logic.

### 7.6 Momentum Should Be Mild And Decaying

If momentum begins to affect rally resolution, it must be bounded.

Bad implementation:

\[
\text{win point} \Rightarrow +10\text{ effective rating}
\]

Good implementation:

\[
\Delta p_{\text{momentum}}
\in [-0.04, 0.04]
\]

or equivalent small score in the detailed resolver.

Recommended shape:

```ts
momentumOffset = (momentum - 50) / 50;
momentumEdge = clamp(momentumOffset * 2.5, -2.5, 2.5);
```

Then apply it only to narrow parts of the model, such as composure or shot choice, not as a huge direct winner button.

Momentum must decay toward neutral:

\[
M_{t+1}
=
0.85M_t
+
\text{small point swing}
\]

If this cannot be implemented carefully in the first pass, leave momentum as telemetry and solve score realism through rally stress, form range, and stabilization first.

### 7.7 Reduce Repeated Error Chains

The traced \(21\text{-}0\) example had \(15\) unforced-error points in the first game.

Add a local anti-collapse correction:

```text
if player has 3+ unforced errors in last 5 points:
  increase safe-shot preference
  reduce next unforced-error threshold slightly
  reduce high-risk shot selection
```

The correction should be temporary and local to the current game.

Do not hide all bad form. A player can still play poorly. The goal is to avoid the engine repeatedly selecting the same terminal failure mode.

### 7.8 Separate Pressure From Immediate Error

Where possible, convert some immediate terminal failures into weak replies.

Better rally narrative:

```text
deep clear -> late movement -> weak lift -> smash pressure -> block -> net kill
```

Less believable repeated pattern:

```text
rally stress -> unforced error
rally stress -> unforced error
rally stress -> unforced error
```

Implementation idea:

- reduce direct `unforced_error` frequency,
- increase `weak_return`,
- let pressure resolve over one or two more shots.

This improves realism and commentary quality.

## 8. Required Calibration Additions

The existing calibration harness focuses on win rate, three-game rate, average points, and rally length. It must also track score-shape realism.

Add score-shape stats to `tests/calibration/match-balance.calibration.test.ts` or a new dedicated calibration test.

Required metrics:

- total games,
- games where loser scored `0`,
- games where loser scored `1-2`,
- games where loser scored `3-5`,
- games where loser scored `6-10`,
- average loser points per game,
- median loser points per game if practical,
- worst score examples by OVR bucket.

Suggested report columns:

```text
gap
matches
games
bagelRate
loserLe2Rate
loserLe5Rate
loserLe10Rate
avgLoserPoints
minLoserPoints
exampleScoreline
```

Suggested target checks behind an explicit env flag:

```text
MATCH_SCORE_SHAPE_ASSERT=1
```

Do not fail normal `npm run test` on statistical calibration unless the explicit assertion flag is set.

## 9. Suggested Target Bands

These are design targets, not official BWF statistics.

### 9.1 Equal And Small-Gap Matchups

For `0` and `1-2` OVR gap buckets:

\[
P(\text{loser points} \le 2) < 1\%
\]

\[
\text{average loser points per game} \ge 12
\]

Three-game rate should increase from the current detailed value toward:

```text
25% to 38%
```

Do not copy quick mode blindly. Quick mode may be slightly too three-game heavy. But detailed mode at roughly `10-14%` is too low.

### 9.2 Medium Gaps

For `3-6` OVR gap buckets:

\[
P(\text{loser points} \le 2) < 3\%
\]

\[
\text{average loser points per game} \ge 10
\]

Dominant games can happen, but the common shape should be around:

```text
21-11
21-13
21-15
```

### 9.3 Large Gaps

For `7-9` and `10+` OVR gap buckets:

\[
P(21\text{-}0) \approx 0
\]

For `10+` gaps:

\[
\text{average loser points per game} \ge 7
\]

Extremely low scores may occur rarely:

```text
21-3
21-4
```

but they should feel like exceptional domination, not the normal expected output.

## 10. Test Requirements

### 10.1 Unit Tests

Update `tests/unit/match.test.ts`.

Required tests:

- deterministic detailed results remain deterministic for same seed and inputs,
- detailed simulations still obey `21 by 2` and `30` cap,
- detailed long-rally regression still allows rallies beyond `18`,
- stronger player still wins most of a seed batch,
- equal or near-equal players do not produce frequent pathological low-score games across a small deterministic batch,
- score-shape guard does not make every game close.

Suggested focused test:

```ts
it("keeps near-equal detailed games from routinely collapsing into bagels", () => {
  // Use two near-equal roster players.
  // Run a deterministic seed window.
  // Assert no 21-0 and very few games where loser <= 2.
});
```

Keep this test small enough for normal `npm run test`.

### 10.2 Calibration Tests

Update or add calibration coverage:

```bash
npm run calibrate:match
```

Add optional score-shape assertion:

```bash
MATCH_BALANCE_CALIBRATION=1 MATCH_SCORE_SHAPE_ASSERT=1 npx vitest run tests/calibration/match-balance.calibration.test.ts
```

If adding a new script is cleaner:

```json
"calibrate:score-shape": "MATCH_SCORE_SHAPE_CALIBRATION=1 vitest run tests/calibration/match-score-shape.calibration.test.ts --reporter=verbose --testTimeout=120000"
```

### 10.3 Career Flow Tests

No broad career test rewrite is required. Add a small assertion only if match input starts incorporating morale or readiness directly.

If this ticket touches career psychology:

- update `tests/unit/career.test.ts`,
- prove morale modifiers are bounded,
- prove pre-match readiness does not create extreme match scorelines by itself.

Prefer not to touch career psychology in the first pass.

## 11. Acceptance Criteria

- [ ] Detailed managed matches no longer routinely produce \(21\text{-}0\), \(21\text{-}1\), or \(21\text{-}2\) games for normal roster matchups.
- [ ] Equal and `1-2` OVR gap detailed buckets have loser-\(\le 2\) game rates below the target threshold.
- [ ] `10+` OVR bucket remains strongly favorite-skewed without making average loser points collapse near `1`.
- [ ] Detailed mode three-game rate for close matchups increases materially from the current `10-14%` range.
- [ ] Stronger players still win at believable rates by OVR bucket.
- [ ] Quick and detailed modes become closer in score-shape behavior, not just winner probability.
- [ ] Momentum, if used in outcome resolution, is mild, bounded, and decaying.
- [ ] Career morale is not made into a large hidden match-outcome multiplier.
- [ ] Calibration output includes score-shape metrics.
- [ ] Documentation records before/after score-shape results.
- [ ] `npm run test` passes.
- [ ] `npm run build` passes before handoff.

## 12. Verification Commands

Run from `BadmintonManager`:

```bash
npm run build
npm run test
npm run calibrate:match
```

If a dedicated score-shape command is added:

```bash
npm run calibrate:score-shape
```

Recommended final proof:

```bash
MATCH_BALANCE_SEEDS=10 npm run calibrate:match
```

The final handoff should include:

- before/after win-rate buckets,
- before/after three-game rates,
- before/after loser-\(\le 2\) rates,
- before/after average loser points,
- a few representative scorelines from equal, medium, and large OVR gaps.

## 13. Suggested Implementation Sequence

1. Add score-shape metrics to the calibration harness.
2. Capture current baseline in the ticket implementation notes or docs.
3. Reduce `DETAILED_MATCH_FORM_RANGE`.
4. Tune detailed rally stress constants and focus/retrieval thresholds.
5. Re-run unit tests and focused calibration.
6. Add trailing-player stabilization only if low-score rates are still too high.
7. Add interval reset only if blowouts still snowball after the first half of the game.
8. Consider mild decaying momentum as a final realism layer, not the first fix.
9. Update `docs/reference/match-balance-calibration.md` with the new report.
10. Run full verification.

## 14. Definition Of Done

This ticket is done when managed live matches feel like competitive badminton:

**legal scoring + credible point distribution + bounded momentum + coach-readable causes**

not:

**legal scoring + error spiral + implausible bagel games**

The player should be able to lose badly and still believe the sport being simulated.
