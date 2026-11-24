import {test} from "node:test";
import assert from "node:assert/strict";
import {patchOcellusViewport,patchOcellusViewportInput,patchOcellusViewportGestures} from "./patch-ocellus-viewport.mjs";
const original=`
import { FirstFrame } from "./FirstFrame";
const FLOOR_Y_POS = -0.5;
    await Trainer.player.region.preload();
    this.scene = new THREE.Scene();
    const translator = (pos: Location, z = 0) => this.projectToScreen(new THREE.Vector3(pos.x, z, pos.y));
      const center = {
        x: perceivedLocation.x + r.size / 2,
        y: perceivedLocation.y - r.size / 2,
      };
      const visibilityPoints=[
        new THREE.Vector3(center.x, perceivedLocation.z, center.y),
        new THREE.Vector3(center.x, perceivedLocation.z + logicalHeight, center.y),
      ];
      return {visibilityPoints,atHeight: (height) => translator(center, perceivedLocation.z + height),};
    document.body.appendChild(this.stats.dom);
      this.stats.update();
    for (const renderable of Trainer.player.region.getRenderables()) {
    const activeRenderables = new Set(region.getRenderables());
    renderables.forEach((r) => {
      r.drawUILayer(world.tickPercent, getUILayerProjector(r), this.uiCanvasContext, SPRITE_SCALE);
      this.lastRenderTime = now;
`;
test("viewport patch preserves region state and excludes only explicit no-op markers",()=>{
 const result=patchOcellusViewport(original);
 assert.match(result,/omitFromOcellus3d === true/);
 assert.match(result,/new Set\(region.getRenderables\(\).filter/);
 assert.match(result,/if \(omitOcellusRenderActor\(r\)\) return/);
 assert.match(result,/if \(ocellusViewportDiagnostics\(\)\) document.body.appendChild/);
 assert.match(result,/__ocellusViewportMetrics/);
 assert.match(result,/this.scene.background = new THREE.Color\(0x05070b\)/);
 assert.match(result,/finiteAbyss/);
 assert.match(result,/targetX:Trainer.player\?Trainer.player.perceivedLocation.x\+\.5:null/);
 assert.match(result,/focusX:this.pivot.position.x/);
 assert.match(result,/distance:this.camera.position.z/);
 assert.match(result,/bundle.assetIds\(CacheRenderReferences.npc\(16678\)\)/);
 assert.match(result,/cachedPayload\(bundle,id\)/);
 assert.match(result,/preloadAnimationFrameSounds\(payloads.flatMap/);
 assert.match(result,/const translator = .*this.projectToClientScreen/);
 assert.doesNotMatch(result,/cameraFocalPoint|setViewOffset/);
 assert.throws(()=>patchOcellusViewport(result),/anchor changed/);
 assert.throws(()=>patchOcellusViewport(original.replace("this.stats.update();","unknown();")),/anchor changed/);
});

test("native overhead and hitsplat anchors follow the actual posed actor root",()=>{
 const out=patchOcellusViewport(original);
 const body=out.slice(out.indexOf("      const root=modelLogicalHeight"),out.indexOf("    if (ocellusViewportDiagnostics()) document.body.appendChild")).replaceAll("root!","root");
 const run=new Function("model","modelLogicalHeight","perceivedLocation","r","logicalHeight","THREE","translator",body);
 const THREE={Vector3:class{constructor(x,y,z){this.x=x;this.y=y;this.z=z;}}};
 const translator=(p,h)=>[p.x,h,p.y];
 const model={getWorldPosition:()=>({x:5.5,y:-.49,z:4.5})};
 const result=run(model,3,{x:4,y:6,z:0},{size:3},3,THREE,translator);
 assert.deepEqual(result.atHeight(3),[5.5,2.51,4.5]);
 assert.deepEqual(result.atHeight(1.5),[5.5,1.01,4.5]);
 assert.equal(result.visibilityPoints[0].y,-.49);
 const fallback=run(model,null,{x:4,y:6,z:0},{size:3},3,THREE,translator);
 assert.deepEqual(fallback.atHeight(3),[5.5,3,4.5]);
 const invalid=run({getWorldPosition:()=>({x:NaN,y:0,z:0})},3,{x:4,y:6,z:0},{size:3},3,THREE,translator);
 assert.deepEqual(invalid.atHeight(3),[5.5,3,4.5]);
});

const inputFixture=`class Viewport{
  yawDelta=0;pitchDelta=0;touchStart={};touchStart2={};
  clientCameraRotation={setMiddleMouseDown:()=>{}};
  onKeyDown(e: KeyboardEvent) {
    if(e.key==="ArrowLeft")this.yawDelta=-2;
    if(e.key==="ArrowUp")this.pitchDelta=-1;
  }
  onWindowBlur() {
    this.clientCameraRotation.setMiddleMouseDown(false);
  }
  visibility(){
      if (document.visibilityState === "hidden") {
        this.renderingSuspended=true;
      }
  }
  events(canvas){
    canvas.addEventListener("touchend", this.onDocumentTouchEnd.bind(this), false);
  }
  onDocumentTouchEnd(){this.touchStart=null;this.touchStart2=null;}
  resize(width: number, height: number) {
    this.dimensions={width,height};
  }
  render(){
      this.renderer.render(this.scene, this.camera);
      return { kind: "rendered" };
  }
  restore(){
      console.warn("[osrs-sdk] WebGL context restored; Three.js resources may need rebuilding");
      this.nextRenderTime = 0;
  }
}`;
function inputHarness(){
 class Element{constructor(editable=false){this.editable=editable;}closest(){return this.editable?this:null;}}
 const out=patchOcellusViewportInput(inputFixture).replace("e: KeyboardEvent","e").replaceAll(": number","");
 const Viewport=new Function("Element","document","console",out+";return Viewport")(Element,{visibilityState:"hidden"},{warn(){}});
 return {Viewport,Element,out};
}
test("camera keyboard remains active in gameplay, not while editing settings or using shortcuts",()=>{
 const {Viewport,Element}=inputHarness(),v=new Viewport();
 v.onKeyDown({key:"ArrowLeft",target:new Element(true)});assert.equal(v.yawDelta,0);
 v.onKeyDown({key:"ArrowUp",target:new Element(),ctrlKey:true});assert.equal(v.pitchDelta,0);
 v.onKeyDown({key:"ArrowUp",target:new Element(),defaultPrevented:true});assert.equal(v.pitchDelta,0);
 v.onKeyDown({key:"ArrowLeft",target:new Element()});assert.equal(v.yawDelta,-2);
 v.onKeyDown({key:"ArrowUp",target:new Element()});assert.equal(v.pitchDelta,-1);
 v.visibility();assert.equal(v.yawDelta,0);assert.equal(v.pitchDelta,0);
 assert.equal(v.touchStart,null);assert.equal(v.touchStart2,null);
});
test("cancelled touch and valid rounded dimensions survive context recovery",()=>{
 const {Viewport,out}=inputHarness(),v=new Viewport();
 v.resize(799.7,601.3);assert.deepEqual(v.dimensions,{width:800,height:601});
 v.resize(0,400);v.resize(NaN,600);assert.deepEqual(v.dimensions,{width:800,height:601});
 const handlers={};v.events({addEventListener:(name,fn)=>{handlers[name]=fn;}});handlers.touchcancel();
 assert.equal(v.touchStart,null);assert.equal(v.touchStart2,null);
 v.renderFailureLogged=true;v.renderer={render(){}};v.render();assert.equal(v.renderFailureLogged,false);
 v.renderFailureLogged=true;v.nextRenderTime=123;v.restore();assert.equal(v.renderFailureLogged,false);assert.equal(v.nextRenderTime,0);
 assert.throws(()=>patchOcellusViewportInput(out),/anchor changed/);
});

const gestureFixture="  onDocumentMouseWheel(e: WheelEvent) {\n    if (this.outsideGameView(e.clientX, e.clientY)) return;\n    const v = this.camera.position.z + e.deltaY * ZOOM_MULT;\n    if (v >= 2 && v <= 20) {\n      this.camera.position.z = v;\n      this.orbitZoomOffset = v - cameraOrbitDistance(this.pitch.rotation.x);\n    }\n    e.preventDefault();\n    return false;\n  }\n\n  onDocumentTouchStart(e: TouchEvent) {\n    if (e.touches.length >= 1 && this.outsideGameView(e.touches[0].clientX, e.touches[0].clientY)) {\n      this.touchStart = null;\n      this.touchStart2 = null;\n      return;\n    }\n    if (e.touches.length >= 1) {\n      this.touchStart = e.touches[0];\n    }\n    if (e.touches.length === 2) {\n      this.touchStart2 = e.touches[1];\n    }\n  }\n\n  onDocumentTouchMove(e: TouchEvent) {\n    if (!this.touchStart) {\n      return;\n    }\n    if (e.touches.length === 1) {\n      // drag - rotate\n      const deltaX = (e.touches[0].clientX - this.touchStart.clientX) * TOUCH_MULT;\n      const deltaY = (e.touches[0].clientY - this.touchStart.clientY) * TOUCH_MULT;\n      this.yaw.rotation.y -= deltaX * ROTATE_MULT;\n      const v = this.pitch.rotation.x - deltaY * ROTATE_MULT;\n      this.pitch.rotation.x = Math.max(this.minimumCameraPitch, Math.min(this.maximumCameraPitch, v));\n      this.touchStart = e.touches[0];\n    } else if (e.touches.length === 2 && this.touchStart2 !== null) {\n      // pinch - zoom\n      const oldDist = Pathing.dist(\n        this.touchStart.clientX,\n        this.touchStart.clientY,\n        this.touchStart2.clientX,\n        this.touchStart2.clientY,\n      );\n      const currentDist = Pathing.dist(\n        e.touches[0].clientX,\n        e.touches[0].clientY,\n        e.touches[1].clientX,\n        e.touches[1].clientY,\n      );\n      const delta = (oldDist - currentDist) * TOUCH_MULT;\n      const v = this.camera.position.z + delta * ZOOM_MULT;\n      if (v >= 2 && v <= 20) {\n        this.camera.position.z = v;\n        this.orbitZoomOffset = v - cameraOrbitDistance(this.pitch.rotation.x);\n      }\n      this.touchStart = e.touches[0];\n      this.touchStart2 = e.touches[1];\n    }\n    e.preventDefault();\n    return false;\n  }\n\n  onDocumentTouchEnd(e: TouchEvent) {\n    this.touchStart = null;\n    this.touchStart2 = null;\n  }\n\n";
function gestureHarness(){
 const body=patchOcellusViewportGestures(gestureFixture).replaceAll("private ","").replaceAll(": number","").replaceAll(": WheelEvent","").replaceAll(": TouchEvent","").replaceAll("this.touchStart!","this.touchStart").replaceAll("this.touchStart2!","this.touchStart2");
 const Viewport=new Function("cameraOrbitDistance","ZOOM_MULT","ROTATE_MULT","TOUCH_MULT",
  "return class { camera={position:{z:10}}; pitch={rotation:{x:-1}}; yaw={rotation:{y:0}}; touchStart=null;touchStart2=null; canvasDimensions={height:600};minimumCameraPitch=-1.5;maximumCameraPitch=-.3;outsideGameView(){return false;} "+body+"}")(x=>10,.005,.006,2);
 return new Viewport();
}
test("wheel zoom clamps at both existing limits, reverses immediately and preserves shortcut zoom",()=>{
 const v=gestureHarness(),event={preventDefault(){},deltaMode:0};
 v.onDocumentMouseWheel({...event,deltaY:9999});assert.equal(v.camera.position.z,20);
 v.onDocumentMouseWheel({...event,deltaY:-100});assert.equal(v.camera.position.z,19.5);
 v.onDocumentMouseWheel({...event,deltaY:-9999});assert.equal(v.camera.position.z,2);
 v.onDocumentMouseWheel({...event,deltaMode:1,deltaY:1});assert.equal(v.camera.position.z,2.08);
 v.onDocumentMouseWheel({...event,deltaMode:2,deltaY:1});assert.equal(v.camera.position.z,5.08);
 v.onDocumentMouseWheel({...event,deltaY:500,ctrlKey:true});assert.equal(v.camera.position.z,5.08);
});
test("pinch tracks touch identity and seamlessly rebases remaining finger",()=>{
 const v=gestureHarness(),touch=(identifier,clientX,clientY)=>({identifier,clientX,clientY});
 const event=(touches,type="touchmove")=>({touches,type,preventDefault(){}});
 v.onDocumentTouchStart(event([touch(1,0,0),touch(2,30,40)]));
 v.onDocumentTouchMove(event([touch(2,60,80),touch(1,0,0)]));
 assert.equal(v.camera.position.z,9.5);assert.equal(v.yaw.rotation.y,0);
 v.onDocumentTouchEnd(event([touch(2,60,80)],"touchend"));
 v.onDocumentTouchMove(event([touch(2,70,80)]));assert.equal(v.yaw.rotation.y,-.12);
 v.onDocumentTouchEnd(event([touch(2,70,80)],"touchcancel"));
 assert.equal(v.touchStart,null);assert.equal(v.touchStart2,null);
 assert.throws(()=>patchOcellusViewportGestures(patchOcellusViewportGestures(gestureFixture)),/anchor changed/);
});
