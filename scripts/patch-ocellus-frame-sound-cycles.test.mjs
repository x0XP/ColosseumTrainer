import {test} from "node:test";
import assert from "node:assert/strict";
import {patchOcellusFrameSoundCycles} from "./patch-ocellus-frame-sound-cycles.mjs";
const fixture="type TimedFrameSounds = { at: number; sounds: CacheRenderFrameSound[] };\n\nfunction timedFrameSounds(animation: CacheRenderAnimation): TimedFrameSounds[] {\n  const byFrame = animation.frameSounds ?? {};\n  const starts: number[] = [];\n  let elapsed = 0;\n  for (let frame = 0; frame < animation.lengths.length; frame++) {\n    starts[frame] = elapsed;\n    elapsed += (animation.lengths[frame] ?? 0) / CLIENT_CYCLES_PER_SECOND;\n  }\n  return Object.entries(byFrame)\n    .map(([frame, sounds]) => ({ at: starts[Number(frame)], sounds }))\n    .filter(({ at, sounds }) => Number.isFinite(at) && sounds.length)\n    .sort((a, b) => a.at - b.at);\n}\n\n/** Return sound groups whose frame boundary was crossed since the last draw. */\nexport function frameSoundsBetween(\n  animation: CacheRenderAnimation,\n  previousElapsed: number | null,\n  elapsed: number,\n  looping: boolean,\n): CacheRenderFrameSound[][] {\n  if (elapsed < 0) return [];\n  const events = timedFrameSounds(animation);\n  if (!events.length) return [];\n  const total = animation.lengths.reduce((sum, length) => sum + length, 0) / CLIENT_CYCLES_PER_SECOND;\n  if (total <= 0) return [];\n  let from = previousElapsed == null || elapsed < previousElapsed ? -Number.EPSILON : previousElapsed;\n\n  if (!looping) {\n    const to = Math.min(elapsed, total);\n    return events.filter(({ at }) => at > from && at <= to).map(({ sounds }) => sounds);\n  }\n\n  // A suspended browser can advance by many loops in one draw. Replaying that\n  // whole backlog produces an audio burst, so retain at most the current loop.\n  from = Math.max(from, elapsed - total);\n  const crossed: Array<TimedFrameSounds & { absoluteTime: number }> = [];\n  for (const event of events) {\n    let cycle = Math.max(0, Math.floor((from - event.at) / total) + 1);\n    for (\n      let absoluteTime = cycle * total + event.at;\n      absoluteTime <= elapsed;\n      absoluteTime = ++cycle * total + event.at\n    ) {\n      crossed.push({ ...event, absoluteTime });\n    }\n  }\n  return crossed.sort((a, b) => a.absoluteTime - b.absoluteTime).map(({ sounds }) => sounds);\n}\n\n/** Pick one cache-authored variant.";
const patched=patchOcellusFrameSoundCycles(fixture);
const code=patched.slice(patched.indexOf("function nativeSoundCycle"),patched.indexOf("/** Pick one cache-authored variant."))
 .replaceAll("export function","function").replaceAll(":Array<TimedFrameSounds&{absoluteTime:number}>","").replaceAll(":number|null","").replaceAll(":number[]","").replaceAll(":number","").replaceAll(":boolean","").replaceAll(": CacheRenderAnimation","").replaceAll(":CacheRenderAnimation","").replaceAll(": TimedFrameSounds[]","").replaceAll(":CacheRenderFrameSound[][]","");
const between=new Function("CLIENT_CYCLES_PER_SECOND",code+";return frameSoundsBetween")(50);
const a={lengths:[7,9,16],frameSounds:{0:[{id:1}],1:[{id:2}],2:[{id:3}]}};
const ids=groups=>groups.flat().map(s=>s.id);
test("native frame sounds cross the same cycle as the visible pose",()=>{
 for(let n=0;n<10000;n++){
  const c=n*32;
  assert.deepEqual(ids(between(a,(c-.01)/50,c/50,true)),[1]);
  assert.deepEqual(ids(between(a,c/50,(c+7)/50,true)),[2]);
  assert.deepEqual(ids(between(a,(c+7)/50,(c+16)/50,true)),[3]);
  assert.deepEqual(ids(between(a,(c+16)/50,(c+16)/50,true)),[]);
 }
});
test("cold start, rewind, one-shot and suspended tab preserve original sound ordering",()=>{
 assert.deepEqual(ids(between(a,null,0,true)),[1]);
 assert.deepEqual(ids(between(a,null,32/50,false)),[1,2,3]);
 assert.deepEqual(ids(between(a,32/50,100,false)),[]);
 assert.deepEqual(ids(between(a,100,0,true)),[1]);
 assert.deepEqual(ids(between(a,0,320/50,true)),[2,3,1]);
 assert.deepEqual(ids(between(a,0,NaN,true)),[]);
 assert.throws(()=>patchOcellusFrameSoundCycles(patched),/anchor changed/);
});
