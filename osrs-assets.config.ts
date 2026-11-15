import { defineConfig } from "osrs-sdk-assets";
import { OCELLUS_ASSETS } from "./src/ocellus/Assets";

/**
 * Separate Ocellus build profile; requires OSRS cache 2746 or newer.
 * The live ColosseumTrainer branch keeps its own 2437 config untouched.
 */
export default defineConfig({
  cache: { openrs2: 2746 },
  assets: OCELLUS_ASSETS,
  outDir: "./public/osrs-assets",
});
