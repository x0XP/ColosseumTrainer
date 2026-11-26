import { stageAt } from "../Phase4Rules";
import { explosionDamageReducedAt, installOcellusExplosionReduction } from "../OcellusExplosionCombat";
import { installOcellusDeflection } from "../OcellusDeflection";
import { OcellusRegion } from "../OcellusRegion";

describe("Ocellus explosion series combat rules", () => {
  test("damage reduction starts with first mark and ends on sixth impact", () => {
    for (const t of [0, 8, 16, 29, 30, 31, 32, 39, 47, 60, 61, 67, 68, 76, 107]) {
      expect(explosionDamageReducedAt(stageAt(t))).toBe(false);
    }
    for (const t of [17, 18, 25, 27, 28, 48, 49, 58, 59, 77, 88, 117, 119]) {
      expect(explosionDamageReducedAt(stageAt(t))).toBe(true);
    }
  });

  test("applies 60 percent reduction after weapon-specific damage changes", () => {
    let beforeHits = 0;
    const projectile = { damage: 30, beforeHit() { beforeHits++; this.damage = 49; } };
    installOcellusExplosionReduction(projectile, () => stageAt(17));
    projectile.beforeHit();
    expect(beforeHits).toBe(1);
    expect(projectile.damage).toBe(19);
  });

  test("checks the landing frame rather than the attack launch frame", () => {
    let landing = stageAt(16);
    const projectile = { damage: 50, beforeHit() {} };
    installOcellusExplosionReduction(projectile, () => landing);
    landing = stageAt(17);
    projectile.beforeHit();
    expect(projectile.damage).toBe(20);
  });

  test("retains the original hit outside the series", () => {
    const projectile = { damage: 47, beforeHit() {} };
    installOcellusExplosionReduction(projectile, () => stageAt(29));
    projectile.beforeHit();
    expect(projectile.damage).toBe(47);
  });

  test("deflected attacks remain zero through explosion reduction", () => {
    const projectile = { attackStyle: "stab", damage: 52, beforeHit() {} };
    expect(installOcellusDeflection(projectile, stageAt(8))).toBe(true);
    installOcellusExplosionReduction(projectile, () => stageAt(17));
    projectile.beforeHit();
    expect(projectile.damage).toBe(0);
  });

  test("one-tile dodge hastens the SDK player attack, floored at zero", () => {
    const run = (delay: number) => {
      const region = { boss: {}, player: { attackDelay: delay } };
      (OcellusRegion.prototype as unknown as {
        applyEffect(this: unknown, effect: { kind: "attack-haste"; ticks: number }): void;
      }).applyEffect.call(region, { kind: "attack-haste", ticks: 3 });
      return region.player.attackDelay;
    };
    expect(run(5)).toBe(2);
    expect(run(2)).toBe(0);
    expect(run(0)).toBe(0);
  });
});


describe("actual incoming boss queue frame",()=>{
  // Exercise the region's real scoped frame accessor, without depending on
  // a browser, GPU, or SDK combat rolls. The real SDK calls this scope in
  // OcellusBoss.queueStep before runEncounterTick publishes the new frame.
  const regionAt=(previous:number)=>{
    const region=Object.create(OcellusRegion.prototype);
    region.view={frame:stageAt(previous),result:null};
    region.sim={upcoming:()=>stageAt(previous+1)};
    region.landingFrame=null;
    return region as OcellusRegion;
  };
  for(const [previous,expected] of [[16,20],[27,20],[28,50],[47,20],[58,20],[59,50],[76,20],[88,50]]) {
    test("incoming hit after published tick "+previous+" uses the actual landing tick",()=>{
      const region=regionAt(previous);
      const hit={damage:50,beforeHit(){}};
      installOcellusExplosionReduction(hit,()=>region.bossLandingFrame());
      expect(region.bossLandingFrame().tick).toBe(previous);
      region.withBossLandingFrame(()=>hit.beforeHit());
      expect(hit.damage).toBe(expected);
      expect(region.bossLandingFrame().tick).toBe(previous);
    });
  }
  test("launch prayer and landing mitigation remain independent across boundary",()=>{
    const region=regionAt(47);
    const hit={damage:50,attackStyle:"range",beforeHit(){}};
    expect(installOcellusDeflection(hit,stageAt(38))).toBe(false);
    installOcellusExplosionReduction(hit,()=>region.bossLandingFrame());
    region.withBossLandingFrame(()=>hit.beforeHit());
    expect(hit.damage).toBe(20);
  });
  test("scoped landing frame is restored even when a weapon callback throws",()=>{
    const region=regionAt(16);
    expect(()=>region.withBossLandingFrame(()=>{throw Error("test");})).toThrow("test");
    expect(region.bossLandingFrame().tick).toBe(16);
  });
});

test("movement frame preserves the original explosion tile even when the SDK mutates location",()=>{
 const region=Object.create(OcellusRegion.prototype);
 region.world={getReadyTimer:0};region.view={frame:stageAt(16),result:null};
 region.sim={upcoming:()=>stageAt(17)};
 region.player={location:{x:5,y:1}};
 region.withMovementFrame(()=>{region.player.location.x=6;});
 expect(region.tickStartTile).toEqual({tick:17,tile:{x:5,y:1}});
 region.withMovementFrame(()=>{region.player.location.x=7;});
 expect(region.tickStartTile.tile).toEqual({x:5,y:1});
 expect(region.movementFrame).toBeUndefined();
});
