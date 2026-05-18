# Match Balance Calibration

This document records how to test whether **Badminton Manager** produces believable singles match
outcomes by overall-rating gap.

The goal is not perfect determinism. Modern badminton should feel probabilistic:

- equal players should behave close to `50/50`
- small overall gaps should still allow frequent underdog wins
- medium gaps should favor the stronger player, but not erase upset paths
- large gaps should feel strongly tilted, but not mechanically impossible forever

## Current Command

Run:

```sh
npm run calibrate:match
```

By default this uses `2` seeds per player pair. For a sturdier report, run:

```sh
MATCH_BALANCE_SEEDS=10 npm run calibrate:match
```

The calibration test is skipped during normal `npm run test` unless
`MATCH_BALANCE_CALIBRATION=1` is set.

## Method

The harness lives in:

- `tests/calibration/match-balance.calibration.test.ts`

It does the following:

- uses all `47` roster athletes
- computes OVR from the same dossier formula used by setup UI
- evaluates every unordered player pairing
- places the higher-OVR athlete on side `A`
- groups matchups into OVR-gap buckets: `0`, `1-2`, `3-4`, `5-6`, `7-9`, `10+`
- runs both fidelity paths: `detailed` and `quick`
- runs both tactic modes:
  - `balanced`: both players use `Balanced Control`
  - `autoplay`: each player receives a simple style-based tactic choice
- records high-OVR win rate, weaker-player win rate, three-game rate, straight-game rates,
  average points, average rally length, longest rally, loser-points buckets, bagel rate,
  loser-`<=2` rate, average loser points, median loser points, and worst score examples

The `10`-seed report below sampled `43,240` simulated matches:

```text
47 players -> 1,081 pairings
1,081 pairings * 10 seeds = 10,810 matches per mode/fidelity sweep
10,810 * 4 sweeps = 43,240 matches
```

## Real-World Reference Frame

These are not exact targets, because public badminton datasets rarely publish clean "ranking gap to
win probability" buckets. They are calibration anchors.

- BWF laws remain the rules source for the current game model. The BWF statutes page lists the
  Laws of Badminton under Chapter 4, Rules of the Game. Source:
  https://corporate.bwfbadminton.com/statutes/
- Current standard badminton uses best-of-three games to `21`, win by `2`, with a `30` point cap.
  Badminton BC summarizes the BWF scoring system in this shape. Source:
  https://www.badmintonbc.com/page/2888/The-Laws-of-Badminton
- A 2020 Olympic singles comparison reports average rally strokes near `8.6-9.0` strokes and
  longest rallies around the high `30s` by set sample. Source:
  https://pmc.ncbi.nlm.nih.gov/articles/PMC7706662/
- A long-rally study of elite badminton found regular rallies made up about `75-80%` of rallies,
  with regular rallies averaging about `6-7` strokes, while long-rally clusters averaged about
  `19-22` strokes. Source:
  https://pmc.ncbi.nlm.nih.gov/articles/PMC7053721/
- A 2022 binary-entropy study of World Championship match records found that badminton stays highly
  uncertain when score gaps remain below about `5` points. Source:
  https://www.frontiersin.org/articles/10.3389/fpsyg.2022.799293/full
- A 2025 sequential win-probability study argues that badminton prediction should account for
  technical, situational, and timing factors, and notes that real matches include performance
  fluctuations and unpredictable elements. Source:
  https://bmcsportsscimedrehabil.biomedcentral.com/articles/10.1186/s13102-025-01078-6

One current rules caveat: in April 2026, BWF members approved a future `3x15` scoring format from
January 2027. `v0.2.3` intentionally keeps the product rule at the current `3x21` format because
that is the fixed MVP match structure documented elsewhere.

## Target Bands

These are practical game-design bands, not official BWF statistics.

| OVR gap | Desired stronger-player win rate | Design read |
| --- | ---: | --- |
| `0` | `45-55%` | equivalent players should be a coin flip |
| `1-2` | `52-62%` | slight edge, frequent underdog wins |
| `3-4` | `70-85%` | meaningful edge, still upset-capable |
| `5-6` | `80-92%` | strong favorite, weaker player still live |
| `7-9` | `90-98%` | heavy favorite, rare but possible upset |
| `10+` | `96-99.5%` | near lock, but not mathematically certain over large samples |

Match-shape targets:

| Metric | Desired direction |
| --- | --- |
| Equal-OVR three-game rate | higher than lopsided buckets |
| Average detailed rally length | roughly `8-14` shots in this abstract model |
| Long rallies | present as a tail, not the average |
| Detailed longest rally | can exceed `18`, should not commonly hit the cap |
| Quick longest rally | may report rare `70`-shot aggregate extremes, but no shot events |

## Current Results

Generated after TIX-006 with:

```sh
MATCH_BALANCE_SEEDS=10 npm run calibrate:match
```

The score-shape pass keeps the same scoring laws:

$$
\text{best of three games},\quad \text{rally scoring to }21,\quad \text{win by }2,\quad \text{cap at }30
$$

but changes the detailed engine so realistic match texture matters as much as legal endpoints.

### Detailed Score-Shape: Before And After

The most important TIX-006 movement is in detailed-mode loser points. Before this pass, normal roster
matchups could collapse into repeated `21-0`, `21-1`, and `21-2` games. After the pass, equal and
small-gap detailed games no longer routinely produce pathological low-score games.

#### Balanced Control vs Balanced Control

| Gap | Before loser <=2 | After loser <=2 | Before avg loser pts | After avg loser pts | Before 3G | After 3G | Before high win | After high win |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| `0` | 15.1% | 0.0% | 9.2 | 16.4 | 10.7% | 37.4% | 50.1% | 52.1% |
| `1-2` | 16.1% | 0.0% | 9.0 | 16.3 | 10.8% | 35.9% | 60.3% | 61.5% |
| `3-4` | 25.1% | 0.0% | 7.8 | 15.8 | 8.4% | 28.1% | 79.0% | 81.7% |
| `5-6` | 33.1% | 0.0% | 6.8 | 15.2 | 7.7% | 20.8% | 86.3% | 90.2% |
| `7-9` | 56.5% | 0.0% | 4.1 | 13.6 | 3.7% | 8.0% | 96.2% | 97.5% |
| `10+` | 85.5% | 0.1% | 1.2 | 11.3 | 0.5% | 1.6% | 99.7% | 99.8% |

#### Autoplay Tactics

| Gap | Before loser <=2 | After loser <=2 | Before avg loser pts | After avg loser pts | Before 3G | After 3G | Before high win | After high win |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| `0` | 10.9% | 0.0% | 9.9 | 16.4 | 12.5% | 37.0% | 50.1% | 50.6% |
| `1-2` | 12.6% | 0.0% | 9.5 | 16.3 | 11.9% | 34.5% | 59.7% | 60.5% |
| `3-4` | 21.3% | 0.0% | 8.2 | 15.7 | 9.7% | 26.1% | 79.8% | 80.2% |
| `5-6` | 33.8% | 0.0% | 6.6 | 15.2 | 6.4% | 21.0% | 89.3% | 87.3% |
| `7-9` | 60.2% | 0.0% | 3.5 | 13.6 | 2.4% | 8.3% | 97.4% | 95.6% |
| `10+` | 86.1% | 0.0% | 1.1 | 10.8 | 0.3% | 1.0% | 99.8% | 99.7% |

### Full Current Detailed Report

| Gap | Balanced high win | Balanced weak win | Balanced 3G | Balanced avg loser pts | Balanced loser <=2 | Autoplay high win | Autoplay weak win | Autoplay 3G | Autoplay avg loser pts | Autoplay loser <=2 |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| `0` | 52.1% | 47.9% | 37.4% | 16.4 | 0.0% | 50.6% | 49.4% | 37.0% | 16.4 | 0.0% |
| `1-2` | 61.5% | 38.5% | 35.9% | 16.3 | 0.0% | 60.5% | 39.5% | 34.5% | 16.3 | 0.0% |
| `3-4` | 81.7% | 18.3% | 28.1% | 15.8 | 0.0% | 80.2% | 19.8% | 26.1% | 15.7 | 0.0% |
| `5-6` | 90.2% | 9.8% | 20.8% | 15.2 | 0.0% | 87.3% | 12.7% | 21.0% | 15.2 | 0.0% |
| `7-9` | 97.5% | 2.5% | 8.0% | 13.6 | 0.0% | 95.6% | 4.4% | 8.3% | 13.6 | 0.0% |
| `10+` | 99.8% | 0.2% | 1.6% | 11.3 | 0.1% | 99.7% | 0.3% | 1.0% | 10.8 | 0.0% |

### Quick Vs Detailed Parity After TIX-006

Quick mode was intentionally left macro-stable. The detailed engine is now much closer to quick mode
on score shape while retaining richer rally telemetry.

| Gap | Detailed balanced 3G | Quick balanced 3G | Detailed balanced avg loser pts | Quick balanced avg loser pts |
| --- | ---: | ---: | ---: | ---: |
| `0` | 37.4% | 40.4% | 16.4 | 15.3 |
| `1-2` | 35.9% | 36.8% | 16.3 | 15.2 |
| `3-4` | 28.1% | 30.6% | 15.8 | 14.4 |
| `5-6` | 20.8% | 25.1% | 15.2 | 14.0 |
| `7-9` | 8.0% | 14.2% | 13.6 | 12.5 |
| `10+` | 1.6% | 2.7% | 11.3 | 9.3 |

## Interpretation

### What Is Good

TIX-006 substantially fixes the detailed score-collapse problem:

- equal-OVR loser-`<=2` games fell from `15.1%` to `0.0%` in balanced mode
- `1-2` OVR loser-`<=2` games fell from `16.1%` to `0.0%` in balanced mode
- `10+` OVR average loser points rose from `1.2` to `11.3` in balanced mode
- close-match detailed three-game rates now sit near quick-mode rates instead of the old `10-14%` band

The engine still produces favorites and decisive matches. The stronger-player win rate remains
bucket-sensitive, but the losing player now gets realistic point footholds instead of vanishing from
the scoreline.

### Known Tradeoffs

The detailed `10+` bucket is still highly favorite-skewed, especially in balanced mode. That is
acceptable for the current roster because a `10+` OVR gap represents a very large quality gap, but it
should remain a calibration watchpoint.

Detailed average rallies now sit around `14-15` shots. That is above the earlier reference band, but
it is an intentional compromise for TIX-006: score-shape credibility was prioritized over preserving
the old short-rally distribution. A later pass can shorten ordinary rallies without reopening the
`21-0` error-collapse failure mode.

## Changes Made In TIX-006

Code:

- added score-shape metrics to `tests/calibration/match-balance.calibration.test.ts`
- added optional score-shape target assertions behind `MATCH_SCORE_SHAPE_ASSERT=1`
- reduced detailed match-form volatility from the old wide watched-match range
- compressed detailed rating spread so ordinary roster gaps do not become point-by-point certainty
- added per-rally variance, large-deficit safety behavior, leader conservation, and local anti-error-spiral relief
- added interval and set-break stabilization as bounded composure/momentum resets, not direct comeback bonuses
- left quick-mode point probability and macro behavior unchanged

Tests:

- normal unit tests cover deterministic detailed output, scoring legality, long rallies, stronger-player success, and near-equal low-score prevention
- calibration remains skipped unless `MATCH_BALANCE_CALIBRATION=1` is set
- score-shape assertions remain opt-in via `MATCH_SCORE_SHAPE_ASSERT=1`

## Recommended Next Balancing Pass

1. Shorten ordinary detailed rallies without reintroducing terminal-error chains.
2. Watch the detailed `10+` stronger-player win rate over larger seed counts.
3. Add archetype-specific calibration once more player styles are active in career progression.
4. Keep quick-mode behavior stable unless future evidence shows background match scorelines drifting.

## Verdict

The detailed engine now produces credible badminton score shapes for normal roster matchups:

$$
\text{favorites still win}
+ \text{underdogs still score}
+ \text{close matchups breathe}
$$

The calibration harness now reports the score-shape evidence needed to keep that behavior from
regressing.
