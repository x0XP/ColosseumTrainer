import { createArenaAssetCache, validateArenaImage, createArtworkReader } from "../OcellusArenaAssets";

describe("native arena asset cache", () => {
  test("concurrent loads and subsequent resets reuse the same decoded payload", async () => {
    const load = jest.fn(async (url: string) => ({ url }));
    const cached = createArenaAssetCache(load);
    const first = cached("rock");
    expect(cached("rock")).toBe(first);
    expect(await first).toEqual({ url: "rock" });
    expect(await cached("rock")).toBe(await first);
    expect(load).toHaveBeenCalledTimes(1);
    await cached("curb");
    expect(load).toHaveBeenCalledTimes(2);
  });
  test("failed requests do not poison later resets", async () => {
    const load = jest.fn<Promise<string>, [string]>()
      .mockRejectedValueOnce(new Error("temporary"))
      .mockResolvedValueOnce("recovered");
    const cached = createArenaAssetCache(load);
    await expect(cached("rock")).rejects.toThrow("temporary");
    await expect(cached("rock")).resolves.toBe("recovered");
    expect(load).toHaveBeenCalledTimes(2);
  });
});


test("multiple independent consumers share a single decoded image payload",async()=>{
  const decoded = {naturalWidth:896,naturalHeight:832};
  const load=jest.fn(async (_url:string)=>decoded);
  const cache=createArenaAssetCache(load);
  const [first,second]=await Promise.all([cache("floor.png"),cache("floor.png")]);
  expect(first).toBe(second);
  expect(await cache("floor.png")).toBe(decoded);
  expect(load).toHaveBeenCalledTimes(1);
});

test("native floor, flood and minimap must retain their exact generated dimensions",()=>{
 expect(()=>validateArenaImage("ocellus-native-floor.png",896,832)).not.toThrow();
 expect(()=>validateArenaImage("ocellus-native-floor-sampling.png",896,832)).not.toThrow();
 expect(()=>validateArenaImage("ocellus-native-floor-sampling.png",448,416)).toThrow("Wrong arena image dimensions");
 expect(()=>validateArenaImage("ocellus-flood.png",128,128)).not.toThrow();
 expect(()=>validateArenaImage("ocellus-native-minimap.png",224,208)).not.toThrow();
 expect(()=>validateArenaImage("ocellus-native-floor.png",832,896)).toThrow("Wrong arena image dimensions");
 expect(()=>validateArenaImage("ocellus-flood.png",0,0)).toThrow("Wrong arena image dimensions");
 expect(()=>validateArenaImage("ocellus-native-minimap.png",896,832)).toThrow("Wrong arena image dimensions");
});

test("rejected native payloads can be retried instead of poisoning the shared cache",async()=>{
 const load=jest.fn<Promise<string>,[string]>().mockRejectedValueOnce(new Error("Invalid native geometry")).mockResolvedValueOnce("valid");
 const cache=createArenaAssetCache(load);
 await expect(cache("foundation")).rejects.toThrow("Invalid native geometry");
 await expect(cache("foundation")).resolves.toBe("valid");
 expect(load).toHaveBeenCalledTimes(2);
});

test("artwork readers coalesce draw calls, retry after cooldown and retain decoded image",async()=>{
 let time=0;
 const load=jest.fn<Promise<string>,[]>().mockRejectedValueOnce(Error("temporary")).mockResolvedValueOnce("native");
 const read=createArtworkReader(load,()=>time,1000);
 const flush=async()=>{for(let i=0;i<8;i++)await Promise.resolve();};
 for(let i=0;i<100;i++)expect(read()).toBeUndefined();
 await flush();expect(load).toHaveBeenCalledTimes(1);
 time=999;read();await flush();expect(load).toHaveBeenCalledTimes(1);
 time=1000;read();read();await flush();expect(load).toHaveBeenCalledTimes(2);expect(read()).toBe("native");
 time=10000;expect(read()).toBe("native");expect(load).toHaveBeenCalledTimes(2);
});
test("full resolution upper art has the native board dimensions",()=>{
 expect(()=>validateArenaImage("ocellus-native-upper.png",896,832)).not.toThrow();
 expect(()=>validateArenaImage("ocellus-native-upper.png",224,208)).toThrow("Wrong arena image dimensions");
});

test("raised relief artwork must match the complete high-resolution board",()=>{
 expect(()=>validateArenaImage("ocellus-native-relief.png",896,832)).not.toThrow();
 expect(()=>validateArenaImage("ocellus-native-relief.png",224,208)).toThrow("Wrong arena image dimensions");
});

import {validateNativeSurrounding} from "../OcellusArenaAssets";
test("surrounding scenery validates exact native placement and rejects invalid geometry",()=>{
 const data={cache:2746,square:16472,plane:1,models:[62249,62250],positions:[0,-1,0,1,-1,0,0,-2,1,0,-3,0,1,-3,0,0,-4,1],vertexColors:Array(6).fill(0x344455),sources:[{id:62954,model:62249,x:-2,y:14,orientation:0,anchorHeight:752,sourceFaces:1,retainedFaces:1},{id:62955,model:62250,x:-2,y:0,orientation:2,anchorHeight:1008,sourceFaces:1,retainedFaces:1}]};
 expect(validateNativeSurrounding(data)).toBe(data);
 expect(()=>validateNativeSurrounding({...data,positions:[0,1,...data.positions.slice(2)]})).toThrow("Invalid native surrounding");
 expect(()=>validateNativeSurrounding({...data,sources:[{...data.sources[0],orientation:1},data.sources[1]]})).toThrow("Invalid native surrounding");
 expect(()=>validateNativeSurrounding({...data,vertexColors:Array(6).fill(-1)})).toThrow("Invalid native surrounding");
});
