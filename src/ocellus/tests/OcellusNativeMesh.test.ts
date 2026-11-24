import {validateNativeArenaMesh} from "../OcellusNativeMesh";
import {WALKWAY_TILES} from "../OcellusArenaTopology";
const base={cache:2746,square:16472,plane:1,lighting:"cache-object",sources:[62274,62275,62277].map(model=>({model})),
 positions:[0,0,0,1,0,0,1,.5,0],colors:[0x123456],vertexColors:[0,0x123456,0xffffff],tiles:29};
test("native curb payload accepts its verified geometry and rejects corrupted data",()=>{
 expect(validateNativeArenaMesh(base,"curb").positions).toEqual(base.positions);
 for(const change of [{cache:1},{square:1},{plane:0},{lighting:"invented"},{sources:[]},{positions:[1]},{vertexColors:[0,0,0x1000000]},{colors:[-1]},{positions:[99,0,0,1,0,0,1,.5,0]},{positions:[0,NaN,0,1,0,0,1,.5,0]},{tiles:28}]){
   expect(()=>validateNativeArenaMesh({...base,...change},"curb")).toThrow("Invalid native curb");
 }
});
test("foundation must remain within the below-floor native bounds and supported curb footprint",()=>{
 const data={...base,positions:[-.18,-1,0,1,-.015,-1,1,-1.69,0],backingTiles:WALKWAY_TILES.slice(0,24)};
 expect(validateNativeArenaMesh(data,"foundation").backingTiles).toHaveLength(24);
 expect(()=>validateNativeArenaMesh({...data,backingTiles:Array(24).fill(WALKWAY_TILES[0])},"foundation")).toThrow("backing footprint");
 expect(()=>validateNativeArenaMesh({...data,positions:base.positions},"foundation")).toThrow("vertex bounds");
});
