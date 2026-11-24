#!/usr/bin/env node
/** Ocellus-only starting pitch. Preserve the SDK's native player-follow
 * focal point, interpolation, zoom and rotation; never track the boss. */
import {readFileSync,writeFileSync} from "node:fs";
import {fileURLToPath} from "node:url";

export function patchOcellusCamera(source) {
  const pitch="this.pitch.rotation.x = -0.7;";
  for(const anchor of [
    pitch,
    "this.cameraFocalPoint.follow(Trainer.player.perceivedLocation, timestamp);",
    "this.cameraFocalPoint.initialise(Trainer.player.perceivedLocation, now);",
  ]){
    if(source.split(anchor).length!==2)throw Error("Pinned SDK camera anchor changed: "+anchor);
  }
  return source.replace(pitch,"this.pitch.rotation.x = -1.05;");
}
if(process.argv[1]===fileURLToPath(import.meta.url)){
  const path=process.argv[2];
  if(!path)throw Error("Expected pinned SDK Viewport3d.ts");
  writeFileSync(path,patchOcellusCamera(readFileSync(path,"utf8")));
  console.log("Ocellus camera: calibrated starting pitch; native player-follow, zoom and rotation retained");
}
