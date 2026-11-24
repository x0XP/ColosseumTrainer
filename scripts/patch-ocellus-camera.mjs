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
  return source.replace(pitch,"this.pitch.rotation.x = MIN_CAMERA_PITCH;");
}

/** Keep the orbit offset consistent with the visible clamped distance.
 * A pitch change at a zoom limit must not accumulate invisible zoom debt. */
export function patchOcellusOrbitLimits(source){
 const anchor=`    this.camera.position.z = Math.max(
      2,
      Math.min(20, cameraOrbitDistance(this.pitch.rotation.x) + this.orbitZoomOffset),
    );`;
 if(source.split(anchor).length!==2)throw Error("Pinned SDK orbit limit anchor changed");
 return source.replace(anchor,`    const baseDistance=cameraOrbitDistance(this.pitch.rotation.x);
    const requested=baseDistance+this.orbitZoomOffset;
    const distance=Math.max(2,Math.min(20,requested));
    this.camera.position.z=distance;
    if(distance!==requested)this.orbitZoomOffset=distance-baseDistance;`);
}

/** RuneLite Perspective.localToCanvas rejects depth below 50 local units.
 * The SDK world uses tiles (128 local units). Keep FOV/zoom unchanged until
 * an actual client getScale and viewport-height measurement is available. */
export function patchOcellusNearPlane(source){
 const anchor="new THREE.PerspectiveCamera(70, this.canvasDimensions.width / this.canvasDimensions.height, 0.1, 50)";
 if(source.split(anchor).length!==2)throw Error("Pinned SDK camera projection anchor changed");
 return source.replace(anchor,"new THREE.PerspectiveCamera(70, this.canvasDimensions.width / this.canvasDimensions.height, 50 / 128, 50)");
}

/** Keep the desktop projection unchanged, but fit narrow portrait displays
 * horizontally. The original player-follow pivot and input are preserved. */
export function ocellusViewportFov(width,height){
 const desktopScale=height/(2*Math.tan(70*Math.PI/360));
 const limit=Math.max(1,width)*1.02;
 if(desktopScale<=limit)return 70;
 const scale=limit;
 return Math.min(110,Math.atan(height/(2*scale))*360/Math.PI);
}
export function patchOcellusPortraitProjection(source){
 const anchor="    this.camera.aspect = width / height;\n    this.camera.updateProjectionMatrix();";
 if(source.split(anchor).length!==2)throw Error("Pinned SDK portrait projection anchor changed");
 const helper=ocellusViewportFov.toString().replace("ocellusViewportFov(width,height)","ocellusViewportFov(width:number,height:number)");
 return helper+"\n"+source.replace(anchor,"    this.camera.aspect = width / height;\n    this.camera.fov = ocellusViewportFov(width,height);\n    this.camera.updateProjectionMatrix();");
}
if(process.argv[1]===fileURLToPath(import.meta.url)){
  const path=process.argv[2];
  if(!path)throw Error("Expected pinned SDK Viewport3d.ts");
  writeFileSync(path,patchOcellusPortraitProjection(patchOcellusNearPlane(patchOcellusOrbitLimits(patchOcellusCamera(readFileSync(path,"utf8"))))));
  console.log("Ocellus camera: calibrated starting pitch; native player-follow, zoom and rotation retained");
}
