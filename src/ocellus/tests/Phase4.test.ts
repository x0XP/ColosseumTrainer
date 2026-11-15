import {
  BOARD_HEIGHT, BOARD_WIDTH, FLOOR_TILES, inPlatform, inNearSquare, stageAt,
  voidFloorHits, orbLocation, specialStyle, bossOverheadAt, bossOverheadSprite, CYCLE_TICKS, LEAD_IN_TICKS,
} from "../Phase4Rules";
import { Phase4Simulation } from "../Phase4Simulation";
import { deflectedByOcellus, installOcellusDeflection } from "../OcellusDeflection";

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

  test("boss overhead protection follows each observed Phase 4 transition", () => {
    const expected: ReadonlyArray<readonly [number, string]> = [
      [7, "None"],
      [8, "Deflect Melee"],
      [32, "Deflect Melee"],
      [33, "Soul Split"],
      [37, "Soul Split"],
      [38, "None"],
      [39, "Deflect Range"],
      [60, "Deflect Range"],
      [61, "Soul Split"],
      [66, "Soul Split"],
      [67, "None"],
      [68, "Deflect Melee"],
    ];
    for (const [tick, overhead] of expected) {
      expect(bossOverheadAt(stageAt(tick))).toBe(overhead);
    }
  });

  test("deflects only matching melee and ranged styles at launch", () => {
    expect(deflectedByOcellus(stageAt(8), "stab")).toBe(true);
    expect(deflectedByOcellus(stageAt(8), "slash")).toBe(true);
    expect(deflectedByOcellus(stageAt(8), "crush")).toBe(true);
    expect(deflectedByOcellus(stageAt(8), "range")).toBe(false);
    expect(deflectedByOcellus(stageAt(8), "magic")).toBe(false);
    expect(deflectedByOcellus(stageAt(38), "range")).toBe(false);
    expect(deflectedByOcellus(stageAt(39), "range")).toBe(true);
    expect(deflectedByOcellus(stageAt(39), "stab")).toBe(false);
    expect(deflectedByOcellus(stageAt(39), "magic")).toBe(false);
    expect(deflectedByOcellus(stageAt(61), "range")).toBe(false);
    expect(deflectedByOcellus(stageAt(67), "range")).toBe(false);
    expect(deflectedByOcellus(stageAt(68), "slash")).toBe(true);
  });

  test("a projectile launched into Deflect Range loses damage only at impact", () => {
    let originalCallCount = 0;
    const blocked = {
      attackStyle: "range",
      damage: 39,
      beforeHit() { originalCallCount++; this.damage = 42; },
    };
    expect(installOcellusDeflection(blocked, stageAt(39))).toBe(true);
    expect(blocked.damage).toBe(39);
    // A projectile can land in the next stage, but uses its launch prayer.
    expect(bossOverheadAt(stageAt(61))).toBe("Soul Split");
    blocked.beforeHit();
    expect(originalCallCount).toBe(1);
    expect(blocked.damage).toBe(0);
    const unblocked = {
      attackStyle: "range",
      damage: 27,
      beforeHit() { this.damage = 27; },
    };
    expect(installOcellusDeflection(unblocked, stageAt(38))).toBe(false);
    unblocked.beforeHit();
    expect(unblocked.damage).toBe(27);
    const magic = {
      attackStyle: "magic",
      damage: 18,
      beforeHit() { this.damage = 18; },
    };
    expect(installOcellusDeflection(magic, stageAt(39))).toBe(false);
    magic.beforeHit();
    expect(magic.damage).toBe(18);
  });

  test("boss head icons map to the documented cache 2746 sprite frames", () => {
    expect(bossOverheadSprite(stageAt(7))).toBeNull();
    expect(bossOverheadSprite(stageAt(8))).toBe(15);
    expect(bossOverheadSprite(stageAt(32))).toBe(15);
    expect(bossOverheadSprite(stageAt(33))).toBe(11);
    expect(bossOverheadSprite(stageAt(38))).toBeNull();
    expect(bossOverheadSprite(stageAt(39))).toBe(16);
    expect(bossOverheadSprite(stageAt(60))).toBe(16);
    expect(bossOverheadSprite(stageAt(61))).toBe(11);
    expect(bossOverheadSprite(stageAt(67))).toBeNull();
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

  test("a wrong-prayer transition attack heals Ocellus two ticks after the hit", () => {
    const sim = new Phase4Simulation(54);
    let hit: ReturnType<typeof sim.step> | undefined;
    for (let t = 0; t <= 37; t++) hit = sim.step(tile(5, 1), 100, null);
    const damage = hit!.effects.find((e) => e.kind === "damage" && e.reason === "Unprotected melee special")
      ?? hit!.effects.find((e) => e.kind === "damage" && /Unprotected .+ special/.test(e.reason));
    expect(damage).toBeDefined();
    expect(hit!.effects.some((e) => e.kind === "boss-heal" && e.reason === "Soul Split")).toBe(false);
    expect(sim.step(tile(5, 1), 100, null).effects.some((e) =>
      e.kind === "boss-heal" && e.reason === "Soul Split")).toBe(false);
    const healed = sim.step(tile(5, 1), 100, null);
    expect(healed.frame.tick).toBe(39);
    expect(healed.effects).toContainEqual({
      kind: "boss-heal",
      amount: damage!.kind === "damage" ? damage!.amount : 0,
      reason: "Soul Split",
    });
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

  test("standing on a lifeforce orb at maturation heals immediately", () => {
    const sim = new Phase4Simulation(7);
    let at = tile(5, 1);
    for (let t = 0; t <= 12; t++) {
      const result = sim.step(at, 100, null);
      if (t === 12) at = result.orbs[0].tile;
    }
    for (let t = 13; t < 24; t++) sim.step(at, 50, null);
    const matured = sim.step(at, 50, null);
    expect(matured.frame.tick).toBe(24);
    expect(matured.effects).toContainEqual({ kind: "heal", amount: 50, reason: "Lifeforce returned" });
    expect(matured.stats.returned).toBe(50);
  });

  test("unclaimed outer orb heals boss a tick after expiry", () => {
    const sim = new Phase4Simulation(7);
    let expired: ReturnType<typeof sim.step> | undefined;
    for (let t = 0; t <= 61; t++) expired = sim.step(tile(5, 1), 100, null);
    expect(expired!.frame.tick).toBe(61);
    expect(expired!.effects.some((e) => e.kind === "boss-heal")).toBe(false);
    const next = sim.step(tile(5, 1), 100, null);
    expect(next.frame.tick).toBe(62);
    expect(next.effects).toContainEqual({ kind: "boss-heal", amount: 50, reason: "Unclaimed lifeforce" });
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
