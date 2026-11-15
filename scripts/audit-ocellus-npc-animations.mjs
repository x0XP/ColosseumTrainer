#!/usr/bin/env node
/**
 * Verify the boss and Void Rift animation sequences from the exact OSRS
 * cache used to render the trainer. Do not substitute guessed animation IDs.
 * The result is a machine-readable description of native NPC animation
 * lengths, frame counts and client-cycle sounds for future frame comparisons.
 */
import path from "node:path";
import { pathToFileURL } from "node:url";
import { loadConfig } from "osrs-sdk-assets";
import { mkdir, writeFile } from "node:fs/promises";

const args = process.argv.slice(2);
const arg = (key) => { const index = args.indexOf(key); return index >= 0 ? args[index + 1] : undefined; };
const cfg = await loadConfig({
  cwd: process.cwd(), cacheDir: arg("--cache-dir"), readerPath: arg("--reader-path"),
});
const { RSCache, IndexType, ConfigType } =
  await import(pathToFileURL(path.join(cfg.readerPath, "src/index.js")).href);
const cache = new RSCache(path.join(cfg.cacheDir, String(cfg.cacheId), "cache") + path.sep);
const identities = {
  boss: { npc: 16677, animations: {
    idle: 14840, walk: 14849, melee: 14846, baseAttack: 14851,
    deflectIn: 14863, deflectLoop: 14864, deflectOut: 14865,
    soulFragment: 14855, transition: 14844, void: 14857, death: 14872,
  } },
  rift: { npc: 16678, animations: {
    idle: 14895, spawn: 14896, despawn: 14897, detonate: 14898,
  } },
};
await cache.onload;
try {
  const report = { cacheId: cfg.cacheId, npcs: {} };
  for (const [name, { npc, animations }] of Object.entries(identities)) {
    const def = await cache.getDef(IndexType.CONFIGS.id, ConfigType.NPC.id, npc);
    if (!def) throw new Error(`NPC ${npc} (${name}) missing from cache ${cfg.cacheId}`);
    const records = {};
    for (const [state, id] of Object.entries(animations)) {
      const sequence = await cache.getDef(IndexType.CONFIGS.id, ConfigType.SEQUENCE.id, id);
      if (!sequence) throw new Error(`NPC ${npc} missing native animation ${state} (${id})`);
      const animaya = Number.isInteger(sequence.animMayaStart) && Number.isInteger(sequence.animMayaEnd)
        ? sequence.animMayaEnd - sequence.animMayaStart : null;
      const legacy = sequence.frameLengths.length
        ? sequence.frameLengths.reduce((sum, length) => sum + length, 0) : null;
      const durationCycles = animaya ?? legacy;
      if (!durationCycles || durationCycles <= 0)
        throw new Error(`NPC ${npc} animation ${id} has no native frame duration`);
      const frameSounds = sequence.frameSounds
        .flatMap((sounds, frame) => (sounds ?? []).map((s) => ({ frame, id: s.id })));
      records[state] = {
        id, name: sequence.name ?? null, durationCycles,
        frameCount: sequence.frameIDs.length || null,
        animMayaId: sequence.animMayaID,
        frameSounds,
      };
    }
    report.npcs[name] = { id: npc, animations: records };
  }
  // Logs record 440 client cycles for death 14872. Detect cache skew instead
  // of silently accepting a broken skeletal animation.
  const death = report.npcs.boss.animations.death.durationCycles;
  if (death !== 440)
    throw new Error(`Ocellus death seq 14872 expected 440 client cycles, got ${death}`);
  await mkdir(cfg.outDir, { recursive: true });
  const output = path.join(cfg.outDir, "ocellus-npc-animation-audit.json");
  await writeFile(output, JSON.stringify(report, null, 2) + "\n");
  console.log("OCELLUS_NPC_ANIMATIONS " + JSON.stringify(report));
} finally {
  cache.close();
}
