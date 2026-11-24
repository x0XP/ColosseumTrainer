#!/usr/bin/env node
import {readFileSync,writeFileSync} from "node:fs";
import {fileURLToPath} from "node:url";
/** Sample in native client cycles before wrapping, preserving subcycle
 * interpolation and the final pose of a one-shot. */
export function patchOcellusAnimationCycles(source){
 const old=`  const total = animation.lengths.reduce((sum, length) => sum + length, 0) / CLIENT_CYCLES_PER_SECOND;
  const frameCount = animation.mayaFrames?.length || animation.rawFrames?.length || animation.frames.length;
  if (frameCount <= 0 || elapsed < 0) return { time: elapsed, total, frame: -1, nextFrame: -1, blend: 0 };

  const time =
    total <= 0 ? 0 : looping ? elapsed % total : Math.max(0, Math.min(elapsed, Math.max(0, total - Number.EPSILON)));
  // Compare integral cache-cycle boundaries to avoid accumulated seconds drift.
  const cycles = time * CLIENT_CYCLES_PER_SECOND;`;
 const next=`  const totalCycles=animation.lengths.reduce((sum,length)=>sum+length,0);
  const total=totalCycles/CLIENT_CYCLES_PER_SECOND;
  const frameCount=animation.mayaFrames?.length||animation.rawFrames?.length||animation.frames.length;
  if(frameCount<=0||!Number.isFinite(elapsed)||elapsed<0)
    return {time:elapsed,total,frame:-1,nextFrame:-1,blend:0};
  const raw=elapsed*CLIENT_CYCLES_PER_SECOND;
  const nearest=Math.round(raw);
  const absolute=Math.abs(raw-nearest)<=1e-9?nearest:raw;
  const cycles=totalCycles<=0?0:looping?absolute%totalCycles:Math.min(absolute,totalCycles);
  const time=cycles/CLIENT_CYCLES_PER_SECOND;`;
 if(source.split(old).length!==2)throw Error("Pinned SDK animation cycle anchor changed");
 return source.replace(old,next);
}
if(process.argv[1]===fileURLToPath(import.meta.url)){
 const file=process.argv[2];if(!file)throw Error("Expected SDK animations.ts");
 writeFileSync(file,patchOcellusAnimationCycles(readFileSync(file,"utf8")));
}
