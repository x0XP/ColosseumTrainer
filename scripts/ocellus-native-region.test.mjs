import { test } from "node:test";
import assert from "node:assert/strict";
import { readNativeRegion } from "./ocellus-native-region.mjs";

const square = 16472;
const backing = Uint8Array.from([255, 7, 8, 255]);
const tiles = Array.from({length:4}, () => Array.from({length:64}, () => Array.from({length:64}, () => ({}))));
function fixture() {
  const group = { files: [{ id:1, content:Uint8Array.of(9) }, { id:0, content:backing.subarray(1,3) }], loadFiles(data) {assert.deepEqual([...data],[42]);} };
  const index = { named:false, archives:{[square]:group}, indexSegments:{[square]:{size:123,segment:456}} };
  const cache = { cacheRequester:{async readData(idx,size,segment,id) {assert.equal(idx,index);assert.deepEqual([size,segment,id],[123,456,square]);return {decompressedData:Uint8Array.of(42)};} } };
  class Loader {
    loadMapDef(bytes,id,x,y) {assert.deepEqual([...bytes],[7,8]);assert.equal(bytes.byteOffset,0);assert.equal(bytes.buffer.byteLength,2);assert.deepEqual([id,x,y],[square,64,88]);return {tiles};}
    loadLocationDef(bytes,id,x,y) {assert.deepEqual([...bytes],[9]);assert.deepEqual([id,x,y],[square,64,88]);return {locations:[{id:62697}]};}
  }
  return {group,index,cache,Loader};
}
test("direct region ID selects terrain file 0 and locations file 1 regardless of file order",async()=>{
  const {index,cache,Loader}=fixture();
  const r=await readNativeRegion(cache,index,square,Loader);
  assert.equal(r.format,"direct-region-files");
  assert.deepEqual(r.files,[{id:0,bytes:2},{id:1,bytes:1}]);
  assert.equal(r.loc.locations[0].id,62697);
});
test("missing group or file is reported rather than treated as an empty native map",async()=>{
  const {index,cache,Loader,group}=fixture();
  group.files=group.files.filter(f=>f.id!==1);
  await assert.rejects(readNativeRegion(cache,index,square,Loader),/missing file 1/);
  delete index.archives[square];
  await assert.rejects(readNativeRegion(cache,index,square,Loader),/group 16472 absent/);
});
test("legacy named archives keep their previous lookup path",async()=>{
  const result=await readNativeRegion({getMap:async(x,y)=>({x,y}),getLoc:async()=>({locations:[]})},{named:true},square,null);
  assert.equal(result.format,"legacy-named");
  assert.deepEqual(result.map,{x:64,y:88});
});
