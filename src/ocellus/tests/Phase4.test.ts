import {
  BOARD_HEIGHT, BOARD_WIDTH, FLOOR_TILES, inPlatform, inNearSquare, inBossFootprint, bossFootprintBlocks, stageAt,
  voidFloorHits, orbLocation, outerOrbLocation, specialStyle, bossOverheadAt, bossOverheadSprite, bossVisibleAt, CYCLE_TICKS, LEAD_IN_TICKS,
} from "../Phase4Rules";
import { Phase4Simulation } from "../Phase4Simulation";
import type { Tile } from "../Phase4Rules";
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

  test("the actual boss is hidden during the first four lead-in ticks", () => {
    expect(bossVisibleAt(stageAt(0))).toBe(false);
    expect(bossVisibleAt(stageAt(3))).toBe(false);
    expect(bossVisibleAt(stageAt(4))).toBe(true);
    expect(bossVisibleAt(stageAt(7))).toBe(true);
    expect(bossVisibleAt(stageAt(8))).toBe(true);
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

  test("outer lifeforce orb spawns on the opposite five-by-five corner", () => {
    for (let seed = 0; seed < 30; seed++) {
      expect(outerOrbLocation(tile(3, 3), seed, 43)).toEqual(tile(7, 7));
      expect(outerOrbLocation(tile(7, 3), seed, 43)).toEqual(tile(3, 7));
      expect(outerOrbLocation(tile(3, 7), seed, 43)).toEqual(tile(7, 3));
      expect(outerOrbLocation(tile(7, 7), seed, 43)).toEqual(tile(3, 3));
      expect(inPlatform(outerOrbLocation(tile(5, 1), seed, 43))).toBe(true);
    }
  });

  test("special attack selection is repeatable per seed", () => {
    const expected = specialStyle(4321, 2, 1);
    expect(specialStyle(4321, 2, 1)).toBe(expected);
    expect(["melee", "range", "magic"]).toContain(expected);
  });
});

describe("Ocellus Phase 4 event simulation", () => {
  test("outer orb remembers the first safe-ring entry, not the player's drain position", () => {
    const sim = new Phase4Simulation(75);
    let result: ReturnType<typeof sim.step> | undefined;
    for (let tick = 0; tick <= 43; tick++) {
      const standing = tick >= 34 ? tile(3, 3) : tile(5, 1);
      result = sim.step(standing, 100, null);
    }
    expect(result!.orbs.find((orb) => orb.void === "outer")?.tile).toEqual(tile(7, 7));
  });

  test("outer orb uses the latest entry after leaving the five-by-five area", () => {
    const sim = new Phase4Simulation(75);
    let result: ReturnType<typeof sim.step> | undefined;
    for (let tick = 0; tick <= 43; tick++) {
      const standing = tick >= 40 ? tile(7, 3)
        : tick >= 36 ? tile(5, 1)
        : tick >= 34 ? tile(3, 3)
        : tile(5, 1);
      result = sim.step(standing, 100, null);
    }
    expect(result!.orbs.find((orb) => orb.void === "outer")?.tile).toEqual(tile(3, 7));
  });

  test("outer orb falls back to the player position when outside the safe ring", () => {
    const sim = new Phase4Simulation(75);
    let result: ReturnType<typeof sim.step> | undefined;
    for (let tick = 0; tick <= 43; tick++)
      result = sim.step(tick >= 34 && tick <= 37 ? tile(3, 3) : tile(5, 1), 100, null);
    const expected = outerOrbLocation(tile(5, 1), 75, 43);
    expect(result!.orbs.find((orb) => orb.void === "outer")?.tile).toEqual(expected);
  });

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
    expect(explosion!.effects).toContainEqual({ kind: "attack-haste", ticks: 3 });
    expect(explosion!.effects.some((e) => e.kind === "damage" && e.reason === "Void explosion")).toBe(false);
  });

  test("a two-tile run avoids the explosion without gaining an attack-speed bonus", () => {
    const sim = new Phase4Simulation(12);
    let result: ReturnType<typeof sim.step> | undefined;
    for (let t = 0; t <= 18; t++) {
      result = sim.step(t === 18 ? tile(7, 1) : tile(5, 1), 100, null);
    }
    expect(result!.stats.explosionsDodged).toBe(1);
    expect(result!.effects).not.toContainEqual({ kind: "attack-haste", ticks: 3 });
    expect(result!.effects.some((e) => e.kind === "damage" && e.reason === "Void explosion")).toBe(false);
  });

  test("standing on the marked tile takes the hit and receives no haste", () => {
    const sim = new Phase4Simulation(12);
    let result: ReturnType<typeof sim.step> | undefined;
    for (let t = 0; t <= 18; t++) result = sim.step(tile(5, 1), 100, null);
    expect(result!.stats.explosionsTotal).toBe(1);
    expect(result!.stats.explosionsDodged).toBe(0);
    expect(result!.effects.some((e) => e.kind === "damage" && e.reason === "Void explosion")).toBe(true);
    expect(result!.effects.some((e) => e.kind === "attack-haste")).toBe(false);
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

describe("Ocellus encounter consistency regressions", () => {
  test("all seeds keep distant fragments on the correct safe floor", () => {
    for (const position of [{x:-20,y:-20},{x:40,y:40},...FLOOR_TILES]) {
      for (let seed=0;seed<8;seed++) for (const kind of ["inner","outer"] as const) {
        const orb=orbLocation(position,kind,seed,12);
        expect(inPlatform(orb)).toBe(true);
        expect(inNearSquare(orb)).toBe(kind==="outer");
      }
    }
  });
  test("the simulation records the impact tile without a rendered warning frame",()=>{
    const sim=new Phase4Simulation(42);
    let result: ReturnType<typeof sim.step>;
    for(let i=0;i<=18;i++) result=sim.step(i===18?tile(6,1):tile(5,1),99,null);
    expect(result!.impactMark).toEqual({void:"inner",pulse:0,tile:tile(5,1)});
    expect(result!.marks).toHaveLength(0);
    expect(sim.snapshot().impactMark).toEqual(result!.impactMark);
    expect(sim.step(tile(6,1),99,null).impactMark).toBeNull();
  });
  test("Soul Split heals actual damage rather than an overkill roll",()=>{
    const sim=new Phase4Simulation(42);
    let result: ReturnType<typeof sim.step>;
    for(let i=0;i<=37;i++) result=sim.step(tile(5,1),i===37?3:99,null);
    expect(result!.effects.find(e=>e.kind==="damage")).toMatchObject({amount:3});
    sim.step(tile(5,1),99,null);
    expect(sim.step(tile(5,1),99,null).effects).toContainEqual({kind:"boss-heal",amount:3,reason:"Soul Split"});
  });
  test("snapshot excludes a destroyed rift immediately",()=>{
    const sim=new Phase4Simulation(42);
    for(let i=0;i<=67;i++)sim.step(tile(5,1),99,null);
    const rifts=sim.snapshot().rifts;
    expect(rifts).toHaveLength(2);
    expect(sim.removeRift(rifts[0].id)).toBe(true);
    expect(sim.snapshot().rifts.map(r=>r.id)).toEqual([rifts[1].id]);
  });
  test("lifeforce recovery can exceed the player's ordinary HP maximum",()=>{
    const sim=new Phase4Simulation(42);
    let at=tile(5,1);
    for(let i=0;i<=12;i++){const r=sim.step(at,99,null);if(i===12)at=r.orbs[0].tile;}
    for(let i=13;i<24;i++)sim.step(at,90,null);
    expect(sim.step(at,90,null).effects).toContainEqual({kind:"heal",amount:49,reason:"Lifeforce returned"});
  });
});

test("orb departure is emitted exactly on the claim or expiry tick",()=>{
 const sim=new Phase4Simulation(42);let at=tile(5,1);
 for(let i=0;i<=12;i++){const r=sim.step(at,99,null);if(i===12)at=r.orbs[0].tile;}
 for(let i=13;i<24;i++)sim.step(at,99,null);
 const picked=sim.step(at,99,null);
 expect(picked.departingOrbs).toHaveLength(1);
 expect(picked.departingOrbs[0]).toMatchObject({claimAt:24,tile:at,picked:true});
 expect(sim.step(at,99,null).departingOrbs).toHaveLength(0);
 const expiry=new Phase4Simulation(42);
 let frame;
 for(let i=0;i<=36;i++)frame=expiry.step(tile(5,1),99,null);
 expect(frame!.departingOrbs).toHaveLength(1);
 expect(frame!.departingOrbs[0]).toMatchObject({expiresAt:36,picked:false});
 expect(expiry.step(tile(5,1),99,null).departingOrbs).toHaveLength(0);
});

test("attempt performance distinguishes adjacent dodge, distant dodge and lifeforce expiry",()=>{
 const adjacent=new Phase4Simulation(42),distant=new Phase4Simulation(42);
 let a,b;
 for(let i=0;i<=18;i++){
  a=adjacent.step(i===18?tile(6,1):tile(5,1),99,null);
  b=distant.step(i===18?tile(7,1):tile(5,1),99,null);
 }
 expect(a!.stats.speedBonusDodges).toBe(1);
 expect(b!.stats.speedBonusDodges).toBe(0);
 expect(a!.stats.explosionsDodged).toBe(b!.stats.explosionsDodged);
 expect(a!.stats.fragmentsSpawned).toBe(1);
 for(let i=19;i<=36;i++)a=adjacent.step(tile(5,1),99,null);
 expect(a!.stats.fragmentsExpired).toBe(1);
 expect(a!.stats.fragmentsCollected).toBe(0);
 const stats=a!.stats;
 expect(stats.damageTaken).toBe(stats.drained+stats.voidFloorDamage+stats.lingeringVoidDamage+stats.explosionDamage+stats.protectedSpecialDamage+stats.unprotectedSpecialDamage+stats.riftDamage);
});

test("outer-void boss collision applies to exactly nine tiles and releases on clear",()=>{
 const blocked=(tick:number,player=tile(5,3),alive=true)=>FLOOR_TILES.filter(at=>bossFootprintBlocks(stageAt(tick).stage,at,player,alive));
 for(const tick of [0,8,29,30,38,59,67,68,98,119])expect(blocked(tick)).toHaveLength(0);
 for(const tick of [39,40,58,99,118]){
  const tiles=blocked(tick);
  expect(tiles).toHaveLength(9);
  expect(tiles.every(inBossFootprint)).toBe(true);
  expect(blocked(tick,tile(5,5))).toHaveLength(0);
  expect(blocked(tick,tile(5,3),false)).toHaveLength(0);
 }
});
test("upcoming stage accounts for movement preceding the next mechanic tick",()=>{
 const sim=new Phase4Simulation(42);
 for(let i=0;i<39;i++)sim.step(tile(5,3),99,null);
 expect(sim.current().tick).toBe(38);
 expect(sim.upcoming()).toMatchObject({tick:39,stage:"outer-void"});
 sim.step(tile(5,3),99,null);
 expect(sim.current().stage).toBe("outer-void");
 for(let i=40;i<59;i++)sim.step(tile(5,3),99,null);
 expect(sim.upcoming()).toMatchObject({tick:59,stage:"after-outer"});
});

// Recorded mark/impact ticks sample the start-of-tick tile, not the
// destination of a click queued during the preceding tick.
for(const markTick of [17,48,77,108]){
 test("personal explosion start-of-tick sampling at "+markTick,()=>{
  const a=tile(5,1),b=tile(6,1),c=tile(7,1);
  const run=(onMark:Tile,onImpact:Tile)=>{
   const sim=new Phase4Simulation(42);let before:ReturnType<typeof sim.step>|undefined;
   for(let t=0;t<markTick;t++)before=sim.step(a,100,null);
   const mark=sim.step(onMark,100,null,a);
   const hit=sim.step(onImpact,100,null,onMark);
   expect(mark.marks[0].tile).toEqual(a);
   return {before:before!,hit};
  };
  const early=run(b,b);
  expect(early.hit.effects).toContainEqual({kind:"attack-haste",ticks:3});
  expect(early.hit.stats.explosionsDodged-early.before.stats.explosionsDodged).toBe(1);
  const late=run(a,b);
  expect(late.hit.effects.some(e=>e.kind==="damage"&&e.reason==="Void explosion")).toBe(true);
  expect(late.hit.effects).not.toContainEqual({kind:"attack-haste",ticks:3});
  const runTwo=run(c,c);
  expect(runTwo.hit.stats.explosionsDodged-runTwo.before.stats.explosionsDodged).toBe(1);
  expect(runTwo.hit.effects).not.toContainEqual({kind:"attack-haste",ticks:3});
 });
}
