import {test} from "node:test";
import assert from "node:assert/strict";
import {patchOcellusViewport} from "./patch-ocellus-viewport.mjs";
const original=`
const FLOOR_Y_POS = -0.5;
    this.scene = new THREE.Scene();
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
 assert.doesNotMatch(result,/cameraFocalPoint|setViewOffset/);
 assert.throws(()=>patchOcellusViewport(result),/anchor changed/);
 assert.throws(()=>patchOcellusViewport(original.replace("this.stats.update();","unknown();")),/anchor changed/);
});
