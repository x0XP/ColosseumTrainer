import {test} from "node:test";
import assert from "node:assert/strict";
import {floodPixels} from "./ocellus-flood-texture.mjs";
test("recovered star positions retain their relative intensity against the observed flood palette",()=>{
 const source=Uint8Array.from([0,0,1,255,128,128,128,255,255,255,255,255,255,255,255,0]);
 const result=floodPixels(source);
 assert.deepEqual([...result.slice(0,4)],[3,3,8,255]);
 assert.deepEqual([...result.slice(8,12)],[246,245,255,255]);
 assert.deepEqual([...result.slice(12,16)],[3,3,8,255]);
 assert.ok(result[4]>result[0]&&result[4]<result[8]);
 assert.equal(source[0],0);
 assert.throws(()=>floodPixels([1,2,3]),/Expected RGBA/);
});
