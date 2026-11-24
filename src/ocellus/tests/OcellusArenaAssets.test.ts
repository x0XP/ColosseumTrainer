import { createArenaAssetCache } from "../OcellusArenaAssets";

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
