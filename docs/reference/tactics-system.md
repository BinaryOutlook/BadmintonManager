# Tactics System Reference

This document defines how the player influences matches without directly controlling rallies.

## Design Goal

Tactics should let the player feel responsible for the match shape without turning the game into manual shot calling every rally.

The tactics system should be:

- readable before match start
- visible in match outcomes
- small enough for the MVP

## Tactical Layers

The stable career system now uses three bounded layers:

- pre-match exact plan creation
- short live directives that last three points
- between-set team talk

Quick tournaments and automated opponents may still use the compact categorical tactic. Career matches snapshot the exact plan at match start so later planning edits cannot rewrite an active or saved match.

## Advanced Career Plan

`AdvancedTacticPlan` persists these manager inputs:

- tempo `0..100`
- rear-court pressure `0..100`
- net priority `0..100`
- risk tolerance `0..100`
- rally-length intent: `shorten`, `balanced`, or `extend`
- modules: `target_backhand`, `net_trap`, `rear_court_lock`, `body_smash`, and `safe_lift_release`

`tacticPlanToMatchTactic()` keeps the readable categorical tempo, pressure pattern, and risk profile, but also writes an optional versioned `advancedIntent` snapshot. The shared resolver in `game/core/tactics.ts` converts that exact snapshot into bounded shot-choice, zone, risk, pressure, rally-stress, and stamina modifiers for both detailed and quick simulation.

Legacy tactics without `advancedIntent` receive a neutral runtime overlay. This preserves old mid-match saves and the established quick/autoplay balance path.

Module claims must remain state-backed:

| Module | Engine evidence |
| --- | --- |
| Target Backhand | raises weight toward the defender's backhand-side zones and relevant constructing shots |
| Net Trap | raises net/drop construction, front-zone use, and front placement pressure |
| Rear-Court Lock | raises deep-zone use and rear-court placement pressure |
| Body Smash | raises smash selection, body-zone targeting, pressure, risk, and stamina cost |
| Safe Lift Release | raises clear/lift/block selection while reducing target difficulty and rally stress |

The Match Command Center displays the persistent locked plan separately from temporary live directives. The Rally Pattern Map reads markers from the saved live-session snapshot rather than mutable career state.

## Pre-Match Tactic Package

The first version should use a compact tactic package with three choices.

### 1. Tempo

Options:

- `fast`
- `balanced`
- `conserve`

Intent:

- `fast` increases attacking pace and stamina drain
- `balanced` keeps default behavior
- `conserve` lowers risk and protects stamina

### 2. Primary Pressure Pattern

Options:

- `backhand_pressure`
- `front_court_control`
- `rear_court_grind`
- `all_out_attack`

Intent:

- `backhand_pressure` raises targeting against an identified weakness
- `front_court_control` increases net and return emphasis
- `rear_court_grind` emphasizes deep clears, long rallies, and patience
- `all_out_attack` increases smash and finishing intent

### 3. Risk Profile

Options:

- `patient`
- `standard`
- `high_risk`

Intent:

- `patient` lowers target difficulty on average and reduces unforced errors
- `standard` stays neutral
- `high_risk` pushes sharper placement and winner hunting at the cost of mistakes

## Team Talk Options

Between sets, the player may choose one talk.

Suggested initial options:

- `encourage`
- `demand_focus`
- `increase_tempo`
- `calm_down`

Team talks are interval decisions. The UI may queue or swap the pending talk while the match is
between sets; the engine applies the selected talk when the next set opens.

Tempo-changing talks update both the categorical tempo and the exact-intent tempo anchor inside the live snapshot. Otherwise an exact plan could accidentally make `Increase Tempo` or `Calm Down` inert.

## Live Directives

Current directives are:

- `target_backhand`
- `safe_play_lift`
- `push_pace`

They last three points and may alter shot, target, risk, and stamina shape only for that window. They do not replace the persistent match plan.

Expected effects:

- `encourage` improves composure slightly
- `demand_focus` improves focus but can slightly reduce composure for fragile players
- `increase_tempo` increases attack pressure and stamina burn
- `calm_down` lowers risk and stabilizes error rate

## Tactical Resolution Rule

Tactics should not rewrite the player's identity.

They should act as bounded modifiers on:

- shot choice weights
- target difficulty appetite
- stamina expenditure
- pressure resistance

Strong tactics can help.

They should not let a weak player permanently behave like a completely different athlete.

## Counterplay Rule

Good tactics depend on context.

Examples:

- `all_out_attack` is strong against a weak retriever but dangerous for a low-focus player
- `rear_court_grind` is useful against explosive but low-stamina opponents
- `front_court_control` is stronger for players with great net play and serve return

The UI should explain these relationships in plain language.

## MVP Constraints

The current system should avoid:

- giant tactic trees
- hidden tactic submenus
- permanent rally-by-rally micromanagement beyond the bounded three-point directive window
- opponent adaptation trees that are too opaque to read

The correct early system is small, legible, and easy to test.
