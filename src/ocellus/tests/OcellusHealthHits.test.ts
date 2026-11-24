import type { Unit } from "osrs-sdk";
import { scriptedHealthProjectile, consumeLifeforceHeal, installOcellusLifeforceRecovery } from "../OcellusHealthHits";

const boss = {
  size: 3, height: 3, location: { x: 4, y: 5 },
} as unknown as Unit;
const player = {
  size: 1, height: 1, location: { x: 5, y: 1 },
  currentStats: { hitpoint: 50 },
} as unknown as Unit;

describe("Ocellus native damage and healing hitsplats", () => {
  test("scripted damage remains a hidden one-tick typeless hit", () => {
    const projectile = scriptedHealthProjectile(boss, player, 49);
    expect(projectile.damage).toBe(49);
    expect(projectile.attackStyle).toBe("typeless");
    expect(projectile.remainingDelay).toBe(1);
    expect(projectile.options.visuals.hidden).toBe(true);
    expect(projectile.to).toBe(player);
  });

  test("returning lifeforce produces a green healing hitsplat", () => {
    const projectile = scriptedHealthProjectile(boss, player, -49);
    expect(projectile.damage).toBe(-49);
    expect(projectile.remainingDelay).toBe(1);
    expect(projectile.options.visuals.hidden).toBe(true);
    projectile.onTick();
    expect(projectile.remainingDelay).toBe(0);
  });

  test("rejects zero and non-integer health changes", () => {
    expect(() => scriptedHealthProjectile(boss, player, 0)).toThrow(RangeError);
    expect(() => scriptedHealthProjectile(boss, player, Number.NaN)).toThrow(RangeError);
    expect(() => scriptedHealthProjectile(boss, player, 1.5)).toThrow(RangeError);
  });
});

describe("scripted hit queue consistency",()=>{
  test("damage is clipped at landing HP, not the earlier queue construction HP",()=>{
    const target={...player,currentStats:{hitpoint:10}} as Unit;
    const hit=scriptedHealthProjectile(boss,target,35);
    expect(hit.damage).toBe(10);
    target.currentStats.hitpoint=45;
    hit.beforeHit();
    expect(hit.damage).toBe(35);
    target.currentStats.hitpoint=8;
    hit.beforeHit();
    expect(hit.damage).toBe(8);
  });
  test("only a landed lifeforce heal carries the one-use overflow marker",()=>{
    const hit=scriptedHealthProjectile(boss,player,-49,true);
    expect(consumeLifeforceHeal(player)).toBe(false);
    hit.beforeHit();
    expect(consumeLifeforceHeal(player)).toBe(true);
    expect(consumeLifeforceHeal(player)).toBe(false);
    scriptedHealthProjectile(boss,player,-10).beforeHit();
    expect(consumeLifeforceHeal(player)).toBe(false);
    expect(()=>scriptedHealthProjectile(boss,player,10,true)).toThrow(RangeError);
  });
});

test("the player-local recovery adapter preserves ordinary caps and returns full lifeforce",()=>{
  const target = {...player, currentStats:{hitpoint:90}, stats:{hitpoint:99},
    restoreHitpoints(amount:number){this.currentStats.hitpoint=Math.min(this.stats.hitpoint,this.currentStats.hitpoint+amount);}
  } as unknown as Unit & {restoreHitpoints:(amount:number)=>void};
  expect(installOcellusLifeforceRecovery(target)).toBe(true);
  target.restoreHitpoints(20);
  expect(target.currentStats.hitpoint).toBe(99);
  target.currentStats.hitpoint=90;
  scriptedHealthProjectile(boss,target,-49,true).beforeHit();
  target.restoreHitpoints(49);
  expect(target.currentStats.hitpoint).toBe(139);
  target.currentStats.hitpoint=95;
  target.restoreHitpoints(20);
  expect(target.currentStats.hitpoint).toBe(99);
  expect(installOcellusLifeforceRecovery(player)).toBe(false);
});
