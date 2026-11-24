#!/usr/bin/env node
/** Ocellus-only viewport optimisation for the temporary pinned SDK checkout.
 * Keep logical entities in Region.entities; only skip their known no-op 3D
 * rendering/projection path. Sol's SDK build is not changed.
 */
import {readFileSync,writeFileSync} from "node:fs";
import {fileURLToPath} from "node:url";
export function patchOcellusViewport(source){
  let next=source;
  const replace=(from,to)=>{
    if(next.split(from).length!==2)throw Error("Pinned SDK viewport anchor changed: "+from);
    next=next.replace(from,to);
  };
  replace('const FLOOR_Y_POS = -0.5;',`const FLOOR_Y_POS = -0.5;

function omitOcellusRenderActor(renderable:Renderable):boolean {
  return (renderable as Renderable & {omitFromOcellus3d?:boolean}).omitFromOcellus3d === true;
}
function ocellusViewportDiagnostics():boolean {
  return window.location.hostname === "127.0.0.1" && window.location.search === "?ocellus-ci=1";
}`);
  // Warm the late-spawning NPC's actual decoded payload and native frame
  // sounds before the first encounter. Keep the real actor creation at spawn.
  replace('import { FirstFrame } from "./FirstFrame";',`import { FirstFrame } from "./FirstFrame";
import { CacheRender } from "./rendering/CacheRenderBundle";
import { CacheRenderReferences } from "./rendering/CacheRenderReference";
import { cachedPayload } from "./rendering/utils/payloadUtils";
import { preloadAnimationFrameSounds } from "./rendering/AnimationFrameSounds";`);
  replace('    await Trainer.player.region.preload();',`    await Promise.all([
      Trainer.player.region.preload(),
      (async () => {
        const bundle=await CacheRender.bundle();
        const ids=bundle.assetIds(CacheRenderReferences.npc(16678));
        const payloads=await Promise.all(ids.map(id=>cachedPayload(bundle,id)));
        await preloadAnimationFrameSounds(payloads.flatMap(p=>Object.values(p.animations??{})));
      })(),
    ]);`);
  // Native integer-pixel HUD projection; picking and camera unchanged.
  replace('const translator = (pos: Location, z = 0) => this.projectToScreen(new THREE.Vector3(pos.x, z, pos.y));',
    'const translator = (pos: Location, z = 0) => this.projectToClientScreen(new THREE.Vector3(pos.x, z, pos.y));');
  // Project the actual posed cache actor root, not the displaced tile origin.
  // Leave fallback/sprite projectors and the camera untouched.
  replace(`      const center = {
        x: perceivedLocation.x + r.size / 2,
        y: perceivedLocation.y - r.size / 2,
      };`,`      const root=modelLogicalHeight!=null?model?.getWorldPosition():undefined;
      const anchored=!!root&&[root.x,root.y,root.z].every(Number.isFinite);
      const center=anchored?{x:root!.x,y:root!.z}:{
        x:perceivedLocation.x+r.size/2,y:perceivedLocation.y-r.size/2,
      };
      const baseY=anchored?root!.y:perceivedLocation.z;`);
  replace("new THREE.Vector3(center.x, perceivedLocation.z, center.y)","new THREE.Vector3(center.x, baseY, center.y)");
  replace("new THREE.Vector3(center.x, perceivedLocation.z + logicalHeight, center.y)","new THREE.Vector3(center.x, baseY + logicalHeight, center.y)");
  replace("atHeight: (height) => translator(center, perceivedLocation.z + height),","atHeight: (height) => translator(center, baseY + height),");
  // Match the arena's abyss without a finite world plane/horizon.
  replace('    this.scene = new THREE.Scene();','    this.scene = new THREE.Scene();\n    this.scene.background = new THREE.Color(0x05070b);');
  replace('    document.body.appendChild(this.stats.dom);', '    if (ocellusViewportDiagnostics()) document.body.appendChild(this.stats.dom);');
  replace('      this.stats.update();', '      if (ocellusViewportDiagnostics()) this.stats.update();');
  replace('    for (const renderable of Trainer.player.region.getRenderables()) {', '    for (const renderable of Trainer.player.region.getRenderables()) {\n      if (omitOcellusRenderActor(renderable)) continue;');
  replace('    const activeRenderables = new Set(region.getRenderables());', '    const activeRenderables = new Set(region.getRenderables().filter(renderable=>!omitOcellusRenderActor(renderable)));');
  replace('    renderables.forEach((r) => {\n      r.drawUILayer(world.tickPercent, getUILayerProjector(r), this.uiCanvasContext, SPRITE_SCALE);', '    renderables.forEach((r) => {\n      if (omitOcellusRenderActor(r)) return;\n      r.drawUILayer(world.tickPercent, getUILayerProjector(r), this.uiCanvasContext, SPRITE_SCALE);');
  replace('      this.lastRenderTime = now;', `      if (ocellusViewportDiagnostics()) {
        const debugWindow = window as Window & {__ocellusViewportMetrics?: {
          actors:number; calls:number; triangles:number; abyss:string|null;
          finiteAbyss:boolean; innerVoid:boolean; outerVoid:boolean;
          rims:Array<{name:string;vertices:number;channels:number;colour:string;alphaEdge:number;alphaFade:number;normalBlend:boolean;depthWrite:boolean}>;
          camera:{focusX:number;focusY:number;targetX:number|null;targetY:number|null;yaw:number;pitch:number;distance:number;canvasWidth:number;canvasHeight:number};
        }};
        const renderInfo = this.renderer.info.render;
        const rims=["ocellus-inner-void","ocellus-outer-void"].flatMap(name=>{
          const rim=this.scene.getObjectByName(name)?.getObjectByName("ocellus-void-rim") as THREE.Mesh|undefined;
          if(!rim)return [];
          const c=rim.geometry.getAttribute("color"),m=rim.material as THREE.MeshBasicMaterial;
          return [{name,vertices:c.count,channels:c.itemSize,colour:new THREE.Color(c.getX(0),c.getY(0),c.getZ(0)).getHexString(),alphaEdge:c.getW(0),alphaFade:c.getW(2),normalBlend:m.blending===THREE.NormalBlending,depthWrite:m.depthWrite}];
        });
        debugWindow.__ocellusViewportMetrics = {
          actors:this.knownActors.size, calls:renderInfo.calls, triangles:renderInfo.triangles,
          abyss:this.scene.background instanceof THREE.Color ? this.scene.background.getHexString() : null,
          finiteAbyss:!!this.scene.getObjectByName("ocellus-abyss"),
          innerVoid:this.scene.getObjectByName("ocellus-inner-void")?.visible===true,
          outerVoid:this.scene.getObjectByName("ocellus-outer-void")?.visible===true,
          rims,
          camera:{
            focusX:this.pivot.position.x,focusY:this.pivot.position.z,
            targetX:Trainer.player?Trainer.player.perceivedLocation.x+.5:null,
            targetY:Trainer.player?Trainer.player.perceivedLocation.y-.5:null,
            yaw:this.yaw.rotation.y,pitch:this.pitch.rotation.x,distance:this.camera.position.z,
            canvasWidth:this.canvasDimensions.width,canvasHeight:this.canvasDimensions.height,
          },
        };
      }
      this.lastRenderTime = now;`);
  return next;
}
/** Isolate camera controls from settings fields and modal UI. */
export function patchOcellusViewportInput(source){
 let next=source;
 const replace=(a,b)=>{if(next.split(a).length!==2)throw Error("Pinned SDK viewport input anchor changed: "+a);next=next.replace(a,b);};
 replace("  onKeyDown(e: KeyboardEvent) {",`  onKeyDown(e: KeyboardEvent) {
    const target=e.target;
    if(e.defaultPrevented||e.ctrlKey||e.metaKey||e.altKey||
       (target instanceof Element&&target.closest('input,textarea,select,button,[contenteditable]:not([contenteditable="false"]),[role="dialog"]')))return;`);
 replace("  onWindowBlur() {\n    this.clientCameraRotation.setMiddleMouseDown(false);",`  onWindowBlur() {
    this.clientCameraRotation.setMiddleMouseDown(false);
    this.yawDelta=0;
    this.pitchDelta=0;
    this.touchStart=null;
    this.touchStart2=null;`);
 replace('      if (document.visibilityState === "hidden") {','      if (document.visibilityState === "hidden") {\n        this.onWindowBlur();');
 replace('    canvas.addEventListener("touchend", this.onDocumentTouchEnd.bind(this), false);','    canvas.addEventListener("touchend", this.onDocumentTouchEnd.bind(this), false);\n    canvas.addEventListener("touchcancel", this.onDocumentTouchEnd.bind(this), false);');
 replace("  resize(width: number, height: number) {",`  resize(width: number, height: number) {
    if(!Number.isFinite(width)||!Number.isFinite(height)||width<=0||height<=0)return;
    width=Math.max(1,Math.round(width));
    height=Math.max(1,Math.round(height));`);
 replace("      this.renderer.render(this.scene, this.camera);\n      return { kind: \"rendered\" };","      this.renderer.render(this.scene, this.camera);\n      this.renderFailureLogged=false;\n      return { kind: \"rendered\" };");
 replace('      console.warn("[osrs-sdk] WebGL context restored; Three.js resources may need rebuilding");\n      this.nextRenderTime = 0;',`      console.warn("[osrs-sdk] WebGL context restored; Three.js resources may need rebuilding");
      this.renderFailureLogged=false;
      this.nextRenderTime=0;`);
 return next;
}
/** Keep native player-follow and default camera settings; improve input
 * continuity at the existing orbit limits and between one/two fingers. */
export function patchOcellusViewportGestures(source){
 const old="  onDocumentMouseWheel(e: WheelEvent) {\n    if (this.outsideGameView(e.clientX, e.clientY)) return;\n    const v = this.camera.position.z + e.deltaY * ZOOM_MULT;\n    if (v >= 2 && v <= 20) {\n      this.camera.position.z = v;\n      this.orbitZoomOffset = v - cameraOrbitDistance(this.pitch.rotation.x);\n    }\n    e.preventDefault();\n    return false;\n  }\n\n  onDocumentTouchStart(e: TouchEvent) {\n    if (e.touches.length >= 1 && this.outsideGameView(e.touches[0].clientX, e.touches[0].clientY)) {\n      this.touchStart = null;\n      this.touchStart2 = null;\n      return;\n    }\n    if (e.touches.length >= 1) {\n      this.touchStart = e.touches[0];\n    }\n    if (e.touches.length === 2) {\n      this.touchStart2 = e.touches[1];\n    }\n  }\n\n  onDocumentTouchMove(e: TouchEvent) {\n    if (!this.touchStart) {\n      return;\n    }\n    if (e.touches.length === 1) {\n      // drag - rotate\n      const deltaX = (e.touches[0].clientX - this.touchStart.clientX) * TOUCH_MULT;\n      const deltaY = (e.touches[0].clientY - this.touchStart.clientY) * TOUCH_MULT;\n      this.yaw.rotation.y -= deltaX * ROTATE_MULT;\n      const v = this.pitch.rotation.x - deltaY * ROTATE_MULT;\n      this.pitch.rotation.x = Math.max(this.minimumCameraPitch, Math.min(this.maximumCameraPitch, v));\n      this.touchStart = e.touches[0];\n    } else if (e.touches.length === 2 && this.touchStart2 !== null) {\n      // pinch - zoom\n      const oldDist = Pathing.dist(\n        this.touchStart.clientX,\n        this.touchStart.clientY,\n        this.touchStart2.clientX,\n        this.touchStart2.clientY,\n      );\n      const currentDist = Pathing.dist(\n        e.touches[0].clientX,\n        e.touches[0].clientY,\n        e.touches[1].clientX,\n        e.touches[1].clientY,\n      );\n      const delta = (oldDist - currentDist) * TOUCH_MULT;\n      const v = this.camera.position.z + delta * ZOOM_MULT;\n      if (v >= 2 && v <= 20) {\n        this.camera.position.z = v;\n        this.orbitZoomOffset = v - cameraOrbitDistance(this.pitch.rotation.x);\n      }\n      this.touchStart = e.touches[0];\n      this.touchStart2 = e.touches[1];\n    }\n    e.preventDefault();\n    return false;\n  }\n\n  onDocumentTouchEnd(e: TouchEvent) {\n    this.touchStart = null;\n    this.touchStart2 = null;\n  }\n\n";
 const next="  private applyOcellusZoom(delta: number) {\n    if(!Number.isFinite(delta)||delta===0)return;\n    const distance=Math.max(2,Math.min(20,this.camera.position.z+delta));\n    this.camera.position.z=distance;\n    this.orbitZoomOffset=distance-cameraOrbitDistance(this.pitch.rotation.x);\n  }\n\n  onDocumentMouseWheel(e: WheelEvent) {\n    if(e.ctrlKey||e.metaKey||this.outsideGameView(e.clientX,e.clientY))return;\n    const unit=e.deltaMode===1?16:e.deltaMode===2?this.canvasDimensions.height:1;\n    this.applyOcellusZoom(e.deltaY*unit*ZOOM_MULT);\n    e.preventDefault();\n    return false;\n  }\n\n  private rebaseOcellusTouch(e: TouchEvent) {\n    const first=e.touches[0],second=e.touches[1];\n    if(e.touches.length<1||e.touches.length>2||\n       this.outsideGameView(first.clientX,first.clientY)||\n       (second&&this.outsideGameView(second.clientX,second.clientY))){\n      this.touchStart=null;this.touchStart2=null;return;\n    }\n    this.touchStart=first;\n    this.touchStart2=second??null;\n  }\n\n  onDocumentTouchStart(e: TouchEvent) {\n    this.rebaseOcellusTouch(e);\n  }\n\n  onDocumentTouchMove(e: TouchEvent) {\n    if(!this.touchStart)return;\n    const touches=Array.from(e.touches);\n    const first=touches.find(t=>t.identifier===this.touchStart!.identifier);\n    const second=this.touchStart2?touches.find(t=>t.identifier===this.touchStart2!.identifier):undefined;\n    if(!first||touches.length!==(this.touchStart2?2:1)||(this.touchStart2&&!second)){\n      this.rebaseOcellusTouch(e);\n      return;\n    }\n    if(!second||!this.touchStart2){\n      const dx=(first.clientX-this.touchStart.clientX)*TOUCH_MULT;\n      const dy=(first.clientY-this.touchStart.clientY)*TOUCH_MULT;\n      this.yaw.rotation.y-=dx*ROTATE_MULT;\n      this.pitch.rotation.x=Math.max(this.minimumCameraPitch,Math.min(this.maximumCameraPitch,this.pitch.rotation.x-dy*ROTATE_MULT));\n    }else{\n      const oldDistance=Math.hypot(this.touchStart.clientX-this.touchStart2.clientX,this.touchStart.clientY-this.touchStart2.clientY);\n      const distance=Math.hypot(first.clientX-second.clientX,first.clientY-second.clientY);\n      this.applyOcellusZoom((oldDistance-distance)*TOUCH_MULT*ZOOM_MULT);\n    }\n    this.touchStart=first;\n    this.touchStart2=second??null;\n    e.preventDefault();\n    return false;\n  }\n\n  onDocumentTouchEnd(e: TouchEvent) {\n    if(e.type===\"touchcancel\"){this.touchStart=null;this.touchStart2=null;return;}\n    this.rebaseOcellusTouch(e);\n  }\n\n";
 if(source.split(old).length!==2)throw Error("Pinned SDK camera gesture anchor changed");
 return source.replace(old,next);
}
if(process.argv[1]===fileURLToPath(import.meta.url)){
 const path=process.argv[2];
 if(!path)throw Error("Expected pinned SDK Viewport3d.ts");
 writeFileSync(path,patchOcellusViewportInput(patchOcellusViewportGestures(patchOcellusViewport(readFileSync(path,"utf8")))));
 console.log("Ocellus-only viewport: skip logical tile actors, suppress public FPS overlay, retain loopback metrics");
}
