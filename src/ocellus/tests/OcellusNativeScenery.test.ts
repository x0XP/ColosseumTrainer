import { OCELLUS_CENSER_FIXTURES, fixtureHeight, fixtureRotation, CENSER_NATIVE_BOUNDS, CENSER_FLAME_CLEARANCE, CENSER_HANG_HEIGHT } from "../OcellusNativeScenery";
import { PLATFORM_ROWS, inPlatform } from "../Phase4Rules";
import { OCELLUS_ASSETS } from "../Assets";

describe("native region 16472 censer fixtures", () => {
  test("both native objects are placed at the original non-walkable censer tile", () => {
    expect(OCELLUS_CENSER_FIXTURES.map(f=>[f.objectId,f.modelId,f.shape,f.orientation,f.animation])).toEqual([
      [62894,62357,22,3,-1],[62895,62739,10,1,10772],
    ]);
    for (const fixture of OCELLUS_CENSER_FIXTURES) {
      expect(fixture.tile).toEqual({x:8,y:8});
      expect(PLATFORM_ROWS[fixture.tile.y][fixture.tile.x]).toBe("b");
      expect(inPlatform(fixture.tile)).toBe(false);
      expect(fixtureHeight(fixture)).toBe(0.5);
    }
  });
  test("raw model orientation compensates the SDK basis rotation",()=>{
    for (const fixture of OCELLUS_CENSER_FIXTURES) {
      expect(fixtureRotation(fixture)+Math.PI/2).toBeCloseTo(-fixture.orientation*Math.PI/2);
    }
  });
  test("both native model assets and the map-defined animation are included",()=>{
    expect(OCELLUS_ASSETS.models.ocellusCenserFixture.id).toBe(62357);
    expect(OCELLUS_ASSETS.models.ocellusCenserAnimatedFixture).toEqual({id:62739,animations:{idle:10772}});
  });
});

test("hanging censer stays above the entire native flame animation",()=>{
 const flameTop=fixtureHeight(OCELLUS_CENSER_FIXTURES[1])+CENSER_NATIVE_BOUNDS.flameTop;
 expect(CENSER_HANG_HEIGHT).toBe(3.5);
 expect(CENSER_HANG_HEIGHT+CENSER_NATIVE_BOUNDS.censerBottom-flameTop).toBe(CENSER_FLAME_CLEARANCE);
 expect(CENSER_HANG_HEIGHT+CENSER_NATIVE_BOUNDS.censerBottom).toBeGreaterThan(fixtureHeight(OCELLUS_CENSER_FIXTURES[0])+CENSER_NATIVE_BOUNDS.standTop);
});
