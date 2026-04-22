# Tactics System Reference

This document defines how the player influences matches without directly controlling rallies.

## Design Goal

Tactics should let the player feel responsible for the match shape without turning the game into manual shot calling every rally.

The tactics system should be:

- readable before match start
- visible in match outcomes
- small enough for the MVP

## Tactical Layers

The MVP should use two intervention windows:

- pre-match tactic selection
- between-set team talk

That is enough to support coaching agency without creating constant menu interruption.

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

The first version should avoid:

- giant tactic trees
- hidden tactic submenus
- live rally-by-rally commands
- opponent adaptation trees that are too opaque to read

The correct early system is small, legible, and easy to test.
