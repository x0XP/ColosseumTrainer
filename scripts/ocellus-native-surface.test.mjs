import { test } from "node:test";
import assert from "node:assert/strict";
import { sampleTopSurface,surfaceSvg,floorPixels } from "./ocellus-native-surface.mjs";
const model={"vertexCount":4,"faceCount":2,"vertexPositionsX":[-64,64,64,-64],"vertexPositionsY":[0,0,0,0],"vertexPositionsZ":[64,64,-64,-64],"faceVertexIndices1":[0,0],"faceVertexIndices2":[1,2],"faceVertexIndices3":[2,3],"faceColors":[111,111]};
const placement={"x":0,"y":1,"orientation":0},definition={"sizeX":1,"sizeY":1,"offsetX":0,"offsetY":0,"offsetHeight":0};
const entry={id:1,model,placement,definition};
test("original horizontal square fully covers the tile with native HSL",()=>{
 const report=sampleTopSurface([entry],[".","#"],8);
 assert.equal(report.tiles[0].coverage,1);
 assert.equal(report.tiles[0].medianHeight,0);
 assert.equal(report.tiles[0].colors[0].packed,111);
 assert.equal(report.tiles[0].colors[0].count,64);
 assert.match(surfaceSvg(report,[".","#"]),/100%/);
});
test("highest eligible face wins; collapsed area and translucent surfaces do not get painted",()=>{
 const upper={...entry,id:2,model:{...model,vertexPositionsY:[-32,-32,-32,-32],faceColors:[222,222]}};
 const invisible={...upper,id:3,model:{...upper.model,vertexPositionsY:[-64,-64,-64,-64],faceAlphas:[128,128]}};
 const report=sampleTopSurface([entry,upper,invisible],[".","#"],8);
 assert.equal(report.tiles[0].medianHeight,.25);
 assert.deepEqual(report.tiles[0].models,[2]);
 assert.equal(report.tiles[0].colors[0].packed,222);
 assert.equal(sampleTopSurface([entry],[".","."],8).tiles.length,0);
});
test("uncovered tiles are represented explicitly, not given an invented native colour",()=>{
 const report=sampleTopSurface([],["#w"],8);
 assert.ok(report.tiles.every(t=>t.coverage===0&&t.medianHeight===null&&t.colors.length===0));
});

test("native floor raster preserves original colours and masks non-playable tiles",()=>{
 const rows=["#w",".#"];
 const samples=Array.from({length:16},(_,i)=>({y:-1/128,rgb:i<8?0x123456:0x789abc}));
 const high={width:4,height:4,resolution:2,samples};
 const baked=floorPixels(high,high,rows);
 assert.deepEqual([...baked.rgba.slice(0,4)],[18,52,86,255]);
 assert.deepEqual([...baked.rgba.slice(8,12)],[0,0,0,0]);
 assert.deepEqual([...baked.rgba.slice(56,60)],[120,154,188,255]);
 assert.equal(baked.pixels,8);
 assert.equal(baked.fallbackPixels,0);
 assert.equal(baked.floorY,-1/128);
});
test("a surface at the wrong altitude cannot be presented as native floor",()=>{
 const high={width:2,height:2,resolution:2,samples:Array(4).fill({y:.4921875,rgb:0x123456})};
 assert.throws(()=>floorPixels(high,high,["#"]),/No native floor-height face/);
});
