import test from "node:test";
import assert from "node:assert/strict";
import {SCENERY_LAYERS,validateSceneryRaster,verifySceneryRaster} from "./ocellus-scenery-pixel-proof.mjs";
const proof=(counts,width=390,height=720)=>({width,height,layers:counts.map((changed,i)=>({name:SCENERY_LAYERS[i],changed,fraction:changed/(width*height)}))});
test("known cliff and curb raster counts pass; backdrop can be hidden on some angles",()=>{
 const mobile=proof([1804,3069,0]),views=[proof([500,2000,0]),proof([100,400,0]),proof([0,300,1200]),proof([0,100,0])];
 const result=verifySceneryRaster(views,mobile);
 assert.equal(result.mobile[SCENERY_LAYERS[0]],1804/(390*720));
 assert.equal(result.maxima[SCENERY_LAYERS[2]],1200/(390*720));
});
test("missing native layers or missing mobile cliff fail even when scene nodes exist",()=>{
 const mobile=proof([1804,3069,0]),views=Array(4).fill(proof([1000,1000,0]));
 assert.throws(()=>verifySceneryRaster(views,mobile),/missing actual visible raster/);
 assert.throws(()=>verifySceneryRaster(Array(4).fill(proof([1000,1000,1000])),proof([0,3069,1000])),/portrait cliff/);
 assert.throws(()=>validateSceneryRaster({...mobile,layers:[mobile.layers[0],mobile.layers[0],mobile.layers[2]]}),/Malformed native scenery layer/);
 assert.throws(()=>verifySceneryRaster([],mobile),/Four native/);
});
