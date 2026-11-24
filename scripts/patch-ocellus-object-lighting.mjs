#!/usr/bin/env node
/** Use original object-definition lighting for the two verified map fixtures.
 * Scope: only Ocellus's pinned temporary SDK asset adapter. Raw actor models
 * and dynamic objects with unverified placement keep their original export. */
import {readFileSync,writeFileSync} from "node:fs";
import {fileURLToPath} from "node:url";
export const FIXTURE_LIGHTING=[
  {model:62357,object:62894,shape:22,orientation:3},
  {model:62739,object:62895,shape:10,orientation:1},
];
export function nativeObjectLighting(ambient,contrast,orientation){
  // Inverse quarter-turn of the fixed map light into raw model space.
  const [x,z]=[[-50,-50],[50,-50],[50,50],[-50,50]][orientation&3];
  return {ambient:ambient+64,contrast:contrast+768,x,y:-10,z};
}
export function patchOcellusObjectLighting(source){
 const anchor="        const modelPayload = await attachTextures(cache, payload(modelGroup));";
 if(source.split(anchor).length!==2)throw Error("Pinned SDK raw model payload anchor changed");
 const replacement=`        // Ocellus native map fixtures retain object rather than actor lighting.
        const fixture = (${JSON.stringify(FIXTURE_LIGHTING)}).find(entry=>entry.model===modelId);
        let modelPayload;
        if(fixture){
          const definition=await cache.getDef(IndexType.CONFIGS.id,ConfigType.OBJECT.id,fixture.object);
          if(!definition||definition.objectModels?.[definition.objectTypes?.indexOf(fixture.shape)]!==modelId
            ||definition.modelSizeX!==128||definition.modelSizeY!==128||definition.modelSizeHeight!==128
            ||!Number.isFinite(definition.ambient)||!Number.isFinite(definition.contrast))
            throw Error("Native Ocellus object lighting metadata mismatch: "+fixture.object);
          const objectLighting=(${nativeObjectLighting.toString()})(definition.ambient,definition.contrast,fixture.orientation);
          modelPayload=await attachTextures(cache,payload(modelGroup,undefined,definition,objectLighting));
          console.log("OCELLUS_NATIVE_FIXTURE_LIGHTING "+JSON.stringify({...fixture,...objectLighting}));
        }else{
          modelPayload=await attachTextures(cache,payload(modelGroup));
        }`;
 return source.replace(anchor,replacement);
}
if(process.argv[1]===fileURLToPath(import.meta.url)){
 const path=process.argv[2];if(!path)throw Error("Expected pinned SDK asset adapter");
 writeFileSync(path,patchOcellusObjectLighting(readFileSync(path,"utf8")));
}
