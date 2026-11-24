import {test} from "node:test";
import assert from "node:assert/strict";
import {patchOcellusInstancedFrames,patchOcellusSpotAge,patchOcellusPosedAlpha,patchOcellusSpotLoop,patchOcellusInstanceGeometry,patchOcellusWarmPools,patchOcellusColdPoolDraw,partitionNativeFrameIndices,patchOcellusInstancedAlphaPasses} from "./patch-ocellus-instanced-frames.mjs";
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

const geometryFixture=`import { cacheColorsToRgba, normalizeCacheAlpha } from "./utils/colors";
function drawsOf(frame: AnimationFrameMesh) {}
const split = splitTexturedFaces(payload.textureIds, indices, available);
        pool!.frames = frameData.map((frame) => {
          const colors =
            payload.colors && payload.colors.length * 3 === payload.positions.length
              ? cacheColorsToRgba(payload.colors, frame.alphas, spotPayload?.faceColors, recolor)
              : null;
          const uv = uvs ? new THREE.Float32BufferAttribute(uvs, 2) : null;
            geometry.computeVertexNormals();
          return {colors,uv};
        });
        previous.active.delete(this.slot);
      mesh.count = pool.next;`;
test("native instanced materials follow index order instead of sequential vertex order",()=>{
 const out=patchOcellusInstanceGeometry(geometryFixture);
 const line=out.split("\n").find(s=>s.includes("const split =")).replace("textureIds!","textureIds");
 const split=new Function("payload","indices","available","splitTexturedFaces",line+";return split");
 assert.deepEqual(split({textureIds:[-1,-1,-1,215,215,215]},[3,4,5,0,1,2],new Set([215]),ids=>ids),[215,215,215,-1,-1,-1]);
 assert.throws(()=>patchOcellusInstanceGeometry(out),/anchor changed/);
});
test("pool allocates one UV buffer and converts static RGB once while retaining native animated alpha",()=>{
 const out=patchOcellusInstanceGeometry(geometryFixture);
 const code=out.slice(out.indexOf("        const uv"),out.indexOf("        previous.active.delete")).replace("pool!.frames","pool.frames");
 let uvAllocations=0,rgbConversions=0;
 const THREE={Float32BufferAttribute:class{constructor(){uvAllocations++;}}};
 const pool={},frames=[{alphas:[0,255]},{alphas:[128,0]}];
 const run=new Function("THREE","uvs","payload","baseAlphas","spotPayload","recolor","frameData","pool","cacheColorsToRgba","cacheAlphaToOpacity",code);
 run(THREE,[0,0,1,1],{positions:[0,0,0,1,0,0],colors:[1,2]},[0,0],{}, {},frames,pool,()=>{rgbConversions++;return [1,2,3,1,4,5,6,1]},a=>1-a/255);
 assert.equal(uvAllocations,1);assert.equal(rgbConversions,1);assert.equal(pool.frames[0].uv,pool.frames[1].uv);
 assert.deepEqual(Array.from(pool.frames[0].colors),[1,2,3,1,4,5,6,0]);
 assert.equal(pool.frames[1].colors[3],Math.fround(127/255));assert.equal(pool.frames[1].colors[7],1);
 assert.ok(!out.includes("geometry.computeVertexNormals()"));
});
test("frame slot range shrinks when its highest instance moves or disappears",()=>{
 const out=patchOcellusInstanceGeometry(geometryFixture);
 const code=out.slice(out.indexOf("function activeSlotCount"),out.indexOf("function drawsOf")).replace("active: Set<number>","active");
 const count=new Function(code+";return activeSlotCount")();
 const active=new Set([0,3,8]);assert.equal(count(active),9);
 active.delete(8);assert.equal(count(active),4);
 active.clear();assert.equal(count(active),0);
 assert.match(out,/mesh.count = activeSlotCount\(bucket.active\)/);
});

const warmFixture=`const pools = new Map<string, Pool>();
class Model {
  pool=null;slot=-1;destroyed=false;reference={kind:"spotAnim"};ocellusDrawRequest=0;frames=[];
  private async ensurePool() {
    if (this.pool) return this.pool;
    const bundle = await CacheRender.bundle();
    const ids =
      this.reference.kind === "spotAnim"
        ? bundle.spotAnimIds(this.reference)
        : [...bundle.assetIds(this.reference), ...bundle.sharedAssetIds(this.reference)];
    const key = poolKey(this.reference, ids, bundle.manifest.bundleVersion);
    let pool = pools.get(key);
    if(!pool){pool=makePool();pools.set(key,pool);}
    await pool.ready;
    if (this.destroyed) return pool;
    this.pool = pool;
    if (this.slot < 0) {
      if (!pool.active.size) {pool.loopElapsed=0;pool.frameSoundPlayer.reset();}
      const reused=pool.free.pop();
      if(reused==null&&pool.next>=pool.capacity)throw Error("capacity");
      this.slot=reused??pool.next++;
      pool.active.add(this.slot);
    }
    return pool;
  }
  draw(){
    const request=++this.ocellusDrawRequest;
    const present=pool=>{if(request===this.ocellusDrawRequest&&!this.destroyed)this.frames.push(pool.id);};
    if (this.pool) present(this.pool);
    else void this.ensurePool().then(present);
  }
}`;
function warmHarness(makePool){
 const code=patchOcellusWarmPools(warmFixture)
  .replace("type OcellusBundle=Awaited<ReturnType<typeof CacheRender.bundle>>;","")
  .replace("new WeakMap<Promise<OcellusBundle>,OcellusBundle>()","new WeakMap()")
  .replace("new WeakMap<OcellusBundle,Map<string,Pool>>()","new WeakMap()")
  .replace("new WeakSet<Pool>()","new WeakSet()")
  .replaceAll(":OcellusBundle","").replaceAll(":CacheRenderReference","")
  .replaceAll("new Map<string,Pool>()","new Map()")
  .replaceAll("private ","").replaceAll(":Pool|null","").replaceAll(":Pool","");
 let promise;const bundle=()=>({manifest:{bundleVersion:"same"},spotAnimIds:()=>["same"],assetIds:()=>[],sharedAssetIds:()=>[]});
 const CacheRender={isConfigured:()=>true,bundle:()=>promise};
 const reconfigure=()=>{promise=Promise.resolve(bundle());};reconfigure();
 const Model=new Function("CacheRender","poolKey","makePool",code+";return Model")(CacheRender,()=>"same",makePool);
 return {Model,reconfigure};
}
const poolFixture=id=>({id,ready:Promise.resolve(),active:new Set(),free:[],capacity:4,next:0,loopElapsed:0,frameSoundPlayer:{reset(){}}});
test("prepared native effects claim their first frame synchronously and never reuse an old bundle",async()=>{
 let id=0;const {Model,reconfigure}=warmHarness(()=>poolFixture(++id));
 const preload=new Model();await preload.ensurePool();
 const effect=new Model();effect.draw();assert.deepEqual(effect.frames,[1]);
 assert.equal(effect.ocellusWarmClaim,true);assert.equal(effect.slot,1);
 reconfigure();const other=new Model();other.draw();assert.deepEqual(other.frames,[]);
 await other.ensurePool();await Promise.resolve();assert.equal(other.pool.id,2);
 const destroyed=new Model();destroyed.destroyed=true;destroyed.draw();assert.deepEqual(destroyed.frames,[]);assert.equal(destroyed.slot,-1);
});
test("a rejected pool does not poison the current bundle and can be rebuilt",async()=>{
 let n=0;const {Model}=warmHarness(()=>{const p=poolFixture(++n);if(n===1)p.ready=Promise.reject(Error("cold failure"));return p;});
 let failed=false;try{await new Model().ensurePool();}catch(e){failed=/cold failure/.test(String(e));}
 assert.equal(failed,true);
 const next=new Model();await next.ensurePool();assert.equal(next.pool.id,2);
 const warm=new Model();warm.draw();assert.deepEqual(warm.frames,[2]);
 assert.throws(()=>patchOcellusWarmPools(patchOcellusWarmPools(warmFixture)),/anchor changed/);
});

const coldFixture=`class Model{
  private ocellusDrawRequest=0;
  destroyed=false;pool=null;frames=[];calls=0;
  getOcellusWarmPool(){return null;}
  ensurePool(){this.calls++;return load();}
  draw(position){
    if(this.destroyed)return;
    const request=++this.ocellusDrawRequest;
    const present=pool=>{if(request===this.ocellusDrawRequest&&!this.destroyed)this.frames.push([pool.id,position]);};
    const warm=this.pool??this.getOcellusWarmPool();
    if(warm)present(warm);
    else void this.ensurePool().then(present)
      .catch((error) => console.error("[osrs-sdk] Cache render instance preload failed", error));
  }
  destroy(){
    this.destroyed = true;
  }
}`;
function coldHarness(){
 let time=0,resolve,reject;
 const load=()=>new Promise((a,b)=>{resolve=a;reject=b;});
 const code=patchOcellusColdPoolDraw(coldFixture).replace("private ocellusPendingPresent:((pool:Pool)=>void)|null","ocellusPendingPresent").replaceAll("private ","");
 const Model=new Function("load","performance","console",code+";return Model")(load,{now:()=>time},{error(){}});
 return {Model,resolve:p=>resolve(p),reject:e=>reject(e),time:t=>time=t};
}
test("100 cold frame requests share one allocation and submit only the latest position",async()=>{
 const h=coldHarness(),m=new h.Model();
 for(let i=0;i<100;i++)m.draw(i);
 assert.equal(m.calls,1);assert.deepEqual(m.frames,[]);
 h.resolve({id:9});await Promise.resolve();
 assert.deepEqual(m.frames,[[9,99]]);
 assert.equal(m.ocellusPendingPresent,null);
 assert.equal(m.ocellusPoolLoading,false);
 m.pool={id:9};m.draw(100);assert.deepEqual(m.frames,[[9,99],[9,100]]);
});
test("cold pool rejection retries after cooldown and destruction drops pending presentation",async()=>{
 const h=coldHarness(),m=new h.Model();
 m.draw(1);h.reject(Error("network"));await Promise.resolve();await Promise.resolve();
 assert.equal(m.ocellusPoolRetryAfter,1000);assert.equal(m.ocellusPendingPresent,null);
 h.time(999);m.draw(2);assert.equal(m.calls,1);
 h.time(1000);m.draw(3);assert.equal(m.calls,2);
 m.destroy();h.resolve({id:7});await Promise.resolve();
 assert.deepEqual(m.frames,[]);assert.equal(m.ocellusPendingPresent,null);
});
test("a warm synchronous frame supersedes an outstanding cold request",async()=>{
 const h=coldHarness(),m=new h.Model();
 m.draw(1);m.pool={id:8};m.draw(2);
 h.resolve({id:8});await Promise.resolve();
 assert.deepEqual(m.frames,[[8,2]]);
 assert.throws(()=>patchOcellusColdPoolDraw(patchOcellusColdPoolDraw(coldFixture)),/anchor changed/);
});

test("exhausted warm pool cannot interrupt the viewport and retries only after cooldown",()=>{
 const h=coldHarness(),m=new h.Model();let claims=0;
 m.getOcellusWarmPool=()=>{claims++;if(claims===1)throw Error("capacity");m.pool={id:4};return m.pool;};
 m.draw(1);assert.equal(claims,1);assert.equal(m.calls,0);assert.equal(m.ocellusPoolRetryAfter,1000);
 h.time(500);m.draw(2);assert.equal(claims,1);assert.equal(m.calls,0);
 h.time(1000);m.draw(3);assert.equal(claims,2);assert.deepEqual(m.frames,[[4,3]]);
 m.draw(4);assert.deepEqual(m.frames,[[4,3],[4,4]]);
});

test("native instanced graphics separate stable opaque faces from every potentially animated alpha face",()=>{
 const frames=[{alphas:new Float32Array([0,0,0,0,0,0,0,0,0])},{alphas:new Float32Array([0,0,0,128,0,0,0,0,0])}];
 const indices=[6,7,8,3,4,5,0,1,2];
 assert.deepEqual(partitionNativeFrameIndices(indices,frames,true),{opaque:[6,7,8,0,1,2],alpha:[3,4,5]});
 assert.deepEqual(partitionNativeFrameIndices(indices,frames,false),{opaque:[],alpha:indices});
 assert.deepEqual(partitionNativeFrameIndices([0,1,99],frames,true),{opaque:[],alpha:[0,1,99]});
 assert.deepEqual(partitionNativeFrameIndices([0,1,2],[],true),{opaque:[],alpha:[0,1,2]});
});
test("instanced alpha pass patch preserves source indices and creates depth-writing opaque and non-writing alpha materials",()=>{
 const fixture=`        pool!.frames = frameData.map((frame) => {
          const mesh = build(split ? split.plain : indices, false, material);
          const textured: THREE.InstancedMesh[] = [];
          split?.textured.forEach((group) => {
            const meshMaterial = textureMaterials.get(group.id);
            if (!meshMaterial) return;
            textured.push(build(group.indices, true, meshMaterial));
          });
          return {mesh,textured};
        });`;
 const out=patchOcellusInstancedAlphaPasses(fixture);
 assert.match(out,/solid.transparent=false;solid.depthWrite=true/);
 assert.match(out,/translucent.transparent=true;translucent.depthWrite=false/);
 assert.match(out,/passes.map\(pass=>build\(pass.indices,pass.withUv,pass.material\)\)/);
 assert.throws(()=>patchOcellusInstancedAlphaPasses(out),/anchor changed/);
});
