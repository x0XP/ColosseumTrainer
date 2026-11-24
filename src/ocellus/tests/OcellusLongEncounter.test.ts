import {Phase4Simulation,emptyFightStats} from "../Phase4Simulation";
import {FLOOR_TILES,inNearSquare,inBossFootprint,inPlatform,isHole,distance,stageAt,specialStyle,random01} from "../Phase4Rules";
import {damageBreakdown} from "../OcellusAttempt";
import type {GamePrayer,FrameResult} from "../Phase4Simulation";
import type {Tile} from "../Phase4Rules";

const key=(at:Tile)=>at.x+":"+at.y;
const cycles=10;
const finalTick=8+60*cycles-1;
const expectedRifts=Array.from({length:cycles},(_,i)=>Math.min(5,i+2)).reduce((a,b)=>a+b,0);

// Deliberately use supplied HP samples rather than pretending to be a
// legitimate fight completion. This test stresses every mechanic over a
// long encounter, even when the sampled player would have died in-game.
function replay(seed:number,check:boolean) {
  const sim=new Phase4Simulation(seed);
  const trace:FrameResult[]=[];
  let killed=0,detonated=0;
  for(let tick=0;tick<=finalTick;tick++){
    const frame=stageAt(tick);
    const position=FLOOR_TILES[Math.floor(random01(seed,tick,91)*FLOOR_TILES.length)];
    const hp=1+Math.floor(random01(seed,tick,92)*160);
    const prayer:GamePrayer=frame.cycle>0&&tick%3===0?specialStyle(seed,frame.cycle,frame.offset===57?1:0):null;
    const result=sim.step(position,hp,prayer);
    trace.push(result);
    const active=result.rifts;
    const bursts=result.effects.filter(e=>e.kind==="rift-detonate");
    detonated+=bursts.length;
    if(check){
      expect(result.frame.tick).toBe(tick);
      expect(sim.upcoming().tick).toBe(tick+1);
      expect(result.marks.length).toBeLessThanOrEqual(1);
      expect(result.orbs.length).toBeLessThanOrEqual(1);
      expect(active.length).toBeLessThanOrEqual(5);
      expect(new Set(active.map(r=>key(r.tile))).size).toBe(active.length);
      for(const rift of active){
        expect(inPlatform(rift.tile)&&!isHole(rift.tile)&&!inNearSquare(rift.tile)).toBe(true);
        expect(distance(rift.tile,{x:5,y:5})-1).toBeGreaterThanOrEqual(2);
        expect(distance(rift.tile,{x:5,y:5})-1).toBeLessThanOrEqual(5);
        expect(tick-rift.spawnedAt).toBeLessThan(30);
      }
      for(const orb of result.orbs){
        expect(inPlatform(orb.tile)&&!isHole(orb.tile)&&!inBossFootprint(orb.tile)).toBe(true);
        expect(inNearSquare(orb.tile)).toBe(orb.void==="outer");
        expect(tick).toBeLessThan(orb.expiresAt);
      }
      // Multiple simultaneous rifts produce at most one player-wide hit.
      expect(result.effects.filter(e=>e.kind==="damage"&&e.reason==="Void Rift eruption").length).toBeLessThanOrEqual(1);
      const stats=result.stats;
      expect(stats.damageTaken).toBe(damageBreakdown(stats).reduce((sum,d)=>sum+d.amount,0));
      expect(stats.explosionsDodged).toBeLessThanOrEqual(stats.explosionsTotal);
      expect(stats.speedBonusDodges).toBeLessThanOrEqual(stats.explosionsDodged);
      expect(stats.specialsDefended).toBeLessThanOrEqual(stats.specialsTotal);
      expect(stats.returned).toBeLessThanOrEqual(stats.drained);
      expect(stats.fragmentsCollected+stats.fragmentsExpired).toBeLessThanOrEqual(stats.fragmentsSpawned);
      expect(stats.riftsKilled+detonated+active.length).toBe(stats.riftsSpawned);
      let landingHp=hp;
      for(const effect of result.effects){
        if(effect.kind==="heal")landingHp+=effect.amount;
        if(effect.kind==="damage"){
          expect(effect.amount).toBeGreaterThan(0);
          expect(effect.amount).toBeLessThanOrEqual(landingHp);
          landingHp-=effect.amount;
        }
      }
    }
    // Exercise destruction and duplicate death callbacks on actual live IDs.
    if(active.length&&tick%7===0){
      const id=active[0].id;
      if(!sim.removeRift(id))throw Error("Could not remove active rift");
      killed++;
      if(sim.removeRift(id))throw Error("Duplicate rift death counted");
    }
  }
  const end=sim.snapshot();
  if(check){
    expect(end.stats.cycles).toBe(cycles);
    expect(end.stats.fragmentsSpawned).toBe(cycles*2);
    expect(end.stats.fragmentsCollected+end.stats.fragmentsExpired).toBe(cycles*2);
    expect(end.stats.explosionsTotal).toBe(cycles*12);
    expect(end.stats.specialsTotal).toBe(cycles*2);
    expect(end.stats.riftsSpawned).toBe(expectedRifts);
    expect(end.stats.riftsKilled).toBe(killed);
    expect(killed+detonated+end.rifts.length).toBe(expectedRifts);
    expect(end.orbs).toHaveLength(0);
    expect(end.marks).toHaveLength(0);
  }
  return trace;
}

describe("long encounter lifecycle",()=>{
  for(const seed of [0,1,42,0x7fffffff,0xffffffff]){
    test("ten cycles maintain mechanic and resource invariants for seed "+seed,()=>{
      replay(seed,true);
    });
  }
  test("same seed and identical inputs reproduce every event and statistic",()=>{
    expect(replay(42,false)).toEqual(replay(42,false));
    expect(replay(42,false)).not.toEqual(replay(43,false));
  });
  test("caller mutation of an emitted snapshot cannot change internal positions or counters",()=>{
    const sim=new Phase4Simulation(42);
    for(let i=0;i<=12;i++)sim.step({x:5,y:1},99,null);
    const copy=sim.snapshot();
    const original=sim.snapshot();
    (copy.orbs[0].tile as {x:number}).x=1000;
    copy.orbs[0].amount=-100;
    copy.stats.drained=-99;
    expect(sim.snapshot()).toEqual(original);
    expect(new Phase4Simulation(42).snapshot().stats).toEqual(emptyFightStats());
  });
});
