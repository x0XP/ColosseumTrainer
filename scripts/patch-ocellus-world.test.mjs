import test from "node:test";
import assert from "node:assert/strict";
import {patchOcellusWorld} from "./patch-ocellus-world.mjs";

const fixture = `    region.entities.forEach((entity) => entity.tick());

    if (this.getReadyTimer == 0) {
      region.beforeNpcTurns();
      region.mobs.forEach((mob: Mob) => mob.queueStep());
    }
    region.players.forEach((player: Player) => {
      if (this.getReadyTimer <= 0) player.queueStep();
      player.timerStep();
      player.movementStep();
      region.refreshUnitChunk(player);
      if (this.getReadyTimer <= 0) {
        player.attackStep();
      }
    });`;

const patched = patchOcellusWorld(fixture);
// The fixture contains no runtime TS constructs other than these annotations.
const run = new Function("region",patched.replace(" as Region & {ocellusMovementBeforeHazards?: boolean}","").replaceAll(": Player","").replaceAll(": Mob",""));
function trace(flag,ready){
 const calls=[];
 const player={timerStep:()=>calls.push("timer"),movementStep:()=>calls.push("move"),queueStep:()=>calls.push("player-hit"),attackStep:()=>calls.push("attack")};
 run.call({getReadyTimer:ready},{ocellusMovementBeforeHazards:flag,players:[player],entities:[],mobs:[{queueStep:()=>calls.push("hazard")}],beforeNpcTurns:()=>calls.push("npc-turn"),refreshUnitChunk:()=>calls.push("chunk")});
 return calls;
}
test("marked Ocellus region: move once before the hazard, hits before attack",()=>{
 assert.deepEqual(trace(true,0),["timer","move","chunk","npc-turn","hazard","player-hit","attack"]);
});
test("unmarked regions keep original order, including Sol",()=>{
 assert.deepEqual(trace(false,0),["npc-turn","hazard","player-hit","timer","move","chunk","attack"]);
});
test("ready countdown moves once without running combat",()=>{
 assert.deepEqual(trace(true,1),["timer","move","chunk"]);
});
test("refuse unexpected SDK source",()=>{
 assert.throws(()=>patchOcellusWorld(""),/anchor changed/);
});
