import {test} from "node:test";
import assert from "node:assert/strict";
import {patchOcellusInstancedFrames} from "./patch-ocellus-instanced-frames.mjs";
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
