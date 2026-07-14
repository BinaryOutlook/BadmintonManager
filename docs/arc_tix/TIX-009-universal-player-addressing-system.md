# TIX-009: Universal Player Addressing System

Status: Draft implementation ticket
Priority: High
Target project: `BadmintonManager`
Target screens: player references across setup, squad, profiles, Calendar, tournament homes, pre-match, post-match, live match, scouting, reports
Prepared on: 2026-05-19
Primary files: `components/PlayerLink.tsx`, `app/playerNavigation.tsx`, `components/CareerWorkbench.tsx`, `components/MatchView.tsx`, `components/OverviewView.tsx`, `components/KnockoutTree.tsx`, `app/pages/PlayerProfilePage.tsx`, `tests/unit/player-link.test.tsx`, `tests/unit/knockout-tree.test.tsx`, `e2e/app.spec.ts`
Reference input: `docs/scratchpad.md` item 1

## 1. Commander Intent

Every visible player name should be a stable address into that player profile unless it is purely decorative or inside a disabled fallback state.

The rule is:

**Player Name On Screen ⇒ Open Player Profile**

The app already has `PlayerLink`, `SmartPlayerText`, and `PlayerNavigationProvider`. This ticket makes that addressing system universal instead of partial.

## 2. Problem Statement

Player profile navigation works in many places, but not everywhere. The clearest missing example is the `Opponent Briefing` pre-match screen, where opponent identity appears as plain text instead of an addressable player object.

The user should never wonder whether a player name is inspectable. Profile access must be consistent across the career shell.

## 3. Addressing Contract

Use stable player identity, not display text:

```ts
type PlayerAddress = {
  playerId: string;
};
```

Allowed implementations:

- `PlayerLink` for known direct player ids,
- `SmartPlayerText` for prose containing player names,
- explicit `profile-name-button` controls where layout needs custom composition.

Do not create new ad hoc name buttons if `PlayerLink` can carry the job.

## 4. Required Coverage

Convert player names to profile addresses in at least:

- `Opponent Briefing` header/status/detail sections,
- pre-match planning bridge opponent references,
- post-match result headings and evidence panels,
- Calendar and tournament-home field/threat references where a player id is known,
- ranking and future rankings pages,
- scouting reports and rival program surfaces where a player id is known,
- any bracket, scoreboard, recap, squad, and setup names not already covered.

If a surface has only a player name and no id, either resolve the id from `playerMap` safely or keep plain text with a comment in the ticket implementation notes. Do not guess between duplicate names.

## 5. Absolute Rules

- Do not navigate by player name.
- Do not break existing `onOpenPlayerProfile` flow.
- Do not make disabled or pending `TBD` labels clickable.
- Do not make whole paragraphs clickable when one player-name link is enough.
- Keep keyboard focus visible.
- Keep profile links usable inside bracket/tree nodes, status strips, tables, and prose.

## 6. Acceptance Criteria

- [ ] `Opponent Briefing` opponent name opens the opponent profile.
- [ ] Managed athlete names in pre-match, post-match, live match, and recap remain profile-addressable.
- [ ] Known opponent names in reports, scouting, and draw contexts are profile-addressable.
- [ ] `SmartPlayerText` is used for prose where player names appear inside sentences.
- [ ] `PlayerLink` tests cover provider behavior and missing-player fallback.
- [ ] E2E proof opens at least one opponent profile from `Opponent Briefing`.
- [ ] No `TBD`, missing-player, or pending draw placeholder attempts to open a profile.

## 7. Verification

Run:

```bash
npm run test -- tests/unit/player-link.test.tsx
npm run test -- tests/unit/knockout-tree.test.tsx
npx playwright test e2e/app.spec.ts
npm run build
```

## 8. Definition Of Done

Player identity becomes a system, not a styling accident:

**known player id + visible name = profile address**

