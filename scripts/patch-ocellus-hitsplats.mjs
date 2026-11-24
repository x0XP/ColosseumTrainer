#!/usr/bin/env node
/** Ocellus-only HUD: reserve existing native hitsplat slots before assigning
 * new ones, avoiding overlaps when a new hit precedes an older hit in the list. */
import {readFileSync,writeFileSync} from "node:fs";
import {fileURLToPath} from "node:url";
export function patchOcellusHitsplats(source){
 const original=`    let projectileOffsets = [
      [0, 10],
      [0, 30],
      [-18, 20],
      [18, 20],
    ];

    let projectileCounter = 0;
    this.incomingProjectiles.forEach((projectile) => {
      if (projectile.remainingDelay > 0) {
        return;
      }
      if (projectileCounter > 3) {
        return;
      }
      projectileCounter++;
      if (this.drawHitsplat(projectile)) {
        let image = projectile.damage === 0 ? this.missedHitsplatImage : this.damageHitsplatImage;
        if (!projectile.offsetX && !projectile.offsetY) {
          projectile.offsetX = projectileOffsets[0][0];
          projectile.offsetY = projectileOffsets[0][1];
        }

        projectileOffsets = remove(projectileOffsets, (offset) => {
          return offset[0] !== projectile.offsetX || offset[1] !== projectile.offsetY;
        });`;
 const replacement=`    const offsets=[[0,10],[0,30],[-18,20],[18,20]];
    const hits=this.incomingProjectiles.filter(p=>p.remainingDelay<=0).slice(0,4).filter(p=>this.drawHitsplat(p));
    const reserved=new Set<number>();
    const assigned=new Map<Projectile,number>();
    // Preserve surviving hits in their existing locations before placing
    // any new hit. Duplicate or invalid old offsets get a free native slot.
    for(const projectile of hits){
      const index=offsets.findIndex(([x,y])=>x===projectile.offsetX&&y===projectile.offsetY);
      if(index>=0&&!reserved.has(index)){reserved.add(index);assigned.set(projectile,index);}
    }
    for(const projectile of hits){
      if(assigned.has(projectile))continue;
      const index=offsets.findIndex((_offset,i)=>!reserved.has(i));
      if(index<0)continue;
      reserved.add(index);assigned.set(projectile,index);
    }
    hits.forEach((projectile)=>{
      const index=assigned.get(projectile);
      if(index!==undefined){
        [projectile.offsetX,projectile.offsetY]=offsets[index];
        let image = projectile.damage === 0 ? this.missedHitsplatImage : this.damageHitsplatImage;`;
 if(source.split(original).length!==2)throw Error("Pinned SDK hitsplat anchor changed");
 return source.replace(original,replacement);
}

/** The 3D layered viewport never flips its HUD canvas (unlike the 2D
 * copied viewport). Its screen-projected coordinates must remain upright. */
export function patchOcellusUprightHud(source){
 const start=source.indexOf("  drawUILayer(")>=0?source.indexOf("  drawUILayer("):source.indexOf("  override drawUILayer(");
 if(start<0)throw Error("Pinned SDK HUD method anchor changed");
 const end=source.indexOf("\n  }",start);
 if(end<0)throw Error("Pinned SDK HUD method end changed");
 const body=source.slice(start,end);
 const pattern=/^[ \t]*if \(Settings\.rotated === "south"\)\s*\{\s*context\.rotate\(Math\.PI\);\s*\}\n|^[ \t]*if \(Settings\.rotated === "south"\) context\.rotate\(Math\.PI\);\n/gm;
 const matches=[...body.matchAll(pattern)];
 if(matches.length<2||matches.length>3)throw Error("Pinned SDK HUD rotation anchor changed");
 return source.slice(0,start)+body.replace(pattern,"")+source.slice(end);
}

if(process.argv[1]===fileURLToPath(import.meta.url)){
 const file=process.argv[2];if(!file)throw Error("Expected SDK Unit.ts");
 writeFileSync(file,patchOcellusHitsplats(readFileSync(file,"utf8")));
 for(const hud of process.argv.slice(3))writeFileSync(hud,patchOcellusUprightHud(readFileSync(hud,"utf8")));
}
