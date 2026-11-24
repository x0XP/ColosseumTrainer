import {test} from "node:test";
import assert from "node:assert/strict";
import {patchOcellusViewport,patchOcellusViewportInput} from "./patch-ocellus-viewport.mjs";
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
