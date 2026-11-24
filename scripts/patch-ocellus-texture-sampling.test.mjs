import {test} from "node:test";
import assert from "node:assert/strict";
import {patchOcellusTextureSampling} from "./patch-ocellus-texture-sampling.mjs";
test("cache textures repeat, convert display RGB exactly once and keep native near texels",()=>{
 const before=`    image.flipY = false;
    image.needsUpdate = true;`;
 const out=patchOcellusTextureSampling(before);
 const image={};
 const THREE={SRGBColorSpace:"srgb",RepeatWrapping:1000,NearestFilter:1003,NearestMipmapLinearFilter:1005};
 new Function("image","THREE",out)(image,THREE);
 assert.deepEqual(image,{flipY:false,colorSpace:"srgb",wrapS:1000,wrapT:1000,magFilter:1003,minFilter:1005,generateMipmaps:true,needsUpdate:true});
 assert.throws(()=>patchOcellusTextureSampling(out),/anchor changed/);
});
