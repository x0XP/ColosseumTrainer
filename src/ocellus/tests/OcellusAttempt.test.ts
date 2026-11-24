import {attemptSeed,attemptMetrics,formatAttemptTime} from "../OcellusAttempt";
import type {FightStats} from "../Phase4Simulation";
const stats:FightStats={drained:80,returned:40,explosionsDodged:7,explosionsTotal:9,specialsDefended:2,specialsTotal:3,riftsKilled:1,riftsSpawned:2,damageTaken:18,cycles:2};
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
  ["Explosions dodged",7,9],["Specials defended",2,3],["Void rifts destroyed",1,2]
 ]);
 expect(formatAttemptTime(99)).toBe("01:00");
 expect(formatAttemptTime(0)).toBe("00:00");
});
