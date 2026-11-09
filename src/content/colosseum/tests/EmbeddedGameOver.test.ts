import "../../../../test/setupFiles";

import { Region, World } from "osrs-sdk";
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
    expect(listener).toHaveBeenCalledTimes(2);
    expect(player.currentStats.prayer).toBe(99);
  });

  test("standalone play keeps the SDK's original canvas Reset control", () => {
    const region = new StandaloneColosseumRegion();
    const nativeGameOver = jest.spyOn(Region.prototype, "onGameOver").mockImplementation(() => undefined);

    region.onGameOver();
    expect(nativeGameOver).toHaveBeenCalledTimes(1);
    expect(region.getGameOver()).toBe(false);
  });
});
