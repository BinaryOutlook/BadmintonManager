import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { PlayerProfilePage } from "../../app/pages/PlayerProfilePage";
import { SquadPage } from "../../app/pages/SquadPage";
import { PlayerNavigationProvider } from "../../app/playerNavigation";
import { TournamentNavigationProvider } from "../../app/tournamentNavigation";
import {
  commissionScoutReport,
  makeRecruitmentOffer,
  resolveDueScoutReports
} from "../../game/career/ecosystem";
import { scheduleRosterPreparation } from "../../game/career/program";
import { scheduledPreparationForAthlete } from "../../game/career/preparation";
import { createInitialCareerState } from "../../game/career/state";
import { advanceWorldRegistry, protectedWorldPlayerIds } from "../../game/career/world";
import { seededPlayers } from "../../game/content/players";

const RECRUIT_ID = "cand-arya-prakash";

function careerWithWorldIntake() {
  const career = createInitialCareerState(seededPlayers[0].player.id, 9_952);
  const seasonId = "2027";
  const date = "2027-01-01";

  return {
    ...career,
    seasonId,
    date,
    world: advanceWorldRegistry({
      registry: career.world,
      careerSeed: career.seed,
      seasonId,
      date,
      protectedPlayerIds: protectedWorldPlayerIds(career)
    })
  };
}

function careerWithSignedArya() {
  const managedPlayerId = seededPlayers[0].player.id;
  const assigned = commissionScoutReport(
    createInitialCareerState(managedPlayerId, 9_951),
    RECRUIT_ID,
    "candidate"
  );
  const assignment = assigned.ecosystem.scouting.assignments.find(
    (entry) => entry.subjectId === RECRUIT_ID
  );

  if (!assignment) {
    throw new Error("Expected Arya's recruitment scouting assignment.");
  }

  return makeRecruitmentOffer(
    resolveDueScoutReports({ ...assigned, date: assignment.dueAt }),
    RECRUIT_ID
  );
}

function renderSquad(args: {
  career: ReturnType<typeof createInitialCareerState>;
  onOpenPlayerProfile?: (playerId: string) => void;
  onSelectPlayer?: (playerId: string) => void;
}) {
  const onOpenPlayerProfile = args.onOpenPlayerProfile ?? vi.fn();
  const onSelectPlayer = args.onSelectPlayer ?? vi.fn();
  const view = render(
    <SquadPage
      selectedPlayerId={args.career.program.managedPlayerId}
      phase="setup"
      career={args.career}
      tournament={null}
      liveMatchSession={null}
      onOpenPlayerProfile={onOpenPlayerProfile}
      onSelectPlayer={onSelectPlayer}
    />
  );

  return { ...view, onOpenPlayerProfile, onSelectPlayer };
}

describe("program squad UI", () => {
  it("defaults a career squad to My Program and keeps the managed lead locked", () => {
    const career = createInitialCareerState(seededPlayers[0].player.id, 9_950);
    const managedLeadId = career.program.managedPlayerId;
    const managedLead = career.ecosystem.recruitment.roster.find(
      (slot) => slot.athleteId === managedLeadId
    );
    const onOpenPlayerProfile = vi.fn();
    const onSelectPlayer = vi.fn();

    if (!managedLead) {
      throw new Error("Expected the initial career to include its managed lead in the program roster.");
    }

    renderSquad({ career, onOpenPlayerProfile, onSelectPlayer });

    expect(screen.getByRole("tab", { name: "My Program" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tabpanel", { name: "My Program" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: managedLead.name })).toBeInTheDocument();
    expect(screen.getByText("Lead")).toBeInTheDocument();
    expect(screen.getByText("Managed lead")).toBeInTheDocument();
    expect(screen.getByText("Career athlete locked")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Select Athlete" })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: managedLead.name }));

    expect(onOpenPlayerProfile).toHaveBeenCalledWith(managedLeadId);
    expect(onSelectPlayer).not.toHaveBeenCalled();
    expect(career.program.managedPlayerId).toBe(managedLeadId);
  });

  it("shows a signed rotation athlete's preparation state and keeps directory viewing separate from selection", () => {
    const career = careerWithSignedArya();
    const managedLeadId = career.program.managedPlayerId;
    const onOpenPlayerProfile = vi.fn();
    const onSelectPlayer = vi.fn();
    const { rerender } = renderSquad({ career, onOpenPlayerProfile, onSelectPlayer });
    const aryaRow = screen.getByRole("button", { name: "Arya Prakash" }).closest("article");

    expect(aryaRow).not.toBeNull();
    expect(within(aryaRow!).getByText("Rotation")).toBeInTheDocument();
    expect(within(aryaRow!).getByText("No block scheduled")).toBeInTheDocument();

    fireEvent.click(within(aryaRow!).getByRole("button", { name: "Arya Prakash" }));
    expect(onOpenPlayerProfile).toHaveBeenCalledWith(RECRUIT_ID);
    expect(onSelectPlayer).not.toHaveBeenCalled();
    expect(career.program.managedPlayerId).toBe(managedLeadId);

    const scheduledCareer = scheduleRosterPreparation({ state: career, athleteId: RECRUIT_ID });
    const scheduledBlock = scheduledPreparationForAthlete(scheduledCareer, RECRUIT_ID);

    expect(scheduledBlock).not.toBeNull();

    rerender(
      <SquadPage
        selectedPlayerId={managedLeadId}
        phase="setup"
        career={scheduledCareer}
        tournament={null}
        liveMatchSession={null}
        onOpenPlayerProfile={onOpenPlayerProfile}
        onSelectPlayer={onSelectPlayer}
      />
    );

    const scheduledAryaRow = screen.getByRole("button", { name: "Arya Prakash" }).closest("article");

    expect(scheduledAryaRow).not.toBeNull();
    expect(within(scheduledAryaRow!).getByText(scheduledBlock!.planSnapshot.label)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("tab", { name: "World Directory" }));

    expect(screen.getByRole("tab", { name: "World Directory" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tabpanel", { name: "World Directory" })).toBeInTheDocument();
    expect(screen.getByText("Profile viewing does not change your managed lead.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Select Athlete" })).not.toBeInTheDocument();

    const worldAthlete = seededPlayers[1].player;
    fireEvent.click(screen.getByRole("button", { name: worldAthlete.name }));

    expect(onOpenPlayerProfile).toHaveBeenLastCalledWith(worldAthlete.id);
    expect(onSelectPlayer).not.toHaveBeenCalled();
    expect(scheduledCareer.program.managedPlayerId).toBe(managedLeadId);
  });

  it("lists active generated intake players in the World Directory and excludes retired records", () => {
    const advanced = careerWithWorldIntake();
    const generated = advanced.world.players.find((record) => record.origin === "generated_intake");
    const retiredRecord = advanced.world.players.find(
      (record) => record.status === "active" && record.player.id !== advanced.program.managedPlayerId
    );

    if (!generated || !retiredRecord) {
      throw new Error("Expected generated and retireable world records.");
    }

    const career = {
      ...advanced,
      world: {
        ...advanced.world,
        players: advanced.world.players.map((record) => record.player.id === retiredRecord.player.id
          ? { ...record, status: "retired" as const, retiredSeason: advanced.seasonId }
          : record)
      }
    };
    const onOpenPlayerProfile = vi.fn();

    renderSquad({ career, onOpenPlayerProfile });
    fireEvent.click(screen.getByRole("tab", { name: "World Directory" }));

    expect(screen.getByRole("button", { name: generated.player.name })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: retiredRecord.player.name })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: generated.player.name }));
    expect(onOpenPlayerProfile).toHaveBeenCalledWith(generated.player.id);
  });
});

describe("career-generated program athlete profile", () => {
  it("renders signed recruit evidence without changing the managed lead", () => {
    const career = careerWithSignedArya();
    const managedLeadId = career.program.managedPlayerId;
    const managedLead = career.ecosystem.recruitment.roster.find((slot) => slot.role === "lead");
    const aryaSlot = career.ecosystem.recruitment.roster.find((slot) => slot.athleteId === RECRUIT_ID);
    const onBack = vi.fn();
    const onSelectPlayer = vi.fn();

    if (!managedLead || !aryaSlot) {
      throw new Error("Expected both the managed lead and Arya in the signed program roster.");
    }

    render(
      <PlayerNavigationProvider onOpenPlayerProfile={vi.fn()}>
        <TournamentNavigationProvider onOpenTournamentHome={vi.fn()}>
          <PlayerProfilePage
            playerId={RECRUIT_ID}
            selectedPlayerId={managedLeadId}
            phase="setup"
            careerPresent={true}
            career={career}
            tournament={null}
            liveMatchSession={null}
            onBack={onBack}
            onSelectPlayer={onSelectPlayer}
          />
        </TournamentNavigationProvider>
      </PlayerNavigationProvider>
    );

    expect(screen.getByRole("heading", { name: "Arya Prakash", level: 1 })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Player Not Found" })).not.toBeInTheDocument();
    expect(screen.getByText("My Program · Rotation")).toBeInTheDocument();
    expect(screen.getByText("Weekly contract").parentElement).toHaveTextContent(
      `$${aryaSlot.contractCost.toLocaleString("en-US")}`
    );
    expect(screen.getByRole("heading", { name: "Development Evidence" })).toBeInTheDocument();
    expect(screen.getByText("Career baseline")).toBeInTheDocument();
    expect(screen.getByText("Arya Prakash recruitment development baseline.")).toBeInTheDocument();
    expect(
      screen.getByText((_, element) =>
        element?.tagName === "P" &&
        element.textContent ===
          `A career-generated athlete profile. Viewing this record does not change the managed lead, ${managedLead.name}.`
      )
    ).toBeInTheDocument();
    expect(onSelectPlayer).not.toHaveBeenCalled();
    expect(career.program.managedPlayerId).toBe(managedLeadId);

    fireEvent.click(screen.getByRole("button", { name: "Back to My Program" }));

    expect(onBack).toHaveBeenCalledOnce();
    expect(onSelectPlayer).not.toHaveBeenCalled();
    expect(career.program.managedPlayerId).toBe(managedLeadId);
  });

  it("renders a generated circuit intake as a complete scouting profile", () => {
    const career = careerWithWorldIntake();
    const generated = career.world.players.find((record) => record.origin === "generated_intake");

    if (!generated) {
      throw new Error("Expected a generated world intake player.");
    }

    render(
      <PlayerNavigationProvider onOpenPlayerProfile={vi.fn()}>
        <TournamentNavigationProvider onOpenTournamentHome={vi.fn()}>
          <PlayerProfilePage
            playerId={generated.player.id}
            selectedPlayerId={career.program.managedPlayerId}
            phase="setup"
            careerPresent={true}
            career={career}
            tournament={null}
            liveMatchSession={null}
            onBack={vi.fn()}
            onSelectPlayer={vi.fn()}
          />
        </TournamentNavigationProvider>
      </PlayerNavigationProvider>
    );

    expect(screen.getByRole("heading", { level: 1, name: generated.player.name })).toBeInTheDocument();
    expect(screen.getByText(generated.player.styleLabel)).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Scouting" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Player Not Found" })).not.toBeInTheDocument();
  });
});
