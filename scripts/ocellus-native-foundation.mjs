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

// Cache floor is exactly -1/128. Stay just below on the five-decimal extraction grid.
export const FOUNDATION_TOP_Y=-0.00783;
export function foundationBoxes(rows,margin=0.18){
  const occupied=(x,y)=>" #wb/".slice(1).includes(rows[y]?.[x]??".");
  const boxes=[];
  for(let y=-1;y<=rows.length;y++)for(let x=-1;x<=Math.max(...rows.map(r=>r.length));x++){
    if(occupied(x,y)){
      boxes.push({x0:x,x1:x+1,z0:y-1,z1:y,y0:-1.69,y1:FOUNDATION_TOP_Y});
      continue;
    }
    const west=occupied(x-1,y),east=occupied(x+1,y),north=occupied(x,y-1),south=occupied(x,y+1);
    if(!west&&!east&&!north&&!south)continue;
    const b=[0,margin,1-margin,1];
    // Disjoint strips outside the platform permit natural cliff overhangs,
    // without extending the playable floor or showing the collapsed room.
    for(let iz=0;iz<3;iz++)for(let ix=0;ix<3;ix++){
      if(!(west&&ix===0||east&&ix===2||north&&iz===0||south&&iz===2))continue;
      boxes.push({x0:x+b[ix],x1:x+b[ix+1],z0:y-1+b[iz],z1:y-1+b[iz+1],y0:-1.69,y1:FOUNDATION_TOP_Y});
    }
  }
  return boxes;
}

/** Retain the real rock silhouette rather than slicing every depth at
 * the same narrow tile outline. These are disjoint depth bands; only
 * below-floor source triangles are admitted. No new walkable surfaces. */
export const FOUNDATION_ENVELOPE=[
 {top:FOUNDATION_TOP_Y,bottom:-.35,margin:.48},
 {top:-.35,bottom:-1.2,margin:.60},
 {top:-1.2,bottom:-3.19,margin:.75},
];
export function foundationEnvelopeBoxes(rows){
 const occupied=(x,y)=>"#wb/".includes(rows[y]?.[x]??".");
 const width=Math.max(...rows.map(r=>r.length)),boxes=[];
 for(const {top,bottom,margin} of FOUNDATION_ENVELOPE){
  const cuts=[...new Set([0,margin,1-margin,1])].sort((a,b)=>a-b);
  for(let y=-1;y<=rows.length;y++)for(let x=-1;x<=width;x++){
   if(occupied(x,y)){boxes.push({x0:x,x1:x+1,z0:y-1,z1:y,y0:bottom,y1:top});continue;}
   for(let iz=0;iz<cuts.length-1;iz++)for(let ix=0;ix<cuts.length-1;ix++){
    const cx=(cuts[ix]+cuts[ix+1])/2,cz=(cuts[iz]+cuts[iz+1])/2;
    // Chebyshev dilation of the native footprint; corners are retained
    // only beneath the shallow lip, not as new upper platform cells.
    const near=occupied(x-1,y)&&cx<margin||occupied(x+1,y)&&cx>1-margin||
      occupied(x,y-1)&&cz<margin||occupied(x,y+1)&&cz>1-margin||
      top<FOUNDATION_TOP_Y&&(
       occupied(x-1,y-1)&&cx<margin&&cz<margin||
       occupied(x+1,y-1)&&cx>1-margin&&cz<margin||
       occupied(x-1,y+1)&&cx<margin&&cz>1-margin||
       occupied(x+1,y+1)&&cx>1-margin&&cz>1-margin);
    if(near)boxes.push({x0:x+cuts[ix],x1:x+cuts[ix+1],z0:y-1+cuts[iz],z1:y-1+cuts[iz+1],y0:bottom,y1:top});
   }
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
  const minDepth=Math.min(...boxes.map(box=>box.y0));
  let sourceFaces=0,clippedFaces=0,skippedTextureFaces=0,duplicateFaces=0;
  for(let i=0;i<model.faceCount;i++){
    if(((model.faceAlphas?.[i]??0)&255)!==0||model.faceRenderTypes?.[i]===2)continue;
    if((model.faceTextures?.[i]??-1)!==-1){skippedTextureFaces++;continue;}
    const triangle=[model.faceVertexIndices1[i],model.faceVertexIndices2[i],model.faceVertexIndices3[i]].map(index=>vertices[index]);
    if(triangle.some(v=>!v||v.some(n=>!Number.isFinite(n))))continue;
    const min=[0,1,2].map(axis=>Math.min(...triangle.map(v=>v[axis])));
    const max=[0,1,2].map(axis=>Math.max(...triangle.map(v=>v[axis])));
    if(min[1]>FOUNDATION_TOP_Y||max[1]<minDepth)continue;
    sourceFaces++;
    const color=nativeFaceRgb((model.faceColors?.[i]??0)&65535);
    const lit=light(i);
    // A face coplanar with a shared clipping-box boundary can be
    // emitted by both boxes. Deduplicate only within this source face,
    // preserving coincident faces from distinct original materials.
    const seen=new Set();
    for(const box of boxes){
      if(max[0]<box.x0||min[0]>box.x1||max[2]<box.z0||min[2]>box.z1)continue;
      const polygon=clipBox(triangle,box);
      for(let j=1;j+1<polygon.length;j++){
        const face=[polygon[0],polygon[j],polygon[j+1]];
        if(triangleAreaSquared(...face)<1e-10)continue;
        const rounded=face.map(vertex=>vertex.map(n=>Math.round(n*100000)/100000));
        if(triangleAreaSquared(...rounded)<1e-10)continue;
        const key=rounded.map(vertex=>vertex.join(",")).sort().join(";");
        if(seen.has(key)){duplicateFaces++;continue;}
        seen.add(key);
        for(let k=0;k<face.length;k++){
          positions.push(...rounded[k]);
          vertexColors.push(triangleColorAt(triangle,lit,face[k]));
        }
        colors.push(color);
        clippedFaces++;
      }
    }
  }
  return {positions,colors,vertexColors,sourceFaces,clippedFaces,skippedTextureFaces,duplicateFaces};
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
/** Preserve original small raised lips that intrude into a playable tile.
 * Exclude the baked flat floor plane itself to prevent depth fighting. */
export const FLOOR_RELIEF_MIN_Y=-1/128+.0001;
export function floorReliefBoxes(rows){
 const result=[];
 for(let y=0;y<rows.length;y++)for(let x=0;x<rows[y].length;x++){
  if(rows[y][x]==="#")result.push({x0:x,x1:x+1,z0:y-1,z1:y,y0:FLOOR_RELIEF_MIN_Y,y1:.75,relief:true});
 }
 return result;
}
/** Native raised-rock overhangs on the exterior of the surviving curb.
 * Disjoint strips avoid extending flat ground, and reject ambiguous cells
 * adjacent only to playable floor. All faces still come from cache models. */
export const CURB_OVERHANG_MARGIN=.48;
export function curbOverhangBoxes(rows,includeFloorEdge=false){
 const occupied=(x,y)=>"#wb/".includes(rows[y]?.[x]??".");
 const curb=(x,y)=>"wb/".includes(rows[y]?.[x]??".");
 const floor=(x,y)=>rows[y]?.[x]==="#";
 const m=CURB_OVERHANG_MARGIN,cuts=[0,m,1-m,1],boxes=[];
 const width=Math.max(...rows.map(r=>r.length));
 for(let y=-1;y<=rows.length;y++)for(let x=-1;x<=width;x++){
  if(occupied(x,y)||rows[y]?.[x]==="?")continue;
  for(let iz=0;iz<3;iz++)for(let ix=0;ix<3;ix++){
   // Keep corner pieces of the original sloping rim as well as cardinal
   // strips. Otherwise clipping creates a serrated stair-step silhouette.
   const adjacent=contains=>contains(x-1,y)&&ix===0||contains(x+1,y)&&ix===2||contains(x,y-1)&&iz===0||contains(x,y+1)&&iz===2||
     contains(x-1,y-1)&&ix===0&&iz===0||contains(x+1,y-1)&&ix===2&&iz===0||
     contains(x-1,y+1)&&ix===0&&iz===2||contains(x+1,y+1)&&ix===2&&iz===2;
   const near=adjacent(curb),floorEdge=!near&&includeFloorEdge&&adjacent(floor);
   if(!near&&!floorEdge)continue;
   boxes.push({x0:x+cuts[ix],x1:x+cuts[ix+1],z0:y-1+cuts[iz],z1:y-1+cuts[iz+1],y0:floorEdge?FLOOR_RELIEF_MIN_Y:1/128,y1:.75,overhang:true,floorEdge});
  }
 }
 return boxes;
}
export function extractCurb(models,rows,includeFloorRelief=false,includeOverhang=false){
  const curb=curbBoxes(rows),relief=includeFloorRelief?floorReliefBoxes(rows):[];
  const overhang=includeOverhang?curbOverhangBoxes(rows,true):[];
  const boxes=[...curb,...relief,...overhang],positions=[],colors=[],vertexColors=[],sources=[],seen=new Set();
  let raisedFloorFaces=0,overhangFaces=0,floorEdgeFaces=0;
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
      // Only original sloping faces rooted in the surviving floor can
      // extend across its exposed edge. Never recover extra flat tiles.
      let rooted;
      for(const box of boxes){
        if(max[0]<box.x0||min[0]>box.x1||max[2]<box.z0||min[2]>box.z1)continue;
        if(box.floorEdge){
          if(max[1]-min[1]<1e-7)continue;
          rooted??=relief.some(r=>!(max[0]<r.x0||min[0]>r.x1||max[2]<r.z0||min[2]>r.z1)&&clipBox(triangle,r).length>=3);
          if(!rooted)continue;
        }
        const poly=clipBox(triangle,box);
        for(let j=1;j+1<poly.length;j++){
          const face=[poly[0],poly[j],poly[j+1]].map(rounded);
          if(triangleAreaSquared(...face)<1e-10)continue;
          const shades=face.map(vertex=>triangleColorAt(triangle,lit,vertex));
          // Deduplicate only identical geometry AND material/lighting.
          // Opposite-facing or differently coloured native faces must not
          // disappear just because their clipped positions coincide.
          const start=face.reduce((best,v,i)=>v.join(",")<face[best].join(",")?i:best,0);
          const key=color+":"+[0,1,2].map(i=>{
            const j=(start+i)%3;
            return face[j].join(",")+":"+shades[j];
          }).join(";");
          if(seen.has(key))continue;
          seen.add(key);
          positions.push(...face.flat());
          vertexColors.push(...shades);
          colors.push(color);
          faces++;
          if(box.relief)raisedFloorFaces++;
          if(box.overhang)overhangFaces++;
          if(box.floorEdge)floorEdgeFaces++;
        }
      }
    }
    sources.push({model:id,faces});
  }
  return {positions,colors,vertexColors,sources,tiles:curb.length,raisedFloorFaces,reliefTiles:relief.length,overhangBoxes:overhang.length,overhangFaces,floorEdgeFaces};
}

/** Recover the actual flat stone triangles with their native vertex
 * colours. The old texture is retained only as an underlay for genuine
 * source gaps. Neither relief nor the collapsed area is painted here. */
export function extractNativeFlatFloor(models,rows){
 const y=-1/128,boxes=[];
 for(let z=0;z<rows.length;z++)for(let x=0;x<rows[z].length;x++)
  if(rows[z][x]==="#")boxes.push({x0:x,x1:x+1,z0:z-1,z1:z,y0:y,y1:y});
 const positions=[],colors=[],vertexColors=[],sources=[],seen=new Set();
 for(const {id,model,placement,definition} of models){
  const vertices=Array.from({length:model.vertexCount},(_,i)=>transformVertex([model.vertexPositionsX[i],model.vertexPositionsY[i],model.vertexPositionsZ[i]],placement,definition));
  const light=objectFaceLighting(model,placement,definition);
  let faces=0;
  for(let f=0;f<model.faceCount;f++){
   if(((model.faceAlphas?.[f]??0)&255)!==0||(model.faceTextures?.[f]??-1)!==-1||model.faceRenderTypes?.[f]===2)continue;
   const tri=[model.faceVertexIndices1[f],model.faceVertexIndices2[f],model.faceVertexIndices3[f]].map(i=>vertices[i]);
   if(tri.some(v=>!v||!v.every(Number.isFinite)||Math.abs(v[1]-y)>1e-7))continue;
   const faceRgb=nativeFaceRgb((model.faceColors?.[f]??0)&65535),lit=light(f);
   const x0=Math.min(...tri.map(v=>v[0])),x1=Math.max(...tri.map(v=>v[0])),z0=Math.min(...tri.map(v=>v[2])),z1=Math.max(...tri.map(v=>v[2]));
   for(const box of boxes){
    if(x1<box.x0||x0>box.x1||z1<box.z0||z0>box.z1)continue;
    const poly=clipBox(tri,box);
    for(let j=1;j+1<poly.length;j++){
     const face=[poly[0],poly[j],poly[j+1]].map(v=>[Math.round(v[0]*1e7)/1e7,y,Math.round(v[2]*1e7)/1e7]);
     if(triangleAreaSquared(...face)<1e-10)continue;
     // The raster sampler picks the first source at equal height. Keep
     // original source order; do not layer identical coplanar triangles.
     const key=face.map(v=>v.join(",")).sort().join(";");
     if(seen.has(key))continue;
     seen.add(key);positions.push(...face.flat());colors.push(faceRgb);
     vertexColors.push(...face.map(v=>triangleColorAt(tri,lit,v)));faces++;
    }
   }
  }
  sources.push({model:id,faces});
 }
 return {positions,colors,vertexColors,sources,tiles:boxes.length,floorY:y};
}

/** Restore native vertical scenery that the old .75-tile curb ceiling
 * amputated. The decoded source models contain features up to 6.734 tiles
 * high. Admit only connected upper components with a root intersecting
 * the surviving floor/curb. Original branches may extend beyond the mask.
 * No adjacent collapsed map object or synthetic model is introduced. */
export const NATIVE_SCENERY_SPLIT_Y=.75;
export const NATIVE_SCENERY_MAX_Y=7;
export function extractTallScenery(models,rows){
 const split=NATIVE_SCENERY_SPLIT_Y,high=NATIVE_SCENERY_MAX_Y;
 const roots=[...curbBoxes(rows),...floorReliefBoxes(rows),...curbOverhangBoxes(rows)]
   .map(box=>({...box,y0:split-.05,y1:split}));
 const positions=[],colors=[],vertexColors=[],sources=[];
 let components=0,discardedComponents=0;
 for(const {id,model,placement,definition} of models){
  const vertices=Array.from({length:model.vertexCount},(_,i)=>transformVertex([model.vertexPositionsX[i],model.vertexPositionsY[i],model.vertexPositionsZ[i]],placement,definition));
  const light=objectFaceLighting(model,placement,definition);
  const faces=[],owners=new Map(),parents=[];
  const find=i=>{while(parents[i]!==i){parents[i]=parents[parents[i]];i=parents[i];}return i;};
  const union=(a,b)=>{const ra=find(a),rb=find(b);if(ra!==rb)parents[rb]=ra;};
  for(let f=0;f<model.faceCount;f++){
   if(((model.faceAlphas?.[f]??0)&255)!==0||(model.faceTextures?.[f]??-1)!==-1||model.faceRenderTypes?.[f]===2)continue;
   const tri=[model.faceVertexIndices1[f],model.faceVertexIndices2[f],model.faceVertexIndices3[f]].map(i=>vertices[i]);
   if(tri.some(v=>!v||!v.every(Number.isFinite)))continue;
   const minY=Math.min(...tri.map(v=>v[1])),maxY=Math.max(...tri.map(v=>v[1]));
   if(maxY<=split||maxY>high)continue;
   const x0=Math.min(...tri.map(v=>v[0])),x1=Math.max(...tri.map(v=>v[0])),z0=Math.min(...tri.map(v=>v[2])),z1=Math.max(...tri.map(v=>v[2]));
   const rooted=minY<=split&&roots.some(box=>!(x1<box.x0||x0>box.x1||z1<box.z0||z0>box.z1)&&clipBox(tri,box).length>=2);
   const index=faces.length;faces.push({f,tri,rooted});parents.push(index);
   // Coordinate identity also joins coincident cache vertices split at a
   // material seam. Only upper candidates participate in the component.
   for(const point of tri){
    const key=point.join(",");
    const previous=owners.get(key);
    if(previous!==undefined)union(index,previous);
    else owners.set(key,index);
   }
  }
  const accepted=new Set(faces.flatMap((face,i)=>face.rooted?[find(i)]:[]));
  const all=new Set(faces.map((_,i)=>find(i)));
  components+=accepted.size;discardedComponents+=all.size-accepted.size;
  let count=0;
  for(let i=0;i<faces.length;i++){
   if(!accepted.has(find(i)))continue;
   const {f,tri}=faces[i],poly=clipPlane(tri,1,split,true);
   const lit=light(f),rgb=nativeFaceRgb((model.faceColors?.[f]??0)&65535);
   for(let j=1;j+1<poly.length;j++){
    const face=[poly[0],poly[j],poly[j+1]].map(p=>p.map(v=>Math.round(v*1e7)/1e7));
    if(triangleAreaSquared(...face)<1e-10)continue;
    positions.push(...face.flat());colors.push(rgb);
    vertexColors.push(...face.map(p=>triangleColorAt(tri,lit,p)));count++;
   }
  }
  sources.push({model:id,faces:count,components:accepted.size,discardedComponents:all.size-accepted.size});
 }
 const maxHeight=positions.reduce((m,v,i)=>i%3===1?Math.max(m,v):m,split);
 return {positions,colors,vertexColors,sources,components,discardedComponents,maxHeight};
}
