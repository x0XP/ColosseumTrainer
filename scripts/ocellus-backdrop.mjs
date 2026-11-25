import {transformVertex} from "./ocellus-native-foundation.mjs";
import {objectFaceLighting} from "./ocellus-object-lighting.mjs";

// Static sections of the enclosing wall and their corresponding lower faces.
const wallDefinitions=[
  [62897,62230,0,3], [62898,62230,0,3], [62899,62231,1,3], [62900,62232,1,3],
  [62901,62237,1,3], [62902,62239,0,3], [62905,62238,1,4], [62906,62229,0,4],
];

export function backdropPlacements(locations,origin){
  const walls=[];
  for(const [id,model,plane,count] of wallDefinitions){
    const matches=locations.filter(l=>l.id===id&&l.position.height===plane&&l.type===10);
    if(matches.length!==count)throw Error("Unexpected native wall layout: "+id);
    for(const l of matches)walls.push({id,model,plane,orientation:l.orientation,
      x:l.position.localX-origin.x,y:origin.y-l.position.localY});
  }
  return walls;
}

export function backdropFaces(model,placement,definition,heights,arenaHeight){
  const mirrored=definition.rotated ? {...model,
    vertexPositionsZ:Array.from(model.vertexPositionsZ,z=>-z),
    faceVertexIndices1:model.faceVertexIndices3,faceVertexIndices3:model.faceVertexIndices1,
  } : model;
  const light=objectFaceLighting(mirrored,placement,definition);
  const points=Array.from({length:mirrored.vertexCount},(_,i)=>{
    const p=transformVertex([mirrored.vertexPositionsX[i],mirrored.vertexPositionsY[i],mirrored.vertexPositionsZ[i]],placement,definition);
    const mx=32+p[0],my=40-p[2],x=Math.floor(mx),y=Math.min(Math.floor(my),heights[x].length-2);
    const u=mx-x,v=my-y;
    const h=(1-u)*((1-v)*heights[x][y]+v*heights[x][y+1])+
      u*((1-v)*heights[x+1][y]+v*heights[x+1][y+1]);
    p[1]+=(h-arenaHeight)/128;
    return p;
  });
  const positions=[],vertexColors=[];
  for(let f=0;f<model.faceCount;f++){
    if(((model.faceAlphas?.[f]??0)&255)!==0||model.faceRenderTypes?.[f]===2||(model.faceTextures?.[f]??-1)!==-1)continue;
    for(const index of [mirrored.faceVertexIndices1[f],mirrored.faceVertexIndices2[f],mirrored.faceVertexIndices3[f]])positions.push(...points[index]);
    vertexColors.push(...light(f));
  }
  return {positions,vertexColors};
}
