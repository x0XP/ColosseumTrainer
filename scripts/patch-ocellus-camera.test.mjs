import {test} from "node:test";
import assert from "node:assert/strict";
import {patchOcellusCamera,patchOcellusOrbitLimits,patchOcellusNearPlane,ocellusViewportFov,ocellusPortraitOffset,patchOcellusPortraitProjection} from "./patch-ocellus-camera.mjs";
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
 assert.equal(out,original.replace("this.pitch.rotation.x = -0.7;","this.pitch.rotation.x = MIN_CAMERA_PITCH;"));
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

test("pitch changes at both zoom limits have no invisible accumulated offset",()=>{
 const fixture=`    this.camera.position.z = Math.max(
      2,
      Math.min(20, cameraOrbitDistance(this.pitch.rotation.x) + this.orbitZoomOffset),
    );`;
 const out=patchOcellusOrbitLimits(fixture),run=new Function("cameraOrbitDistance",out);
 const state={camera:{position:{z:0}},pitch:{rotation:{x:9}},orbitZoomOffset:15};
 run.call(state,x=>x);
 assert.equal(state.camera.position.z,20);assert.equal(state.orbitZoomOffset,11);
 state.pitch.rotation.x=8;run.call(state,x=>x);assert.equal(state.camera.position.z,19);
 state.orbitZoomOffset=-20;run.call(state,x=>x);
 assert.equal(state.camera.position.z,2);assert.equal(state.orbitZoomOffset,-6);
 state.pitch.rotation.x=9;run.call(state,x=>x);assert.equal(state.camera.position.z,3);
 assert.throws(()=>patchOcellusOrbitLimits(out),/anchor changed/);
});

test("RuneLite near clipping is 50 local units in a 128-unit tile, without changing FOV",()=>{
 const input="new THREE.PerspectiveCamera(70, this.canvasDimensions.width / this.canvasDimensions.height, 0.1, 50)";
 const out=patchOcellusNearPlane(input);
 const THREE={PerspectiveCamera:class{constructor(fov,aspect,near,far){Object.assign(this,{fov,aspect,near,far})}}};
 const camera=new Function("THREE","return "+out).call({canvasDimensions:{width:800,height:600}},THREE);
 assert.equal(camera.near*128,50);
 assert.equal(camera.fov,70);assert.equal(camera.far,50);assert.equal(camera.aspect,800/600);
 assert.throws(()=>patchOcellusNearPlane(out),/anchor changed/);
});

test("portrait projection fits the horizontal arena without altering desktop FOV or player target",()=>{
 assert.ok(Math.abs(ocellusViewportFov(1038,713)-70)<1e-9);
 assert.ok(ocellusViewportFov(390,720)>80);
 assert.ok(ocellusViewportFov(320,1000)<=110);
 const out=patchOcellusPortraitProjection("    this.camera.aspect = width / height;\n    this.camera.updateProjectionMatrix();");
 assert.match(out,/ocellusViewportFov\(width,height\)/);
 assert.equal(ocellusPortraitOffset(390,720),58);
 assert.equal(ocellusPortraitOffset(1038,713),0);
 assert.equal(ocellusPortraitOffset(450,320),0);
 assert.match(out,/this.camera.setViewOffset\(width,height,0,-offset,width,height\)/);
 assert.throws(()=>patchOcellusPortraitProjection(out),/anchor changed/);
});
