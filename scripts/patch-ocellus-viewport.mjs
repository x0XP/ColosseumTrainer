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
        }};
        const renderInfo = this.renderer.info.render;
        debugWindow.__ocellusViewportMetrics = {
          actors:this.knownActors.size, calls:renderInfo.calls, triangles:renderInfo.triangles,
          abyss:this.scene.background instanceof THREE.Color ? this.scene.background.getHexString() : null,
          finiteAbyss:!!this.scene.getObjectByName("ocellus-abyss"),
          innerVoid:this.scene.getObjectByName("ocellus-inner-void")?.visible===true,
          outerVoid:this.scene.getObjectByName("ocellus-outer-void")?.visible===true,
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
