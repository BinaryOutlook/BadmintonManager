# TIX-018: Sidebar Schedule Rail Mediation

Status: Draft mediation ticket
Priority: High
Target project: `BadmintonManager`
Target screens: career shell topbar, left command rail, schedule/timeline navigation
Prepared on: 2026-05-19
Primary files: `app/App.tsx`, `app/pages.ts`, `components/CareerWorkbench.tsx`, `styles.css`, `tests/unit/app-career-shell.test.tsx`, `e2e/app.spec.ts`
Reference input: `docs/scratchpad.md` lines 33-70
Related archived tickets: `docs/arc_tix/TIX-010-command-rail-competition-route-cleanup.md`, `docs/arc_tix/TIX-012-topbar-hierarchy-and-intel-removal.md`
Related active ticket: `docs/active_tix/TIX-016-schedule-calendar-timeline-separation.md`

## 1. Commander Intent

Clean up the left sidebar so it follows the manager's daily mental flow and avoids repeating identity already handled by the topbar.

The sidebar should become pure navigation:

**Sidebar = commands**

not:

**Sidebar = brand block + managed-player identity + commands**

The `BM` logo and associated managed-player text should not be repeated in the left sidebar now that the topbar already carries that identity.

## 2. Mediation Context

`TIX-012` moved the managed player into the topbar and strengthened the career clock. This was good.

The remaining issue is that the sidebar still visually repeats brand/player identity and its command order does not yet match the desired work rhythm. This ticket sharpens the sidebar after the topbar change.

## 3. Required Sidebar Order

Use this command order:

```text
CORE
Portal
Timeline
Calendar
Inbox Preview

PROGRAM
Squad
Training
Tactics
Rankings

MATCH
Live Match
Reports
Scouting

OPERATIONS
Staff
Facilities

SYSTEM
Save Manager
Settings
```

`Inbox Preview` is a future feature. It may appear as disabled, locked, or preview-only, but it should not pretend to be fully functional.

## 4. Calendar And Timeline Naming Mediation

This ticket must coordinate with `TIX-016`.

`TIX-016` establishes:

**Schedule = Upcoming + Past Events + Timeline + Calendar**

The sidebar language in this ticket should not accidentally recreate the old ambiguity.

Acceptable implementation paths:

- expose one top-level `Schedule` command and show `Timeline` / `Calendar` as subtabs inside it,
- or expose `Timeline` and `Calendar` as direct sidebar shortcuts that route into the corresponding `Schedule` subtabs.

The chosen implementation must keep the conceptual split:

**Timeline = chronological event log**

**Calendar = month-grid confirmed commitments**

Do not let `Calendar` return to meaning the whole schedule hub.

## 5. Remove Sidebar Identity Duplication

Remove from the left sidebar:

- standalone `BM` logo block,
- duplicated managed-player name,
- duplicated local save/profile text tied to that identity block.

Keep identity in the topbar as defined by `TIX-012`.

The sidebar should begin with navigation content, not another brand/player header.

## 6. Visual Contract

- Preserve the current dark management style.
- Keep section labels visually quieter than commands.
- Highlight the active command or active schedule subtab clearly.
- Avoid oversized vertical gaps between related commands.
- Keep disabled preview commands visually distinct without becoming unreadable.
- Ensure the rail remains usable at narrow desktop widths and mobile breakpoints.

## 7. Absolute Rules

- Do not remove topbar managed-player identity.
- Do not reintroduce `Competitions`.
- Do not make `Inbox Preview` look fully available if it is not functional.
- Do not let the sidebar contain two separate player identity areas.
- Do not conflict with the `Schedule` / `Timeline` / `Calendar` split in `TIX-016`.
- Do not break `Live Match`, daily action routing, save manager, or settings.

## 8. Acceptance Criteria

- [ ] The left sidebar no longer repeats the `BM` logo and managed-player identity block.
- [ ] Sidebar commands follow the requested order.
- [ ] `Inbox Preview` is shown as disabled, preview-only, hidden, or otherwise clearly not functional.
- [ ] `Timeline` and `Calendar` navigation respects the `TIX-016` schedule split.
- [ ] `Competitions` remains absent.
- [ ] Active navigation state is clear for schedule subtabs and normal pages.
- [ ] Topbar identity from `TIX-012` remains intact.
- [ ] Desktop and mobile layouts avoid overlap, clipping, and horizontal overflow.

## 9. Verification

Run:

```bash
npm run test -- tests/unit/app-career-shell.test.tsx
npx playwright test e2e/app.spec.ts
npm run build
```

Add or update tests for:

- sidebar command labels and order,
- removal of duplicated sidebar identity,
- disabled or preview-only inbox state,
- schedule subtab routing if `Timeline` and `Calendar` become direct shortcuts.

## 10. Definition Of Done

The command rail reads like a manager's workspace:

**time → program → match → operations → system**

The topbar says who we are managing. The sidebar says what we can do.
