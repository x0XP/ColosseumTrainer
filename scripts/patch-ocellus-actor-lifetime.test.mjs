import {test} from "node:test";
import assert from "node:assert/strict";
import {patchOcellusActorLifetime} from "./patch-ocellus-actor-lifetime.mjs";
const original=`  private modelGeneration = 0;
  modelChanged() {
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
