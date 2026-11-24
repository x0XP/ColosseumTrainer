import {test} from "node:test";
import assert from "node:assert/strict";
import {patchOcellusCamera} from "./patch-ocellus-camera.mjs";
const original=`
const FLOOR_Y_POS = -0.5;
private orbitZoomOffset = 0;
this.pitch.rotation.x = -0.7;
this.camera.position.z = cameraOrbitDistance(this.pitch.rotation.x);
this.cameraFocalPoint.follow(Trainer.player.perceivedLocation, timestamp);
this.cameraFocalPoint.initialise(Trainer.player.perceivedLocation, now);
this.applyCameraFocalPosition(this.cameraFocalPoint.getPerceivedPosition(now));
this.cameraFocalPoint.reset();
this.camera.updateProjectionMatrix();
`;
test("only initial pitch changes; native player-follow and all other controls stay identical",()=>{
 const out=patchOcellusCamera(original);
 assert.equal(out,original.replace("this.pitch.rotation.x = -0.7;","this.pitch.rotation.x = -1.05;"));
 assert.ok(!out.includes("ocellusFocus"));
 assert.ok(!out.includes("setViewOffset"));
});
test("both initialisation and subsequent ticks must use the native player position",()=>{
 for(const anchor of [
  "this.cameraFocalPoint.follow(Trainer.player.perceivedLocation, timestamp);",
  "this.cameraFocalPoint.initialise(Trainer.player.perceivedLocation, now);"
 ]){
  assert.throws(()=>patchOcellusCamera(original.replace(anchor,"other();")),/anchor changed/);
 }
 assert.throws(()=>patchOcellusCamera(patchOcellusCamera(original)),/anchor changed/);
});
