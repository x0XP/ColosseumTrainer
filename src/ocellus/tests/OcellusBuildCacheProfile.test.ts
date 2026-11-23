import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("single-branch Ocellus cache profile", () => {
  const root = process.cwd();
  const build = readFileSync(resolve(root, "scripts/build-ocellus.sh"), "utf8");
  const config = readFileSync(resolve(root, "osrs-assets.ocellus.config.ts"), "utf8");

  test("all extraction and audit scripts receive the same explicit cache config as the asset build", () => {
    expect(build).toContain("ASSET_ARGS=(--config osrs-assets.ocellus.config.ts --cache-dir");
    expect(build).toContain('npm run assets -- "${ASSET_ARGS[@]}"');
    for (const name of [
      "audit-ocellus-map.mjs",
      "audit-ocellus-npc-animations.mjs",
      "extract-ocellus-icons.mjs",
      "extract-ocellus-texture.mjs",
    ]) {
      expect(build).toContain('node scripts/' + name + ' "${ASSET_ARGS[@]}"');
      const script = readFileSync(resolve(root, "scripts", name), "utf8");
      expect(script).toContain('config: ');
      expect(script).toContain('"--config"');
      expect(script).toContain("cacheId !== 2746");
    }
  });

  test("the Ocellus cache stays 2746 and Sol retains its own main-build config", () => {
    expect(config).toContain("openrs2: 2746");
    const solConfig = readFileSync(resolve(root, "osrs-assets.config.ts"), "utf8");
    expect(solConfig).toContain("openrs2: 2437");
  });
});
