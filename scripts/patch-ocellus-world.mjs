#!/usr/bin/env node
/** Process real movement before Ocellus samples the player's tile. Keep the
 * NPC/player hit queues in their original order and never move twice.
 * This is applied only to the temporary Ocellus SDK, not Sol's SDK. */
import {readFileSync,writeFileSync} from "node:fs";
import {fileURLToPath} from "node:url";

export function patchOcellusWorld(source) {
  const replace=(from,to)=>{
    if(source.split(from).length!==2) throw Error("Pinned SDK world anchor changed: "+from);
    source=source.replace(from,to);
  };
  replace('    region.entities.forEach((entity) => entity.tick());\n\n    if (this.getReadyTimer == 0) {', `    region.entities.forEach((entity) => entity.tick());

    // Phase 4 tile hazards sample the destination reached on this tick,
    // rather than the previous tick's tile. Ready countdown is unchanged.
    const earlyMovement = this.getReadyTimer === 0 &&
      (region as Region & {ocellusMovementBeforeHazards?: boolean}).ocellusMovementBeforeHazards === true;
    if (earlyMovement) {
      region.players.forEach((player: Player) => {
        player.timerStep();
        player.movementStep();
        region.refreshUnitChunk(player);
      });
    }

    if (this.getReadyTimer == 0) {`);
  replace('      player.timerStep();\n      player.movementStep();\n      region.refreshUnitChunk(player);\n      if (this.getReadyTimer <= 0) {', `      if (!earlyMovement) {
        player.timerStep();
        player.movementStep();
        region.refreshUnitChunk(player);
      }
      if (this.getReadyTimer <= 0) {`);
  return source;
}
if(process.argv[1]===fileURLToPath(import.meta.url)){
 const path=process.argv[2];
 if(!path)throw Error("Expected pinned SDK World.ts");
 writeFileSync(path,patchOcellusWorld(readFileSync(path,"utf8")));
 console.log("Ocellus world: resolve movement before tile hazards; retain hit queue order");
}
