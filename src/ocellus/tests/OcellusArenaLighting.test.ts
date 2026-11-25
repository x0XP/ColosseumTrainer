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

import {stoneGrade,cliffFacetExposure,backdropExposure,starMipWeight} from "../OcellusArenaLighting";
test("stone grade preserves luminance and neutral colours while reducing green saturation",()=>{
 for(const v of stoneGrade(.2,.2,.2,1))expect(v).toBeCloseTo(.2,12);
 expect(stoneGrade(0,0,0,1)).toEqual([0,0,0]);
 const [r,g,b]=stoneGrade(.1,.3,.09,1);
 expect(g-r).toBeLessThan(.2);expect(g).toBeGreaterThan(r);
 expect(.2126*r+.7152*g+.0722*b).toBeCloseTo(.2126*.1+.7152*.3+.0722*.09,12);
 stoneGrade(.1,.3,.09,0).forEach((v,i)=>expect(v).toBeCloseTo([.1,.3,.09][i],12));
});
test("native cliff modulation is bounded, directional and degeneracy safe",()=>{
 const a=cliffFacetExposure([0,0,0,1,0,0,0,0,1],0);
 const b=cliffFacetExposure([0,0,0,0,0,1,1,0,0],0);
 expect(a).toBeLessThan(b);expect(a).toBeGreaterThanOrEqual(.8);expect(b).toBeLessThanOrEqual(1.12);
 expect(cliffFacetExposure([0,0,0,0,0,0,0,0,0],0)).toBe(1);
});
test("near relief retains detail and far/deep scenery fades; mip peaks decline with scale",()=>{
 expect(backdropExposure(10,0)).toBeCloseTo(.91);
 expect(backdropExposure(34,0)).toBeCloseTo(.32);
 expect(backdropExposure(34,-15)).toBeCloseTo(.0768);
 expect(starMipWeight(64)).toBeGreaterThan(starMipWeight(16));
 expect(starMipWeight(8)).toBe(0);
});

import {distanceToLightEdge,rimReflection,rimReflectionPixels,environmentLightAt} from "../OcellusArenaLighting";
test("reflections follow finite diagonal edges and never fill an entire hazard square",()=>{
 const edge={from:{x:0,z:0},to:{x:1,z:1}};
 expect(distanceToLightEdge(.5,.5,edge)).toBe(0);
 expect(distanceToLightEdge(2,2,edge)).toBeCloseTo(Math.SQRT2);
 expect(rimReflection(.5,.5,[edge])).toBe(1);
 expect(rimReflection(2,2,[edge])).toBe(0);
 expect(rimReflection(0,0,[])).toBe(0);
 const data=rimReflectionPixels(2,2,1,4,[edge],[]);
 expect(data.width).toBe(16);expect(data.height).toBe(16);
 expect(data.pixels.some((v,i)=>i%4===0&&v>0)).toBe(true);
 expect(data.pixels.every((v,i)=>i%4===1?v===0:i%4===3?v===255:true)).toBe(true);
});
test("environment lighting uses only the active phase and a continuous tick clock",()=>{
 const a=environmentLightAt("inner-void",10,1),b=environmentLightAt("inner-void",11,0);
 expect(a).toEqual(b);expect(a.inner).toBeGreaterThan(.8);expect(a.outer).toBe(0);
 const c=environmentLightAt("outer-void",39,.5);expect(c.inner).toBe(0);expect(c.outer).toBeGreaterThan(.8);
 const clear=environmentLightAt("after-outer",60,0);expect(clear.inner+clear.outer).toBe(0);
});
