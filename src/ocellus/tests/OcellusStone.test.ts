import { LIGHT_STONE, DARK_STONE, arenaStoneAt, arenaStoneCss } from "../OcellusStone";

describe("observed Ocellus floor checkerboard", () => {
  test("the 2D and 3D palette shares the same tile lookup", () => {
    expect(arenaStoneAt({ x: 5, y: 1 })).toBe(LIGHT_STONE);
    expect(arenaStoneCss({ x: 5, y: 1 })).toBe("#4d5849");
    expect(arenaStoneAt({ x: 5, y: 2 })).toBe(DARK_STONE);
    expect(arenaStoneCss({ x: 5, y: 2 })).toBe("#3e483d");
  });

  test("the observed floor is green-grey, not the previous brown-grey", () => {
    for (const colour of [LIGHT_STONE, DARK_STONE]) {
      const red = (colour >> 16) & 255;
      const green = (colour >> 8) & 255;
      const blue = colour & 255;
      expect(green).toBeGreaterThan(red);
      expect(green).toBeGreaterThan(blue);
    }
  });
});
