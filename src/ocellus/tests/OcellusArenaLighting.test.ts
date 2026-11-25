import {bossShadowLift,flameGlowScale,markGlowOpacity,shadowProjection,SHADOW_PADDING_TILES} from "../OcellusArenaLighting";

test("shadow follows the two-tick rise and one-tick native landing",()=>{
 expect(bossShadowLift("inner-void",0,0)).toBe(0);
 expect(bossShadowLift("inner-void",1,0)).toBe(.5);
 expect(bossShadowLift("inner-void",2,0)).toBe(1);
 expect(bossShadowLift("inner-void",21,0)).toBe(1);
 expect(bossShadowLift("inner-void",21,.5)).toBe(.5);
 expect(bossShadowLift("inner-void",21,1)).toBe(0);
 expect(bossShadowLift("after-inner",22,0)).toBe(0);
 expect(bossShadowLift("outer-void",35,.5)).toBe(0);
});

test("projection preserves exterior curb pixels within the padded map",()=>{
 expect(shadowProjection(0,0,-1)).toEqual([SHADOW_PADDING_TILES,SHADOW_PADDING_TILES]);
 const [x,z]=shadowProjection(-.48,.75,-1.48);
 expect(x).toBeGreaterThan(0);expect(z).toBeGreaterThan(0);
 const [a,b]=shadowProjection(14.48,0,12.48);
 expect(a).toBeLessThan(14+2*SHADOW_PADDING_TILES);
 expect(b).toBeLessThan(13+2*SHADOW_PADDING_TILES);
});

test("flame is continuous at integer ticks and reflection decays only after impact",()=>{
 expect(flameGlowScale(69,1)).toBe(flameGlowScale(70,0));
 expect(markGlowOpacity(false,1)).toBe(.35);
 expect(markGlowOpacity(true,0)).toBe(.48);
 expect(markGlowOpacity(true,.5)).toBe(.24);
 expect(markGlowOpacity(true,1)).toBe(0);
});
