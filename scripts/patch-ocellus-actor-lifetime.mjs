#!/usr/bin/env node
/** Preserve the current actor geometry and effect placement through a
 * cached presentation, equipment swap, and reset. Ocellus SDK only. */
import {readFileSync,writeFileSync} from "node:fs";
import {fileURLToPath} from "node:url";
export function patchOcellusActorLifetime(source){
 let next=source;
 const replace=(a,b)=>{if(next.split(a).length!==2)throw Error("Pinned SDK actor lifetime anchor changed: "+a);next=next.replace(a,b);};
 replace("  private modelGeneration = 0;","  private modelGeneration = 0;\n  private ocellusDestroyed = false;");
 replace("  modelChanged() {","  modelChanged() {\n    if(this.ocellusDestroyed)return;");
 replace("  private async ensureLoaded() {","  private async ensureLoaded() {\n    if(this.ocellusDestroyed)return;");
 replace("    this.disposeRetired();\n    this.clickboxController.invalidate();","    if(this.ocellusDestroyed)return;\n    this.disposeRetired();\n    this.clickboxController.invalidate();");
 replace("  clientTick() {\n    this.renderable.setAnimationListener(this);","  clientTick() {\n    if(this.ocellusDestroyed)return;\n    this.renderable.setAnimationListener(this);");
 replace("      const mesh = new THREE.Mesh(geometry, materials.length > 1 ? materials : materials[0]);",
   "      const mesh = new THREE.Mesh(geometry, materials.length > 1 ? materials : materials[0]);\n      if(Object.keys(this.animations).length)mesh.frustumCulled=false;");
 replace(`    this.root.children.forEach((child, index) => {
      const offset = modelOffsets[index];
      child.position.set(offset?.x ?? 0, offset?.z ?? 0, offset?.y ?? 0);
    });`,`    let baseIndex=0;
    this.root.children.forEach((child) => {
      // Attached graphics have their own placement and are not actor
      // equipment parts. A cached presentation may skip the effect update.
      if(this.reference.kind!=="spotAnim"&&this.spotAnims.some(spot=>spot.mesh===child))return;
      const offset=modelOffsets[baseIndex++];
      child.position.set(offset?.x??0,offset?.z??0,offset?.y??0);
    });`);
 replace("  destroy(scene: THREE.Scene) {\n    if (this.root.parent === scene) scene.remove(this.root);",
   "  destroy(scene: THREE.Scene) {\n    if(this.ocellusDestroyed)return;\n    this.ocellusDestroyed=true;\n    // Invalidate asynchronous payload loads before releasing GPU resources.\n    this.modelGeneration++;\n    if (this.root.parent === scene) scene.remove(this.root);");
 replace("    [...this.retired, ...this.root.children, this.outline, this.trueTile, this.clickbox].forEach(disposeObject);\n    this.retired = [];",
   "    [...this.retired, ...this.root.children, this.outline, this.trueTile, this.clickbox].forEach(disposeObject);\n    this.retired = [];\n    this.root.clear();\n    this.spotAnims=[];\n    this.spotAnimPayloads.clear();\n    this.mesh=null;");
 return next;
}
if(process.argv[1]===fileURLToPath(import.meta.url)){
 const file=process.argv[2];if(!file)throw Error("Expected CacheRenderModel.ts");
 writeFileSync(file,patchOcellusActorLifetime(readFileSync(file,"utf8")));
}
