import {
  BOARD_HEIGHT, BOARD_WIDTH, FLOOR_TILES, inPlatform, inNearSquare, stageAt,
  voidFloorHits, orbLocation, specialStyle, CYCLE_TICKS, LEAD_IN_TICKS,
} from "../Phase4Rules";
import { Phase4Simulation } from "../Phase4Simulation";

const tile = (x: number, y: number) => ({ x, y });

describe("Ocellus Phase 4 arena and cycle", () => {
  test("the evidenced triangle has 84 walkable floor tiles", () => {
    expect(BOARD_WIDTH).toBe(14);
    expect(BOARD_HEIGHT).toBe(13);
    expect(FLOOR_TILES.length).toBe(84);
    expect(inPlatform(tile(5, 1))).toBe(true);
    expect(inPlatform(tile(14, 12))).toBe(false);
    expect(inNearSquare(tile(3, 7))).toBe(true);
    expect(inNearSquare(tile(8, 7))).toBe(false);
  });

  test("lead-in is 8 ticks and cycles repeat every 60 ticks", () => {
    expect(LEAD_IN_TICKS).toBe(8);
    expect(CYCLE_TICKS).toBe(60);
    expect(stageAt(0).stage).toBe("lead-in");
    expect(stageAt(7).stage).toBe("lead-in");
    expect(stageAt(8)).toMatchObject({ cycle: 1, stage: "inner-void", offset: 0 });
    expect(stageAt(29)).toMatchObject({ cycle: 1, stage: "inner-void", offset: 21 });
    expect(stageAt(30)).toMatchObject({ cycle: 1, stage: "after-inner", offset: 22 });
    expect(stageAt(39)).toMatchObject({ cycle: 1, stage: "outer-void", offset: 31 });
    expect(stageAt(59)).toMatchObject({ cycle: 1, stage: "after-outer", offset: 51 });
    expect(stageAt(68)).toMatchObject({ cycle: 2, stage: "inner-void", offset: 0 });
    expect(() => stageAt(-1)).toThrow(RangeError);
  });

  test("lifeforce, six marks, prayers and rifts occur on specific ticks", () => {
    const events = (t: number) => stageAt(t).events.map((e) => e.kind);
    expect(events(11)).toContain("lifeforce-tell");
    expect(events(12)).toContain("lifeforce-hit");
    expect(events(24)).toContain("orb-mature");
    expect(events(36)).toContain("orb-expire");
    expect(events(17)).toContain("explosion-mark");
    expect(events(18)).toContain("explosion-hit");
    expect(events(27)).toContain("explosion-mark");
    expect(events(28)).toContain("explosion-hit");
    expect(events(32)).toContain("special-tell");
    expect(events(37)).toContain("special-hit");
    expect(events(43)).toContain("lifeforce-hit");
    expect(events(49)).toContain("orb-mature");
    expect(events(48)).toContain("explosion-mark");
    expect(events(59)).toContain("explosion-hit");
    expect(events(67)).toContain("rift-spawn");
  });

  test("floor pressure only activates on its own half after grace period", () => {
    const near = tile(3, 3);
    const outer = tile(2, 1);
    expect(voidFloorHits(stageAt(8), near)).toBe(false);
    expect(voidFloorHits(stageAt(10), near)).toBe(true);
    expect(voidFloorHits(stageAt(10), outer)).toBe(false);
    expect(voidFloorHits(stageAt(40), outer)).toBe(false);
    expect(voidFloorHits(stageAt(44), outer)).toBe(true);
    expect(voidFloorHits(stageAt(44), near)).toBe(false);
  });

  test("orb placement stays on the floor and outside the active void", () => {
    for (let seed = 0; seed < 30; seed++) {
      const inner = orbLocation(tile(5, 1), "inner", seed, 12);
      const outer = orbLocation(tile(5, 1), "outer", seed, 43);
      expect(inPlatform(inner)).toBe(true);
      expect(inPlatform(outer)).toBe(true);
      expect(inNearSquare(inner)).toBe(false);
      expect(inNearSquare(outer)).toBe(true);
    }
  });

  test("special attack selection is repeatable per seed", () => {
    const expected = specialStyle(4321, 2, 1);
    expect(specialStyle(4321, 2, 1)).toBe(expected);
    expect(["melee", "range", "magic"]).toContain(expected);
  });
});

describe("Ocellus Phase 4 event simulation", () => {
  test("a lifeforce hit takes half current HP and creates a reclaimable orb", () => {
    const sim = new Phase4Simulation(7);
    let frame: ReturnType<typeof sim.step> | undefined;
    for (let i = 0; i <= 12; i++) frame = sim.step(tile(5, 1), 100, null);
    const drain = frame!.effects.find((e) => e.kind === "damage" && e.reason === "Lifeforce drain");
    expect(drain).toMatchObject({ amount: 50 });
    expect(frame!.orbs).toHaveLength(1);
    expect(frame!.orbs[0].amount).toBe(50);
    expect(frame!.orbs[0].maturesAt).toBe(24);
  });

  test("a targeted explosion is avoided by moving off its marked tile", () => {
    const sim = new Phase4Simulation(12);
    let explosion: ReturnType<typeof sim.step> | undefined;
    for (let i = 0; i <= 18; i++) {
      explosion = sim.step(i === 18 ? tile(6, 1) : tile(5, 1), 100, null);
    }
    expect(explosion!.stats.explosionsTotal).toBe(1);
    expect(explosion!.stats.explosionsDodged).toBe(1);
    expect(explosion!.effects.some((e) => e.kind === "damage" && e.reason === "Void explosion")).toBe(false);
  });

  test("matching a special's prayer records a defence", () => {
    const seed = 32, sim = new Phase4Simulation(seed);
    const prayer = specialStyle(seed, 1, 0);
    let result: ReturnType<typeof sim.step> | undefined;
    for (let tick = 0; tick <= 37; tick++) result = sim.step(tile(5, 1), 100, prayer);
    expect(result!.stats.specialsDefended).toBe(1);
    expect(result!.stats.specialsTotal).toBe(1);
  });

  test("rifts spawn from cycle two and can be killed to prevent detonation", () => {
    const sim = new Phase4Simulation(21);
    let result: ReturnType<typeof sim.step> | undefined;
    for (let tick = 0; tick <= 67; tick++) result = sim.step(tile(5, 1), 100, null);
    expect(result!.rifts.length).toBe(2);
    const id = result!.rifts[0].id;
    expect(sim.removeRift(id)).toBe(true);
    expect(sim.removeRift(id)).toBe(false);
    for (let tick = 68; tick <= 97; tick++) result = sim.step(tile(5, 1), 100, null);
    expect(result!.effects.filter((e) => e.kind === "rift-detonate")).toHaveLength(1);
    expect(result!.stats.riftsKilled).toBe(1);
  });

  test("the simulation does not reuse mutable state across attempts", () => {
    const sim = new Phase4Simulation(1);
    sim.step(tile(5, 1), 100, null);
    const fresh = new Phase4Simulation(1);
    expect(fresh.current().stage).toBe("lead-in");
    expect(fresh.snapshot().stats.damageTaken).toBe(0);
    expect(fresh.snapshot().orbs).toHaveLength(0);
  });
});
