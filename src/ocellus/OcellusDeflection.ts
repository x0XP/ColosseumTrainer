import { bossOverheadAt } from "./Phase4Rules";
import type { PhaseFrame } from "./Phase4Rules";

/** The SDK uses stab/slash/crush for melee projectiles and range for bows. */
export function deflectedByOcellus(frameAtLaunch: PhaseFrame, attackStyle: string): boolean {
  const overhead = bossOverheadAt(frameAtLaunch);
  if (overhead === "Deflect Melee") {
    return attackStyle === "stab" || attackStyle === "slash" || attackStyle === "crush";
  }
  if (overhead === "Deflect Range") return attackStyle === "range";
  return false;
}

export type DeflectableHit = { readonly attackStyle: string; damage: number; beforeHit(): void };

/**
 * Capture the overhead when the hit launches. SDK projectile.beforeHit runs
 * on arrival, after any weapon-specific prayer or damage calculation. Keeping
 * the original beforeHit prevents us from disabling the normal hit visuals.
 * No direct HP mutations or fabricated reflected damage.
 */
export function installOcellusDeflection(
  projectile: DeflectableHit, frameAtLaunch: PhaseFrame,
): boolean {
  if (!deflectedByOcellus(frameAtLaunch, projectile.attackStyle)) return false;
  const originalBeforeHit = projectile.beforeHit.bind(projectile);
  projectile.beforeHit = () => {
    // Prevent ordinary positive-hit weapon effects before their callback.
    // The separate stat guard rolls back any zero-hit drain that still runs.
    projectile.damage = 0;
    originalBeforeHit();
    projectile.damage = 0;
  };
  return true;
}
