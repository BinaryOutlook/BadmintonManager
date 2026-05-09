# V0.2.4 Player Profile And Shell Amendment

Status: Draft / approved direction for `v0.2.4`
Owner: BinaryOutlook
Last updated: 2026-05-09
Related packet: `docs/product/versions/v0.2.4/v0.2.4.md`

## 1. Purpose

This amendment defines the first high-fidelity player page for **Badminton Manager** and tightens
the surrounding shell navigation.

The reference inspiration is the familiar sports-management profile pattern: a strong identity
header, profile tabs, attribute blocks, contextual actions, and a compact visual summary. The
implementation should not copy Football Manager directly. It should translate that proven
information architecture into a badminton coaching product.

The goal is:

$$
\text{Player Profile} =
\text{Identity} + \text{Badminton Attributes} + \text{Tactical Meaning} + \text{Match Evidence}
$$

This is the first documentation step toward reinventing the UI and UX around dedicated pages instead
of one crowded command-center surface.

## 2. Product Rule

Clicking any player name in the game should open the same player profile page structure for that
player.

The page must be generated for every player in the local roster, including:

- the managed athlete
- current opponent
- background bracket athletes
- future squad or scouting-list athletes
- Trophy Titans and Honorable Mentions

The player profile is a coaching dossier, not a biography scrapbook. It should help the user decide:

- should I select this athlete?
- what tactical plan suits this athlete?
- how dangerous is this opponent?
- what happened in recent matches?
- which attributes explain the simulation outcome?

## 3. Runtime Generation Decision

Use runtime generation for `v0.2.4`.

The app already stores players as typed local content in `src/game/content/players.ts` and exposes a
`playerMap`. A dedicated player page can therefore render from a `playerId` payload without producing
static files at build time.

Recommended shape:

```ts
type AppPage =
  | { id: "setup" }
  | { id: "home" }
  | { id: "squad" }
  | { id: "playerProfile"; playerId: string }
  | { id: "games" }
  | { id: "season" }
  | { id: "calendar" }
  | { id: "bracket" }
  | { id: "liveMatch" }
  | { id: "review" };
```

If URL routes are adopted later, this maps cleanly to:

```text
/players/:playerId
```

For now, internal page state is enough. It keeps `v0.2.4` focused on UI structure rather than a routing
decision.

## 4. Page Structure

The page should feel structurally similar to a top sports-management profile while becoming
badminton-specific in content.

```text
+--------------------------------------------------------------------------------+
| Player identity strip                                                          |
| Name | age | nationality | handedness | style | OVR | current event context     |
+--------------------------------------------------------------------------------+
| Actions                         | Overview | Attributes | Performance | Career |
+--------------------------------------------------------------------------------+
| Portrait / avatar / flag        | Badminton attribute table                     |
| Bio facts                       | Technical | Physical | Mental                 |
| Traits                          | Derived profile wheel / radar                 |
| Tactical fit                    | Match evidence and current form               |
+--------------------------------------------------------------------------------+
```

The first version does not need licensed images or real athlete likenesses. Use fictional-player-safe
presentation:

- initials or nationality-code avatars
- optional generated fictional portraits later
- flag or country-code treatment
- style-label visual identity

## 5. What The Page Should Contain

### 5.1 Header identity strip

The top strip should summarize who the athlete is before the user reads any tables.

Required fields:

| Field | Source | Notes |
| --- | --- | --- |
| Name | `Player.name` | Primary click target throughout the app |
| Nationality | `Player.nationality` | Current code format is enough |
| Age | `Player.age` | Already in model |
| Handedness | `Player.handedness` | Badminton equivalent of footedness |
| Style | `Player.styleLabel` | Presentation identity |
| OVR | derived from dossier/profile | Current setup uses power, speed, stamina, control average |
| Role/context | tournament state | Managed athlete, next opponent, entrant, eliminated, champion |
| Traits count | `Player.traits` | Show as chips or compact list |

Recommended header formula:

$$
\text{OVR}_{display}
= round\left(\frac{Power + Speed + Stamina + Control}{4}\right)
$$

This matches the current setup-screen direction and can later move into a centralized selector.

### 5.2 Actions

Actions should be contextual, not generic clutter.

Possible actions:

- `Select Athlete`: shown during setup if the profile belongs to a selectable athlete
- `Compare`: opens a comparison against the managed athlete or next opponent
- `Scout Report`: opens opponent scouting detail when the player is a current or possible opponent
- `Set As Focus`: future training/development hook, disabled until development exists
- `Back To Bracket` or `Back To Squad`: returns to the previous page context

Destructive actions do not belong on the player profile. Reset remains a confirmation overlay.

### 5.3 Tabs

The first profile should use tabs because the page will eventually carry more information than one
screen can hold.

| Tab | Purpose | `v0.2.4` content |
| --- | --- | --- |
| Overview | Fast coaching read | identity, OVR, key strengths, tactical fit, current event status |
| Attributes | Full badminton ratings | technical, physical, mental, derived profile |
| Performance | Evidence from matches | current-run stats when available, empty state otherwise |
| Career | Long-term history | scaffold only unless season/career persistence is added |

Development can appear later once training and progression exist. It should not be added as a fake
active tab in `v0.2.4`.

### 5.4 Badminton attributes

Replace football attributes with badminton ratings.

Technical:

- smash
- net play
- clear/lob
- drop shot
- defense/retrieval
- serve/return

Physical:

- stamina
- footwork speed
- explosiveness/jump
- agility/balance

Mental:

- anticipation
- composure
- focus
- aggression

Derived profile:

- attack pressure
- front-court control
- recovery quality
- rally tolerance
- pressure resistance
- judgment

The derived profile already exists in `src/game/core/ratings.ts` as `deriveProfile(player)`.

The attribute view should make the engine legible:

```text
raw rating -> derived profile -> tactic fit -> match outcome explanation
```

### 5.5 Visual summary

The page should include a compact visual summary similar in purpose to a radar chart, but with
badminton categories.

Suggested axes:

- Attack
- Front Court
- Recovery
- Rally
- Pressure
- Judgment

These can be computed from `DerivedProfile`.

If a chart is not ready in the first pass, use six stable stat tiles. Do not block the whole page on
chart polish.

### 5.6 Tactical fit

The profile must connect attributes to tactical decisions.

For each tactic option in `src/game/content/tactics.ts`, the page should be able to explain whether
the athlete naturally supports it.

Examples:

| Tactic | Good fit signals | Risk signals |
| --- | --- | --- |
| Aggressive Smash | high smash, explosiveness, attack pressure, aggression | low stamina, low focus |
| Balanced Control | front-court control, judgment, composure | low net play or serve/return |
| Spread Court | footwork, recovery, stamina, rally tolerance | low clear/lob or agility |
| Defensive Wall | recovery, composure, rally tolerance | low counterattack pressure |

The tactical fit explanation should be generated from real ratings and derived profile values.

### 5.7 Performance evidence

Performance should start small and honest.

In `v0.2.4`, only show evidence that exists:

- current tournament match results if the player has participated
- managed-athlete run telemetry from `tournament.managedResults`
- bracket result context for completed matches
- live-match telemetry when viewing current competitors

If no history exists, show an empty state such as "No match record in the current run." Do not invent
career records until persistence supports them.

### 5.8 Career scaffold

The Career tab prepares the UI for seasons without pretending the model already exists.

Allowed `v0.2.4` content:

- current event status
- fictional profile facts from current model
- placeholder for future season appearances
- explicit note that long-term career records arrive with season progression

Not allowed:

- fake historical clubs
- fake titles not represented in content data
- hidden career simulations
- real athlete biography or licensed content

## 6. What Features The Page Should Describe

The page should describe player meaning through five feature groups.

### 6.1 Identity

What makes the athlete recognizable?

- name
- nationality
- age
- handedness
- style label
- traits

### 6.2 Capability

What can the athlete do?

- core ratings
- derived profile
- overall display
- strength and weakness highlights

### 6.3 Tactical usage

How should the coach use the athlete?

- best tactic fits
- risky tactic choices
- suggested match-plan language
- live directive compatibility

### 6.4 Competitive context

Where is the athlete in the current run?

- selected player
- next opponent
- tournament entrant
- eliminated athlete
- champion
- background match participant

### 6.5 Evidence

What has happened on court?

- completed scorelines
- winners, errors, smash totals, stamina drain, longest rally where available
- current live telemetry if the match is active
- summary events from quick background simulation where available

## 7. What The Page Is Connected To

The player page is not an isolated screen. It should become the destination behind every player-name
click.

```text
Setup roster name
    |
    v
Player Profile <---- Bracket names
    ^                    |
    |                    v
Squad page          Opponent scout
    ^                    |
    |                    v
Review history <--- Live match competitors
```

Required connections:

| Source | Behavior |
| --- | --- |
| Setup roster cards | clicking name or detail button opens `playerProfile` for that athlete |
| Selected operative panel | opens managed athlete profile |
| Bracket names | opens profile for any entrant, completed or pending |
| Next opponent panel | opens opponent profile, with scouting context |
| Live match header | opens either competitor profile without changing match state |
| Review page | opens profiles from managed match history |
| Tactical intel | links to relevant athlete or opponent profiles |

The profile page can read store state, but it must not resolve matches, advance tournaments, or mutate
engine outcomes.

## 8. Current Technical Progress

The existing codebase already contains the strongest pieces needed for this page.

Implemented foundations:

- `Player` and `PlayerRatings` schemas in `src/game/core/models.ts`
- local player content and `playerMap` in `src/game/content/players.ts`
- derived badminton profile in `src/game/core/ratings.ts`
- setup roster ranking through `deriveAthleteDossier()` in `src/components/SetupView.tsx`
- threat reports through `deriveThreatReport()` in `src/game/core/intel.ts`
- tactic definitions in `src/game/content/tactics.ts`
- tournament and match results in `src/game/tournament/tournament.ts`
- live telemetry and recap helpers in `src/game/core/intel.ts`
- current shell navigation in `src/app/App.tsx`

What is still missing:

- typed page model with payloads
- `PlayerProfilePage`
- central player-profile selectors
- name-click wiring across setup, bracket, match, and review
- shared action model for page-level actions
- profile tabs and chart/stat visual summary
- clean settings modal and feature navigation split

## 9. Suggested Technical Shape

Create a UI selector layer so components do not recalculate profile display values independently.

```ts
interface PlayerProfileViewModel {
  player: Player;
  overall: number;
  dossier: AthleteDossier;
  derived: DerivedProfile;
  traits: string[];
  currentContext: PlayerContext;
  tacticFits: TacticFitSummary[];
  performance: PlayerPerformanceSummary;
}
```

The selector should live outside React components if it contains non-trivial logic:

```text
src/game/core/ratings.ts        raw and derived rating math
src/game/core/intel.ts          dossier, threat, tactic summaries
src/game/selectors/player.ts    page-ready profile view model
src/app/pages/PlayerProfilePage.tsx
```

If `src/game/selectors/` feels too early, the first implementation can place a small profile selector
near `intel.ts`, then extract later.

## 10. Shell And Settings Decision

The current outer shell has top navigation, left-side console options, a tactical intel button, and a
settings panel. In `v0.2.4`, these should stop behaving like loose buttons that open more loose
sub-panels.

Decision:

- top and left navigation should move the user to a page-level workspace
- true app settings should live in one consolidated settings pop-up
- game decisions should stay inside game pages, not the settings pop-up

The rule is:

$$
\text{Navigation Click} \rightarrow \text{Page}
\qquad
\text{Preference Click} \rightarrow \text{Settings Modal}
$$

## 11. Outer Ring Item Placement

| Current or proposed item | Classification | New home | Reason |
| --- | --- | --- | --- |
| Theme color choices | App setting | Settings pop-up | Preference, not gameplay |
| Live squad | Game page | Squad page and live-match context | It affects roster understanding |
| Tactical intel | Game detail surface | Overlay launched from relevant page | It explains engine state |
| Tactics | Game decision | Setup, Bracket, Live Match, optional Tactics page | Tactics change match intent |
| Athlete events | Game/season content | Games, Season, Calendar pages | Event choice is progression structure |
| Settings | App preference | Single settings pop-up | Keep preferences centralized |
| New session/reset | Destructive app action | Confirmation overlay | Prevent accidental save loss |

This keeps the settings pop-up clean. It should not become a hidden second game dashboard.

## 12. Settings Pop-Up Contents

The settings pop-up should contain only cross-app preferences and safe session controls.

Recommended sections:

- Appearance: theme color, contrast preference, density if added
- Accessibility: reduced motion, text size if added
- Save and session: reset confirmation, save status, local storage note
- About: version label, local-first reminder, build label if available

Do not place these in settings:

- tactic selection
- player selection
- scouting reports
- live directives
- calendar event choice
- athlete profile content

## 13. Navigation Behavior

When the user clicks a top or left navigation item, the app should change the active page.

Recommended page mapping:

| Navigation label | Target page |
| --- | --- |
| Home / Command | `home` |
| Squad / Athletes | `squad` |
| Player name | `playerProfile` with `playerId` |
| Tactics | `bracket`, `setup`, or dedicated `tactics` page if added |
| Events / Games | `games` |
| Season | `season` |
| Calendar | `calendar` |
| Bracket | `bracket` |
| Live | `liveMatch` when a match is active |
| Review | `review` |
| Settings | `settings` overlay |

The sidebar can still show context-sensitive shortcuts, but those shortcuts should navigate or open a
named overlay. They should not create hidden nested states that only the sidebar understands.

## 14. Implementation Tasks For This Amendment

### Task A: Add player profile page contract

Acceptance criteria:

- [ ] `AppPage` supports `{ id: "playerProfile"; playerId: string }`.
- [ ] Invalid or missing `playerId` falls back to Squad or a useful not-found state.
- [ ] The page can render every player in `playerMap`.

### Task B: Create the profile view model

Acceptance criteria:

- [ ] Overall, dossier, derived profile, traits, and current-run context are computed centrally.
- [ ] Profile display values match setup roster OVR logic unless intentionally changed.
- [ ] Unit coverage exists for at least one ordinary player and one Trophy Titan.

### Task C: Build `PlayerProfilePage`

Acceptance criteria:

- [ ] Header identity strip is present.
- [ ] Overview and Attributes tabs are functional.
- [ ] Performance and Career tabs have honest empty/scaffold states when data is unavailable.
- [ ] Attribute groups use badminton terminology, not football terminology.

### Task D: Wire player-name navigation

Acceptance criteria:

- [ ] Setup roster names open the profile page.
- [ ] Bracket competitor names open the profile page.
- [ ] Next opponent and managed athlete panels open the profile page.
- [ ] Live match competitor names open the profile page without changing match state.

### Task E: Consolidate settings

Acceptance criteria:

- [ ] Settings opens one modal through the shared overlay host.
- [ ] Theme color choices live inside that modal.
- [ ] Tactical intel, tactics, squad, and events are removed from settings and moved to their page
      or overlay homes.
- [ ] Reset/new-session uses a confirmation overlay.

### Task F: Validate the shell rule

Acceptance criteria:

- [ ] Top and left navigation items change pages or open named overlays.
- [ ] No sidebar item opens an undocumented nested sub-settings state.
- [ ] Browser QA confirms the profile page and settings modal are reachable at desktop and narrow
      widths without text overlap.

## 15. Verification Expectations

Run the standard release checks once implemented:

- `npm run typecheck`
- `npm run test`
- `npm run build`
- `npm run test:e2e`

Add focused tests for:

- player profile view-model determinism
- all players in `seededPlayers` render through the profile component
- clicking a player name from setup navigates to `playerProfile`
- clicking a bracket player name navigates to `playerProfile`
- settings opens as a modal and does not mutate gameplay state
- reset requires confirmation

## 16. Design Notes

The visual tone should stay operational and dense. This is a manager screen, not a marketing hero.

Good direction:

- clear identity header
- compact tabs
- readable stat rows
- stable chart or tile dimensions
- strong click targets on player names
- no nested card piles
- no decorative fiction that is not backed by the model

Avoid:

- real player photos or licensed likenesses
- football attribute labels
- fake career data
- settings panels that secretly contain gameplay controls
- opening profile details in tiny side panels when a full page is deserved

## 17. Change Log

- 2026-05-09: Added the player-profile and shell/settings amendment for `v0.2.4`.
