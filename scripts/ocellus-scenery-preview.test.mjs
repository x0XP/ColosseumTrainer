import { test } from "node:test";
import assert from "node:assert/strict";
import { geometryOf, makeSheet } from "./ocellus-scenery-preview.mjs";
const fixture = {"vertexCount":4,"faceCount":4,"vertexPositionsX":[0,128,0,0],"vertexPositionsY":[0,0,-128,0],"vertexPositionsZ":[0,0,0,128],"faceVertexIndices1":[0,0,0,1],"faceVertexIndices2":[1,2,3,2],"faceVertexIndices3":[2,3,1,3],"faceAlphas":[0,0,0,0]};
test("native cache vertices, bounds and faces produce a valid two-view inspection sheet",()=>{
  const geometry=geometryOf(fixture);
  assert.deepEqual(geometry.bounds.map(b=>b.span),[128,128,128]);
  assert.equal(geometry.triangles.length,4);
  const svg=makeSheet([{id:42,label:"A & B",locs:[1,2],geometry}],2746);
  assert.match(svg,/Model 42/);
  assert.match(svg,/A &amp; B/);
  assert.match(svg,/<polygon points=/);
  assert.match(svg,/128 × 128 × 128/);
  assert.ok(!svg.includes("NaN"));
});
test("fully transparent faces do not appear in preview",()=>{
  assert.equal(geometryOf({...fixture,faceAlphas:[-1,0,0,0]}).triangles.length,3);
});
test("invalid or empty geometry is rejected",()=>{
  assert.throws(()=>geometryOf({...fixture,vertexPositionsX:[]}),/Invalid model vertices/);
  assert.throws(()=>geometryOf({...fixture,faceAlphas:[-1,-1,-1,-1]}),/no visible triangles/);
});
