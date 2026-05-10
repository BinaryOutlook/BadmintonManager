export const QUICK_TOURNAMENT_NAME = "Harborline Open";
export const LEGACY_QUICK_TOURNAMENT_NAME = "Singapore Open";

export function normalizeTournamentName(value: unknown) {
  return value === LEGACY_QUICK_TOURNAMENT_NAME ? QUICK_TOURNAMENT_NAME : value;
}
