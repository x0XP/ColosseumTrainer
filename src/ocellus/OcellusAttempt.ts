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
    { label: "Fragments collected", good:stats.fragmentsCollected,total:stats.fragmentsSpawned },
    { label: "Speed-bonus dodges", good:stats.speedBonusDodges,total:stats.explosionsTotal },
  ] as const;
}
export function formatAttemptTime(tick: number): string {
  const seconds = Math.max(0, Math.floor((tick + 1) * .6));
  return String(Math.floor(seconds / 60)).padStart(2, "0") + ":" + String(seconds % 60).padStart(2, "0");
}

/** Each category is a subset of simulator mechanic damage, not a claim to
 * count every external SDK weapon or environmental hitsplat. */
export function damageBreakdown(stats:Readonly<FightStats>) {
  return [
    {label:"Lifeforce drain",amount:stats.drained},
    {label:"Void floor",amount:stats.voidFloorDamage},
    {label:"Lingering void",amount:stats.lingeringVoidDamage},
    {label:"Explosions",amount:stats.explosionDamage},
    {label:"Protected specials",amount:stats.protectedSpecialDamage},
    {label:"Wrong-prayer specials",amount:stats.unprotectedSpecialDamage},
    {label:"Rift eruptions",amount:stats.riftDamage},
  ];
}

/** A presentation-only ratio, without changing raw encounter counters.
 * No denominator means no attempt, not a zero-percent failure. */
export function attemptPercentage(good:number,total:number):number|null {
 if(!Number.isFinite(good)||!Number.isFinite(total)||total<=0)return null;
 return Math.round(Math.max(0,Math.min(1,good/total))*100);
}
