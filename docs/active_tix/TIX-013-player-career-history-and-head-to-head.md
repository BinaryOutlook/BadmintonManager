# TIX-013: Player Career History And Head-To-Head Records

Status: Draft implementation ticket
Priority: High
Target project: `BadmintonManager`
Target screens: Player Profile `Career` tab, career persistence
Prepared on: 2026-05-19
Primary files: `app/pages/PlayerProfilePage.tsx`, `game/selectors/player.ts`, `game/career/models.ts`, `game/career/events.ts`, `game/tournament/tournament.ts`, `game/store/save.ts`, `tests/unit/player-profile.test.ts`, `tests/unit/career.test.ts`, `e2e/app.spec.ts`
Reference input: `docs/scratchpad.md` item 6

## 1. Commander Intent

Upgrade the player profile `Career` tab into a real historical record surface.

Each player page should show:

- all-time W-L,
- win percentage,
- titles,
- runner-up finishes,
- top 10 most-played opponents,
- head-to-head matches and win percentage.

The page should feel like a career archive, not placeholder prose.

## 2. Data Contract

The career save needs enough match history to calculate profile records.

Minimum match record shape:

```ts
type CareerMatchRecord = {
  id: string;
  eventId: string;
  eventName: string;
  date: string;
  round: "R16" | "QF" | "SF" | "F";
  playerAId: string;
  playerBId: string;
  winnerId: string;
  scoreline: string;
};
```

Minimum result achievement shape:

```ts
type PlayerCareerAchievement = {
  playerId: string;
  eventId: string;
  eventName: string;
  date: string;
  result: "champion" | "runner_up";
};
```

Old saves must migrate with empty arrays.

## 3. Calculation Rules

For a given player:

$$
\text{Win Percentage}
=
\frac{\text{Wins}}{\text{Wins} + \text{Losses}}
\times 100
$$

Top opponents:

- group matches by opponent id,
- count matches played,
- count wins against that opponent,
- sort by matches played descending, then wins descending, then opponent name,
- show top 10.

For inactive or old saves with no records, show an honest empty state.

## 4. Required UI

In the Player Profile `Career` tab, add:

- career record strip: `W-L`, `Win %`, `Titles`, `Runner-up`,
- titles list or compact trophy table,
- runner-up list,
- top 10 head-to-head table:
  - opponent,
  - played,
  - W-L,
  - win percentage.

Opponent names must use the universal player addressing system.

## 5. Absolute Rules

- Do not fabricate history that the save has not recorded.
- Do not count pending matches.
- Do not count walkovers unless the domain model explicitly records them as match results.
- Do not break old saves.
- Do not replace existing profile overview, attributes, or performance tabs.
- Keep the career tab readable for players with zero matches.

## 6. Acceptance Criteria

- [ ] Player Career tab shows all-time W-L.
- [ ] Player Career tab shows W-L percentage.
- [ ] Player Career tab shows accumulated champion and runner-up results.
- [ ] Player Career tab shows top 10 most-played opponents with played count and win percentage.
- [ ] Opponent names in the head-to-head table open player profiles.
- [ ] Managed match completion writes match history.
- [ ] Completed event closeout writes champion/runner-up achievements when known.
- [ ] Old saves migrate safely with empty history arrays.

## 7. Verification

Run:

```bash
npm run test -- tests/unit/player-profile.test.ts
npm run test -- tests/unit/career.test.ts
npx playwright test e2e/app.spec.ts
npm run build
```

## 8. Definition Of Done

The player profile can answer:

$$
\text{What has this player actually done in this save?}
$$

with record, trophies, finals, and opponent history.

