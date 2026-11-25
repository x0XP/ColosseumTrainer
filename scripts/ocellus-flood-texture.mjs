/** The source texture 215 stays byte-for-byte unchanged. The flood itself
 * has a distinct palette measured in encounter footage (reference V1).
 * Recolour only its separately derived ground texture. */
export function floodPixels(source){
  if(source.length%4!==0)throw Error("Expected RGBA starfield");
  const out=new Uint8Array(source.length);
  // P4 reference close-ups show black galaxy ground with bright white stars.
  // These are display-space estimates, not a raw cache palette.
  const dark=[3,3,8],star=[246,245,255];
  for(let i=0;i<source.length;i+=4){
    // Preserve the original star pattern and relative luminance, while
    // mapping its black/purple-white palette onto the observed flood colours.
    const intensity=Math.max(0,Math.min(1,(Math.max(source[i],source[i+1],source[i+2])-8)/247));
    const weight=Math.pow(intensity,.8)*source[i+3]/255;
    for(let c=0;c<3;c++)out[i+c]=Math.round(dark[c]+(star[c]-dark[c])*weight);
    out[i+3]=255;
  }
  return out;
}
