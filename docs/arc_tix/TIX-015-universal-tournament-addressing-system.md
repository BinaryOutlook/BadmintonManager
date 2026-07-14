# TIX-015: Universal Tournament Addressing System

Status: Draft implementation ticket
Priority: High
Target project: `BadmintonManager`
Target screens: Calendar, tournament home, Career Portal, pre-match hub, post-match hub, Player Profile career history, Calendar View commitments, Save Manager, reports
Prepared on: 2026-05-19
Primary files: `components/TournamentLink.tsx`, `app/tournamentNavigation.tsx`, `components/CareerWorkbench.tsx`, `app/App.tsx`, `app/pages.ts`, `game/career/events.ts`, `game/career/models.ts`, `tests/unit/tournament-link.test.tsx`, `tests/unit/app-career-shell.test.tsx`, `e2e/app.spec.ts`
Related tickets: `TIX-008-universal-tournament-home-system.md`, `TIX-014-calendar-view-commitments-tab.md`

## 1. Commander Intent

Create a universal addressing system for tournaments.

Every visible known tournament name should route to that tournament's home page, just as known player names route to player profiles.

The rule is:

**Tournament Name On Screen ⇒ Open Tournament Home**

TIX-008 owns the tournament home. This ticket owns the links, address model, provider, and consistent clickable behavior across the app.

## 2. Problem Statement

Tournament navigation is currently action-specific and inconsistent. Some places use `View Entry`, some use Calendar row actions, some show event names as plain text, and past-event records are not yet universally addressable.

The player should learn one interaction rule:

**click competition = inspect competition**

That rule must apply to future, entered, active, completed, missed, skipped, and archived events whenever the app has a stable event identity.

## 3. Addressing Contract

Use stable tournament identity, not display text:

```ts
type TournamentAddress = {
  seasonId: string;
  eventId: string;
};
```

Create a reusable navigation layer similar to player navigation:

```tsx
<TournamentNavigationProvider onOpenTournamentHome={openTournamentHome}>
  {children}
</TournamentNavigationProvider>
```

Create a reusable link/control:

```tsx
<TournamentLink seasonId={career.seasonId} eventId={event.id}>
  {event.name}
</TournamentLink>
```

If a surface has `eventId` but no `seasonId`, resolve `seasonId` from the active career state. If neither can be resolved safely, render plain text.

## 4. Required Coverage

Tournament names must become addressable in at least:

- Calendar Upcoming rows,
- Calendar Past Events rows,
- Calendar `Schedule Brief`,
- Calendar `Calendar View` commitments from TIX-014,
- Career Portal next-event and calendar snapshot surfaces,
- pre-match hub event labels,
- post-match hub event labels,
- tournament home cross-links,
- Player Profile `Career` tab event histories from TIX-013,
- Save Manager active career/event summary,
- reports or evidence panels that display known event names.

Do not make `TBD`, missing event, or old save fallback labels clickable.

## 5. Route Contract

The universal address should open the same tournament home as TIX-008:

```text
/career/tournaments/:seasonId/:eventId
```

The current SPA may keep internal page state:

```ts
{ id: "eventDetails", eventId: string }
```

but helper names should use tournament-home language:

```ts
openTournamentHome({ seasonId, eventId })
```

Do not use row index, event name, venue name, or date window as a route key.

## 6. Interaction Rules

- Tournament links should look like intentional links, not disabled status text.
- Links inside tables, cards, and status strips must remain keyboard reachable.
- Clicking a tournament name opens the tournament home only.
- Dedicated daily-action buttons still own daily actions: `Enter Event`, `Play Match`, `Review Match`.
- Do not turn the whole row into a link if it creates nested interactive conflicts.
- Use `TournamentLink` for names and explicit buttons for commands.

The target separation is:

**TournamentLink = inspect**

**Command Button = act**

## 7. Data And Fallback Rules

- Future catalog event: link with `career.seasonId + event.id`.
- Entered active event: link with active tournament/event id.
- Completed history record: link with `seasonId + record.eventId`.
- Imported old save with missing catalog event: show fallback text plus not-found-safe behavior if clicked from stored id.
- Event name only, no id: render plain text and do not guess.

## 8. Absolute Rules

- Do not navigate by tournament name.
- Do not duplicate tournament-home rendering logic inside the link component.
- Do not replace daily action buttons with links.
- Do not break existing Calendar entry, scheduled match, or post-match routing.
- Do not require a full browser-router migration.
- Do not make old saves invalid.

## 9. Acceptance Criteria

- [ ] A reusable `TournamentLink` or equivalent exists.
- [ ] A tournament navigation provider/helper exists, parallel in spirit to player navigation.
- [ ] Known tournament names in Calendar Upcoming open the tournament home.
- [ ] Known tournament names in Calendar Past Events open the tournament home.
- [ ] Known tournament names in Portal, pre-match, and post-match surfaces open the tournament home.
- [ ] TIX-014 commitment rows or event names open the tournament home when implemented.
- [ ] TIX-013 player career event names open the tournament home when implemented.
- [ ] Links use stable `seasonId + eventId`, never display text.
- [ ] Missing or legacy records fail safely with a not-found tournament home state.
- [ ] Keyboard and screen-reader access remains clear.

## 10. Verification

Run:

```bash
npm run test -- tests/unit/app-career-shell.test.tsx
npm run test -- tests/unit/career-calendar-ranking.test.ts
npx playwright test e2e/app.spec.ts
npm run build
```

Add focused tests for:

- tournament link provider calls `openTournamentHome` with `seasonId + eventId`,
- Calendar event-name click opens the tournament home,
- Past Events event-name click opens the tournament home,
- missing event id renders safe plain text or not-found state.

## 11. Definition Of Done

Tournament identity becomes a system:

**known tournament id + visible tournament name = tournament home address**

The user should not need to search for `Open Event` when the competition name itself is already on screen.
