import "../../../../test/setupFiles";

import { Player, Region, World } from "osrs-sdk";
import { SolHeredit } from "../js/mobs/SolHeredit";
import { ColosseumRegion } from "../js/ColosseumRegion";

class FramedColosseumRegion extends ColosseumRegion {
  protected override isEmbedded() { return true; }
}

class StandaloneColosseumRegion extends ColosseumRegion {
  protected override isEmbedded() { return false; }
}

describe("Colosseum death and reset", () => {
  afterEach(() => jest.restoreAllMocks());

  test("an embedded death stops combat and exposes Reset independently of canvas rendering", () => {
    const region = new FramedColosseumRegion();
    const world = { stopTicking: jest.fn() } as unknown as World;
    region.world = world;
    const listener = jest.fn();
    const unsubscribe = region.subscribeGameOver(listener);

    expect(region.getGameOver()).toBe(false);
    region.onGameOver();
    expect(world.stopTicking).toHaveBeenCalledTimes(1);
    expect(region.getGameOver()).toBe(true);
    expect(listener).toHaveBeenCalledTimes(1);

    // Multiple callbacks must not continually re-render the HTML button.
    region.onGameOver();
    expect(listener).toHaveBeenCalledTimes(1);
    unsubscribe();
  });

  test("Reset clears the embedded game-over state without reloading the page", () => {
    const region = new FramedColosseumRegion();
    region.world = { stopTicking: jest.fn() } as unknown as World;
    const player = {
      stats: { attack: 99, strength: 99, range: 99, defence: 99, prayer: 99 },
      currentStats: { attack: 99, strength: 99, range: 99, defence: 99, prayer: 99 },
    };
    // Isolate the state transition from cache/model loading in Region.reset.
    const reset = jest.spyOn(Region.prototype, "reset").mockReturnValue({ player } as ReturnType<Region["reset"]>);
    const listener = jest.fn();

    region.subscribeGameOver(listener);
    region.onGameOver();
    expect(region.getGameOver()).toBe(true);
    expect(region.reset(false).player).toBe(player);
    expect(reset).toHaveBeenCalledWith(false);
    expect(region.getGameOver()).toBe(false);
    expect(region.getAttemptSummary()).toBeNull();
    expect(listener).toHaveBeenCalledTimes(2);
    expect(player.currentStats.prayer).toBe(99);
  });

  test("standalone play also shows the HTML summary and stops until Reset", () => {
    const region = new StandaloneColosseumRegion();
    const world = { stopTicking: jest.fn(), globalTickCounter: 3 } as unknown as World;
    region.world = world;
    const nativeGameOver = jest.spyOn(Region.prototype, "onGameOver").mockImplementation(() => undefined);

    region.onGameOver();
    expect(nativeGameOver).not.toHaveBeenCalled();
    expect(world.stopTicking).toHaveBeenCalledTimes(1);
    expect(region.getGameOver()).toBe(true);
    expect(region.getAttemptSummary()?.outcome).toBe("defeat");
  });

  test("captures Sol victory once and preserves the snapshot until reset", () => {
    const region = new FramedColosseumRegion();
    region.world = { stopTicking: jest.fn(), globalTickCounter: 100, getReadyTimer: 0 } as unknown as World;
    const sol = Object.create(SolHeredit.prototype) as SolHeredit;
    sol.stats = { hitpoint: 1500 } as SolHeredit["stats"];
    sol.currentStats = { hitpoint: -20 } as SolHeredit["currentStats"];
    sol.phaseId = 5;
    region.mobs = [sol];
    region.recordAttemptAttack("triple");
    region.recordGrappleDefence(true);
    region.onUnitDeath(sol);
    const summary = region.getAttemptSummary();
    expect(region.getGameOver()).toBe(true);
    expect(summary?.outcome).toBe("victory");
    expect(summary?.solHpRemaining).toBe(0);
    expect(summary?.phaseReached).toBe(6);
    expect(summary?.attacks.triple).toBe(1);
    expect(summary?.grapplesDefended).toBe(1);
    region.onGameOver();
    expect(region.getAttemptSummary()).toBe(summary);
  });

  test("captures player death at impact, not at the end of the animation", () => {
    const region = new FramedColosseumRegion();
    region.world = { stopTicking: jest.fn(), globalTickCounter: 120 } as unknown as World;
    const player = Object.create(Player.prototype) as Player;
    const sol = Object.create(SolHeredit.prototype) as SolHeredit;
    sol.stats = { hitpoint: 1500 } as SolHeredit["stats"];
    sol.currentStats = { hitpoint: 625 } as SolHeredit["currentStats"];
    sol.phaseId = 2;
    sol.tauntPlayerDeath = jest.fn();
    region.mobs = [sol];
    region.onUnitDeath(player);
    const summary = region.getAttemptSummary();
    expect(summary?.outcome).toBe("defeat");
    expect(summary?.solHpRemaining).toBe(625);
    expect(region.getGameOver()).toBe(false);
    region.world.globalTickCounter = 180;
    region.onGameOver();
    expect(region.getAttemptSummary()).toBe(summary);
    expect(region.getGameOver()).toBe(true);
  });
});
