# TIX-030: Player Profile Optimization

Status: Draft design and implementation ticket
Priority: High
Target project: `BadmintonManager`
Target screens: Player Profile, Squad profile route, setup/selectable athlete profile route, tournament/player-link profile route
Prepared on: 2026-05-21
Primary files: `app/pages/PlayerProfilePage.tsx`, `game/selectors/player.ts`, `styles.css`, `tests/unit/player-profile-page.test.tsx`, `tests/unit/player-profile.test.ts`, `e2e/app.spec.ts`
Reference input: 2026-05-21 human UI review screenshots and follow-up discussion on decision-first profile UX
Further sharpens: `docs/product/versions/v0.2.4/player-profile-and-shell-amendment.md`, `docs/arc_tix/TIX-013-player-career-history-and-head-to-head.md`, `docs/arc_tix/TIX-019-universe-wide-player-records.md`

## 1. Commander Intent

Rework the Player Profile from a strong-looking stat dossier into a decision-first management surface.

The profile should answer:

$$
\text{What does this athlete mean, what changed, and what should I do next?}
$$

before it answers:

$$
\text{Which ratings and records can I inspect?}
$$

The current profile already has a credible management-sim tone: dark shell, compact tabs, badminton-specific attributes, radar profile, tactical fit cards, current-run evidence, and career records. The next step is to sharpen the information architecture so each profile state supports the manager's actual job.

The key optimization is relationship-aware content:

$$
\text{Player Profile}
=
\text{shared athlete identity}
+
\text{contextual manager decision}
+
\text{deep evidence tabs}
$$

For a managed player, the profile should help the user select, train, rest, and tactically deploy the athlete. For an unmanaged player, the profile should help the user scout, compare, shortlist, or prepare against the athlete.

## 2. Why This Ticket Exists

Human review identified that the current profile reads well but behaves too much like an archive. The Overview page contains useful pieces, but many panels have similar visual weight and the page does not always lead with the next decision.

The present tabs are:

```text
Overview
Attributes
Performance
Career
```

That set is close, but it misses one important axis:

$$
\text{future action}
$$

Attributes explain what the player can do. Performance explains what they have recently done. Career explains what they have achieved. The profile still needs an explicit place for what comes next: development if the athlete is under management, scouting if they are not.

This ticket therefore keeps the navigation compact but adds a fifth contextual tab:

```text
Overview
Attributes
Performance
Career
Development / Scouting
```

## 3. Product Principle

Do not create two separate Overview tabs.

Create one `Overview` tab whose contents change based on player relationship:

$$
\text{Overview} =
\begin{cases}
\text{Management Dashboard}, & \text{if player is managed} \\
\text{Scouting / Opposition Dashboard}, & \text{if player is not managed}
\end{cases}
$$

The tab name remains stable, while the page becomes intelligent.

## 4. Relationship States

The implementation should distinguish at least two major relationships.

### 4.1 Managed Profile

A player is managed when they are the active selected/locked athlete for the current setup, run, tournament, or career context.

Managed-profile UX should answer:

$$
\text{Should I play them, how should I use them, and what should I do next?}
$$

### 4.2 Unmanaged Profile

A player is unmanaged when they are a selectable athlete, opponent, event entrant, available roster player, or tournament participant not currently controlled by the manager.

Unmanaged-profile UX should answer:

$$
\text{Should I scout, select, sign, avoid, or prepare against them?}
$$

If the player is the next opponent, the unmanaged profile should lean toward opposition preparation. If the player is in setup selection, it should lean toward recruitment/selection fit. If the player is merely an available roster entry, it should lean toward scouting and comparison.

## 5. Final Tab Contract

Use five subtabs:

```text
Overview
Attributes
Performance
Career
Development / Scouting
```

The mental model should be:

$$
\text{Who are they?}
\rightarrow
\text{What can they do?}
\rightarrow
\text{How are they playing?}
\rightarrow
\text{What have they done?}
\rightarrow
\text{What comes next?}
$$

## 6. Overview Tab Contract

`Overview` is the decision dashboard. It should be the most useful tab for a player who only wants the next actionable judgment.

### 6.1 Managed Overview

For managed players, compose the Overview from these sections in priority order:

| Priority | Section | Purpose |
| ---: | --- | --- |
| 1 | `Manager Verdict` | Clear recommendation: start, rest, train, review, or prepare |
| 2 | `Readiness Strip` | Fitness, form, morale, fatigue, injury risk, match sharpness |
| 3 | `Tactical Plan` | Best tactic, viable alternatives, risk tradeoff |
| 4 | `Training Recommendation` | Suggested focus and projected benefit |
| 5 | `Risk Flags` | Overuse, matchup, stamina, error-rate, or age-curve cautions |
| 6 | `Recent Evidence` | Last match evidence that justifies the verdict |

Example verdict language:

```text
Start next match
Best tactic: Balanced Control
Reason: Elite attack profile, stable morale, excellent fitness.
```

The managed Overview should have this shape:

$$
\text{Managed Overview}
=
\text{Selection}
+
\text{Tactic}
+
\text{Training}
+
\text{Risk}
$$

The `Tactical Plan` section can reuse current `Tactical Fit` data, but it should identify the recommended tactic first instead of presenting every tactic as equal. Each tactic card should include:

- score;
- fit label;
- why it works;
- risk or tradeoff;
- primary attribute drivers;
- a route/intention affordance to use this information in match planning.

Do not add one-click gameplay commands such as direct tactic changes, direct training changes, or forced rest unless explicitly approved during implementation. The safe default is a navigational CTA into the appropriate existing workflow.

### 6.2 Unmanaged Overview

For unmanaged players, compose the Overview from these sections in priority order:

| Priority | Section | Purpose |
| ---: | --- | --- |
| 1 | `Scouting Verdict` | Shortlist, compare, select, monitor, prepare against, or ignore |
| 2 | `Threat / Fit Summary` | Recruitment fit or opponent threat depending on context |
| 3 | `How They Win` | Tactical identity in plain badminton language |
| 4 | `How To Beat Them` | Counterplan when they are an opponent or likely opponent |
| 5 | `Known Strengths And Unknowns` | Confidence-aware knowledge rather than fake certainty |
| 6 | `Next Scout Action` | Scout again, compare, shortlist, select athlete, or view head-to-head |

Example scouting verdict language:

```text
Prepare counterplan
Primary threat: Aggressive Smash
Recommended counter: Defensive Wall
Scouting confidence: 72%
```

The unmanaged Overview should have this shape:

$$
\text{Unmanaged Overview}
=
\text{Recruitment Value}
+
\text{Threat Report}
+
\text{Uncertainty}
+
\text{Next Scout Action}
$$

When the profile is opened from setup and the athlete can be selected, `Select Athlete` remains available, but the page should still explain why the selection makes sense rather than treating selection as the only story.

## 7. Attributes Tab Contract

`Attributes` owns the player's badminton toolkit.

Keep the existing categories:

```text
Technical
Physical
Mental
Derived Profile
```

The current bars are readable, but they become less informative when an elite athlete has almost every value in the same band. Add context beside the raw values.

Each attribute row should move toward this information pattern:

```text
Smash 95
Elite / Squad rank #1 / +1 this season / Near peak
```

Required attribute signals where data exists or can be safely derived:

- current rating;
- benchmark label: `Weak`, `Average`, `Strong`, `Elite`, `World Class`;
- recent change when historical data exists;
- squad or field percentile when comparison data exists;
- training sensitivity or development note when the player is managed;
- uncertainty/confidence note when the player is unmanaged and scouting is incomplete.

The Attributes tab should answer:

$$
\text{What tools does this athlete possess, and which tools are changing?}
$$

## 8. Performance Tab Contract

`Performance` owns actual match evidence.

The current tab has promising pieces, especially recent form and managed telemetry, but it leaves too much empty space when the player has limited current-run evidence. Make the tab analytical rather than sparse.

Required sections:

| Section | Contents |
| --- | --- |
| `Recent Form` | Last 5 results, opponent, round, score, and context |
| `Last Match Evidence` | winners, errors, stamina drain, longest rally, peak smash, decisive pattern |
| `Shot Profile` | smash pressure, net success, defensive retrieval, rally length, if tracked |
| `Tactical Results` | outcomes by tactic used or tactic fit, where data exists |
| `Trend Summary` | winners/errors/stamina over recent matches |
| `Telemetry State` | what is known, locked, unavailable, or opponent-only |

The Performance tab should answer:

$$
\text{Are the ratings becoming results?}
$$

For players without enough evidence, avoid a large blank panel. Show a meaningful empty state that tells the user what will unlock the evidence.

## 9. Career Tab Contract

`Career` owns the athlete's story and history.

The current career record, milestones, titles, runner-up finishes, and head-to-head table are the right ingredients. The improvement is hierarchy and narrative texture.

Required sections:

- career summary strip: W-L, win percentage, titles, finals, best result;
- tournament timeline in chronological order;
- titles and runner-up finishes;
- biggest wins and worst losses where persisted match data supports it;
- rivalries and head-to-head interpretation;
- prime-years or age-curve framing;
- milestone list.

Rivalries should be labeled in a way that helps the user understand the relationship:

```text
Problem Rival
Eight-Crown Monarch: 1-3

Dominated Opponent
Oscar Nyman: 3-0
```

The Career tab should answer:

$$
\text{What has this athlete's career become over time?}
$$

Do not fabricate historical achievements. Continue deriving records from persisted universe facts.

## 10. Development / Scouting Tab Contract

The fifth tab is contextual. Use one route/tab id internally if simpler, but render the label and contents based on relationship.

### 10.1 Managed Label: `Development`

For managed players, the tab should contain:

- current development plan;
- recommended training focus;
- expected gain or improvement area;
- workload and fatigue implication;
- potential or age-curve note;
- recent training gains;
- coach notes;
- injury or overuse risk.

Example:

```text
Current Plan: Improve Front Court
Expected Gain: +1 over 3 weeks
Risk: Medium fatigue if tournament load continues
```

The Development tab should answer:

$$
\text{How should I improve this athlete next?}
$$

### 10.2 Unmanaged Label: `Scouting`

For unmanaged players, the tab should contain:

- scouting confidence;
- discovered strengths;
- uncertain or hidden areas;
- recruitment/selection recommendation;
- comparison against current managed athlete;
- opponent-preparation notes;
- next scouting focus;
- shortlist or compare affordance when supported by existing flows.

Example:

```text
Scouting Confidence: 68%
Next Scout Focus: Stamina and pressure resistance
Recommendation: Watch one more match before selection decision
```

The Scouting tab should answer:

$$
\text{What do I know, what do I not know, and what should I learn next?}
$$

## 11. Header And Identity Contract

Keep the current player hero, but make it earn its vertical space.

The header should retain:

- nationality block;
- player name;
- nationality, age, handedness, archetype chips;
- OVR block;
- relationship label.

Add compact state where available:

- current ranking;
- current run role;
- next opponent or next match;
- recent form row;
- fitness/form/morale summary.

Avoid making the hero a second Overview. The header is identity plus immediate status; the Overview is decision logic.

If `Managed athlete`, `Selectable athlete`, `Next opponent`, and `Available roster` remain relationship labels, ensure each label maps to different page behavior. A label that does not change the user's available judgment is noise.

## 12. Visual Hierarchy Contract

Keep the dark command-center style, but reduce same-weight panels.

Required visual outcomes:

- `Overview` has one dominant verdict panel, not five equal rectangles;
- secondary panels are calmer and denser;
- empty states use less vertical space than populated evidence panels;
- active tab remains obvious without every important number becoming neon green;
- green is reserved for positive state, active selection, excellent rating, or primary commitment;
- cyan can continue owning physical metrics;
- amber should mark caution, fatigue, uncertainty, or development risk;
- red/pink should mark urgent injury, poor form, or review-required match states;
- small all-caps labels remain readable on desktop and mobile.

The design target is:

$$
\text{dense} \ne \text{flat}
$$

Dense means many decisions are available. Flat means the interface refuses to prioritize them.

## 13. Responsive Contract

Desktop should make the first visible viewport useful without requiring immediate scrolling.

Suggested desktop order for `Overview`:

```text
Hero
Tabs
Verdict / Scouting Verdict
Readiness or Threat Summary
Tactical Plan
Training or Scout Action
Risk / Unknowns
Recent Evidence
```

Mobile should preserve the same priority order:

```text
Verdict
Readiness or Threat Summary
Tactical Plan
Training or Scout Action
Risk / Unknowns
Recent Evidence
```

Rules:

- no tab label should clip or overflow;
- no stat row should rely on hover-only details;
- tables should remain readable at narrow widths;
- long athlete names and tournament names must wrap cleanly;
- action buttons must not become stacked blocks with unreadable text;
- radar labels must not overlap the chart or each other.

## 14. Implementation Notes

Likely implementation work lives in:

- `app/pages/PlayerProfilePage.tsx` for tab structure, layout, and rendering;
- `game/selectors/player.ts` for relationship-aware derived profile data;
- `styles.css` for the profile grid, verdict panels, tab layout, responsive behavior, and color hierarchy;
- `tests/unit/player-profile.test.ts` for selector/view-model contracts;
- `tests/unit/player-profile-page.test.tsx` for rendering and tab behavior;
- `e2e/app.spec.ts` for player profile navigation and visual/interaction coverage.

Expected edits:

- extend `ProfileTab` with a fifth contextual tab;
- add a relationship-derived profile mode such as `managed`, `opponent`, `selectable`, `entrant`, or `available`;
- create view-model fields for `managerVerdict` and `scoutingVerdict`;
- promote best tactic instead of presenting all tactic cards with equal importance;
- add readiness/threat summary fields that reuse existing performance, context, and coach-report data;
- add training/development recommendation for managed players using safe existing ratings and readiness signals;
- add scouting/uncertainty summary for unmanaged players;
- add attribute context fields when data can be derived without inventing history;
- enrich performance empty states and recent evidence structure;
- add career rivalry interpretation based on persisted head-to-head records.

Do not move simulation logic into React. If derived values become nontrivial, keep them in selectors or dedicated helper functions outside the page component.

The boundary remains:

$$
\text{React UI}
\rightarrow
\text{intent}
\rightarrow
\text{career/tournament/player state}
\rightarrow
\text{derived display model}
$$

## 15. Absolute Rules

- Do not create separate `Managed Overview` and `Scouting Overview` tabs.
- Do not remove existing profile access from player links, bracket names, setup selection, squad, or match surfaces.
- Do not fabricate career records, old injuries, hidden scouting facts, or historical development changes.
- Do not add one-click tactic/training/rest commands without explicit approval.
- Do not make the profile a marketing-style landing page.
- Do not bury `Select Athlete` when the setup flow depends on it.
- Do not let every panel use the same visual weight.
- Do not rely on color alone to communicate status.
- Do not regress keyboard navigation for tabs or profile actions.

## 16. Acceptance Criteria

- [ ] Player Profile renders five subtabs: `Overview`, `Attributes`, `Performance`, `Career`, and contextual `Development` or `Scouting`.
- [ ] The fifth tab label is `Development` for managed players and `Scouting` for unmanaged players.
- [ ] `Overview` keeps one tab label but renders managed or unmanaged content based on relationship.
- [ ] Managed Overview starts with a clear manager verdict that recommends selection/rest/training/preparation using current state.
- [ ] Managed Overview includes readiness, tactical plan, training recommendation, risk flags, and recent evidence.
- [ ] Unmanaged Overview starts with a clear scouting/opposition verdict.
- [ ] Unmanaged Overview includes threat/fit summary, how-they-win, how-to-beat-them when relevant, known strengths, unknowns, and next scout action.
- [ ] Tactical Fit promotes a best tactic and still shows alternatives with drivers and tradeoffs.
- [ ] Attributes include contextual interpretation beyond raw bar values wherever data exists.
- [ ] Performance includes recent evidence, telemetry state, and useful empty states instead of large blank space.
- [ ] Career includes narrative interpretation for rivalries/head-to-head records without fabricating records.
- [ ] Header relationship labels correspond to visible differences in page behavior or action framing.
- [ ] Desktop and mobile layouts do not show overlapping text, clipped tab labels, clipped buttons, or broken radar labels.
- [ ] Existing profile navigation and `Select Athlete` setup behavior still work.

## 17. Verification

Run:

```bash
npm run test -- tests/unit/player-profile.test.ts
npm run test -- tests/unit/player-profile-page.test.tsx
npx playwright test e2e/app.spec.ts
npm run build
```

Add or update tests for:

- managed versus unmanaged profile mode derivation;
- contextual fifth tab label;
- managed Overview verdict rendering;
- unmanaged Overview verdict rendering;
- `Select Athlete` remaining available for selectable setup profiles;
- best-tactic promotion;
- performance empty state and populated state;
- career rivalry/head-to-head interpretation;
- keyboard tab navigation.

Capture visual QA screenshots for at least:

- managed player Overview at desktop width;
- unmanaged/selectable player Overview at desktop width;
- opponent profile Overview from tournament context;
- Attributes tab at desktop and mobile widths;
- Performance tab with and without telemetry;
- Career tab with head-to-head rows.

## 18. Definition Of Done

The Player Profile should feel less like:

$$
\text{Stat Archive}
$$

and more like:

$$
\text{Badminton Management Dossier}
$$

The user should be able to open any athlete and immediately understand the player's identity, the relevant managerial decision, the evidence behind that decision, and the next sensible path.

