/** Preferred native SDK hitsplat locations. Never draw a green healsplat
 * over an occupied damage/miss slot, and never exceed the four native slots. */
export type HitsplatSlot=readonly [number,number];
export function availableHealSlots(occupied:readonly HitsplatSlot[]):readonly HitsplatSlot[]{
 const preferred:readonly HitsplatSlot[]=[[0,30],[-18,20],[18,20],[0,10]];
 return preferred.filter(([x,y])=>!occupied.some(([px,py])=>px===x&&py===y));
}

/** Keep surviving heals in their previous slots; damage takes priority. */
export function reserveHealSlots(previous:readonly (HitsplatSlot|undefined)[],occupied:readonly HitsplatSlot[]):(HitsplatSlot|undefined)[]{
 const free=availableHealSlots(occupied);
 const used=new Set<number>();
 const result=previous.map(slot=>{
  const index=slot?free.findIndex(([x,y])=>x===slot[0]&&y===slot[1]):-1;
  if(index<0||used.has(index))return undefined;
  used.add(index);return free[index];
 });
 for(let i=0;i<result.length;i++){
  if(result[i])continue;
  const index=free.findIndex((_slot,j)=>!used.has(j));
  if(index<0)break;
  used.add(index);result[i]=free[index];
 }
 return result;
}
