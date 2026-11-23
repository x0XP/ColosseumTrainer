import { defineConfig } from "osrs-sdk-assets";
import { OCELLUS_ASSETS } from "./src/ocellus/Assets";

/** Ocellus's native 2746 cache profile in the unified main-branch build. */
export default defineConfig({
  cache: { openrs2: 2746 },
  assets: OCELLUS_ASSETS,
  outDir: "./public/osrs-assets",
});
