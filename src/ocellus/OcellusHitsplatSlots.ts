/** Preferred native SDK hitsplat locations. Never draw a green healsplat
 * over an occupied damage/miss slot, and never exceed the four native slots. */
export type HitsplatSlot=readonly [number,number];
export function availableHealSlots(occupied:readonly HitsplatSlot[]):readonly HitsplatSlot[]{
 const preferred:readonly HitsplatSlot[]=[[0,30],[-18,20],[18,20],[0,10]];
 return preferred.filter(([x,y])=>!occupied.some(([px,py])=>px===x&&py===y));
}
