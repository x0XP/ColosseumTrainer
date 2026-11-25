import {objectFaceLighting} from "./ocellus-object-lighting.mjs";

// Static sections of the enclosing wall and their corresponding lower faces.
const wallDefinitions=[
  [62897,62230,0,3], [62898,62230,0,3], [62899,62231,1,3], [62900,62232,1,3],
  [62901,62237,1,3], [62902,62239,0,3], [62905,62238,1,4], [62906,62229,0,4],
  [62907,62233,0,2], [62908,62235,0,2], [62909,62236,0,2], [62910,62234,1,2],
  [62911,62241,0,4], [62912,62241,0,1], [62913,62241,0,1], [62914,62242,0,3],
  [62915,62242,0,1], [62916,62243,0,3], [62917,62243,0,1], [62918,62244,0,4],
  [62919,62244,0,1], [62920,62245,0,2], [62921,62246,0,2], [62922,62247,0,2],
];

export function backdropPlacements(locations,origin){
  const walls=[];
  for(const [id,model,plane,count] of wallDefinitions){
    const matches=locations.filter(l=>l.id===id&&l.position.height===plane&&(l.type===10||l.type===11));
    if(matches.length!==count)throw Error("Unexpected native wall layout: "+id);
    for(const l of matches)walls.push({id,model,plane,type:l.type,orientation:l.orientation,
      x:l.position.localX-origin.x,y:origin.y-l.position.localY});
  }
  return walls;
}

export function backdropFaces(model,placement,definition,heights,arenaHeight){
  const mirrored=definition.rotated ? {...model,
    vertexPositionsZ:Array.from(model.vertexPositionsZ,z=>-z),
    faceVertexIndices1:model.faceVertexIndices3,faceVertexIndices3:model.faceVertexIndices1,
  } : model;
  const turn=placement.orientation&3;
  const width=turn&1?definition.sizeY:definition.sizeX;
  const length=turn&1?definition.sizeX:definition.sizeY;
  const oriented={...mirrored,vertexPositionsX:[],vertexPositionsY:[],vertexPositionsZ:[]};
  for(let i=0;i<model.vertexCount;i++){
    const x=mirrored.vertexPositionsX[i],z=mirrored.vertexPositionsZ[i];
    const [rx,rz]=[[x,z],[z,-x],[-x,-z],[-z,x]][turn];
    // Cache definitions resize the oriented axes before applying offsets.
    oriented.vertexPositionsX.push(Math.trunc(rx*(definition.modelSizeX??128)/128)+definition.offsetX);
    oriented.vertexPositionsY.push(Math.trunc(mirrored.vertexPositionsY[i]*(definition.modelSizeHeight??128)/128)+definition.offsetHeight);
    oriented.vertexPositionsZ.push(Math.trunc(rz*(definition.modelSizeY??128)/128)+definition.offsetY);
  }
  const light=objectFaceLighting(oriented,{orientation:0},definition);
  const points=Array.from({length:oriented.vertexCount},(_,i)=>{
    let xLocal=oriented.vertexPositionsX[i],zLocal=oriented.vertexPositionsZ[i];
    if(placement.type===11){
      [xLocal,zLocal]=[(xLocal+zLocal)*Math.SQRT1_2,(zLocal-xLocal)*Math.SQRT1_2];
    }
    const p=[placement.x+width/2+xLocal/128,-oriented.vertexPositionsY[i]/128,placement.y-length/2-zLocal/128];
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
