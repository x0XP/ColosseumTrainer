#!/usr/bin/env node
/**
 * Make the pinned SDK resilient to original RuneScape sequences naming audio
 * which is not actually present in their cache snapshot.
 *
 * This is an Ocellus-only compile patch applied to a temporary SDK checkout.
 * It does not alter Sol Heredit, the pinned dependency repo, or any visuals.
 * Only an explicit "not present in runtime pack" error may be suppressed;
 * missing/corrupt pack downloads and decoding errors still propagate.
 */
import { readFileSync, writeFileSync } from "node:fs";

const target = process.argv[2];
if (!target) throw new Error("Expected temporary SDK AnimationFrameSounds.ts");
let content = readFileSync(target, "utf8");
function replaceOnce(oldText, newText, label) {
  if (content.split(oldText).length !== 2)
    throw new Error("SDK frame sound patch outdated: " + label);
  content = content.replace(oldText, newText);
}

replaceOnce(
  "const CACHE_ANIMATION_SOUND_VOLUME = 0.1;",
  `const CACHE_ANIMATION_SOUND_VOLUME = 0.1;
const unavailableCacheFrameSounds = new Set<number>();`,
  "sound unavailable set",
);
replaceOnce(
  "  await Promise.all(Array.from(ids).map((id) => SoundCache.preload(cacheSound(id))));",
  `  await Promise.all(Array.from(ids).map(async (id) => {
    try {
      await SoundCache.preload(cacheSound(id));
    } catch (error) {
      if (error instanceof Error &&
        error.message === \`Sound effect \${id} is not present in the runtime pack\`) {
        unavailableCacheFrameSounds.add(id);
        console.warn(\`[ocellus] original cache omits referenced sound \${id}; continuing without that sound\`);
        return;
      }
      throw error;
    }
  }));`,
  "optional preloading",
);
replaceOnce(
  "      if (sound) {",
  "      if (sound && !unavailableCacheFrameSounds.has(sound.id)) {",
  "don't attempt to play missing original sounds",
);
writeFileSync(target, content);
console.log("Applied Ocellus-only exact missing-audio guard to native frame sound player");
