import assert from "node:assert/strict";
import test from "node:test";
import {backdropFaces} from "./ocellus-backdrop.mjs";

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
