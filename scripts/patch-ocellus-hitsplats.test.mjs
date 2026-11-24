import {test} from "node:test";
import assert from "node:assert/strict";
import {patchOcellusHitsplats,patchOcellusUprightHud} from "./patch-ocellus-hitsplats.mjs";
const fixture="    let projectileOffsets = [\n      [0, 10],\n      [0, 30],\n      [-18, 20],\n      [18, 20],\n    ];\n\n    let projectileCounter = 0;\n    this.incomingProjectiles.forEach((projectile) => {\n      if (projectile.remainingDelay > 0) {\n        return;\n      }\n      if (projectileCounter > 3) {\n        return;\n      }\n      projectileCounter++;\n      if (this.drawHitsplat(projectile)) {\n        let image = projectile.damage === 0 ? this.missedHitsplatImage : this.damageHitsplatImage;\n        if (!projectile.offsetX && !projectile.offsetY) {\n          projectile.offsetX = projectileOffsets[0][0];\n          projectile.offsetY = projectileOffsets[0][1];\n        }\n\n        projectileOffsets = remove(projectileOffsets, (offset) => {\n          return offset[0] !== projectile.offsetX || offset[1] !== projectile.offsetY;\n        });"+"\n        draw(projectile);\n      }\n    });";
const render=()=>new Function("draw",patchOcellusHitsplats(fixture).replace("new Map<Projectile,number>()","new Map()").replace("new Set<number>()","new Set()"));
const hit=(x=0,y=0,remainingDelay=0,damage=8)=>({offsetX:x,offsetY:y,remainingDelay,damage});
test("a new hit never steals the existing location of a surviving hitsplat",()=>{
 const older=hit(0,10),fresh=hit();
 const result=[];render().call({incomingProjectiles:[fresh,older],drawHitsplat:()=>true},p=>result.push([p.offsetX,p.offsetY]));
 assert.deepEqual(result,[[0,30],[0,10]]);
});
test("duplicate offsets are repaired, delayed hits and fifth visible hit do not consume a slot",()=>{
 const a=hit(0,10),b=hit(0,10),c=hit(),d=hit(),e=hit(),late=hit(18,20,1);
 const result=[];render().call({incomingProjectiles:[late,a,b,c,d,e],drawHitsplat:()=>true},p=>result.push([p.offsetX,p.offsetY]));
 assert.deepEqual(result,[[0,10],[0,30],[-18,20],[18,20]]);
 assert.equal(e.offsetY,0);assert.equal(late.offsetY,20);
});
test("expired positions are reused without relocating other active hits and patch fails closed",()=>{
 const a=hit(-18,20),b=hit();
 const result=[];render().call({incomingProjectiles:[a,b],drawHitsplat:()=>true},p=>result.push([p.offsetX,p.offsetY]));
 assert.deepEqual(result,[[-18,20],[0,10]]);
 assert.throws(()=>patchOcellusHitsplats(patchOcellusHitsplats(fixture)),/anchor changed/);
});

test("3D health bars and hitsplats remain upright regardless of 2D map rotation",()=>{
 const source=`  draw2d() {
    if (Settings.rotated === "south") context.rotate(Math.PI);
  }
  override drawUILayer() {
    if (Settings.rotated === "south") context.rotate(Math.PI);
    context.fillRect(0,0,90,5);
    if (Settings.rotated === "south") {
      context.rotate(Math.PI);
    }
    context.drawImage(icon,0,0);
  }`;
 const out=patchOcellusUprightHud(source);
 assert.equal((out.match(/context\.rotate/g)||[]).length,1);
 assert.ok(out.includes("context.fillRect(0,0,90,5)"));
 assert.ok(out.includes("context.drawImage(icon,0,0)"));
 assert.throws(()=>patchOcellusUprightHud(out),/anchor changed/);
});
