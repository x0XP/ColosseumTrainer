// Build-time evidence only. No runtime colour or floor replacement until
// original upper-face coverage and appearance have been inspected.
import { transformVertex, nativeFaceRgb } from "./ocellus-native-foundation.mjs";
export function sampleTopSurface(models,rows,resolution=16){
  if(!Number.isInteger(resolution)||resolution<2||resolution>64)throw Error("Invalid sampling resolution");
  const width=Math.max(...rows.map(r=>r.length))*resolution,height=rows.length*resolution;
  const samples=new Array(width*height).fill(null);
  for(const {id,model,placement,definition} of models){
    const vertices=Array.from({length:model.vertexCount},(_,i)=>transformVertex([model.vertexPositionsX[i],model.vertexPositionsY[i],model.vertexPositionsZ[i]],placement,definition));
    for(let f=0;f<model.faceCount;f++){
      // Retain opaque faces only; do not invent textured or hidden surfaces.
      if(((model.faceAlphas?.[f]??0)&255)!==0 || (model.faceTextures?.[f]??-1)!==-1 || model.faceRenderTypes?.[f]===2)continue;
      const tri=[model.faceVertexIndices1[f],model.faceVertexIndices2[f],model.faceVertexIndices3[f]].map(i=>vertices[i]);
      if(tri.some(v=>!v||v.some(n=>!Number.isFinite(n))))continue;
      const [a,b,c]=tri;
      if(Math.min(a[1],b[1],c[1])>0.7||Math.max(a[1],b[1],c[1])<-.2)continue;
      const ux=b[0]-a[0],uy=b[1]-a[1],uz=b[2]-a[2],vx=c[0]-a[0],vy=c[1]-a[1],vz=c[2]-a[2];
      const nx=uy*vz-uz*vy,ny=uz*vx-ux*vz,nz=ux*vy-uy*vx;
      if(Math.abs(ny)<1e-8||Math.abs(ny)/Math.hypot(nx,ny,nz)<.8)continue;
      const minX=Math.max(0,Math.floor(Math.min(a[0],b[0],c[0])*resolution));
      const maxX=Math.min(width-1,Math.floor(Math.max(a[0],b[0],c[0])*resolution));
      const minZ=Math.max(0,Math.floor((Math.min(a[2],b[2],c[2])+1)*resolution));
      const maxZ=Math.min(height-1,Math.floor((Math.max(a[2],b[2],c[2])+1)*resolution));
      const det=ux*vz-uz*vx,packed=(model.faceColors?.[f]??0)&65535;
      for(let iz=minZ;iz<=maxZ;iz++)for(let ix=minX;ix<=maxX;ix++){
        const tx=Math.floor(ix/resolution),ty=Math.floor(iz/resolution);
        const glyph=rows[ty]?.[tx];
        if(!"#wb/".includes(glyph??"."))continue;
        const x=(ix+.5)/resolution,z=(iz+.5)/resolution-1;
        const u=((x-a[0])*vz-(z-a[2])*vx)/det,v=(ux*(z-a[2])-uz*(x-a[0]))/det;
        if(u< -1e-7||v< -1e-7||u+v>1+1e-7)continue;
        const y=a[1]+u*uy+v*vy;
        if(y<-.2||y>.7)continue;
        const k=iz*width+ix;
        if(!samples[k]||y>samples[k].y+1e-7)samples[k]={y,packed,rgb:nativeFaceRgb(packed),model:id,face:f};
      }
    }
  }
  const tiles=[];
  for(let y=0;y<rows.length;y++)for(let x=0;x<rows[y].length;x++){
    const kind=rows[y][x];
    if(!"#wb/".includes(kind))continue;
    const covered=[];
    for(let dz=0;dz<resolution;dz++)for(let dx=0;dx<resolution;dx++){
      const s=samples[(y*resolution+dz)*width+x*resolution+dx];
      if(s)covered.push(s);
    }
    const histogram=new Map();
    for(const s of covered)histogram.set(s.packed,(histogram.get(s.packed)??0)+1);
    const colors=[...histogram].sort((a,b)=>b[1]-a[1]).map(([packed,count])=>({packed,rgb:nativeFaceRgb(packed),count}));
    const heights=covered.map(s=>s.y).sort((a,b)=>a-b);
    tiles.push({x,y,kind,coverage:covered.length/(resolution*resolution),medianHeight:heights.length?heights[Math.floor(heights.length/2)]:null,colors,models:[...new Set(covered.map(s=>s.model))]});
  }
  return {width,height,resolution,samples,tiles};
}
export function surfaceSvg(report,rows){
  const {width,height,resolution,samples}=report;
  const px=3,margin=28,top=64;
  const out=[`<svg xmlns="http://www.w3.org/2000/svg" width="${width*px+margin*2}" height="${height*px+top+margin}" viewBox="0 0 ${width*px+margin*2} ${height*px+top+margin}">`,`<rect width="100%" height="100%" fill="#141820"/>`,`<g font-family="sans-serif" fill="#e6e7e9"><text x="12" y="22" font-size="15">Ocellus · native upper surface samples</text><text x="12" y="42" font-size="10">Raw model face colours · not final in-game lighting · empty cells = no qualifying face</text></g>`];
  for(let z=0;z<height;z++){
    for(let x=0;x<width;){
      const s=samples[z*width+x];
      if(!s){x++;continue;}
      let end=x+1;
      while(end<width&&samples[z*width+end]?.rgb===s.rgb)end++;
      out.push(`<rect x="${margin+x*px}" y="${top+z*px}" width="${(end-x)*px}" height="${px}" fill="#${s.rgb.toString(16).padStart(6,"0")}"/>`);
      x=end;
    }
  }
  for(const tile of report.tiles){
    const x=margin+tile.x*resolution*px,y=top+tile.y*resolution*px,side=resolution*px;
    const stroke=tile.kind==="#"?"#89938d":"#d2b16c";
    out.push(`<rect x="${x}" y="${y}" width="${side}" height="${side}" fill="none" stroke="${stroke}" stroke-opacity=".5"/>`);
    out.push(`<text x="${x+2}" y="${y+10}" fill="#f0f0f0" font-family="monospace" font-size="9">${Math.round(tile.coverage*100)}%</text>`);
  }
  return out.join("")+"</svg>";
}
