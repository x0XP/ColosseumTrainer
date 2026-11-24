import {test} from "node:test";
import assert from "node:assert/strict";
import {checkGeometry,checkSequence,checkNativeModel,auditAnimatedAlpha,auditEquipmentSkin,NATIVE_MODELS,VISIBLE_EQUIPMENT,NON_MESH_ITEMS} from "./audit-ocellus-native-actors.mjs";
const geometry={positions:[0,0,0,1,0,0,1,1,0],indices:[0,1,2],colors:[1,2,3],alphas:[0,0,0],uvs:[0,0,1,0,1,1],textureIds:[-1,-1,-1]};
const sequence={lengths:[10,20],rawFrames:[{},{}]};
test("native actor geometry rejects invalid indices, colors and missing textures",()=>{
 assert.deepEqual(checkGeometry("fixture",geometry),{vertices:3,triangles:1});
 for(const invalid of [{indices:[0,1,4]},{positions:[0,NaN,0]},{colors:[1]},{textureIds:[215,215,215]}])
  assert.throws(()=>checkGeometry("fixture",{...geometry,...invalid}),/fixture:/);
 assert.deepEqual(checkGeometry("nonmesh",{positions:[0,0,0],indices:[]}),{vertices:1,triangles:0});
});
test("sequence and model checks reject truncated frames, wrong native timing, pose and scale",()=>{
 assert.deepEqual(checkSequence("fixture",123,sequence,[30,2]),{id:123,cycles:30,frames:2});
 assert.throws(()=>checkSequence("fixture",123,{...sequence,lengths:[9,20]},[30,2]),/native sequence mismatch/);
 assert.throws(()=>checkSequence("fixture",123,{...sequence,rawFrames:[{}]},[30,2]),/incomplete sequence/);
 const expected={vertices:3,triangles:1,scale:.75,animations:{123:[30,2]}};
 const data={...geometry,scale:.75,animations:{123:sequence},poseMap:{0:123}};
 assert.equal(checkNativeModel("fixture",data,expected).sequences.length,1);
 assert.throws(()=>checkNativeModel("fixture",{...data,scale:1},expected),/scale mismatch/);
 assert.throws(()=>checkNativeModel("fixture",{...data,poseMap:{0:124}},expected),/missing mapped pose/);
 assert.equal(Object.keys(NATIVE_MODELS).length,6);
 assert.equal(VISIBLE_EQUIPMENT.length+NON_MESH_ITEMS.length,16);
});

test("type-5 alpha transforms affect actual exported vertices rather than every group",()=>{
 const payload={alphas:[0,0,0],alphaGroups:[[0,1],[2]],animations:{123:{rawFrames:[
  {types:[5],maps:[[0]],indexFrameIds:[0],x:[16]},
  {types:[5,5],maps:[[1],[1]],indexFrameIds:[0,1],x:[32,-32]},
  {types:[5],maps:[[7]],indexFrameIds:[0],x:[32]}
 ]}}};
 assert.deepEqual(auditAnimatedAlpha(payload,123),{id:123,changedFrames:1,affectedVertices:2,maximum:128});
 assert.throws(()=>auditAnimatedAlpha({...payload,alphas:[1,0,0]},123),/start opaque/);
});

test("visible equipment retains one animation group and a source identity for every exported vertex",()=>{
 const payload={positions:[0,0,0,1,0,0,1,1,0],sourceVertices:[0,1,2],vertexGroups:[[0,2],[1]]};
 assert.deepEqual(auditEquipmentSkin("fixture",payload),{skinnedVertices:3,uniqueSourceVertices:3});
 assert.throws(()=>auditEquipmentSkin("fixture",{...payload,vertexGroups:[[0],[1]]}),/unskinned/);
 assert.throws(()=>auditEquipmentSkin("fixture",{...payload,vertexGroups:[[0,2],[1,2]]}),/duplicate/);
 assert.throws(()=>auditEquipmentSkin("fixture",{...payload,sourceVertices:[0,1]}),/source vertices/);
});

test("native static boss alpha records ordered runs and rejects mixed or animated triangles",async()=>{
 const {auditBossAlpha}=await import("./audit-ocellus-native-actors.mjs");
 const payload={indices:[0,1,2,3,4,5,6,7,8],alphas:[0,0,0,150,150,150,0,0,0]};
 assert.deepEqual(auditBossAlpha(payload),{opaque:2,translucent:1,runs:3});
 assert.throws(()=>auditBossAlpha({...payload,alphas:[1,...payload.alphas.slice(1)]}),/Mixed/);
 assert.throws(()=>auditBossAlpha({...payload,animations:{1:{rawFrames:[{types:[5]}]}}}),/static/);
});
