#!/usr/bin/env node
import {readFileSync,writeFileSync} from "node:fs";
import {fileURLToPath} from "node:url";
export function patchOcellusFrameSoundCycles(source){
 const start=source.indexOf("type TimedFrameSounds =");
 const end=source.indexOf("/** Pick one cache-authored variant.",start);
 if(start<0||end<0||source.includes("function nativeSoundCycle(")||source.split("export function frameSoundsBetween(").length!==2)throw Error("Pinned SDK sound cycle anchor changed");
 const block=`type TimedFrameSounds = { at: number; sounds: CacheRenderFrameSound[] };

function nativeSoundCycle(seconds:number):number{
 const raw=seconds*CLIENT_CYCLES_PER_SECOND;
 const nearest=Math.round(raw);
 return Math.abs(raw-nearest)<=1e-9?nearest:raw;
}
function timedFrameSounds(animation: CacheRenderAnimation): TimedFrameSounds[] {
 const starts:number[]=[];
 let cycles=0;
 for(let frame=0;frame<animation.lengths.length;frame++){
  starts[frame]=cycles;cycles+=animation.lengths[frame]??0;
 }
 return Object.entries(animation.frameSounds??{})
  .map(([frame,sounds])=>({at:starts[Number(frame)],sounds}))
  .filter(({at,sounds})=>Number.isFinite(at)&&sounds.length)
  .sort((a,b)=>a.at-b.at);
}
/** Return sound groups crossed in the same native cycles as the poses. */
export function frameSoundsBetween(
 animation:CacheRenderAnimation,
 previousElapsed:number|null,
 elapsed:number,
 looping:boolean,
):CacheRenderFrameSound[][]{
 if(!Number.isFinite(elapsed)||elapsed<0)return [];
 const events=timedFrameSounds(animation);
 const total=animation.lengths.reduce((sum,length)=>sum+length,0);
 if(!events.length||total<=0)return [];
 const to=nativeSoundCycle(elapsed);
 let from=previousElapsed==null||!Number.isFinite(previousElapsed)||elapsed<previousElapsed?-1e-6:nativeSoundCycle(previousElapsed);
 if(!looping)return events.filter(({at})=>at>from&&at<=Math.min(to,total)).map(({sounds})=>sounds);
 from=Math.max(from,to-total);
 const crossed:Array<TimedFrameSounds&{absoluteTime:number}>=[];
 for(const event of events){
  const cycle=Math.max(0,Math.floor((from-event.at)/total)+1);
  const absoluteTime=cycle*total+event.at;
  if(absoluteTime>from&&absoluteTime<=to)crossed.push({...event,absoluteTime});
 }
 return crossed.sort((a,b)=>a.absoluteTime-b.absoluteTime).map(({sounds})=>sounds);
}

`;
 return source.slice(0,start)+block+source.slice(end);
}
if(process.argv[1]===fileURLToPath(import.meta.url)){
 const file=process.argv[2];if(!file)throw Error("Expected AnimationFrameSounds.ts");
 writeFileSync(file,patchOcellusFrameSoundCycles(readFileSync(file,"utf8")));
}
