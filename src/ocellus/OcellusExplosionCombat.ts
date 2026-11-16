import type { PhaseFrame } from "./Phase4Rules";

/**
 * The observed Ocellus Phase 4 explosion series reduces PLAYER attacks
 * against the boss by 60% while its six marks are active, including the
 * sixth mark's impact tick. Separate from NPC defence/prayer rolls.
 * Timing is in P4 cycle offsets, not wall-clock time.
 */
export function explosionDamageReducedAt(frame: PhaseFrame): boolean {
  if (frame.cycle === 0) return false;
  const t = frame.offset;
  return (t >= 9 && t <= 20) || (t >= 40 && t <= 51);
}

export type ExplosionReducibleHit = { damage: number; beforeHit(): void };

/** Resolve the reduction at projectile IMPACT, after the SDK's weapon-specific
 * hit processing. A deflected hit stays 0; healing values are untouched.
 * Called only for player-launched projectiles targeting Ocellus.
 */
export function installOcellusExplosionReduction(
  projectile: ExplosionReducibleHit, landingFrame: () => PhaseFrame,
): void {
  const beforeHit = projectile.beforeHit.bind(projectile);
  projectile.beforeHit = () => {
    beforeHit();
    if (projectile.damage > 0 && explosionDamageReducedAt(landingFrame())) {
      projectile.damage = Math.floor(projectile.damage * 0.4);
    }
  };
}
