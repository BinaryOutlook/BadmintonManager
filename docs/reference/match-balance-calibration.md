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
  average points, average rally length, and longest rally

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

Generated with:

```sh
MATCH_BALANCE_SEEDS=10 npm run calibrate:match
```

### Balanced Tactics

| Gap | Detailed high win | Detailed weak win | Detailed 3G | Detailed avg rally | Quick high win | Quick weak win | Quick 3G | Quick avg rally |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| `0` | 50.1% | 49.9% | 10.7% | 13.8 | 52.2% | 47.8% | 40.4% | 12.8 |
| `1-2` | 60.3% | 39.7% | 10.8% | 13.7 | 60.4% | 39.6% | 36.8% | 12.7 |
| `3-4` | 79.0% | 21.0% | 8.4% | 13.2 | 77.4% | 22.6% | 30.6% | 12.6 |
| `5-6` | 86.3% | 13.7% | 7.7% | 13.3 | 85.5% | 14.5% | 25.1% | 12.4 |
| `7-9` | 96.2% | 3.8% | 3.7% | 12.2 | 95.1% | 4.9% | 14.2% | 12.1 |
| `10+` | 99.7% | 0.3% | 0.5% | 10.4 | 99.1% | 0.9% | 2.7% | 11.6 |

### Autoplay Tactics

| Gap | Detailed high win | Detailed weak win | Detailed 3G | Detailed avg rally | Quick high win | Quick weak win | Quick 3G | Quick avg rally |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| `0` | 50.1% | 49.9% | 12.5% | 13.6 | 50.2% | 49.8% | 41.4% | 12.8 |
| `1-2` | 59.7% | 40.3% | 11.9% | 13.4 | 58.7% | 41.3% | 39.0% | 12.7 |
| `3-4` | 79.8% | 20.2% | 9.7% | 12.9 | 75.9% | 24.1% | 33.3% | 12.5 |
| `5-6` | 89.3% | 10.7% | 6.4% | 13.1 | 87.6% | 12.4% | 23.3% | 12.6 |
| `7-9` | 97.4% | 2.6% | 2.4% | 11.8 | 96.3% | 3.7% | 13.4% | 12.1 |
| `10+` | 99.8% | 0.2% | 0.3% | 9.9 | 99.6% | 0.4% | 2.1% | 11.2 |

## Quick Vs Detailed Parity

Winner-rate parity is now good. Quick and detailed should not produce identical scores or rally
histories, but they should agree on macro outcome odds. The current larger sweep is within about
`0-3.9` percentage points for every OVR bucket.

| Gap | Balanced quick minus detailed | Autoplay quick minus detailed |
| --- | ---: | ---: |
| `0` | `+2.1` | `+0.1` |
| `1-2` | `+0.1` | `-1.0` |
| `3-4` | `-1.6` | `-3.9` |
| `5-6` | `-0.8` | `-1.7` |
| `7-9` | `-1.1` | `-1.1` |
| `10+` | `-0.6` | `-0.2` |

Match-shape parity is not good yet. Quick mode has many more three-game matches and more total
points than detailed mode:

- equal-OVR balanced detailed three-game rate: `10.7%`
- equal-OVR balanced quick three-game rate: `40.4%`
- equal-OVR autoplay detailed three-game rate: `12.5%`
- equal-OVR autoplay quick three-game rate: `41.4%`

That means the two engines now agree on "who is likely to win", but not yet on "what kind of match
shape gets them there".

## Interpretation

### What Is Good

Equivalent players are now healthy:

- balanced detailed: `50.1%`
- balanced quick: `52.2%`
- autoplay detailed: `50.1%`
- autoplay quick: `50.2%`

Small gaps are also healthy. A `1-2` OVR advantage wins about `59-60%`, leaving the weaker player
with roughly `40-41%`. That is exactly the feel we want: a visible edge, not destiny.

Quick and detailed now broadly agree on macro-probability. In the `3-4` and `5-6` buckets, both
paths keep underdogs live while clearly favoring the stronger player.

Rally shape improved after the neutral-rally pass:

- detailed average rallies are now about `9.9-13.8`, depending on gap and tactic mode
- quick average rallies are about `11.2-12.8`
- detailed longest rallies in this sweep are `20-22`, meaning the `32` cap is no longer the normal
  endpoint

### What Is Still Too Chalky

The `10+` bucket remains close to certain:

- balanced detailed `10+`: `99.7%`
- balanced quick `10+`: `99.1%`
- autoplay detailed `10+`: `99.8%`
- autoplay quick `10+`: `99.6%`

That may be acceptable if `10+` means a true legend against a much weaker field player, and this
run still shows a tiny upset path. A larger sweep should continue to confirm that the bucket is
heavily tilted without becoming literally impossible.

Detailed mode also produces fewer three-game matches than quick mode. That suggests active-match
fatigue, momentum, and set-to-set tactical variance are not yet strong enough.

## Changes Made In This Pass

Code:

- added `npm run calibrate:match`
- added the explicit calibration harness
- softened quick-mode OVR determinism
- added seeded detailed match-form variance
- moved detailed continuation stress earlier in the rally
- made late-rally stress more important to retrieval and focus
- kept neutral-shot pressure dampening, but tightened it so neutral rallies no longer average near
  the detailed cap

Tests:

- the calibration harness is skipped by default
- normal unit tests still cover deterministic detailed and quick modes
- the detailed long-rally regression verifies rallies can exceed the old `18`-shot guardrail while
  staying under the current `32` cap

## Recommended Next Balancing Pass

1. Add permanent target-band assertions behind an explicit calibration gate.
   - Do not fail normal `npm run test`.
   - Fail only when `MATCH_BALANCE_ASSERT=1` is set.

2. Reduce detailed-mode chalk in `5+` OVR buckets.
   - Add more set-to-set form swing.
   - Increase between-set recovery variance.
   - Let high-risk tactics produce more errors when favorite players overpress.

3. Increase detailed three-game rate for close matchups.
   - Current detailed equal-OVR three-game rate is only about `12%`.
   - Quick mode sits around `40-41%`, which may be high but gives a better "close match" feel.

4. Add rare detailed long-rally tails without increasing the average.
   - Real elite badminton has many regular rallies and a smaller long-rally cluster.
   - The current detailed path has a reasonable average, but longest rallies in this sweep top out
     around `20-23`; rare `30+` rallies should still exist.

5. Separate balance by archetype, not only OVR.
   - OVR is useful, but a front-court controller, defensive retriever, and high-risk attacker
     should not produce identical upset curves.
   - The next report should bucket by style matchup as well as OVR gap.

## Verdict

The current algorithm is now credible for:

- equivalent players
- small OVR gaps
- quick/background match probability
- quick-to-detailed winner-rate parity
- average rally shape compared with modern badminton references

The current algorithm still needs work for:

- match-shape parity between quick and detailed modes
- detailed-mode three-game rates
- rare but real long-rally tails
- avoiding near-`100%` stronger-player win rates in the `10+` bucket over larger samples

This is a good first calibrated baseline. It is no longer just vibes; we now have a repeatable
statistical harness and concrete target bands to tune against.
