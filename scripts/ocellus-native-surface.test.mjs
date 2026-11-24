import { test } from "node:test";
import assert from "node:assert/strict";
import { sampleTopSurface,surfaceSvg,floorPixels,padFloorSampling,upperSurfacePixels } from "./ocellus-native-surface.mjs";
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

test("flat-floor sampling prefers the original lower surface instead of the raised lip",()=>{
 const lower={...entry,model:{...model,vertexPositionsY:[1,1,1,1],faceColors:[111,111]}};
 const upper={...entry,id:2,model:{...model,vertexPositionsY:[-63,-63,-63,-63],faceColors:[222,222]}};
 const report=sampleTopSurface([lower,upper],[".","#"],8,-1/128);
 assert.equal(report.tiles[0].coverage,1);
 assert.equal(report.tiles[0].medianHeight,-1/128);
 assert.equal(report.tiles[0].colors[0].packed,111);
});
test("small edge gaps extend only the nearest verified native colour within the same tile",()=>{
 const rows=["####"];const samples=Array.from({length:64},(_,i)=>({y:-1/128,rgb:i%16<4?0x123456:0xabcdef}));
 samples[3]={y:.4921875,rgb:0xff0000};samples[19]=null;
 const report={width:16,height:4,resolution:4,samples};
 const baked=floorPixels(report,report,rows);
 assert.equal(baked.pixels,64);
 assert.equal(baked.extendedPixels,2);
 assert.deepEqual(baked.repairs,[{x:0,y:0,pixels:2}]);
 assert.deepEqual([...baked.rgba.slice(12,16)],[18,52,86,255]);
});

test("sampling padding preserves all native texels and does not mutate the transparent artwork",()=>{
 const rgba=new Uint8Array([255,0,0,255,0,0,0,0,0,0,0,0,0,0,255,255]);
 const result=padFloorSampling(4,1,rgba);
 assert.equal(result.padded,2);
 assert.deepEqual([...result.rgba],[255,0,0,255,255,0,0,255,0,0,255,255,0,0,255,255]);
 assert.equal(rgba[7],0);assert.equal(rgba[11],0);
});
test("padding does not wrap across rows and rejects invalid or empty source masks",()=>{
 const rgba=new Uint8Array(3*2*4);rgba.set([10,20,30,255],0);rgba.set([90,80,70,255],5*4);
 const result=padFloorSampling(3,2,rgba);
 assert.deepEqual([...result.rgba.slice(8,12)],[90,80,70,255]);
 assert.deepEqual([...result.rgba.slice(12,16)],[10,20,30,255]);
 assert.throws(()=>padFloorSampling(2,2,new Uint8Array(16)),/No native floor pixels/);
 assert.throws(()=>padFloorSampling(1,1,new Uint8Array([0,0,0,128])),/binary/);
 assert.throws(()=>padFloorSampling(2,1,new Uint8Array(4)),/Invalid floor sampling/);
});

test("high resolution upper art retains native raised lips and only fills missing playable pixels",()=>{
 const rows=["#w","/."],samples=[{rgb:0xabcdef},null,{rgb:0x123456},null,null,{rgb:0x456789},null,null,
  {rgb:0xabcdef},null,null,null,null,null,{rgb:0xffffff},null];
 const flat=new Uint8Array(64);
 for(const i of [0,1,4,5])flat.set([30,40,50,255],i*4);
 const result=upperSurfacePixels({width:4,height:4,resolution:2,samples},{width:4,height:4,rgba:flat},rows);
 assert.deepEqual([...result.rgba.slice(0,8)],[171,205,239,255,30,40,50,255]);
 assert.deepEqual([...result.rgba.slice(8,16)],[18,52,86,255,0,0,0,0]);
 assert.equal(result.native,4);assert.equal(result.repaired,2);assert.equal(result.curb,2);
 assert.equal(result.rgba[14*4+3],0);
 assert.throws(()=>upperSurfacePixels({width:4,height:4,resolution:2,samples},{width:4,height:4,rgba:new Uint8Array(64)},rows),/Missing verified/);
});
