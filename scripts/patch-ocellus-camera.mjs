#!/usr/bin/env node
/**
 * Ocellus-only camera framing. The original 3D SDK starts at -0.7 radians,
 * clipping the raised boss over the remaining quadrant. The OSRS client view
 * in phase-four footage is closer to a 60-degree downward camera.
 *
 * Patch ONLY the temporary pinned SDK clone used for the independent Ocellus
 * build. The stable Sol Heredit trainer and the real SDK repo are untouched.
 * Fail on unknown upstream code instead of silently replacing another line.
 */
import { readFileSync, writeFileSync } from "node:fs";
const file = process.argv[2];
if (!file) throw new Error("Expected the temporary SDK Viewport3d.ts path");
const source = readFileSync(file, "utf8");
const original = "this.pitch.rotation.x = -0.7;";
if (source.split(original).length !== 2) {
  throw new Error("Pinned SDK starting camera pitch changed; Ocellus patch requires review");
}
const next = source.replace(original, "this.pitch.rotation.x = -1.05;");
writeFileSync(file, next);
console.log("Ocellus-only camera pitch: -0.7 -> -1.05 radians");
