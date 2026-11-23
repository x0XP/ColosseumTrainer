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
