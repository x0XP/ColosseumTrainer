import {test} from "node:test";
import assert from "node:assert/strict";
import {patchOcellusInstancedFrames,patchOcellusSpotAge} from "./patch-ocellus-instanced-frames.mjs";
const fixture=`class Model {
 pool=null;destroyed=false;frames=[];
 ensurePool(){return Promise.resolve({id:1});}
 draw(){
    this.ensurePool()
      .then((pool) => {
        if(this.destroyed)return;
        this.frames.push(pool.id);
      })
      .catch((error) => console.error("[osrs-sdk] Cache render instance preload failed", error));
 }
}`;
test("warm native models update synchronously, cold models still allocate asynchronously",async()=>{
 const Model=new Function(patchOcellusInstancedFrames(fixture).replace("(pool: Pool)","(pool)")+";return Model")();
 const warm=new Model();warm.pool={id:2};warm.draw();assert.deepEqual(warm.frames,[2]);
 const cold=new Model();cold.draw();assert.deepEqual(cold.frames,[]);await Promise.resolve();assert.deepEqual(cold.frames,[1]);
 const dead=new Model();dead.pool={id:3};dead.destroyed=true;dead.draw();assert.deepEqual(dead.frames,[]);
});
test("unknown or already-patched SDK fails closed",()=>{
 assert.throws(()=>patchOcellusInstancedFrames(""),/anchor changed/);
 assert.throws(()=>patchOcellusInstancedFrames(patchOcellusInstancedFrames(fixture)),/anchor changed/);
});

test("absolute native effect age is applied on the first frame and hidden one-shots do not advance shared loops",()=>{
 const original=`  onSpotAnimComplete?: () => void;
        if (oneShot && visible) {
          if (this.started) this.elapsed += Math.max(0, clockDelta);
          else this.started = true;
        } else {`;
 const out=patchOcellusSpotAge(original);
 const body=out.slice(out.indexOf("        if (oneShot"))+"this.loop++;}";
 const draw=new Function("oneShot","visible","clockDelta",body);
 const model={options:{ocellusElapsed:()=>.75},elapsed:0,started:false,loop:0};
 draw.call(model,true,true,0);assert.equal(model.elapsed,.75);
 model.options.ocellusElapsed=()=>.9;
 draw.call(model,true,true,999);assert.equal(model.elapsed,.9);
 draw.call(model,true,false,999);assert.equal(model.loop,0);
 draw.call(model,false,true,.1);assert.equal(model.loop,1);
 const normal={options:{},elapsed:0,started:false,loop:0};
 draw.call(normal,true,true,.5);assert.equal(normal.elapsed,0);
 draw.call(normal,true,true,.5);assert.equal(normal.elapsed,.5);
 assert.throws(()=>patchOcellusSpotAge(out),/anchor changed/);
});
