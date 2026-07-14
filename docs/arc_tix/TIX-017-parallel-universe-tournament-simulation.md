# TIX-017: Parallel Universe Tournament Simulation

Status: Draft mediation ticket
Priority: High
Target project: `BadmintonManager`
Target screens: tournament home, past event archive, rankings, player profile career records
Prepared on: 2026-05-19
Primary files: `components/CareerWorkbench.tsx`, `components/KnockoutTree.tsx`, `game/career/events.ts`, `game/career/matchSchedule.ts`, `game/career/models.ts`, `game/tournament/tournament.ts`, `game/store/save.ts`, `game/selectors/player.ts`, `tests/unit/career.test.ts`, `tests/unit/career-calendar-ranking.test.ts`, `tests/unit/player-profile.test.ts`, `e2e/app.spec.ts`
Reference input: `docs/scratchpad.md` line 3
Related archived tickets: `docs/arc_tix/TIX-008-universal-tournament-home-system.md`, `docs/arc_tix/TIX-013-player-career-history-and-head-to-head.md`, `docs/arc_tix/TIX-015-universal-tournament-addressing-system.md`

## 1. Commander Intent

Upgrade the tournament universe so events continue to exist independently of the managed athlete.

If the managed player does not enter, loses early, or is not involved in a match, the tournament should still resolve honestly. A champion should be simulated, displayed on the tournament home, awarded ranking points, and written into player career records.

The product rule is:

**Career Universe ≠ Managed Player Diary**

The managed athlete is one actor inside the world, not the reason the world exists.

## 2. Mediation Context

`TIX-008` successfully moved competition detail into a universal tournament home, but it explicitly avoided changing simulation outcomes. That was the correct boundary for the original ticket.

This mediation ticket now takes the next step: tournament home pages and archives should reflect complete tournament outcomes, not only managed-player outcomes.

The improved model is:

**Tournament Home = managed player context + whole event outcome**

## 3. Problem Statement

The current system is still too managed-player centric. When the manager's athlete is not the champion, the surrounding event world can feel under-simulated: champions may be missing, other players may not accrue meaningful records, and player profiles can look empty unless they directly intersect with the managed athlete.

That breaks the sports-management illusion. A believable career mode needs a parallel competitive universe where other athletes win, lose, build form, gain ranking points, and develop career histories.

## 4. Universe Simulation Contract

Every entered or calendar-relevant tournament must eventually produce a complete event outcome.

For each tournament:

- simulate all non-managed matches using the existing quick simulation pathway,
- preserve any manually played managed-player match results,
- continue the bracket after managed-player elimination,
- resolve champion and runner-up,
- persist final bracket state or an archive snapshot,
- award ranking points according to event tier and finishing round,
- write win-loss match records for all simulated and played matches,
- expose the complete outcome on the tournament home.

The event closeout rule is:

**Event Closed ⇒ Champion + Runner-Up + Match Records + Ranking Deltas**

## 5. Managed Match Integrity

Do not overwrite matches the user actually played.

The simulation pipeline should treat managed matches as fixed facts:

**Played Managed Match Result = source of truth**

Quick simulation only fills missing event matches. If the managed player loses in the quarter-final, the semi-finals and final should still be simulated from the remaining bracket.

## 6. Ranking And Record Contract

For every completed tournament:

- champion, runner-up, semi-finalists, quarter-finalists, and earlier exits should receive the correct ranking points when the ranking system supports that event tier,
- every completed match should create a win-loss record for both players,
- simulated matches and manually played matches should be distinguishable internally if needed, but both count as real career history,
- old saves without full event records must remain valid and show honest fallback states.

Minimum match source field:

```ts
type CareerMatchRecordSource = "played" | "quick_sim" | "archive_import";
```

Suggested record extension:

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
  source: CareerMatchRecordSource;
};
```

## 7. Tournament Home Display Contract

Tournament home pages should display the event's true outcome, even when the champion is not the managed athlete.

Completed event pages must show:

- champion,
- runner-up where known,
- managed-player result,
- completed bracket or saved snapshot,
- ranking points awarded,
- match results and scoreline evidence,
- archive status if the save predates full bracket persistence.

The top summary should not say `Not archived` when the event has enough simulated truth to identify a champion.

## 8. Parallel Universe Principle

This ticket should be implemented with a universe-first mindset:

**Player Record = all matches in the save universe**

not:

**Player Record = matches against my managed player only**

This principle should guide data selectors, tournament archives, rankings, and profile records.

## 9. Absolute Rules

- Do not change or reroll manually played match outcomes.
- Do not make the managed athlete the default champion when they did not win.
- Do not skip tournament completion after managed-player elimination.
- Do not award ranking points without a completed bracket or honest fallback logic.
- Do not fabricate historical records for old saves that never stored the data.
- Do not break universal tournament addressing from `TIX-015`.
- Do not remove managed-player-focused summaries; place them beside the full event truth.

## 10. Acceptance Criteria

- [ ] A tournament can complete with a non-managed champion.
- [ ] Completed tournament homes display champion and runner-up where available.
- [ ] Non-managed matches are resolved through quick simulation when needed.
- [ ] Managed-player played results remain fixed and are not overwritten.
- [ ] Ranking points accrue for non-managed players according to event results.
- [ ] Player win-loss records include simulated universe matches, not only managed-player matches.
- [ ] Past event archives persist or reconstruct complete bracket outcomes when possible.
- [ ] Old saves without full archives render fallback states without crashing.
- [ ] Tests cover a tournament where the managed player loses before the final and a different player wins.

## 11. Verification

Run:

```bash
npm run test -- tests/unit/career.test.ts
npm run test -- tests/unit/career-calendar-ranking.test.ts
npm run test -- tests/unit/player-profile.test.ts
npx playwright test e2e/app.spec.ts
npm run build
```

Add focused tests for:

- non-managed champion simulation,
- post-elimination bracket continuation,
- ranking point accrual for non-managed players,
- universe-wide match-record writes,
- tournament home champion display.

## 12. Definition Of Done

The tournament system feels like a living badminton world:

**I manage one athlete; inside; a complete competitive universe**

Other players win events, build records, and move through the rankings whether or not the managed athlete is involved.
