#!/usr/bin/env node
/** Ocellus-only starting camera calibration. Patch the temporary pinned SDK,
 * not Sol's SDK or the upstream repository. */
import {readFileSync,writeFileSync} from "node:fs";
import {fileURLToPath} from "node:url";

// Boss anchor (4,6), size 3, gives the centre (5,5) in SDK tile coordinates.
// Preserve the prior +1.25 tile bias at spawn (5,1). Everywhere else move
// toward the centre, not always south. Blend gently when close to the boss.
export function ocellusFocus(location) {
  const dx=5-location.x,dy=5-location.y;
  const distance=Math.hypot(dx,dy);
  const blend=distance>0?Math.min(.3125,1.25/distance):0;
  return {...location,x:location.x+dx*blend,y:location.y+dy*blend};
}
export function patchOcellusCamera(source) {
  let next=source;
  const replace=(from,to)=>{
    if(next.split(from).length!==2)throw Error("Pinned SDK camera anchor changed: "+from);
    next=next.replace(from,to);
  };
  replace("const FLOOR_Y_POS = -0.5;","const FLOOR_Y_POS = -0.5;\n\n"+
    ocellusFocus.toString().replace("ocellusFocus(location)","ocellusFocus(location: {x:number;y:number})"));
  replace("this.pitch.rotation.x = -0.7;","this.pitch.rotation.x = -1.05;");
  replace("this.cameraFocalPoint.follow(Trainer.player.perceivedLocation, timestamp);",
    "this.cameraFocalPoint.follow(ocellusFocus(Trainer.player.perceivedLocation), timestamp);");
  replace("this.cameraFocalPoint.initialise(Trainer.player.perceivedLocation, now);",
    "this.cameraFocalPoint.initialise(ocellusFocus(Trainer.player.perceivedLocation), now);");
  return next;
}
if(process.argv[1]===fileURLToPath(import.meta.url)){
  const path=process.argv[2];
  if(!path)throw Error("Expected pinned SDK Viewport3d.ts");
  writeFileSync(path,patchOcellusCamera(readFileSync(path,"utf8")));
  console.log("Ocellus camera: calibrated pitch and bounded boss-relative focal bias");
}
