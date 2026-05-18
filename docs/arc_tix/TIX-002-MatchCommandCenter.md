# Make The Tactical Viewer Feel Like Badminton

Status: Draft implementation ticket Priority: High Target project: `BadmintonManager`

## 1. Current Problem

The current **2D Tactical Viewer** is useful as raw simulation evidence, but it feels too much like a soccer-style territorial pressure map. That makes it harder to read as badminton tactics.

In soccer, a pressure map can naturally mean:

$$
\text{Team Control} = \text{territory} + \text{pressure} + \text{momentum}
$$

In badminton, that mental model is weaker. Badminton tactics are not mainly about owning territory. They are about **rally construction**:

$$
\text{Rally Pattern} =
\text{shot placement}
\rightarrow
\text{forced reply}
\rightarrow
\text{attack chance or error}
$$

So the court map should not ask the player to decode abstract pressure numbers. It should answer a coach's natural questions:

- Where are we forcing weak replies?
- Where are we getting punished?
- Are we winning the front court, mid court, or rear court?
- What shot pattern should we repeat?
- What pattern should we stop feeding?

## 2. Keep The Court, Change The Meaning

The existing \(3 \times 3\) court is still a good MVP shape:

```text
Front L   Front C   Front R
Mid L     Mid C     Mid R
Back L    Back C    Back R
```

The issue is not the grid. The issue is the language around it.

Right now each zone reads like:

```text
Back C
92
P64 / S34
```

That is technically correct, but not coach-readable. A more natural badminton read would be:

```text
Back C
Attack 64
Load 34
92 shots
```

Or, even better:

```text
Back C
Danger
Attack 64 / Load 34
92 shots
```

The map should feel like a **rally pattern map**, not an abstract analytics panel.

## 3. Rename The Feature

`2D Tactical Viewer` sounds generic and imported from another sport.

Better names:

| Current            | Better            |
| ------------------ | ----------------- |
| 2D Tactical Viewer | Rally Pattern Map |
| Tactical Viewer    | Court Control Map |
| Tactical Viewer    | Shot Pattern Map  |

Recommended MVP name:

> **Rally Pattern Map**

This tells the player that the view is about repeated rally behavior, not just court geometry.

## 4. Rename The Metrics

### Pressure

`Pressure` is too broad. In badminton, pressure usually means one of these:

- forcing a weak lift
- making the opponent late
- creating a winner chance
- forcing an error

The code can still compute the same internal value, but the UI should use a clearer label.

Recommended label:

> **Attack Value**

Possible calculation meaning:

$$
\text{Attack Value}
=
\text{winner threat}
+
\text{forced errors}
+
\text{weak replies}
+
\text{shot quality}
$$

### Strain

`Strain` sounds medical or sports-science heavy. For badminton planning, the clearer term is:

> **Movement Load**

This immediately communicates that wide and deep shots are making somebody move.

Possible calculation meaning:

$$
\text{Movement Load}
=
\text{width load}
+
\text{depth load}
+
\text{rally length load}
+
\text{late execution load}
$$

### Momentum

`Momentum` is understandable, but it should be framed as tactical control.

Better label:

> **Rally Control**

Instead of:

```text
Momentum
29
Opponent
```

Use:

```text
Rally Control
Opponent 29 / 100
```

That reads more like a live coaching diagnosis.

## 5. Reduce The Importance Of Raw Shot Count

The current big number in each zone is the shot count. This can mislead the player.

A zone with \(148\) neutral shots may matter less than a zone with \(30\) shots that repeatedly forces weak replies.

Current implied priority:

$$
\text{Important Zone} \approx \text{Most Shots}
$$

Better tactical priority:

$$
\text{Important Zone}
=
\text{Attack Value}
+
\text{Movement Load}
+
\text{Momentum Swing}
$$

Recommendation:

- make **Attack Value** or a zone status the big read
- move raw shot count into a smaller supporting line
- use labels like `Danger`, `Winning`, `Neutral`, `Problem`, or `Target`

Example:

```text
Front R
Problem
Attack 53 / Load 40
143 shots
```

## 6. Replace Evidence Summary With Tactical Read

`Evidence Summary` sounds like a debugging artifact. It proves the engine has data, but it does not feel like coaching.

Current copy:

```text
Evidence Summary
back center carried 64 pressure and 34 strain
```

Better copy:

```text
Tactical Read
Deep center shots are creating attack chances, but the opponent is winning the front-court exchanges.
```

Or:

```text
Tactical Read
Your rear-court pressure is working. Protect the front court after the next reply.
```

This should be the core translation layer between simulation data and player decision-making.

## 7. Add Shot Chains

The biggest badminton-specific improvement is to show shot chains.

Badminton tactics are sequences:

```text
Serve wide -> weak return -> net kill
Clear deep -> short lift -> smash chance
Net hold -> forced lift -> rear attack
```

The viewer should surface the top patterns:

```text
Best Pattern
Deep clear -> weak lift -> smash chance

Problem Pattern
Loose net reply -> opponent front-court winner

Adjustment
Lift safer after net pressure, then attack rear center/backhand.
```

This changes the viewer from:

$$
\text{Where did shots go?}
$$

to:

$$
\text{What rally pattern is actually working?}
$$

That is much closer to real badminton planning.

## 8. Proposed MVP Layout

```text
Rally Pattern Map                         72 rallies analysed

[3x3 court grid]

Right Panel
-----------------------------------------
Rally Control
Opponent 29 / 100

Attack Value
80 High

Movement Load
36 Moderate

Tactical Read
Opponent is winning the front court. Your deep-center shots are still creating pressure, but loose front replies are giving them the initiative.

Best Adjustment
Play safer lifts after net pressure, then target rear center/backhand.
```

Zone example:

```text
Back C
Danger
Attack 64 / Load 34
92 shots
```

## 9. Match Command Center UI/UX Constraint

The Rally Pattern Map cannot be designed in isolation. It lives inside the current **Match Command Center**, which already has a heavy top header, a scoreboard block, a large next-command block, a repeated status strip, a live feed, telemetry cards, tactical options, and the tactical viewer.

The current screen has the right pieces, but the space composition is inefficient. Too much height is spent restating the same match state:

- the scoreboard already shows score and match context
- the next-command panel repeats set, match, and directive state
- the status strip repeats score, match, directive, server, and next action
- the tactical viewer then has less room to become genuinely readable

The screen should obey this simpler composition rule:

$$
\text{Useful Match Screen}
=
\text{Score State}
+
\text{Advance Control}
+
\text{Rally Evidence}
+
\text{Tactical Choice}
$$

Any repeated status block that does not help the next decision should be removed or folded into a denser component.

## 10. Scoreboard Redesign

The scoreboard should move toward the compact broadcast-style badminton score graphic shown in the reference screenshot. The current big center-versus-center scoreboard is readable, but it consumes too much space for information that can be shown in a tighter two-row strip.

Recommended scoreboard shape:

```text
Player / Side                  S1   S2   Current
------------------------------------------------
Three-Lung Dynamo        *     21   18      11
Arjun Sen                      18   21       9
```

Where:

- `*` marks the current server
- completed set scores sit in narrow historical columns
- the current game score is the final highlighted column
- match score is derived visually from completed set columns, not repeated in another large card
- country flags or nationality codes can be added later, but should not block the MVP

This makes the scoreboard feel closer to badminton broadcast language:

$$
\text{Match State}
=
\text{Player Row}
+
\text{Set History}
+
\text{Current Game Score}
+
\text{Server Marker}
$$

The score should become a **compact match state strip**, not a large panel.

## 11. Compact Simulation Controls

The current **Next Command** panel is too large for an action the player may press dozens of times. Once the match is live, the simulation controls should behave more like compact transport controls.

Recommended control group:

```text
[ Next Point ] [ Finish Set ]
```

or, when space is very tight:

```text
[ Point ] [ Set ]
```

Behavior:

- `Next Point` simulates exactly one rally
- `Finish Set` simulates until the current set ends or the match completes
- during intermission, the primary action becomes `Open Next Set`
- after match completion, the action becomes `Advance`
- the buttons should sit beside or directly under the compact scoreboard strip

This reduces the repeated click burden without hiding the core match flow.

Suggested layout:

```text
+------------------------------------------------------------------+
| Compact broadcast scoreboard                       Point   Set   |
+------------------------------------------------------------------+
```

The key space rule:

$$
\text{Scoreboard Height}
+
\text{Action Height}
\le
\text{one compact top band}
$$

Do not keep a separate large action panel and a separate status strip if the compact top band already explains the match state.

## 12. Revised Match Command Layout

After the scoreboard and action controls are compressed, the main screen should give the saved space to tactical reading.

Recommended desktop composition:

```text
Top Band
------------------------------------------------------------
Compact scoreboard + Point / Set controls

Main Band
------------------------------------------------------------
Live Feed        Rally Pattern Map             Match Rail
recent events    court + tactical read          telemetry
                 shot-chain read                directives
```

Suggested proportional intent:

```text
Live Feed          28%
Rally Pattern Map  42%
Match Rail         30%
```

This is not a strict CSS requirement. It is the product priority:

$$
\text{Rally Pattern Map}
>
\text{Live Feed}
>
\text{Telemetry Detail}
$$

The player is in a match. The most important thing is not raw logging. It is knowing what pattern is working and what button to press next.

## 13. Remove The Repeated Status Strip

The current status strip:

```text
Score
Match
Directive
Server
Next Action
```

should not remain as a separate row if the redesigned top band exists.

Move its information like this:

| Current Status Item | New Home                                             |
| ------------------- | ---------------------------------------------------- |
| Score               | compact scoreboard current column                    |
| Match               | completed set columns                                |
| Directive           | small badge near action controls or tactical options |
| Server              | server marker on the player row                      |
| Next Action         | button label itself                                  |

This gives the Rally Pattern Map more vertical breathing room without removing information.

## 14. Rally Pattern Map In The New Layout

The map should also become more compact and more useful inside the real screen.

Instead of stacking many right-side metric cards inside the viewer, use a tighter read:

```text
Rally Pattern Map                         72 rallies

[court grid]

Rally Read
Opponent is winning the front court. Deep-center shots are still creating attack value.

Adjustment
Lift safer after net pressure, then target rear center/backhand.
```

The internal metrics can be smaller:

```text
Attack 80   Load 36   Control: Opponent 29
```

This keeps the map from becoming a second dashboard inside the dashboard.

The viewer should prioritize:

1. court pattern
2. tactical read
3. adjustment
4. secondary metrics

It should not prioritize:

1. raw shot count
2. abstract pressure numbers
3. separate metric cards that compete with the court

## 15. Updated MVP Implementation Direction

Do not rebuild the whole match engine for this. The current data model already has enough evidence:

- `targetZone`
- `shotType`
- `quality`
- `outcome`
- `winner`
- `rallyLength`
- `targetDifficulty`
- `executionScore`

The first pass can be mostly presentation, naming, and layout:

1. Replace the current large scoreboard with a compact two-row broadcast-style scoreboard.
2. Add compact `Next Point` and `Finish Set` controls beside the scoreboard.
3. Remove the separate match status strip by folding its information into the scoreboard and action controls.
4. Rename `2D Tactical Viewer` to `Rally Pattern Map`.
5. Rename `Pressure` to `Attack Value`.
6. Rename `Strain` to `Movement Load`.
7. Rename `Momentum` to `Rally Control`.
8. Replace `Evidence Summary` with `Tactical Read`.
9. Demote raw shot count from the biggest zone number.
10. Add one generated `Best Adjustment` line from the hottest zone and losing zone.
11. Rebalance the Match Command Center grid so the Rally Pattern Map gets the central visual priority.

Later, add real shot-chain detection.

For `Finish Set`, the MVP implementation can repeatedly resolve points until:

$$
\text{set complete}
\quad \text{or} \quad
\text{match complete}
$$

This should use the same deterministic match engine path as `Next Point`, only looped through a faster command.

## 16. Final Product Intent

The viewer should stop feeling like:

$$
\text{soccer territory analytics}
$$

and start feeling like:

$$
\text{badminton rally coaching}
$$

The player should look at the map and instantly understand:

- where the rally is being won
- where the rally is being lost
- what tactical pattern to repeat
- what tactical pattern to avoid
- what adjustment to make before the next rally

That would make the feature more natural, more readable, and much more useful for actual badminton tactical planning.

The whole Match Command Center should feel like:

$$
\text{broadcast scoreboard}
+
\text{coach's rally read}
+
\text{fast match controls}
$$

not:

$$
\text{large score panel}
+
\text{large action panel}
+
\text{repeated status cards}
+
\text{squeezed tactical map}
$$