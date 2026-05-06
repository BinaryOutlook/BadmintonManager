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
| `0` | 47.4% | 52.6% | 12.2% | 14.4 | 49.1% | 50.9% | 36.3% | 12.8 |
| `1-2` | 54.2% | 45.8% | 11.5% | 14.4 | 56.6% | 43.4% | 37.1% | 12.8 |
| `3-4` | 80.3% | 19.7% | 8.1% | 14.1 | 79.2% | 20.8% | 28.5% | 12.7 |
| `5-6` | 87.4% | 12.6% | 7.9% | 13.9 | 85.8% | 14.2% | 24.8% | 12.5 |
| `7-9` | 96.3% | 3.7% | 3.4% | 12.8 | 95.3% | 4.7% | 13.2% | 12.2 |
| `10+` | 100.0% | 0.0% | 0.3% | 11.2 | 99.3% | 0.7% | 3.0% | 11.8 |

### Autoplay Tactics

| Gap | Detailed high win | Detailed weak win | Detailed 3G | Detailed avg rally | Quick high win | Quick weak win | Quick 3G | Quick avg rally |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| `0` | 50.3% | 49.7% | 12.1% | 14.3 | 49.5% | 50.5% | 37.8% | 13.1 |
| `1-2` | 56.8% | 43.2% | 12.0% | 14.4 | 56.9% | 43.1% | 36.9% | 13.3 |
| `3-4` | 81.6% | 18.4% | 8.7% | 14.0 | 79.1% | 20.9% | 28.0% | 13.1 |
| `5-6` | 90.7% | 9.3% | 6.4% | 13.7 | 87.4% | 12.6% | 22.1% | 12.9 |
| `7-9` | 97.2% | 2.8% | 2.2% | 12.7 | 96.1% | 3.9% | 13.5% | 12.8 |
| `10+` | 99.8% | 0.2% | 0.1% | 10.6 | 99.6% | 0.4% | 2.7% | 12.0 |

## Quick Vs Detailed Parity

Winner-rate parity is now good. Quick and detailed should not produce identical scores or rally
histories, but they should agree on macro outcome odds. The current larger sweep is within about
`0-3.3` percentage points for every OVR bucket.

| Gap | Balanced quick minus detailed | Autoplay quick minus detailed |
| --- | ---: | ---: |
| `0` | `+1.7` | `-0.8` |
| `1-2` | `+2.4` | `+0.1` |
| `3-4` | `-1.1` | `-2.5` |
| `5-6` | `-1.6` | `-3.3` |
| `7-9` | `-1.0` | `-1.1` |
| `10+` | `-0.7` | `-0.2` |

Match-shape parity is not good yet. Quick mode has many more three-game matches and more total
points than detailed mode:

- equal-OVR balanced detailed three-game rate: `12.2%`
- equal-OVR balanced quick three-game rate: `36.3%`
- equal-OVR autoplay detailed three-game rate: `12.1%`
- equal-OVR autoplay quick three-game rate: `37.8%`

That means the two engines now agree on "who is likely to win", but not yet on "what kind of match
shape gets them there".

## Interpretation

### What Is Good

Equivalent players are now healthy:

- balanced detailed: `47.4%`
- balanced quick: `49.1%`
- autoplay detailed: `50.3%`
- autoplay quick: `49.5%`

Small gaps are also healthy. A `1-2` OVR advantage wins about `55-59%`, leaving the weaker player
with roughly `41-45%`. That is exactly the feel we want: a visible edge, not destiny.

Quick and detailed now broadly agree on macro-probability. In the `3-4` and `5-6` buckets, both
paths keep underdogs live while clearly favoring the stronger player.

Rally shape improved after the neutral-rally pass:

- detailed average rallies are now about `10.6-14.4`, depending on gap and tactic mode
- quick average rallies are about `11.8-13.3`
- detailed longest rallies in this sweep are `20-23`, meaning the `32` cap is no longer the normal
  endpoint

### What Is Still Too Chalky

The `10+` bucket remains close to certain:

- balanced detailed `10+`: `100.0%`
- balanced quick `10+`: `99.3%`
- autoplay detailed `10+`: `99.8%`
- autoplay quick `10+`: `99.6%`

That may be acceptable if `10+` means a true legend against a much weaker field player, but it
should not stay literally impossible forever. A larger `20+` seed sweep should occasionally show
one upset in this bucket.

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
   - Quick mode sits around `36-38%`, which may be high but gives a better "close match" feel.

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
