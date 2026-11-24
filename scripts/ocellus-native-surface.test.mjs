import { test } from "node:test";
import assert from "node:assert/strict";
import { sampleTopSurface,surfaceSvg } from "./ocellus-native-surface.mjs";
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
