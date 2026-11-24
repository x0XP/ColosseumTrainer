import {test} from "node:test";
import assert from "node:assert/strict";
import {patchOcellusMinimap,ocellusMinimapWidthScale,patchOcellusCompactMinimap} from "./patch-ocellus-minimap.mjs";
const original=`    this.mapCanvas = new OffscreenCanvas(152, 152);
    const mapContext = this.mapCanvas.getContext("2d") as OffscreenCanvasRenderingContext2D;

    mapContext.save();`;
test("native map uses interpolated player position, reuses the canvas and keeps a fixed mask",()=>{
 const out=patchOcellusMinimap(original);
 assert.match(out,/this.mapCanvas \?\? new OffscreenCanvas/);
 assert.match(out,/drawOcellusMinimap\(mapContext,Viewport.viewport.getMapRotation\(\),true\)/);
 assert.match(out,/mapContext.save\(\);\s*mapContext.globalCompositeOperation = "destination-out"/);
 assert.match(out,/mapContext.restore\(\);\s*return;/);
 assert.throws(()=>patchOcellusMinimap(out),/anchor changed/);
});

test("portrait map and orbs use one compact scale; desktop scale is unchanged",()=>{
 assert.equal(ocellusMinimapWidthScale(390),.68);
 assert.equal(ocellusMinimapWidthScale(450),.75);
 assert.equal(ocellusMinimapWidthScale(1038),1);
 const out=patchOcellusCompactMinimap("      : (gameHeight / 500 > 1 ? 1 : gameHeight / 500) * Settings.maxUiScale;");
 assert.match(out,/Settings.maxUiScale \* ocellusMinimapWidthScale\(width\)/);
 assert.throws(()=>patchOcellusCompactMinimap(out),/anchor changed/);
});
