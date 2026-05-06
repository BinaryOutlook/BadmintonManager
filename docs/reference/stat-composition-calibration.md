# Stat Composition Calibration

This document audits whether each rating field in **Badminton Manager** means something in the match
engine, and whether equivalent displayed OVR can hide broken stat compositions.

The short version: before this pass, it could. A rear-court stamina/control build could appear as
the same OVR as a power or speed build while playing like a much stronger athlete. This pass added a
repeatable same-OVR archetype harness and tuned both the displayed OVR formula and the detailed
match beats that were over-rewarding long-rally profiles.

## Commands

Run the same-OVR stat-composition matrix:

```sh
npm run calibrate:stats
```

For the stronger report used below:

```sh
STAT_COMPOSITION_SEEDS=100 npm run calibrate:stats
```

The test is skipped during normal `npm run test` unless `STAT_COMPOSITION_CALIBRATION=1` is set.

## What The Harness Does

The harness lives in:

- `tests/calibration/stat-composition.calibration.test.ts`

It builds seven synthetic archetypes and normalizes each one to the same displayed OVR:

- Balanced All-Court
- Power Smasher
- Net Controller
- Counter Retriever
- Rear-Court Grinder
- Speed Counter
- Precision Deceiver

Each matchup is mirrored across both sides so server/side bias does not drive the result. With
`STAT_COMPOSITION_SEEDS=100`, every non-mirror cell is based on `200` matches.

Same OVR should not mean every style matchup is exactly `50/50`. It should mean no build is secretly
worth several OVR points more than another build. A style advantage around `60-70%` is acceptable.
Repeated `80-95%` wins at equal OVR are a warning sign unless the matchup is intentionally extreme.

## Beat-By-Beat Stat Map

| Rating | What it represents | Detailed-mode beats | Quick-mode beats | Balance risk |
| --- | --- | --- | --- | --- |
| `smash` | rear-court kill threat | smash execution, attack profile, smash speed | quick attack rating, all-out tactic fit | Can be too weak if defense always survives |
| `netPlay` | tight front-court control | net-shot execution, front-court profile | quick front-control rating, front-court tactic fit | Can dominate if front control also hides pressure stats |
| `clearLob` | safe depth and reset quality | clear execution, lift blend, rally tolerance | rally tolerance, rear-court tactic fit | Can become a hidden super-stat with stamina/focus |
| `dropShot` | deception and front/back change | drop execution, wide/front pressure | attack reasons, wide-pressure tactic fit | Should punish slow defenders without replacing net play |
| `defenseRetrieval` | racket defense and hard-shot survival | block skill, lift blend, retrieval score | recovery rating, defensive tactic fit | Previously strong but not the main imbalance |
| `serveReturn` | first-contact quality and drive base | serve execution, drive skill, front-court profile | front-control rating, wide/front tactic fit | Useful glue stat; can be invisible to players |
| `stamina` | physical endurance | initial stamina, fatigue penalty, rally tolerance | quick fatigue, rally load, rear/defensive tactic fit | Was over-rewarded in long-rally builds |
| `footworkSpeed` | court coverage speed | drive skill, recovery profile, retrieval score | quick attack/recovery, wide-pressure tactic fit | Was under-rewarded in detailed mode |
| `explosivenessJump` | explosive attack | smash skill, attack profile, smash speed | quick attack rating, all-out tactic fit | Needs enough payoff to make power builds viable |
| `agilityBalance` | recovery balance and stretch defense | recovery profile, retrieval score, movement composure | recovery rating, wide-pressure countering | Now helps late-rally focus stability |
| `anticipation` | reading opponent intent | judgment, front-court profile, retrieval score | judgment/front rating, tactic fit | Strong but fair when paired with control |
| `composure` | pressure stability | execution modifier, team talks, pressure resistance | quick pressure resistance, tactic fit | Important hidden value; now counted more in OVR |
| `focus` | rally discipline | execution/focus checks, rally tolerance, pressure resistance | rally tolerance, pressure resistance, tactic fit | Can overstack with stamina/clearLob |
| `aggression` | willingness to attack | shot selection, smash difficulty shift, attack profile | quick attack rating, high-risk fit | Should add winners and errors, not only errors |

## Important Design Fix

The displayed OVR now counts hidden match value more honestly.

Before this pass, the UI dossier could underprice:

- pressure resistance
- judgment
- recovery quality
- rally tolerance

That made some specialists look like fair same-OVR opponents while their detailed engine profile was
far stronger. The OVR component formulas now include more derived profile value:

- `power` uses `attackPressure`
- `speed` uses `recoveryQuality`
- `stamina` uses `rallyTolerance` and `pressureResistance`
- `control` uses `frontCourtControl`, `pressureResistance`, and `judgment`

This does not make every athlete bland. It makes the OVR label less misleading.

## Engine Changes From This Pass

The stat matrix exposed three specific issues.

### 1. Long-Rally Builds Were Too Cheap

Rear-Court Grinder had too much free safety from:

- `patient` risk profile
- rear-court clear/lift modifier
- conserve tempo stamina discount
- stamina/focus/clearLob stacking

Changes:

- reduced `patient` difficulty relief
- reduced rear-court clear/lift shot modifier
- raised conserve tempo stamina burn from `0.88` to `0.94`
- reduced patient quick tactic-fit bonus

### 2. Wide Pressure Was Not Real Enough

Before this pass, targeting side lanes made the attacker execute a harder shot, but did not stress
the defender enough. That punished speed/wide builds for taking risk without giving them the
movement payoff.

Changes:

- added target-zone pressure for wide and depth placements
- added extra side-lane pressure for `wide_pressure`
- improved quick-mode wide-pressure tactic fit around footwork/agility

### 3. Speed Helped Retrieval But Not Stability

Speed Counter could retrieve, but still collapsed too often in detailed focus checks. Footwork and
agility now contribute a small movement-composure term during focus checks, so speed/balance helps
players survive late exchanges.

## Current Archetype Profiles

Generated with:

```sh
STAT_COMPOSITION_SEEDS=100 npm run calibrate:stats
```

| Archetype | OVR | Power | Speed | Stamina | Control | Attack | Front | Recovery | Tolerance | Pressure | Judgment |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Balanced All-Court | 82 | 82 | 82 | 82 | 82 | 82.0 | 82.0 | 82.0 | 82.0 | 82.0 | 82.0 |
| Power Smasher | 82 | 93 | 80 | 78 | 78 | 92.2 | 77.0 | 79.0 | 78.1 | 76.8 | 78.6 |
| Net Controller | 82 | 75 | 84 | 80 | 89 | 75.0 | 92.5 | 80.8 | 79.4 | 85.4 | 86.9 |
| Counter Retriever | 82 | 72 | 89 | 84 | 82 | 72.8 | 80.0 | 90.9 | 83.8 | 83.8 | 86.1 |
| Rear-Court Grinder | 82 | 71 | 81 | 92 | 82 | 71.5 | 77.0 | 82.7 | 92.7 | 87.8 | 86.0 |
| Speed Counter | 82 | 79 | 89 | 77 | 81 | 79.7 | 81.8 | 87.0 | 76.8 | 76.8 | 83.0 |
| Precision Deceiver | 82 | 75 | 83 | 81 | 88 | 74.9 | 87.5 | 80.7 | 80.4 | 87.6 | 86.2 |

## Current Same-OVR Detailed Matrix

Rows are the archetype being measured. Values are row win rate.

| Archetype | Balanced | Power | Net | Retriever | Grinder | Speed | Precision |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Balanced All-Court | 50.0% | 49.0% | 41.5% | 39.5% | 35.5% | 56.5% | 35.0% |
| Power Smasher | 53.0% | 50.0% | 47.0% | 36.0% | 48.0% | 55.0% | 41.0% |
| Net Controller | 56.5% | 54.0% | 50.0% | 40.0% | 40.5% | 61.0% | 40.5% |
| Counter Retriever | 62.0% | 65.0% | 58.0% | 50.0% | 42.5% | 68.0% | 55.5% |
| Rear-Court Grinder | 59.5% | 56.0% | 56.0% | 56.5% | 50.0% | 73.0% | 43.0% |
| Speed Counter | 40.5% | 47.5% | 39.5% | 27.0% | 29.5% | 50.0% | 33.5% |
| Precision Deceiver | 62.0% | 61.5% | 51.5% | 39.5% | 56.0% | 65.0% | 50.0% |

## Current Same-OVR Quick Matrix

Rows are the archetype being measured. Values are row win rate.

| Archetype | Balanced | Power | Net | Retriever | Grinder | Speed | Precision |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Balanced All-Court | 50.0% | 43.0% | 38.0% | 45.0% | 28.0% | 35.0% | 45.5% |
| Power Smasher | 58.0% | 50.0% | 54.0% | 53.5% | 30.5% | 44.5% | 57.0% |
| Net Controller | 64.5% | 50.0% | 50.0% | 41.5% | 27.0% | 45.5% | 57.5% |
| Counter Retriever | 63.0% | 48.0% | 57.0% | 50.0% | 46.0% | 61.0% | 69.0% |
| Rear-Court Grinder | 76.0% | 68.0% | 73.5% | 58.5% | 50.0% | 76.5% | 68.0% |
| Speed Counter | 72.5% | 50.0% | 50.5% | 39.0% | 25.0% | 50.0% | 61.0% |
| Precision Deceiver | 54.5% | 48.0% | 36.0% | 29.5% | 25.0% | 46.5% | 50.0% |

## Interpretation

This is much healthier than the first same-OVR matrix.

Before tuning, Rear-Court Grinder had several same-OVR matchups in the `80-100%` range, including a
near-total shutdown of Speed Counter. After tuning:

- Grinder is still a strong style, especially in quick mode, but no longer universally deletes the
  field in detailed mode.
- Power Smasher now has credible detailed chances into Balanced, Net, Grinder, and Speed profiles.
- Speed Counter is no longer dead in quick mode, but still underperforms in detailed mode against
  control/recovery specialists.
- Precision and Retriever profiles remain strong but have clearer counters.

## Remaining Concern

Speed Counter is still the weakest detailed archetype.

That may be partly legitimate: this synthetic Speed Counter has low stamina, focus, composure, and
aggression relative to its movement tools. In badminton terms, it is fast but not especially stable
or ruthless.

Still, the detailed engine probably needs one more counterattack beat:

```text
elite movement recovery -> not only "ball comes back"
elite movement recovery -> occasional immediate counter-pressure
```

That would make footwork/agility feel more active without turning every fast player into a defensive
wall.

## Verdict

The stat system is now more honest:

- OVR better reflects hidden profile value.
- Long-rally specialists still matter but no longer get as much free safety.
- Placement and wide pressure now affect defender stress.
- Movement stats now help late-rally stability.
- Same-OVR composition gaps still exist, but they read more like style matchup differences than
  invisible OVR fraud.

The next beat-by-beat balancing task should focus specifically on **counterattack conversion** for
high-speed players.
