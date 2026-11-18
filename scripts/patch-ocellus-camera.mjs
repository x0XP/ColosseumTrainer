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
let next = source.replace(original, "this.pitch.rotation.x = -1.05;");
// With the camera following the player exactly, the 3x3 airborne boss sits
// behind the top-left HP overlay in the 1280px desktop regression frame.
// Aim the focal point 1.25 world tiles towards the arena centre instead.
// Follow and first-frame initialisation MUST use identical offsets.
for (const [from, to] of [
  [
    "this.cameraFocalPoint.follow(Trainer.player.perceivedLocation, timestamp);",
    "this.cameraFocalPoint.follow({ ...Trainer.player.perceivedLocation, y: Trainer.player.perceivedLocation.y + 1.25 }, timestamp);",
  ],
  [
    "this.cameraFocalPoint.initialise(Trainer.player.perceivedLocation, now);",
    "this.cameraFocalPoint.initialise({ ...Trainer.player.perceivedLocation, y: Trainer.player.perceivedLocation.y + 1.25 }, now);",
  ],
]) {
  if (next.split(from).length !== 2)
    throw new Error("Pinned SDK camera focal-point API changed; Ocellus patch requires review: " + from);
  next = next.replace(from, to);
}
writeFileSync(file, next);
console.log("Ocellus-only camera pitch -1.05 radians, focal offset +1.25 tiles towards boss");
