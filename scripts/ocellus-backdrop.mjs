import {transformVertex} from "./ocellus-native-foundation.mjs";
import {objectFaceLighting} from "./ocellus-object-lighting.mjs";

// Fixed objects from region 16472 plane 1. Tile coordinates here use the
// same arena-local convention as the platform extraction.
export const BACKDROP = [
  {id:62900,model:62232,x:18,y:10,orientation:3},
  {id:62901,model:62237,x:17,y:3,orientation:1},
  {id:62905,model:62238,x:11,y:18,orientation:2},
];

export function backdropFaces(model,placement,definition,heights){
  const mirrored=definition.rotated ? {...model,
    vertexPositionsZ:Array.from(model.vertexPositionsZ,z=>-z),
    faceVertexIndices1:model.faceVertexIndices3,faceVertexIndices3:model.faceVertexIndices1,
  } : model;
  const light=objectFaceLighting(mirrored,placement,definition);
  const points=Array.from({length:mirrored.vertexCount},(_,i)=>{
    const p=transformVertex([mirrored.vertexPositionsX[i],mirrored.vertexPositionsY[i],mirrored.vertexPositionsZ[i]],placement,definition);
    const mx=32+p[0],my=40-p[2],x=Math.floor(mx),y=Math.floor(my);
    const u=mx-x,v=my-y;
    const h=(1-u)*((1-v)*heights[x][y]+v*heights[x][y+1])+
      u*((1-v)*heights[x+1][y]+v*heights[x+1][y+1]);
    p[1]+=(h-heights[32][40])/128;
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
