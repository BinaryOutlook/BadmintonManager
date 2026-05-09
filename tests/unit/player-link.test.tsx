import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { PlayerNavigationProvider } from "../../app/playerNavigation";
import { SmartPlayerText } from "../../components/PlayerLink";

describe("SmartPlayerText", () => {
  it("turns known player names into profile links inside prose", () => {
    const openPlayerProfile = vi.fn();

    render(
      <PlayerNavigationProvider onOpenPlayerProfile={openPlayerProfile}>
        <SmartPlayerText text="Scheduled against Three-Lung Dynamo after Adrian Koh advanced." />
      </PlayerNavigationProvider>
    );

    screen.getByRole("button", { name: "Three-Lung Dynamo" }).click();
    screen.getByRole("button", { name: "Adrian Koh" }).click();

    expect(openPlayerProfile).toHaveBeenCalledTimes(2);
  });
});
