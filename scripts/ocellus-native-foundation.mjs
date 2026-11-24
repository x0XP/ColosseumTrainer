// Native model coordinates and disjoint clipping for the surviving P4 foundation.
// Original packed-HSL faces receive cache object lighting. Textured and
// transparent faces are excluded rather than assigned invented materials.
import { nativeFaceRgb, objectFaceLighting, triangleColorAt } from "./ocellus-object-lighting.mjs";
export { nativeFaceRgb } from "./ocellus-object-lighting.mjs";
export function transformVertex(v, placement, definition) {
  const [rawX,rawY,rawZ]=v;
  const orientation=placement.orientation&3;
  const [x,z]=[[rawX,rawZ],[rawZ,-rawX],[-rawX,-rawZ],[-rawZ,rawX]][orientation];
  const width=orientation&1?definition.sizeY:definition.sizeX;
  const height=orientation&1?definition.sizeX:definition.sizeY;
  return [
    placement.x+width/2+(x+definition.offsetX)/128,
    (-rawY-definition.offsetHeight)/128,
    placement.y-height/2-(z+definition.offsetY)/128
  ];
}

function clipPlane(vertices,axis,limit,keepGreater){
  if (!vertices.length) return [];
  const result=[];
  const distance=v=>(v[axis]-limit)*(keepGreater?1:-1);
  let a=vertices[vertices.length-1],da=distance(a);
  for(const b of vertices){
    const db=distance(b),aIn=da>=0,bIn=db>=0;
    if(aIn!==bIn){
      const t=da/(da-db);
      const p=a.map((value,i)=>value+(b[i]-value)*t);
      p[axis]=limit;
      result.push(p);
    }
    if(bIn) result.push(b);
    a=b;da=db;
  }
  return result;
}

export function clipBox(vertices,box){
  return clipPlane(clipPlane(clipPlane(clipPlane(clipPlane(clipPlane(vertices,0,box.x0,true),0,box.x1,false),1,box.y0,true),1,box.y1,false),2,box.z0,true),2,box.z1,false);
}

export function foundationBoxes(rows,margin=0.18){
  const occupied=(x,y)=>" #wb/".slice(1).includes(rows[y]?.[x]??".");
  const boxes=[];
  for(let y=-1;y<=rows.length;y++)for(let x=-1;x<=Math.max(...rows.map(r=>r.length));x++){
    if(occupied(x,y)){
      boxes.push({x0:x,x1:x+1,z0:y-1,z1:y,y0:-1.69,y1:-0.015});
      continue;
    }
    const west=occupied(x-1,y),east=occupied(x+1,y),north=occupied(x,y-1),south=occupied(x,y+1);
    if(!west&&!east&&!north&&!south)continue;
    const b=[0,margin,1-margin,1];
    // Disjoint strips outside the platform permit natural cliff overhangs,
    // without extending the playable floor or showing the collapsed room.
    for(let iz=0;iz<3;iz++)for(let ix=0;ix<3;ix++){
      if(!(west&&ix===0||east&&ix===2||north&&iz===0||south&&iz===2))continue;
      boxes.push({x0:x+b[ix],x1:x+b[ix+1],z0:y-1+b[iz],z1:y-1+b[iz+1],y0:-1.69,y1:-0.015});
    }
  }
  return boxes;
}

function triangleAreaSquared(a,b,c){
  const u=b.map((v,i)=>v-a[i]),v=c.map((v,i)=>v-a[i]);
  const n=[u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]];
  return n.reduce((sum,x)=>sum+x*x,0);
}

export function extractFoundation(model,placement,definition,boxes){
  const vertices=Array.from({length:model.vertexCount},(_,i)=>transformVertex([model.vertexPositionsX[i],model.vertexPositionsY[i],model.vertexPositionsZ[i]],placement,definition));
  const positions=[],colors=[],vertexColors=[];
  const light=objectFaceLighting(model,placement,definition);
  let sourceFaces=0,clippedFaces=0,skippedTextureFaces=0;
  for(let i=0;i<model.faceCount;i++){
    if(((model.faceAlphas?.[i]??0)&255)!==0||model.faceRenderTypes?.[i]===2)continue;
    if((model.faceTextures?.[i]??-1)!==-1){skippedTextureFaces++;continue;}
    const triangle=[model.faceVertexIndices1[i],model.faceVertexIndices2[i],model.faceVertexIndices3[i]].map(index=>vertices[index]);
    if(triangle.some(v=>!v||v.some(n=>!Number.isFinite(n))))continue;
    const min=[0,1,2].map(axis=>Math.min(...triangle.map(v=>v[axis])));
    const max=[0,1,2].map(axis=>Math.max(...triangle.map(v=>v[axis])));
    if(min[1]>-0.015||max[1]<-1.69)continue;
    sourceFaces++;
    const color=nativeFaceRgb((model.faceColors?.[i]??0)&65535);
    const lit=light(i);
    for(const box of boxes){
      if(max[0]<box.x0||min[0]>box.x1||max[2]<box.z0||min[2]>box.z1)continue;
      const polygon=clipBox(triangle,box);
      for(let j=1;j+1<polygon.length;j++){
        const face=[polygon[0],polygon[j],polygon[j+1]];
        if(triangleAreaSquared(...face)<1e-10)continue;
        for(const vertex of face){
          positions.push(...vertex.map(n=>Math.round(n*100000)/100000));
          vertexColors.push(triangleColorAt(triangle,lit,vertex));
        }
        colors.push(color);
        clippedFaces++;
      }
    }
  }
  return {positions,colors,vertexColors,sourceFaces,clippedFaces,skippedTextureFaces};
}

// Clip original upper stone and vertical faces to the visual curb footprint.
// Do not fill uncovered outer cells with a synthetic rectangular cap.
export function curbBoxes(rows) {
  const result=[];
  for(let y=0;y<rows.length;y++)for(let x=0;x<rows[y].length;x++){
    if(!"wb/".includes(rows[y][x]))continue;
    result.push({x0:x,x1:x+1,z0:y-1,z1:y,y0:-1/128,y1:.75});
  }
  return result;
}
export function extractCurb(models,rows){
  const boxes=curbBoxes(rows),positions=[],colors=[],vertexColors=[],sources=[],seen=new Set();
  const rounded=v=>v.map(n=>Math.round(n*1e7)/1e7);
  for(const {id,model,placement,definition} of models){
    const vertices=Array.from({length:model.vertexCount},(_,i)=>transformVertex([model.vertexPositionsX[i],model.vertexPositionsY[i],model.vertexPositionsZ[i]],placement,definition));
    let faces=0;
    const light=objectFaceLighting(model,placement,definition);
    for(let f=0;f<model.faceCount;f++){
      if(((model.faceAlphas?.[f]??0)&255)!==0 || (model.faceTextures?.[f]??-1)!==-1 || model.faceRenderTypes?.[f]===2)continue;
      const triangle=[model.faceVertexIndices1[f],model.faceVertexIndices2[f],model.faceVertexIndices3[f]].map(i=>vertices[i]);
      if(triangle.some(v=>!v||v.some(n=>!Number.isFinite(n))))continue;
      const min=[0,1,2].map(i=>Math.min(...triangle.map(v=>v[i]))),max=[0,1,2].map(i=>Math.max(...triangle.map(v=>v[i])));
      if(max[1]<-1/128||min[1]>.75)continue;
      const color=nativeFaceRgb((model.faceColors?.[f]??0)&65535);
      const lit=light(f);
      for(const box of boxes){
        if(max[0]<box.x0||min[0]>box.x1||max[2]<box.z0||min[2]>box.z1)continue;
        const poly=clipBox(triangle,box);
        for(let j=1;j+1<poly.length;j++){
          const face=[poly[0],poly[j],poly[j+1]].map(rounded);
          if(triangleAreaSquared(...face)<1e-10)continue;
          const key=face.map(v=>v.join(",")).sort().join(";");
          // A vertical face on a shared tile edge can be clipped twice.
          if(seen.has(key))continue;
          seen.add(key);
          positions.push(...face.flat());
          vertexColors.push(...face.map(vertex=>triangleColorAt(triangle,lit,vertex)));
          colors.push(color);
          faces++;
        }
      }
    }
    sources.push({model:id,faces});
  }
  return {positions,colors,vertexColors,sources,tiles:boxes.length};
}
