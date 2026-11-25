import {validateNativeArenaMesh,NATIVE_FOUNDATION_TOP_Y,cliffVisibility,nativeCliffSampler,CLIFF_BOTTOM_Y,CLIFF_FALLBACK_RGB,cliffDepthProfile,NATIVE_FOUNDATION_MIN_Y,cliffBackingDepthProfile,flatFloorCoverageError} from "../OcellusNativeMesh";
import {WALKWAY_TILES} from "../OcellusArenaTopology";
import {FLOOR_TILES} from "../Phase4Rules";
const base={cache:2746,square:16472,plane:1,lighting:"cache-object",sources:[62274,62275,62277].map(model=>({model})),
 positions:[0,0,0,1,0,0,1,.5,0],colors:[0x123456],vertexColors:[0,0x123456,0xffffff],tiles:29,reliefTiles:84,raisedFloorFaces:0,overhangBoxes:3,overhangFaces:0,floorEdgeFaces:0,curbFaces:1,tall:{faces:0,components:0,discardedComponents:0,maxHeight:.75}};
test("native curb payload accepts its verified geometry and rejects corrupted data",()=>{
 expect(validateNativeArenaMesh(base,"curb").positions).toEqual(base.positions);
 for(const change of [{cache:1},{square:1},{plane:0},{lighting:"invented"},{sources:[]},{positions:[1]},{vertexColors:[0,0,0x1000000]},{colors:[-1]},{positions:[99,0,0,1,0,0,1,.5,0]},{positions:[-.49,0,0,1,0,0,1,.5,0]},{positions:[0,NaN,0,1,0,0,1,.5,0]},{tiles:28},{reliefTiles:83},{raisedFloorFaces:-1},{raisedFloorFaces:2},{raisedFloorFaces:undefined},{overhangBoxes:0},{overhangFaces:-1},{overhangFaces:2},{floorEdgeFaces:-1},{floorEdgeFaces:1}]){
   expect(()=>validateNativeArenaMesh({...base,...change},"curb")).toThrow("Invalid native curb");
 }
});
test("foundation must remain within the below-floor native bounds and supported curb footprint",()=>{
 const data={...base,topY:NATIVE_FOUNDATION_TOP_Y,positions:[-.75,-2,0,1,NATIVE_FOUNDATION_TOP_Y,-1,1,NATIVE_FOUNDATION_MIN_Y,0],backingTiles:WALKWAY_TILES.slice(0,24)};
 expect(validateNativeArenaMesh(data,"foundation").backingTiles).toHaveLength(24);
 expect(()=>validateNativeArenaMesh({...data,topY:-.015},"foundation")).toThrow("foundation top plane");
 expect(()=>validateNativeArenaMesh({...data,positions:[0,-1/128,0,1,-1,-1,1,-1.69,0]},"foundation")).toThrow("vertex bounds");
 expect(()=>validateNativeArenaMesh({...data,backingTiles:Array(24).fill(WALKWAY_TILES[0])},"foundation")).toThrow("backing footprint");
 expect(()=>validateNativeArenaMesh({...data,positions:base.positions},"foundation")).toThrow("vertex bounds");
 expect(()=>validateNativeArenaMesh({...data,positions:[-.76,-2,0,1,-1,-1,1,-3.19,0]},"foundation")).toThrow("vertex bounds");
 expect(()=>validateNativeArenaMesh({...data,positions:[0,-5.26,0,1,-1,-1,1,-3.19,0]},"foundation")).toThrow("vertex bounds");
});

test("cliff lip preserves native lighting while its lower edge fades into the abyss",()=>{
 expect(cliffVisibility(NATIVE_FOUNDATION_TOP_Y)).toBe(1);
 expect(cliffVisibility(CLIFF_BOTTOM_Y)).toBe(0);
 expect(cliffVisibility(-100)).toBe(0);
 expect(cliffVisibility(NaN)).toBe(0);
 expect(cliffVisibility((NATIVE_FOUNDATION_TOP_Y+CLIFF_BOTTOM_Y)/2)).toBeCloseTo(1-Math.pow(.5,2.5),10);
 let last=0;
 for(let i=0;i<=100;i++){const value=cliffVisibility(CLIFF_BOTTOM_Y+i*(NATIVE_FOUNDATION_TOP_Y-CLIFF_BOTTOM_Y)/100);expect(value).toBeGreaterThanOrEqual(last);last=value;}
});
test("native cliff backing samples local original colours, not one uniform slab",()=>{
 const y=NATIVE_FOUNDATION_TOP_Y;
 const sampler=nativeCliffSampler([0,y,0,0,y,0,1,y,0,5,y,5,0,-1,0],[0x102030,0x102030,0x506070,0x809090,0xff0000]);
 expect(sampler(.5,0)).toBe(0x304050);
 expect(sampler(5,5)).toBe(0x809090);
 expect(sampler(20,20)).toBe(CLIFF_FALLBACK_RGB);
 expect(sampler(NaN,0)).toBe(CLIFF_FALLBACK_RGB);
 expect(nativeCliffSampler([],[])(0,0)).toBe(CLIFF_FALLBACK_RGB);
});

test("backing uses the same native depth curve at every shared horizontal level",()=>{
 const profile=cliffDepthProfile();
 expect(profile).toHaveLength(9);
 expect(profile[0]).toEqual({y:NATIVE_FOUNDATION_TOP_Y,visibility:1});
 expect(profile[8]).toEqual({y:CLIFF_BOTTOM_Y,visibility:0});
 for(let i=1;i<profile.length;i++){
  expect(profile[i].y).toBeLessThan(profile[i-1].y);
  expect(profile[i].visibility).toBeLessThan(profile[i-1].visibility);
  expect(profile[i].visibility).toBe(cliffVisibility(profile[i].y));
 }
 expect(profile[2].visibility).toBeCloseTo(1-Math.pow(.25,2.5),10);
 expect(profile[6].visibility).toBeCloseTo(1-Math.pow(.75,2.5),10);
});

test("flat source stone rejects altered heights, winding, footprint and incomplete per-tile coverage",()=>{
 const h=-1/128;
 const positions=FLOOR_TILES.flatMap(({x,y})=>[x,h,y-1,x,h,y,x+1,h,y-1,x+1,h,y-1,x,h,y,x+1,h,y]);
 const colours=Array(positions.length/9).fill(0x123456);
 const data={...base,tiles:84,floorY:h,positions,colors:colours,vertexColors:Array(positions.length/3).fill(0x123456)};
 expect(validateNativeArenaMesh(data,"flat-floor").positions).toEqual(positions);
 expect(flatFloorCoverageError(positions)).toBeNull();
 expect(flatFloorCoverageError(positions.slice(9))).toBe("flat floor tile coverage");
 expect(flatFloorCoverageError([...positions,...positions.slice(0,9)])).toBe("flat floor tile coverage");
 const inverted=[...positions];inverted.splice(0,9,...positions.slice(3,6),...positions.slice(0,3),...positions.slice(6,9));
 expect(flatFloorCoverageError(inverted)).toBe("flat floor winding");
 const raised=[...positions];raised[1]=0;
 expect(flatFloorCoverageError(raised)).toBe("flat floor height");
 const outside=[...positions];outside[0]=0;
 expect(flatFloorCoverageError(outside)).toBe("flat floor footprint");
 expect(()=>validateNativeArenaMesh({...data,tiles:83},"flat-floor")).toThrow("flat floor metadata");
});

test("fallback cliff stays behind the original lip and recedes into the native rock",()=>{
 const native=cliffDepthProfile(),backing=cliffBackingDepthProfile(.2);
 expect(backing[0]).toEqual({y:NATIVE_FOUNDATION_TOP_Y,inset:.2,visibility:1});
 expect(backing[8].inset).toBeCloseTo(.45,10);
 expect(backing[8].visibility).toBe(0);
 for(let i=1;i<backing.length;i++){
  expect(backing[i].inset).toBeGreaterThan(backing[i-1].inset);
  expect(backing[i].y).toBe(native[i].y);
  expect(backing[i].visibility).toBeLessThanOrEqual(native[i].visibility);
 }
 expect(backing[4].visibility).toBeCloseTo(Math.pow(1-Math.pow(.5,2.5),2),10);
});

test("native upper scenery preserves anchored high faces without relaxing lower curb bounds",()=>{
 const data={...base,positions:[...base.positions,1,.75,0,1,2,0,2,3,0],colors:[0x123456,0x456789],vertexColors:[...base.vertexColors,0x456789,0x456789,0x456789],tall:{faces:1,components:1,discardedComponents:0,maxHeight:3}};
 expect(validateNativeArenaMesh(data,"curb").positions).toEqual(data.positions);
 expect(()=>validateNativeArenaMesh({...data,tall:{...data.tall,maxHeight:2}},"curb")).toThrow("tall scenery heights");
 expect(()=>validateNativeArenaMesh({...data,tall:{...data.tall,maxHeight:NaN}},"curb")).toThrow("tall scenery proof");
 expect(()=>validateNativeArenaMesh({...data,tall:{...data.tall,components:0}},"curb")).toThrow("tall scenery proof");
 expect(()=>validateNativeArenaMesh({...data,positions:[-.6,.75,0,...data.positions.slice(3)]},"curb")).toThrow("vertex bounds");
 expect(()=>validateNativeArenaMesh({...data,positions:[...base.positions,1,.7,0,1,2,0,2,3,0]},"curb")).toThrow("tall scenery heights");
});

import {nativeCliffSection,nativeBackingPoint} from "../OcellusNativeMesh";
test("native rock sections determine a bounded inward-only fallback setback",()=>{
 const points=[.32,-1,0,.32,-3,0,.32,-1,2, .32,-3,0,.32,-3,2,.32,-1,2];
 const section=nativeCliffSection(points,-2);
 expect(section).toHaveLength(2);
 expect(section.flat().every(p=>Math.abs(p.x-.32)<1e-10)).toBe(true);
 const edge={x:0,z:1},point={x:.2,z:1};
 const moved=nativeBackingPoint(edge,point,section);
 expect(moved.x).toBeCloseTo(.36);expect(moved.z).toBe(1);
 expect(nativeBackingPoint(edge,point,[])).toEqual(point);
 expect(nativeBackingPoint(edge,point,[[{x:.1,z:0},{x:.1,z:2}]])).toEqual(point);
 expect(nativeCliffSection(points,-5)).toEqual([]);
 expect(nativeCliffSection([0,-2,0,1,-2,0,0,-2,1],-2)).toEqual([]);
});
