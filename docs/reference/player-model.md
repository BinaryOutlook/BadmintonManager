# Player Model Reference

This document defines the canonical player shape for the first serious version of **Badminton Manager**.

## Design Goal

The player model should be detailed enough to create believable match variety without becoming an unreadable spreadsheet.

Ratings should explain:

- how a player attacks
- how a player survives pressure
- how a player fades physically
- how a player makes or avoids mistakes

## Rating Scale

All core ratings use a `1` to `100` scale.

Interpretation guidance:

- `1` to `29`: severe weakness
- `30` to `49`: below tour standard
- `50` to `69`: competitive baseline
- `70` to `84`: strong tour-level quality
- `85` to `100`: elite weapon or elite trait

## Canonical Structure

```ts
interface Player {
  id: string;
  name: string;
  nationality: string;
  age: number;
  handedness: "right" | "left";
  styleLabel: string;
  ratings: PlayerRatings;
  traits?: string[];
}

interface PlayerRatings {
  technical: {
    smash: number;
    netPlay: number;
    clearLob: number;
    dropShot: number;
    defenseRetrieval: number;
    serveReturn: number;
  };
  physical: {
    stamina: number;
    footworkSpeed: number;
    explosivenessJump: number;
    agilityBalance: number;
  };
  mental: {
    anticipation: number;
    composure: number;
    focus: number;
    aggression: number;
  };
}
```

## Rating Groups

### Technical

- `smash`: finishing power and steepness on attacking balls
- `netPlay`: tight net control and front-court finesse
- `clearLob`: ability to reset or push deep
- `dropShot`: disguise and quality of rear-court drops
- `defenseRetrieval`: ability to absorb pressure and return hard attacks
- `serveReturn`: quality of the rally opening

### Physical

- `stamina`: resistance to match-length degradation
- `footworkSpeed`: court coverage and ability to arrive early
- `explosivenessJump`: interception height and first-step burst
- `agilityBalance`: recovery after lunges, dives, and compromised contacts

### Mental

- `anticipation`: read on direction and leave-or-play judgment
- `composure`: performance under high score pressure
- `focus`: resistance to unforced errors
- `aggression`: preference for high-pressure attacking choices

## Derived Attributes

The first engine pass should calculate a small set of derived attributes from the raw ratings.

Suggested derived attributes:

- `attackPressure`
- `frontCourtControl`
- `recoveryQuality`
- `rallyTolerance`
- `pressureResistance`
- `judgment`

Example weighting guidance:

- `attackPressure` should lean on smash, explosiveness, footwork, and aggression
- `frontCourtControl` should lean on net play, serve return, and anticipation
- `recoveryQuality` should lean on defense retrieval, agility, and footwork
- `rallyTolerance` should lean on stamina, focus, and clear lob
- `pressureResistance` should lean on composure and focus
- `judgment` should lean on anticipation and focus

One acceptable example is:

- `attackPressure` \(=\) `0.45 * smash + 0.2 * explosivenessJump + 0.15 * footworkSpeed + 0.2 * aggression`

The exact weights can be tuned, but they should stay centralized in one module.

## Player Identity

Each player should also expose a readable style label such as:

- attacking finisher
- rally grinder
- front-court artist
- counterpunch defender
- high-risk shotmaker

The style label is presentation-facing. It should not replace the underlying ratings.

## Traits

Traits are optional in `v0.1`.

If used early, keep them small and additive.

Good examples:

- `bigMatchPlayer`
- `slowStarter`
- `lateFade`
- `backhandTargetable`
- `netHunter`

Traits should nudge the simulation. They should not override the rating model.

## MVP Guidance

`v0.1` should keep the player model stable and avoid expanding into:

- injury histories
- sponsorship data
- detailed biography simulation
- hidden personality systems

The first version only needs enough metadata to support believable matches, readable scouting, and simple tournament presentation.
