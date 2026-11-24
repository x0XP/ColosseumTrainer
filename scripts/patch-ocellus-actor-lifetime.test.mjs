import {test} from "node:test";
import assert from "node:assert/strict";
import {patchOcellusActorLifetime} from "./patch-ocellus-actor-lifetime.mjs";
const original=`  private modelGeneration = 0;
  modelChanged() {
    this.logicalHeight = null;
  private startLoading() {
    if (this.ready) return;
    this.ensureLoaded().catch((error) => console.error("[osrs-sdk] Cache render preload failed", error));
  }
  private async ensureLoaded() {
    this.disposeRetired();
    this.clickboxController.invalidate();
  clientTick() {
    this.renderable.setAnimationListener(this);
      const mesh = new THREE.Mesh(geometry, materials.length > 1 ? materials : materials[0]);
    this.root.children.forEach((child, index) => {
      const offset = modelOffsets[index];
      child.position.set(offset?.x ?? 0, offset?.z ?? 0, offset?.y ?? 0);
    });
  destroy(scene: THREE.Scene) {
    if (this.root.parent === scene) scene.remove(this.root);
    [...this.retired, ...this.root.children, this.outline, this.trueTile, this.clickbox].forEach(disposeObject);
    this.retired = [];`;
test("destroyed cache actors never reattach or complete an obsolete generation",()=>{
 const out=patchOcellusActorLifetime(original);
 assert.match(out,/this.ocellusDestroyed=true;[\s\S]*this.modelGeneration\+\+/);
 assert.equal((out.match(/if\(this.ocellusDestroyed\)return;/g)||[]).length,5);
 assert.match(out,/this.spotAnimPayloads.clear\(\)/);
 assert.match(out,/if\(Object.keys\(this.animations\).length\)mesh.frustumCulled=false/);
 assert.throws(()=>patchOcellusActorLifetime(out),/anchor changed/);
});
test("cached actor draw leaves attached graphic offsets untouched",()=>{
 const out=patchOcellusActorLifetime(original);
 const code=out.slice(out.indexOf("    let baseIndex=0;"),out.indexOf("  destroy(scene:"));
 const apply=new Function("modelOffsets",code);
 const calls=[];const base={position:{set(...v){calls.push(v)}}};
 const effect={position:{set(){throw Error("attached effect moved")}}};
 apply.call({root:{children:[effect,base]},reference:{kind:"npc"},spotAnims:[{mesh:effect}]},[{x:1,y:2,z:3}]);
 assert.deepEqual(calls,[[1,3,2]]);
 const standalone={position:{set(...v){calls.push(v)}}};
 apply.call({root:{children:[standalone]},reference:{kind:"spotAnim"},spotAnims:[{mesh:standalone}]},[{x:4,y:5,z:6}]);
 assert.deepEqual(calls.at(-1),[4,6,5]);
});

test("replaced equipment keeps the previous visible mesh height until new geometry is ready",()=>{
 const out=patchOcellusActorLifetime(original);
 const body=out.slice(out.indexOf("  modelChanged() {")+"  modelChanged() {".length,out.indexOf("  private startLoading()"));
 const change=new Function(body);
 const player={ocellusDestroyed:false,ocellusRetryAfter:500,mesh:{},logicalHeight:1.25};
 change.call(player);assert.equal(player.logicalHeight,1.25);assert.equal(player.ocellusRetryAfter,0);
 player.mesh=null;change.call(player);assert.equal(player.logicalHeight,null);
});
test("failed cold draws retry after cooldown without clearing a newer model generation",async()=>{
 const out=patchOcellusActorLifetime(original);
 const body=out.slice(out.indexOf("  private startLoading() {")+"  private startLoading() {".length,out.indexOf("  private async ensureLoaded()")).trim().slice(0,-1);
 let time=0,calls=0,reject;
 const model={ocellusDestroyed:false,ready:null,modelGeneration:1,meshGeneration:0,ocellusRetryAfter:0,
  ensureLoaded(){calls++;return this.ready=new Promise((_resolve,r)=>{reject=r;});}};
 const draw=new Function("performance","console",body);
 const render=()=>draw.call(model,{now:()=>time},{error(){}});
 render();render();assert.equal(calls,1);reject(Error("network"));await Promise.resolve();
 assert.equal(model.ready,null);assert.equal(model.ocellusRetryAfter,1000);
 time=999;render();assert.equal(calls,1);
 time=1000;render();assert.equal(calls,2);
 const stale=reject;model.modelGeneration++;model.ready=Promise.resolve();stale(Error("old request"));await Promise.resolve();
 assert.ok(model.ready);assert.equal(model.ocellusRetryAfter,1000);
});
