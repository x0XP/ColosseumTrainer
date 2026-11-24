import {attemptSeed,attemptMetrics,formatAttemptTime,damageBreakdown,attemptPercentage} from "../OcellusAttempt";
import {emptyFightStats,recordMechanicDamage} from "../Phase4Simulation";
import type {FightStats} from "../Phase4Simulation";
const stats:FightStats={...emptyFightStats(),fragmentsSpawned:4,fragmentsCollected:2,speedBonusDodges:5,drained:80,returned:40,explosionsDodged:7,explosionsTotal:9,specialsDefended:2,specialsTotal:3,riftsKilled:1,riftsSpawned:2,damageTaken:18,cycles:2};
test("CI seed is explicitly fixed, normal attempts consume new random values",()=>{
 let draws=0;
 const random=()=>++draws/10;
 expect(attemptSeed(42,random)).toBe(42);
 expect(draws).toBe(0);
 const first=attemptSeed(undefined,random),second=attemptSeed(undefined,random);
 expect(first).not.toBe(second);
 expect(draws).toBe(2);
 expect(first).toBeGreaterThanOrEqual(0);
 expect(second).toBeLessThan(0x100000000);
});
test("live and final attempt metrics use the same ordered successful/total values",()=>{
 expect(attemptMetrics(stats).map(s=>[s.label,s.good,s.total])).toEqual([
  ["Explosions dodged",7,9],["Specials defended",2,3],["Void rifts destroyed",1,2],["Fragments collected",2,4],["Speed-bonus dodges",5,9]
 ]);
 expect(formatAttemptTime(99)).toBe("01:00");
 expect(formatAttemptTime(0)).toBe("00:00");
});

test("damage categories add up without counting lifeforce twice",()=>{
 const stats=emptyFightStats();
 for(const [reason,amount] of [["Lifeforce drain",49],["Void floor",10],["Lingering void",9],["Void explosion",15],["Protected melee special",7],["Unprotected range special",48],["Void Rift eruption",30]] as const)recordMechanicDamage(stats,reason,amount);
 stats.drained=49;
 expect(stats.damageTaken).toBe(168);
 expect(damageBreakdown(stats).map(x=>x.amount)).toEqual([49,10,9,15,7,48,30]);
 expect(damageBreakdown(stats).reduce((sum,row)=>sum+row.amount,0)).toBe(stats.damageTaken);
 expect(Object.values(emptyFightStats()).every(v=>v===0)).toBe(true);
});

test("presentation ratios keep raw counts and distinguish no attempts from failed attempts",()=>{
 expect(attemptPercentage(0,0)).toBeNull();
 expect(attemptPercentage(0,4)).toBe(0);
 expect(attemptPercentage(7,9)).toBe(78);
 expect(attemptPercentage(10,4)).toBe(100);
 expect(attemptPercentage(-1,4)).toBe(0);
 expect(attemptPercentage(NaN,4)).toBeNull();
 expect(attemptPercentage(2,Infinity)).toBeNull();
});
