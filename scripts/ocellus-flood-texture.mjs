/** The source texture 215 stays byte-for-byte unchanged. The flood itself
 * has a distinct palette measured in encounter footage (reference V1).
 * Recolour only its separately derived ground texture. */
export function floodPixels(source){
  if(source.length%4!==0)throw Error("Expected RGBA starfield");
  const out=new Uint8Array(source.length);
  const dark=[30,37,41],star=[186,188,194];
  for(let i=0;i<source.length;i+=4){
    // Preserve the original star pattern and relative luminance, while
    // mapping its black/purple-white palette onto the observed flood colours.
    const weight=Math.max(0,Math.min(1,(Math.max(source[i],source[i+1],source[i+2])-8)/247))*source[i+3]/255;
    for(let c=0;c<3;c++)out[i+c]=Math.round(dark[c]+(star[c]-dark[c])*weight);
    out[i+3]=255;
  }
  return out;
}
