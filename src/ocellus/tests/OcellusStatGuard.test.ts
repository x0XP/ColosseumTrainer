import {installOcellusStatGuard,minimumOcellusDefence,OCELLUS_DEMONBANE_EFFECTIVENESS} from "../OcellusStatGuard";
import {installOcellusDeflection} from "../OcellusDeflection";
import {installOcellusExplosionReduction} from "../OcellusExplosionCombat";
import {stageAt} from "../Phase4Rules";

const stats=()=>({attack:325,strength:250,defence:250,range:300,magic:300,hitpoint:1313});
test("repeated warhammer-style drains stop at level 150 immediately after each hit",()=>{
 const target=stats();
 const hit={damage:35,beforeHit(){target.defence-=Math.floor(target.defence*.3);}};
 installOcellusStatGuard(hit,()=>target,stats,false);
 hit.beforeHit();expect(target.defence).toBe(175);
 hit.beforeHit();expect(target.defence).toBe(150);
 hit.beforeHit();expect(target.defence).toBe(150);
 expect(minimumOcellusDefence(250)).toBe(150);
});
test("a blocked weapon callback cannot drain any combat stat",()=>{
 const target=stats();let callbacks=0;
 const hit={damage:40,attackStyle:"crush",beforeHit(){
  callbacks++;expect(this.damage).toBe(0);
  target.attack-=15;target.strength-=20;target.defence-=75;
 }};
 const blocked=installOcellusDeflection(hit,stageAt(8));
 installOcellusExplosionReduction(hit,()=>stageAt(17));
 installOcellusStatGuard(hit,()=>target,stats,blocked);
 hit.beforeHit();
 expect(callbacks).toBe(1);expect(hit.damage).toBe(0);expect(target).toEqual(stats());
});
test("unblocked successful zero-hit drain and explosion mitigation keep their separate rules",()=>{
 const target=stats();
 const hit={damage:0,beforeHit(){target.attack-=16;target.defence-=120;}};
 installOcellusStatGuard(hit,()=>target,stats,false);
 hit.beforeHit();
 expect(target.attack).toBe(309);expect(target.defence).toBe(150);
 expect(hit.damage).toBe(0);
});

test("the later offensive stat cap retains at least half the original levels",()=>{
 const target=stats();
 const hit={damage:30,beforeHit(){target.attack=0;target.strength=0;target.range=0;target.magic=0;target.defence=0;}};
 installOcellusStatGuard(hit,()=>target,stats,false);
 hit.beforeHit();
 expect(target).toEqual({attack:163,strength:125,defence:150,range:150,magic:150,hitpoint:1313});
 expect(OCELLUS_DEMONBANE_EFFECTIVENESS).toBe(.8);
});
