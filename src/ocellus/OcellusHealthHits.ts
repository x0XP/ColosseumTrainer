import { Projectile } from "osrs-sdk";
import type { Unit } from "osrs-sdk";

/**
 * Ocellus's server-side HP changes use the SDK's normal hitsplat pipeline:
 * positive amount = red damage splat, negative = green healing splat.
 * The boss event fires before the player's incoming-hit queue in each world
 * tick, so delay 1 resolves on that same tick.
 *
 * No projectile model is drawn: Ocellus's original spell/fragment spotanims
 * handle the visible attack and healing effects separately.
 */
export function scriptedHealthProjectile(
  boss: Unit,
  target: Unit,
  signedAmount: number,
): Projectile {
  if (!Number.isSafeInteger(signedAmount) || signedAmount === 0) {
    throw new RangeError("Ocellus health splat requires a nonzero integer");
  }
  return new Projectile(null, signedAmount, boss, target, "typeless", {
    setDelay: 1,
    visuals: { hidden: true },
  });
}
