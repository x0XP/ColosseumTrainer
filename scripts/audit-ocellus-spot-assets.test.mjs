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
