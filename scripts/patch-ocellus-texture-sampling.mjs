#!/usr/bin/env node
/** The cache's packed texture RGB is display-space colour, as are the
 * vertex colours. Decode it once to the Three.js working colour space.
 * UVs are native repeating tile coordinates, including negative values. */
import {readFileSync,writeFileSync} from "node:fs";
import {fileURLToPath} from "node:url";
export function patchOcellusTextureSampling(source){
 const anchor=`    image.flipY = false;
    image.needsUpdate = true;`;
 if(source.split(anchor).length!==2)throw Error("Pinned SDK texture sampling anchor changed");
 return source.replace(anchor,`    image.flipY = false;
    image.colorSpace=THREE.SRGBColorSpace;
    image.wrapS=THREE.RepeatWrapping;
    image.wrapT=THREE.RepeatWrapping;
    image.magFilter=THREE.NearestFilter;
    image.minFilter=THREE.NearestMipmapLinearFilter;
    image.generateMipmaps=true;
    image.needsUpdate = true;`);
}
if(process.argv[1]===fileURLToPath(import.meta.url)){
 const file=process.argv[2];if(!file)throw Error("Expected SDK textureImages.ts");
 writeFileSync(file,patchOcellusTextureSampling(readFileSync(file,"utf8")));
}
