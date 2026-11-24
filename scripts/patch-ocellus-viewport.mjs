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
          camera:{focusX:number;focusY:number;targetX:number|null;targetY:number|null;yaw:number;pitch:number;distance:number;canvasWidth:number;canvasHeight:number};
        }};
        const renderInfo = this.renderer.info.render;
        debugWindow.__ocellusViewportMetrics = {
          actors:this.knownActors.size, calls:renderInfo.calls, triangles:renderInfo.triangles,
          abyss:this.scene.background instanceof THREE.Color ? this.scene.background.getHexString() : null,
          finiteAbyss:!!this.scene.getObjectByName("ocellus-abyss"),
          innerVoid:this.scene.getObjectByName("ocellus-inner-void")?.visible===true,
          outerVoid:this.scene.getObjectByName("ocellus-outer-void")?.visible===true,
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
if(process.argv[1]===fileURLToPath(import.meta.url)){
 const path=process.argv[2];
 if(!path)throw Error("Expected pinned SDK Viewport3d.ts");
 writeFileSync(path,patchOcellusViewport(readFileSync(path,"utf8")));
 console.log("Ocellus-only viewport: skip logical tile actors, suppress public FPS overlay, retain loopback metrics");
}
