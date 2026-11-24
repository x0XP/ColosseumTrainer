import {test} from "node:test";
import assert from "node:assert/strict";
import {ocellusFocus,patchOcellusCamera} from "./patch-ocellus-camera.mjs";
const original=`
const FLOOR_Y_POS = -0.5;
this.pitch.rotation.x = -0.7;
this.cameraFocalPoint.follow(Trainer.player.perceivedLocation, timestamp);
this.cameraFocalPoint.initialise(Trainer.player.perceivedLocation, now);
`;
test("initial spawn retains the calibrated framing and the centre never moves",()=>{
 assert.deepEqual(ocellusFocus({x:5,y:1,z:0}),{x:5,y:2.25,z:0});
 assert.deepEqual(ocellusFocus({x:5,y:5}),{x:5,y:5});
});
test("camera focus is bounded and points toward Ocellus from every side",()=>{
 for(const x of [0,3,5,7,13])for(const y of [0,3,5,7,12]){
  const at={x,y},p=ocellusFocus(at);
  assert.ok(Math.hypot(p.x-x,p.y-y)<=1.25+1e-9);
  assert.ok(Math.hypot(p.x-5,p.y-5)<=Math.hypot(x-5,y-5));
  assert.ok(p.x>=Math.min(x,5)&&p.x<=Math.max(x,5));
  assert.ok(p.y>=Math.min(y,5)&&p.y<=Math.max(y,5));
 }
 assert.ok(ocellusFocus({x:5,y:9}).y<9);
 assert.ok(ocellusFocus({x:9,y:5}).x<9);
});
test("camera initialisation and following share the same focus and unknown SDK source fails closed",()=>{
 const out=patchOcellusCamera(original);
 assert.match(out,/ocellusFocus\(location: \{x:number;y:number\}\)/);
 assert.match(out,/follow\(ocellusFocus\(Trainer.player.perceivedLocation\), timestamp\)/);
 assert.match(out,/initialise\(ocellusFocus\(Trainer.player.perceivedLocation\), now\)/);
 assert.throws(()=>patchOcellusCamera(out),/anchor changed/);
});
