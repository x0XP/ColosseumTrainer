import {validateNativeArenaMesh,NATIVE_FOUNDATION_TOP_Y,cliffVisibility,nativeCliffSampler,CLIFF_BOTTOM_Y,CLIFF_FALLBACK_RGB,cliffDepthProfile} from "../OcellusNativeMesh";
import {WALKWAY_TILES} from "../OcellusArenaTopology";
const base={cache:2746,square:16472,plane:1,lighting:"cache-object",sources:[62274,62275,62277].map(model=>({model})),
 positions:[0,0,0,1,0,0,1,.5,0],colors:[0x123456],vertexColors:[0,0x123456,0xffffff],tiles:29,reliefTiles:84,raisedFloorFaces:0};
test("native curb payload accepts its verified geometry and rejects corrupted data",()=>{
 expect(validateNativeArenaMesh(base,"curb").positions).toEqual(base.positions);
 for(const change of [{cache:1},{square:1},{plane:0},{lighting:"invented"},{sources:[]},{positions:[1]},{vertexColors:[0,0,0x1000000]},{colors:[-1]},{positions:[99,0,0,1,0,0,1,.5,0]},{positions:[0,NaN,0,1,0,0,1,.5,0]},{tiles:28},{reliefTiles:83},{raisedFloorFaces:-1},{raisedFloorFaces:2},{raisedFloorFaces:undefined}]){
   expect(()=>validateNativeArenaMesh({...base,...change},"curb")).toThrow("Invalid native curb");
 }
});
test("foundation must remain within the below-floor native bounds and supported curb footprint",()=>{
 const data={...base,topY:NATIVE_FOUNDATION_TOP_Y,positions:[-.18,-1,0,1,NATIVE_FOUNDATION_TOP_Y,-1,1,-1.69,0],backingTiles:WALKWAY_TILES.slice(0,24)};
 expect(validateNativeArenaMesh(data,"foundation").backingTiles).toHaveLength(24);
 expect(()=>validateNativeArenaMesh({...data,topY:-.015},"foundation")).toThrow("foundation top plane");
 expect(()=>validateNativeArenaMesh({...data,positions:[0,-1/128,0,1,-1,-1,1,-1.69,0]},"foundation")).toThrow("vertex bounds");
 expect(()=>validateNativeArenaMesh({...data,backingTiles:Array(24).fill(WALKWAY_TILES[0])},"foundation")).toThrow("backing footprint");
 expect(()=>validateNativeArenaMesh({...data,positions:base.positions},"foundation")).toThrow("vertex bounds");
});

test("cliff lip preserves native lighting while its lower edge fades into the abyss",()=>{
 expect(cliffVisibility(NATIVE_FOUNDATION_TOP_Y)).toBe(1);
 expect(cliffVisibility(CLIFF_BOTTOM_Y)).toBe(0);
 expect(cliffVisibility(-100)).toBe(0);
 expect(cliffVisibility(NaN)).toBe(0);
 expect(cliffVisibility((NATIVE_FOUNDATION_TOP_Y+CLIFF_BOTTOM_Y)/2)).toBeCloseTo(.5,10);
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
 expect(profile[2].visibility).toBeCloseTo(.84375,10);
 expect(profile[6].visibility).toBeCloseTo(.15625,10);
});
