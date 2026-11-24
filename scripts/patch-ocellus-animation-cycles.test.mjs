import {test} from "node:test";
import assert from "node:assert/strict";
import {patchOcellusAnimationCycles} from "./patch-ocellus-animation-cycles.mjs";
const fixture="export function sampleAnimation(\n  animation: CacheRenderAnimation,\n  elapsed: number,\n  looping: boolean,\n): AnimationFrameSample {\n  const total = animation.lengths.reduce((sum, length) => sum + length, 0) / CLIENT_CYCLES_PER_SECOND;\n  const frameCount = animation.mayaFrames?.length || animation.rawFrames?.length || animation.frames.length;\n  if (frameCount <= 0 || elapsed < 0) return { time: elapsed, total, frame: -1, nextFrame: -1, blend: 0 };\n\n  const time =\n    total <= 0 ? 0 : looping ? elapsed % total : Math.max(0, Math.min(elapsed, Math.max(0, total - Number.EPSILON)));\n  // Compare integral cache-cycle boundaries to avoid accumulated seconds drift.\n  const cycles = time * CLIENT_CYCLES_PER_SECOND;\n  let frameStart = 0;\n  let frame = 0;\n  while (\n    frame < Math.min(animation.lengths.length, frameCount) - 1 &&\n    cycles + 1e-9 >= frameStart + animation.lengths[frame]\n  ) {\n    frameStart += animation.lengths[frame];\n    frame++;\n  }\n\n  frame = Math.min(frame, frameCount - 1);\n  const nextFrame = looping ? (frame + 1) % frameCount : Math.min(frame + 1, frameCount - 1);\n  const frameDuration = animation.lengths[frame];\n  const blend = frameDuration ? Math.max(0, Math.min(1, (cycles - frameStart) / frameDuration)) : 0;\n  return { time, total, frame, nextFrame, blend };\n}\n\n";
function sampler(source){
 const js=source.replace("export function","function").replace("animation: CacheRenderAnimation","animation").replace("elapsed: number","elapsed").replace("looping: boolean","looping").replace("): AnimationFrameSample",")");
 return new Function("CLIENT_CYCLES_PER_SECOND",js+";return sampleAnimation")(50);
}
const animation={lengths:[7,9,16],frames:[[],[],[]]};
test("native 32-cycle fragment restarts exactly across 10,000 loop boundaries",()=>{
 const sample=sampler(patchOcellusAnimationCycles(fixture));
 for(let loop=0;loop<10000;loop++){
  const elapsed=loop*32/50;
  const at=sample(animation,elapsed,true);
  assert.equal(at.frame,0);assert.equal(at.blend,0);assert.equal(at.time,0);
  assert.equal(sample(animation,elapsed+.0001,true).frame,0);
  if(loop)assert.equal(sample(animation,elapsed-.0001,true).frame,2);
 }
});
test("all native client boundaries and subcycle blends remain correct",()=>{
 const sample=sampler(patchOcellusAnimationCycles(fixture));
 for(let cycle=0;cycle<3200;cycle++){
  const expected=cycle%32<7?0:cycle%32<16?1:2;
  assert.equal(sample(animation,cycle/50,true).frame,expected);
 }
 assert.equal(sample(animation,7/50,true).frame,1);
 assert.equal(sample(animation,16/50,true).frame,2);
 assert.ok(Math.abs(sample(animation,3.5/50,true).blend-.5)<1e-12);
 assert.equal(sample(animation,32/50,false).frame,2);
 assert.equal(sample(animation,100,false).nextFrame,2);
 assert.equal(sample(animation,-.1,true).frame,-1);
 assert.equal(sample(animation,NaN,true).frame,-1);
 assert.equal(sample(animation,Infinity,true).frame,-1);
 assert.throws(()=>patchOcellusAnimationCycles(patchOcellusAnimationCycles(fixture)),/anchor changed/);
});
