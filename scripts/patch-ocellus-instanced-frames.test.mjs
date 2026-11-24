import {test} from "node:test";
import assert from "node:assert/strict";
import {patchOcellusInstancedFrames,patchOcellusSpotAge,patchOcellusPosedAlpha,patchOcellusSpotLoop} from "./patch-ocellus-instanced-frames.mjs";
const fixture=`class Model {
 pool=null;destroyed=false;frames=[];ocellusDrawRequest=0;
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

test("posed cache alpha selects the transparent material queue even when bind pose is opaque",()=>{
 const original=`        const materialOptions = {
          transparent: Boolean(payload.alphas?.some((alpha) => alpha !== 0)),
        };
        const frameData = posedFrames(
          payload.positions,
          baseAlphas,
          groups,
          sources,
          alphaGroups,
          payload.animayaGroups ?? [],
          payload.animayaScales ?? [],
          animation,
        );
        return materialOptions.transparent;`;
 const patched=patchOcellusPosedAlpha(original);
 assert.ok(patched.indexOf("const frameData")<patched.indexOf("const materialOptions"));
 const run=new Function("payload","baseAlphas","groups","sources","alphaGroups","animation","posedFrames",patched);
 const args=[{alphas:[0,0]},[],[],[],[],null];
 assert.equal(run(...args,()=>[{alphas:new Float32Array([0,0])},{alphas:new Float32Array([0,128])}]),true);
 assert.equal(run(...args,()=>[{alphas:new Float32Array([0,0])}]),false);
 assert.throws(()=>patchOcellusPosedAlpha(patched),/anchor changed/);
});

test("native fragment loops retain their own time, world basis and sound timeline",()=>{
 const source=`  ocellusElapsed?: () => number;
        const oneShot = this.reference.kind === "spotAnim";
        const animationSample = pool.animation ? sampleAnimation(pool.animation, animationTime, !oneShot) : undefined;
        const animationEnded =
          oneShot &&
          animationTime >= 0 &&
          (!hasAnimation || pool.animationTotal <= 0 || animationTime >= pool.animationTotal);
        this.frameSoundPlayer.advance(
              pool.animationId,
              pool.animation,
              Math.min(animationTime, pool.animationTotal),
              false,
              soundLocation,
            );
        const basisRotation = oneShot ? 0 : Math.PI / 2;
        return {animationSample,animationEnded,basisRotation};`;
 const out=patchOcellusSpotLoop(source);
 const run=new Function("pool","animationTime","hasAnimation","sampleAnimation","soundLocation",out.slice(out.indexOf("        const oneShot")));
 const calls=[];
 const self={reference:{kind:"spotAnim"},options:{ocellusLoop:true},frameSoundPlayer:{advance(...a){calls.push(a)}}};
 const pool={animation:{},animationId:14914,animationTotal:.64};
 const result=run.call(self,pool,1.3,true,(_a,t,loop)=>({t,loop}),{x:3,y:4});
 assert.deepEqual(result,{animationSample:{t:1.3,loop:true},animationEnded:false,basisRotation:0});
 assert.equal(calls[0][2],1.3);assert.equal(calls[0][3],true);
 self.options={};const ended=run.call(self,pool,1.3,true,(_a,t,loop)=>({t,loop}),{});
 assert.equal(ended.animationEnded,true);assert.equal(calls[1][2],.64);assert.equal(calls[1][3],false);
 assert.throws(()=>patchOcellusSpotLoop(out),/anchor changed/);
});

test("cold native draws submit only the latest position after allocation",async()=>{
 const source=fixture.replace("draw(){","draw(position){").replace("this.frames.push(pool.id)","this.frames.push(position)");
 const Model=new Function(patchOcellusInstancedFrames(source).replace("(pool: Pool)","(pool)")+";return Model")();
 const model=new Model();model.draw(1);model.draw(2);model.draw(3);
 await Promise.resolve();assert.deepEqual(model.frames,[3]);
 model.pool={id:1};model.draw(4);assert.deepEqual(model.frames,[3,4]);
});
