import {test} from "node:test";
import assert from "node:assert/strict";
import {nativeFaceRgb,shadePacked,objectFaceLighting,interpolateRgb,triangleColorAt} from "./ocellus-object-lighting.mjs";
const upward={"vertexCount":3,"faceCount":1,"vertexPositionsX":[0,128,0],"vertexPositionsY":[0,0,0],"vertexPositionsZ":[0,0,128],"faceVertexIndices1":[0],"faceVertexIndices2":[1],"faceVertexIndices3":[2],"faceColors":[16553],"faceRenderTypes":[0]},definition={"ambient":20,"contrast":1750};
test("the native object ambient and contrast illuminate upward-facing stone using the original HSL hue",()=>{
 const lit=objectFaceLighting(upward,{orientation:0},definition)(0);
 assert.deepEqual(lit,Array(3).fill(nativeFaceRgb(shadePacked(16553,87))));
 assert.notEqual(lit[0],nativeFaceRgb(16553));
 assert.equal(shadePacked(16553,87)&0xff80,16553&0xff80);
});
test("vertical native faces react to original map orientation",()=>{
 const model={...upward,vertexPositionsY:[0,0,128],vertexPositionsZ:[0,0,0],faceRenderTypes:[1]};
 const a=objectFaceLighting(model,{orientation:0},definition)(0);
 const b=objectFaceLighting(model,{orientation:2},definition)(0);
 assert.notEqual(a[0],b[0]);
 assert.equal(new Set(a).size,1);
 assert.equal(new Set(b).size,1);
});
test("clipping preserves the source vertex colours and interpolates in linear colour space",()=>{
 const triangle=[[0,0,0],[1,0,0],[0,0,1]],colours=[0,0xffffff,0xff0000];
 assert.equal(triangleColorAt(triangle,colours,triangle[1]),0xffffff);
 assert.equal(triangleColorAt(triangle,colours,[.5,0,0]),0xbcbcbc);
 assert.equal(interpolateRgb([0,0xffffff],[.5,.5]),0xbcbcbc);
});
