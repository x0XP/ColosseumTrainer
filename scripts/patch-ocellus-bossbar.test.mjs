import {test} from "node:test";
import assert from "node:assert/strict";
import {ocellusBossBarWidth,patchOcellusBossBar} from "./patch-ocellus-bossbar.mjs";
test("boss health stays within the left side of the game viewport",()=>{
 assert.equal(ocellusBossBarWidth(1038,300),300);
 assert.equal(ocellusBossBarWidth(500,300),300);
 assert.ok(Math.abs(ocellusBossBarWidth(360,300)-197.2)<1e-8);
 assert.equal(ocellusBossBarWidth(120,300),0);
 assert.equal(ocellusBossBarWidth(12,300),0);
});
test("boss bar patch preserves the original drawing code but moves the layout left",()=>{
 const original=`const BOSS_BAR_HORIZONTAL_OFFSET = -60;
    const width = Math.min(BOSS_BAR_WIDTH, viewportWidth - 16);
    const centeredX = (viewportWidth - width) / 2 + BOSS_BAR_HORIZONTAL_OFFSET;
    const x = Math.round(Math.max(8, Math.min(centeredX, viewportWidth - width - 8)));
    this.context.fillRect(x,y,width,BOSS_BAR_HEIGHT);`;
 const out=patchOcellusBossBar(original);
 assert.match(out,/ocellusBossBarWidth\(viewportWidth:number,maxWidth:number\)/);
 assert.match(out,/const x = 8;/);
 assert.match(out,/this.context.fillRect\(x,y,width,BOSS_BAR_HEIGHT\)/);
 assert.throws(()=>patchOcellusBossBar(out),/anchor changed/);
});
