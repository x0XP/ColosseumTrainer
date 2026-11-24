import {test} from "node:test";
import assert from "node:assert/strict";
import {gzipSync} from "node:zlib";
import {soundPackIds,readPayload,validateSpot,EXPECTED_SPOTS} from "./audit-ocellus-spot-assets.mjs";
function pack(){const b=Buffer.alloc(12);b.write("SFX1");b.writeUInt16BE(1,4);b.writeUInt16BE(12620,6);b.writeUInt16BE(2,8);return b;}
test("sound pack validates lengths and duplicate/truncated entries",()=>{
 assert.deepEqual([...soundPackIds(pack())],[12620]);
 assert.throws(()=>soundPackIds(pack().subarray(0,11)),/Invalid sound pack entry/);
});
test("compressed OSRB asset metadata and native sequences are checked",()=>{
 const data={spotAnim:{id:4312,animationId:14916,resizeX:128,resizeY:128,rotation:0},positions:[0,0,0],animations:{"14916":{lengths:[30],frames:[[0,0,0]],frameSounds:{"0":[{id:12620}]}}}};
 const bytes=gzipSync(Buffer.from(JSON.stringify(data))),header=Buffer.alloc(8);header.write("OSRB");header.writeUInt32LE(bytes.length,4);
 const decoded=readPayload(Buffer.concat([header,bytes]));
 assert.equal(validateSpot(4312,decoded,new Set([12620])).cycles,30);
 assert.throws(()=>validateSpot(4312,decoded,new Set()),/Unexpected missing native spot audio/);
 decoded.animations["14916"].lengths=[29];
 assert.throws(()=>validateSpot(4312,decoded,new Set([12620])),/duration mismatch/);
 assert.equal(Object.keys(EXPECTED_SPOTS).length,16);
});

test("all five cache-textured effects retain their known ordered triangle coverage",async()=>{
 const {auditSpotTexture,TEXTURED_SPOTS}=await import("./audit-ocellus-spot-assets.mjs");
 const [triangles,runs]=TEXTURED_SPOTS[4276];
 const indices=Array.from({length:(triangles+1)*3},(_,i)=>i);
 const payload={positions:Array(indices.length*3).fill(0),indices,textureIds:[...Array(triangles*3).fill(215),-1,-1,-1],uvs:Array(indices.length*2).fill(0),textures:{215:{width:128,height:128,pixels:Array(16384).fill(0xffffffff)}}};
 assert.equal(runs,2);
 // Native death-crack texture crosses the tile boundary 255 times.
 for(let i=0;i<255;i++)payload.uvs[i]=-0.5;
 assert.deepEqual(auditSpotTexture(4276,payload),{texturedTriangles:82,drawRuns:2,texture:215,repeatedCoordinates:255});
 assert.throws(()=>auditSpotTexture(4276,{...payload,uvs:Array(indices.length*2).fill(0)}),/repeated UV coverage/);
 assert.throws(()=>auditSpotTexture(4276,{...payload,uvs:[]}),/Invalid native spot UVs/);
 assert.throws(()=>auditSpotTexture(4276,{...payload,indices:[...indices.slice(0,-1),0]}),/texture triangle/);
 assert.equal(auditSpotTexture(4339,payload),null);
});
