import assert from "node:assert/strict";
import test from "node:test";
import {backdropFaces,surroundingPlacements,belowFloorScenery,objectAnchorHeight} from "./ocellus-backdrop.mjs";

test("lower wall samples the adjoining map border relative to the arena floor",()=>{
  const grid=Array.from({length:64},()=>[...Array(64).fill(240),368]);
  const model={vertexCount:3,faceCount:1,vertexPositionsX:[0,64,0],
    vertexPositionsY:[0,0,-128],vertexPositionsZ:[64,64,-64],
    faceVertexIndices1:[0],faceVertexIndices2:[1],faceVertexIndices3:[2],faceColors:[1234]};
  const object={x:1,y:-23,orientation:0};
  const def={sizeX:1,sizeY:1,offsetX:0,offsetY:0,offsetHeight:0};
  const mesh=backdropFaces(model,object,def,grid,1008);
  assert.deepEqual(mesh.positions.filter((_,i)=>i%3===1),[-5,-5,-5]);
  assert.equal(mesh.vertexColors.length,3);
});

test("asymmetric scale follows rotation and a type-11 placement turns after its offset",()=>{
 const grid=Array.from({length:64},()=>Array(65).fill(1008));
 const model={vertexCount:3,faceCount:1,vertexPositionsX:[0,128,0],
   vertexPositionsY:[0,0,-128],vertexPositionsZ:[128,0,0],
   faceVertexIndices1:[0],faceVertexIndices2:[1],faceVertexIndices3:[2],faceColors:[1234]};
 const def={sizeX:1,sizeY:1,offsetX:32,offsetY:0,offsetHeight:0,modelSizeX:64,modelSizeY:128,modelSizeHeight:64};
 const place={x:1,y:1,orientation:1,type:10};
 const normal=backdropFaces(model,place,def,grid,1008);
 assert.deepEqual(normal.positions.slice(0,3),[2.25,0,.5]);
 assert.equal(normal.positions[7],.5);
 const diagonal=backdropFaces(model,{...place,type:11},def,grid,1008);
 assert.ok(Math.abs(diagonal.positions[0]-1.5-.75*Math.SQRT1_2)<1e-8);
 assert.ok(Math.abs(diagonal.positions[2]-.5-.75*Math.SQRT1_2)<1e-8);
});

test("original surrounding stairs and rock support use exact cache positions and orientation",()=>{
 const origin={x:32,y:40};
 const locations=[{id:62954,type:10,orientation:0,position:{localX:30,localY:26,height:1}},{id:62955,type:10,orientation:2,position:{localX:30,localY:40,height:1}}];
 assert.deepEqual(surroundingPlacements(locations,origin).map(({id,model,x,y,orientation})=>[id,model,x,y,orientation]),[[62954,62249,-2,14,0],[62955,62250,-2,0,2]]);
 assert.throws(()=>surroundingPlacements(locations.slice(1),origin),/location changed/);
});
test("surrounding geometry keeps original lower faces and clips away upper surfaces",()=>{
 const mesh=belowFloorScenery({positions:[0,-1,0,1,-1,0,0,1,1, 0,1,0,1,1,0,0,1,1],vertexColors:Array(6).fill(0x345678)});
 assert.equal(mesh.positions.length,18);
 assert.ok(mesh.positions.filter((_,i)=>i%3===1).every(y=>y<=-.00783+1e-10));
 assert.ok(mesh.vertexColors.every(c=>c===0x345678));
});

test("static object height uses rotated footprint midpoint samples, not vertex-dependent terrain bending",()=>{
 const heights=Array.from({length:64},(_,x)=>Array.from({length:65},(_,y)=>x*128+y*32));
 const place={x:-2,y:14,orientation:0,type:10};const def={sizeX:3,sizeY:2,offsetX:0,offsetY:0,offsetHeight:640};
 const anchor=objectAnchorHeight(place,def,heights);
 assert.equal(anchor,(31.5*128+27*32));
 assert.equal(objectAnchorHeight({...place,orientation:1},def,heights),31*128+27.5*32);
 const model={vertexCount:3,faceCount:1,vertexPositionsX:[0,64,0],vertexPositionsY:[0,0,-128],vertexPositionsZ:[64,64,-64],faceVertexIndices1:[0],faceVertexIndices2:[1],faceVertexIndices3:[2],faceColors:[1234]};
 const mesh=backdropFaces(model,place,def,heights,anchor,anchor);
 assert.deepEqual(mesh.positions.filter((_,i)=>i%3===1),[-5,-5,-4]);
});
