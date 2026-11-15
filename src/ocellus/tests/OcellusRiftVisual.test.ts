import { RIFT_CHARGE_TICKS } from "../OcellusPresentation";
import { Phase4Simulation } from "../Phase4Simulation";
import { PLAYER_SPAWN } from "../Phase4Rules";

describe("native Void Rift charge timing", () => {
  test("the charge bar reaches full after the original 30-tick deadline", () => {
    expect(RIFT_CHARGE_TICKS).toBe(30);
    const sim = new Phase4Simulation(42);
    let spawnedAt: number | null = null;
    let detonatedAt: number | null = null;
    for (let t = 0; t <= 100; t++) {
      const row = sim.step(PLAYER_SPAWN, 99, "range");
      if (row.effects.some((effect) => effect.kind === "rift-spawn") && spawnedAt === null) spawnedAt = t;
      if (row.effects.some((effect) => effect.kind === "rift-detonate") && detonatedAt === null) detonatedAt = t;
    }
    expect(spawnedAt).toBe(67);
    expect(detonatedAt).toBe(97);
    expect(detonatedAt! - spawnedAt!).toBe(RIFT_CHARGE_TICKS);
  });
});
