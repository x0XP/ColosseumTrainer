import {test} from "node:test";
import assert from "node:assert/strict";
import {transformVertex,clipBox,foundationBoxes,extractFoundation,curbBoxes,extractCurb,FOUNDATION_TOP_Y,floorReliefBoxes,FLOOR_RELIEF_MIN_Y,foundationEnvelopeBoxes,FOUNDATION_ENVELOPE,extractNativeFlatFloor,curbOverhangBoxes,CURB_OVERHANG_MARGIN,extractTallScenery,NATIVE_SCENERY_SPLIT_Y} from "./ocellus-native-foundation.mjs";
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
    assert.ok(y>=-1.69&&y<=FOUNDATION_TOP_Y);
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

test("shared clipping-box walls emit each native source triangle only once",()=>{
 const wall={...fixture,vertexPositionsX:[64,64,64],vertexPositionsY:[64,128,64],vertexPositionsZ:[48,48,-48]};
 const p={x:0,y:1,orientation:0};
 const box={x0:0,x1:1,z0:0,z1:1,y0:-1.69,y1:-.015};
 const result=extractFoundation(wall,p,def,[box,{...box,x0:1,x1:2}]);
 assert.equal(result.clippedFaces,1);
 assert.equal(result.duplicateFaces,1);
 assert.equal(result.positions.length,9);
 assert.equal(result.vertexColors.length,3);
 assert.deepEqual(result.positions,extractFoundation(wall,p,def,[box]).positions);
});

test("distinct original faces retain their own colours even on shared geometry",()=>{
 const wall={...fixture,faceCount:2,vertexPositionsX:[64,64,64],vertexPositionsY:[64,128,64],vertexPositionsZ:[48,48,-48],faceVertexIndices1:[0,0],faceVertexIndices2:[1,1],faceVertexIndices3:[2,2],faceColors:[14000,15000]};
 const box={x0:0,x1:1,z0:0,z1:1,y0:-1.69,y1:-.015};
 const result=extractFoundation(wall,{x:0,y:1,orientation:0},def,[box,{...box,x0:1,x1:2}]);
 assert.equal(result.clippedFaces,2);
 assert.equal(result.duplicateFaces,2);
 assert.equal(result.positions.length,18);
 assert.notEqual(result.colors[0],result.colors[1]);
});

test("native sloping side faces extend nearly to the floor without coplanar faces",()=>{
 const p={x:0,y:1,orientation:0},boxes=foundationBoxes([".","#"]);
 assert.ok(boxes.every(b=>b.y1===FOUNDATION_TOP_Y));
 assert.ok(FOUNDATION_TOP_Y< -1/128&&-1/128-FOUNDATION_TOP_Y<.00002);
 const result=extractFoundation({...fixture,vertexPositionsY:[1,8,16]},p,def,boxes);
 assert.ok(result.positions.filter((_,i)=>i%3===1).some(y=>y===FOUNDATION_TOP_Y));
 assert.ok(result.positions.filter((_,i)=>i%3===1).every(y=>y<=FOUNDATION_TOP_Y));
 assert.equal(extractFoundation({...fixture,vertexPositionsY:[1,1,1]},p,def,boxes).clippedFaces,0);
 assert.ok(extractFoundation({...fixture,vertexPositionsY:[1,1.5,1.5]},p,def,boxes).clippedFaces>0);
});

test("coincident curb faces preserve distinct original material and winding",()=>{
 const model={vertexCount:3,faceCount:4,vertexPositionsX:[-64,0,-64],vertexPositionsY:[-63,-63,-63],vertexPositionsZ:[64,64,0],
 faceVertexIndices1:[0,0,0,0],faceVertexIndices2:[1,1,1,2],faceVertexIndices3:[2,2,2,1],faceColors:[12694,12694,13000,12694],faceRenderTypes:[1,1,1,1]};
 const entry={id:1,model,placement:{x:0,y:1,orientation:0},definition:def};
 const result=extractCurb([entry],[".","w"]);
 assert.equal(result.colors.length,3);
 assert.equal(result.positions.length,27);
 assert.equal(result.vertexColors.length,9);
 assert.equal(result.colors[0],result.colors[2]);
 assert.notEqual(result.colors[0],result.colors[1]);
});

test("raised native lips extend into walkable tiles without duplicating the baked floor",()=>{
 const model={vertexCount:3,faceCount:1,vertexPositionsX:[-64,0,-64],vertexPositionsY:[-63,-63,-63],vertexPositionsZ:[64,64,0],faceVertexIndices1:[0],faceVertexIndices2:[1],faceVertexIndices3:[2],faceColors:[12694]};
 const entry={id:1,model,placement:{x:0,y:1,orientation:0},definition:def};
 const rows=["..","#w"];
 assert.equal(extractCurb([entry],rows).colors.length,0);
 const out=extractCurb([entry],rows,true);
 assert.equal(out.tiles,1);assert.equal(out.reliefTiles,1);
 assert.equal(out.raisedFloorFaces,1);assert.equal(out.colors.length,1);
 assert.ok(out.positions.filter((_,i)=>i%3===1).every(y=>y===.4921875));
 const flat={...entry,model:{...model,vertexPositionsY:[1,1,1]}};
 assert.equal(extractCurb([flat],rows,true).raisedFloorFaces,0);
 const slope={...entry,model:{...model,vertexPositionsY:[1,-63,-63]}};
 const clipped=extractCurb([slope],rows,true);
 assert.ok(clipped.raisedFloorFaces>0);
 assert.ok(clipped.positions.filter((_,i)=>i%3===1).every(y=>y>=FLOOR_RELIEF_MIN_Y-1e-7));
 assert.equal(floorReliefBoxes(["?wb/#."]).length,1);
});

test("deeper source rock retains natural overhangs without expanding the upper lip or playable floor",()=>{
 const boxes=foundationEnvelopeBoxes([".#.","..."]);
 const contains=(p,box)=>p[0]>box.x0&&p[0]<box.x1&&p[1]>box.y0&&p[1]<box.y1&&p[2]>box.z0&&p[2]<box.z1;
 for(const [point,count] of [[[.8,-.1,.2],1],[[.5,-.1,.2],0],[[.5,-.1,-.5],0],[[.6,-.1,-.5],1],[[.9,-.1,-.5],1],[[.61,-.8,-.5],1],[[.4,-2,-.5],1],[[.4,-2,.4],1],[[.1,-2,-.5],0],[[1.5,.01,-.5],0],[[1.5,-3.3,-.5],0]]){
  assert.equal(boxes.filter(b=>contains(point,b)).length,count);
 }
 assert.equal(FOUNDATION_ENVELOPE[2].bottom,-3.19);
 const deep={...fixture,vertexPositionsY:[256,320,384]};
 const result=extractFoundation(deep,{x:1,y:0,orientation:0},def,boxes);
 assert.ok(result.clippedFaces>0);
 assert.ok(result.positions.filter((_,i)=>i%3===1).every(y=>y>=-3.19&&y<=-2));
 assert.equal(extractFoundation(deep,{x:1,y:0,orientation:0},def,foundationBoxes([".#.","..."])).clippedFaces,0);
});

test("original flat floor triangles retain exact native height, colour and playable mask",()=>{
 const flat={...fixture,vertexPositionsX:[-64,192,-64],vertexPositionsY:[1,1,1],vertexPositionsZ:[64,64,-64]};
 const entry={id:1,model:flat,placement:{x:0,y:1,orientation:0},definition:def};
 const rows=["..","#w"];
 const result=extractNativeFlatFloor([entry,{...entry,id:2}],rows);
 assert.equal(result.tiles,1);assert.equal(result.floorY,-1/128);
 assert.ok(result.colors.length>0);
 assert.equal(result.sources[1].faces,0);
 assert.equal(result.vertexColors.length,result.colors.length*3);
 for(let i=0;i<result.positions.length;i+=3){
  const [x,y,z]=result.positions.slice(i,i+3);
  assert.ok(x>=0&&x<=1&&z>=0&&z<=1);assert.equal(y,-1/128);
 }
 assert.equal(extractNativeFlatFloor([{...entry,model:{...flat,vertexPositionsY:[1,-63,1]}}],rows).colors.length,0);
 assert.equal(extractNativeFlatFloor([{...entry,model:{...flat,faceTextures:[215]}}],rows).colors.length,0);
});

test("raised exterior rock recovers native overhangs without creating additional floor cells",()=>{
 const rows=[".#.","?w."],boxes=curbOverhangBoxes(rows);
 assert.ok(boxes.length>0);
 assert.ok(boxes.every(b=>b.y0===FLOOR_RELIEF_MIN_Y&&b.y1===.75));
 const inside=p=>boxes.filter(b=>p[0]>b.x0&&p[0]<b.x1&&p[1]>b.y0&&p[1]<b.y1&&p[2]>b.z0&&p[2]<b.z1).length;
 assert.equal(inside([2.09,.3,.5]),1);
 assert.equal(inside([2.3,.3,.5]),1);
 assert.equal(inside([2.49,.3,.5]),0);
 assert.equal(inside([2.25,.3,1.25]),1); // native exterior corner
 assert.equal(inside([2.49,.3,1.25]),0);
 assert.equal(inside([.91,.3,.5]),0); // ambiguous cell
 assert.equal(inside([1.5,.3,-.5]),0); // playable tile
 assert.equal(inside([2.09,0,.5]),1);
 assert.equal(CURB_OVERHANG_MARGIN,.48);
 const model={...fixture,vertexPositionsX:[64,80,64],vertexPositionsY:[-63,-63,-63],vertexPositionsZ:[32,32,-32]};
 const entry={id:1,model,placement:{x:1,y:1,orientation:0},definition:def};
 assert.equal(extractCurb([entry],rows,true).overhangFaces,0);
 const out=extractCurb([entry],rows,true,true);
 assert.ok(out.overhangFaces>0);
 assert.ok(out.positions.filter((_,i)=>i%3===0).every(x=>x>=2&&x<=2.48));
 assert.equal(extractCurb([{...entry,model:{...model,vertexPositionsY:[1,1,1]}}],rows,true,true).overhangFaces,0);
});

test("original tall branches are retained only when connected to a surviving native root",()=>{
 const model={vertexCount:9,faceCount:4,
 vertexPositionsX:[-32,32,0,96,128,160,448,480,464],
 vertexPositionsY:[-64,-64,-160,-256,-400,-400,-64,-64,-384],
 vertexPositionsZ:[0,0,0,0,0,32,0,0,0],
 faceVertexIndices1:[0,2,3,6],faceVertexIndices2:[1,3,4,7],faceVertexIndices3:[2,4,5,8],
 faceColors:[12694,12694,12694,12694]};
 const entry={id:62274,model,placement:{x:1,y:1,orientation:0},definition:def};
 const result=extractTallScenery([entry],["....",".w..","...."]);
 assert.equal(result.components,1);assert.equal(result.discardedComponents,1);
 assert.ok(result.colors.length>=3);
 assert.equal(result.maxHeight,3.125);
 assert.ok(result.positions.filter((_,i)=>i%3===1).every(y=>y>=NATIVE_SCENERY_SPLIT_Y));
 assert.ok(result.positions.filter((_,i)=>i%3===0).every(x=>x<3));
 assert.equal(extractTallScenery([entry],["....","....","...."]).colors.length,0);
});

test("exposed floor edge retains rooted native sloping faces but never restores flat or detached floor",()=>{
 const rows=["....",".#..","...."],p={x:1,y:1,orientation:0};
 const slope={...fixture,vertexPositionsX:[32,96,32],vertexPositionsY:[-24,-8,-40],vertexPositionsZ:[32,32,-32]};
 const entry={id:1,model:slope,placement:p,definition:def};
 const out=extractCurb([entry],rows,true,true);
 assert.ok(out.floorEdgeFaces>0);
 assert.ok(out.positions.filter((_,i)=>i%3===0).some(x=>x>2&&x<=2.48));
 assert.equal(extractCurb([{...entry,model:{...slope,vertexPositionsY:[-24,-24,-24]}}],rows,true,true).floorEdgeFaces,0);
 assert.equal(extractCurb([{...entry,model:{...slope,vertexPositionsX:[80,96,112]}}],rows,true,true).floorEdgeFaces,0);
 assert.equal(extractCurb([entry],["....",".#?.","...."],true,true).floorEdgeFaces,0);
 const tangent={...slope,vertexPositionsX:[64,96,96]};
 assert.equal(extractCurb([{...entry,model:tangent}],rows,true,true).floorEdgeFaces,0);
 assert.equal(extractCurb([entry],rows,true,false).floorEdgeFaces,0);
});
