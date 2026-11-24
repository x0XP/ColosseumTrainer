import {test} from "node:test";
import assert from "node:assert/strict";
import {transformVertex,clipBox,foundationBoxes,extractFoundation,curbBoxes,extractCurb} from "./ocellus-native-foundation.mjs";
const fixture={"vertexCount":3,"faceCount":1,"vertexPositionsX":[-64,64,0],"vertexPositionsY":[0,256,128],"vertexPositionsZ":[0,0,64],"faceVertexIndices1":[0],"faceVertexIndices2":[1],"faceVertexIndices3":[2],"faceColors":[14000]};
const def={"sizeX":1,"sizeY":1,"offsetX":0,"offsetY":0,"offsetHeight":0};
test("native map anchors and quarter turns match cache coordinates",()=>{
  const original={sizeX:9,sizeY:12,offsetX:0,offsetY:0,offsetHeight:769};
  assert.deepEqual(transformVertex([0,-769,0],{x:1,y:9,orientation:3},original),[7,0,4.5]);
  assert.deepEqual(transformVertex([128,-769,0],{x:1,y:9,orientation:3},original),[7,0,3.5]);
  assert.deepEqual(transformVertex([0,-769,128],{x:1,y:12,orientation:0},original),[5.5,0,5]);
});
test("native triangles are clipped below the walkable floor and inside disjoint footprint boxes",()=>{
  const result=extractFoundation(fixture,{x:0,y:1,orientation:0},def,foundationBoxes([".","#"]));
  assert.ok(result.clippedFaces>0);
  assert.equal(result.positions.length,result.colors.length*9);
  assert.equal(result.vertexColors.length,result.colors.length*3);
  assert.ok(result.vertexColors.every(c=>Number.isInteger(c)&&c>=0&&c<=0xffffff));
  for(let i=0;i<result.positions.length;i+=3){
    const [x,y,z]=result.positions.slice(i,i+3);
    assert.ok(y>=-1.69&&y<=-0.015);
    assert.ok(x>=-0.18&&x<=1.18&&z>=-0.18&&z<=1.18);
  }
});
test("fully outside faces are excluded and an intersecting face is sliced at the floor",()=>{
  const box={x0:0,x1:1,y0:-1.69,y1:-0.015,z0:0,z1:1};
  assert.deepEqual(clipBox([[0,1,0],[1,1,0],[0,1,1]],box),[]);
  const p=clipBox([[0,0,0],[1,-1,0],[0,-1,1]],box);
  assert.ok(p.length>=3&&p.every(v=>v[1]<=-0.015));
});
test("translucent or textured source faces are excluded rather than fabricated",()=>{
  const boxes=foundationBoxes([".","#"]),p={x:0,y:1,orientation:0};
  assert.equal(extractFoundation({...fixture,faceAlphas:[128]},p,def,boxes).clippedFaces,0);
  assert.equal(extractFoundation({...fixture,faceTextures:[215]},p,def,boxes).clippedFaces,0);
});

test("native curb keeps partial faces and does not fill empty outer tiles",()=>{
 const model={vertexCount:3,faceCount:1,vertexPositionsX:[-64,0,-64],vertexPositionsY:[-63,-63,-63],vertexPositionsZ:[64,64,0],faceVertexIndices1:[0],faceVertexIndices2:[1],faceVertexIndices3:[2],faceColors:[12694]};
 const def={sizeX:1,sizeY:1,offsetX:0,offsetY:0,offsetHeight:0};
 const entry={id:1,model,placement:{x:0,y:1,orientation:0},definition:def};
 const result=extractCurb([entry],["..","ww"]);
 assert.equal(result.tiles,2);
 assert.equal(result.colors.length,1);
 assert.equal(result.positions.length,9);
 assert.equal(result.vertexColors.length,3);
 assert.ok(result.positions.filter((_,i)=>i%3===0).every(x=>x<=.5));
 assert.ok(result.positions.filter((_,i)=>i%3===1).every(y=>y===.4921875));
 assert.equal(extractCurb([entry],["..","##"]).colors.length,0);
});
test("curb footprint includes diagonal cells but excludes ambiguous and playable tiles",()=>{
 assert.equal(curbBoxes(["?wb/#."]).length,3);
});
