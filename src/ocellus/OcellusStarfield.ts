/** Preserve the small bright clusters in texture 215 when several source
 * texels share one display pixel. Use the strongest contribution only at
 * near and middle distances so a fully zoomed-out surface stays dark. */
const chains=new WeakMap<HTMLImageElement, readonly (HTMLImageElement|HTMLCanvasElement)[]>();

export function starfieldLevels(image:HTMLImageElement) {
  const existing=chains.get(image);
  if(existing)return existing;
  const source=document.createElement("canvas");
  source.width=image.naturalWidth;
  source.height=image.naturalHeight;
  const ctx=source.getContext("2d")!;
  ctx.drawImage(image,0,0);
  let pixels=ctx.getImageData(0,0,source.width,source.height);
  const levels:(HTMLImageElement|HTMLCanvasElement)[]=[image];
  while(pixels.width>1||pixels.height>1){
    const canvas=document.createElement("canvas");
    canvas.width=Math.max(1,pixels.width>>1);
    canvas.height=Math.max(1,pixels.height>>1);
    const target=canvas.getContext("2d")!;
    const next=target.createImageData(canvas.width,canvas.height);
    const peakWeight=canvas.width>=16?.35:0;
    for(let y=0;y<canvas.height;y++)for(let x=0;x<canvas.width;x++){
      const output=(y*canvas.width+x)*4;
      for(let c=0;c<3;c++){
        let peak=0,sum=0;
        for(let dy=0;dy<2;dy++)for(let dx=0;dx<2;dx++){
          const value=pixels.data[(Math.min(pixels.height-1,2*y+dy)*pixels.width+Math.min(pixels.width-1,2*x+dx))*4+c];
          peak=Math.max(peak,value);
          sum+=value*value;
        }
        next.data[output+c]=Math.sqrt(sum*.25*(1-peakWeight)+peak*peak*peakWeight);
      }
      next.data[output+3]=255;
    }
    target.putImageData(next,0,0);
    levels.push(canvas);
    pixels=next;
  }
  chains.set(image,levels);
  return levels;
}
