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
MATCH_BALANCE_SEEDS=5 npm run calibrate:match
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

The `5`-seed report below sampled `21,620` simulated matches:

```text
47 players -> 1,081 pairings
1,081 pairings * 5 seeds = 5,405 matches per mode/fidelity sweep
5,405 * 4 sweeps = 21,620 matches
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
MATCH_BALANCE_SEEDS=5 npm run calibrate:match
```

### Balanced Tactics

| Gap | Detailed high win | Detailed weak win | Detailed 3G | Detailed avg rally | Quick high win | Quick weak win | Quick 3G | Quick avg rally |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| `0` | 50.0% | 50.0% | 12.4% | 14.4 | 47.9% | 52.1% | 36.4% | 12.8 |
| `1-2` | 55.5% | 44.5% | 14.3% | 14.4 | 55.1% | 44.9% | 36.8% | 12.8 |
| `3-4` | 84.5% | 15.5% | 7.9% | 14.1 | 78.0% | 22.0% | 29.7% | 12.7 |
| `5-6` | 91.8% | 8.2% | 7.1% | 13.9 | 84.8% | 15.2% | 25.4% | 12.6 |
| `7-9` | 98.7% | 1.3% | 1.6% | 12.8 | 95.0% | 5.0% | 12.7% | 12.2 |
| `10+` | 100.0% | 0.0% | 0.2% | 11.3 | 98.9% | 1.1% | 3.7% | 11.8 |

### Autoplay Tactics

| Gap | Detailed high win | Detailed weak win | Detailed 3G | Detailed avg rally | Quick high win | Quick weak win | Quick 3G | Quick avg rally |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| `0` | 50.3% | 49.7% | 14.7% | 14.3 | 50.0% | 50.0% | 35.9% | 13.0 |
| `1-2` | 59.1% | 40.9% | 15.5% | 14.4 | 55.1% | 44.9% | 35.6% | 13.3 |
| `3-4` | 86.6% | 13.4% | 9.2% | 14.0 | 77.3% | 22.7% | 28.5% | 13.1 |
| `5-6` | 94.9% | 5.1% | 5.3% | 13.7 | 86.6% | 13.4% | 22.9% | 12.9 |
| `7-9` | 98.9% | 1.1% | 0.9% | 12.8 | 96.7% | 3.3% | 13.7% | 12.8 |
| `10+` | 100.0% | 0.0% | 0.0% | 10.6 | 99.6% | 0.4% | 3.7% | 12.0 |

## Interpretation

### What Is Good

Equivalent players are now healthy:

- balanced detailed: `50.0%`
- balanced quick: `47.9%`
- autoplay detailed: `50.3%`
- autoplay quick: `50.0%`

Small gaps are also healthy. A `1-2` OVR advantage wins about `55-59%`, leaving the weaker player
with roughly `41-45%`. That is exactly the feel we want: a visible edge, not destiny.

Quick mode is now the better macro-probability match for middle gaps. In the `3-4` and `5-6`
buckets, quick mode gives underdogs about `13-23%`, which is a believable background-match range.

Rally shape improved after the neutral-rally pass:

- detailed average rallies are now about `10.6-14.4`, depending on gap and tactic mode
- quick average rallies are about `11.8-13.3`
- detailed longest rallies in this sweep are `20-23`, meaning the `32` cap is no longer the normal
  endpoint

### What Is Still Too Chalky

Detailed mode remains too decisive above a `3+` OVR gap:

- balanced detailed `3-4`: `84.5%`, top edge of target
- autoplay detailed `5-6`: `94.9%`, above target
- detailed `10+`: `100.0%`, still too certain over this sample

Quick mode is much better, but `10+` remains nearly certain:

- balanced quick `10+`: `98.9%`
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
   - Current detailed equal-OVR three-game rate is only about `12-15%`.
   - Quick mode sits around `36%`, which may be high but gives a better "close match" feel.

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
- average rally shape compared with modern badminton references

The current algorithm still needs work for:

- detailed-mode upset probability from `5+` OVR gaps
- detailed-mode three-game rates
- rare but real long-rally tails
- avoiding `100%` stronger-player win rates over larger samples

This is a good first calibrated baseline. It is no longer just vibes; we now have a repeatable
statistical harness and concrete target bands to tune against.
