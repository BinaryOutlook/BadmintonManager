import type { AppPhase } from "../game/store/store";

export type AppPage =
  | { id: "setup" }
  | { id: "home" }
  | { id: "squad" }
  | { id: "playerProfile"; playerId: string }
  | { id: "games" }
  | { id: "season" }
  | { id: "calendar" }
  | { id: "program" }
  | { id: "rivals" }
  | { id: "scouting" }
  | { id: "recruitment" }
  | { id: "youth" }
  | { id: "staff" }
  | { id: "promises" }
  | { id: "bracket" }
  | { id: "liveMatch" }
  | { id: "review" };

export function pageForPhase(phase: AppPhase): AppPage {
  switch (phase) {
    case "setup":
      return { id: "setup" };
    case "overview":
      return { id: "bracket" };
    case "match":
      return { id: "liveMatch" };
    case "complete":
      return { id: "review" };
  }
}

export function isPhaseBoundPage(page: AppPage) {
  return page.id === "setup" || page.id === "bracket" || page.id === "liveMatch" || page.id === "review";
}
