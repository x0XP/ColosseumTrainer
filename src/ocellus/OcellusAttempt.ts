import type { FightStats } from "./Phase4Simulation";

/** Production attempts use a fresh seed. CI supplies a fixed seed explicitly
 * to keep encounter and screenshot assertions reproducible. No presets. */
export function attemptSeed(fixed: number | undefined, random: () => number = Math.random): number {
  if(fixed !== undefined) return fixed >>> 0;
  return Math.floor(random() * 0x100000000) >>> 0;
}

export function attemptMetrics(stats: Readonly<FightStats>) {
  return [
    { label: "Explosions dodged", good: stats.explosionsDodged, total: stats.explosionsTotal },
    { label: "Specials defended", good: stats.specialsDefended, total: stats.specialsTotal },
    { label: "Void rifts destroyed", good: stats.riftsKilled, total: stats.riftsSpawned },
  ] as const;
}
export function formatAttemptTime(tick: number): string {
  const seconds = Math.max(0, Math.floor((tick + 1) * .6));
  return String(Math.floor(seconds / 60)).padStart(2, "0") + ":" + String(seconds % 60).padStart(2, "0");
}
