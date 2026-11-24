// Pure native-model geometry helpers. Neutral preview only, no runtime game code.
function escapeXml(value) {return String(value).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");}
export function geometryOf(def) {
  const vertices = Array.from({length: def.vertexCount}, (_, i) => [def.vertexPositionsX[i], -def.vertexPositionsY[i], def.vertexPositionsZ[i]]);
  if (!vertices.length || vertices.some(v => v.some(x => !Number.isFinite(x)))) throw new Error("Invalid model vertices");
  const triangles = Array.from({length: def.faceCount}, (_, i) => ({
    indices: [def.faceVertexIndices1[i], def.faceVertexIndices2[i], def.faceVertexIndices3[i]],
    transparent: ((def.faceAlphas?.[i] ?? 0) & 255) === 255,
  })).filter(face => !face.transparent && face.indices.every(i => Number.isInteger(i) && vertices[i]));
  if (!triangles.length) throw new Error("Model has no visible triangles");
  const bounds = [0, 1, 2].map(axis => {
    let min = Infinity, max = -Infinity;
    for (const vertex of vertices) {min = Math.min(min, vertex[axis]); max = Math.max(max, vertex[axis]);}
    return { min, max, span: max - min };
  });
  return {vertices, triangles, bounds};
}
function preview(geometry, angle, x, y, w, h) {
  const cs = Math.cos(angle), sn = Math.sin(angle), pitch = Math.PI / 7;
  const pts = geometry.vertices.map(([vx, vy, vz]) => {
    const right = vx * cs - vz * sn, depth = vx * sn + vz * cs;
    return [right, -vy * Math.cos(pitch) + depth * Math.sin(pitch), vy * Math.sin(pitch) + depth * Math.cos(pitch)];
  });
  let minX=Infinity,minY=Infinity,maxX=-Infinity,maxY=-Infinity;
  for (const [px,py] of pts) {minX=Math.min(minX,px);minY=Math.min(minY,py);maxX=Math.max(maxX,px);maxY=Math.max(maxY,py);}
  const scale=Math.min((w-12)/Math.max(1,maxX-minX),(h-12)/Math.max(1,maxY-minY));
  const faces=geometry.triangles.map(({indices}) => {
    const corners=indices.map(i=>pts[i]);
    const a=corners[0],b=corners[1],c=corners[2];
    const area=(b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]);
    // Neutral geometry preview: distinguish silhouettes and facets without
    // falsely claiming the game client's material, texture or lighting.
    const ux=b[0]-a[0],uy=b[1]-a[1],uz=b[2]-a[2],vx=c[0]-a[0],vy=c[1]-a[1],vz=c[2]-a[2];
    const nx=uy*vz-uz*vy,ny=uz*vx-ux*vz,nz=ux*vy-uy*vx;
    const norm=Math.hypot(nx,ny,nz)||1;
    const light=Math.abs((nx*0.35-ny*0.65+nz*0.67)/norm);
    return {corners,depth:(a[2]+b[2]+c[2])/3,area,grey:Math.round(72+133*Math.min(1,light))};
  }).filter(f=>Math.abs(f.area)>1e-6).sort((a,b)=>b.depth-a.depth);
  return faces.map(({corners,grey})=>{
    const points=corners.map(([px,py])=>[
      (x+w/2+(px-(minX+maxX)/2)*scale).toFixed(1),
      (y+h/2+(py-(minY+maxY)/2)*scale).toFixed(1)
    ].join(",")).join(" ");
    return '<polygon points="'+points+'" fill="rgb('+grey+','+grey+','+grey+')" stroke="#44484e" stroke-width=".3"/>';
  }).join("");
}
export function makeSheet(records, cacheId) {
  const cols=4, cellW=300,cellH=170,header=65;
  const width=cols*cellW,height=header+Math.ceil(records.length/cols)*cellH;
  const parts=['<svg xmlns="http://www.w3.org/2000/svg" width="'+width+'" height="'+height+'" viewBox="0 0 '+width+' '+height+'">','<rect width="100%" height="100%" fill="#15191f"/>','<g font-family="sans-serif" fill="#eef0f2">','<text x="18" y="25" font-size="18">Ocellus native cache '+cacheId+' · scenery model inspection</text>','<text x="18" y="47" font-size="12">Two neutral, independently fitted views per model · dimensions are native units (128 = 1 tile) · not game lighting or placement</text>'];
  records.forEach((r,i)=>{
    const x=i%cols*cellW,y=header+Math.floor(i/cols)*cellH;
    parts.push('<rect x="'+(x+3)+'" y="'+(y+3)+'" width="'+(cellW-6)+'" height="'+(cellH-6)+'" rx="4" fill="#222830" stroke="#47505b"/>');
    parts.push('<text x="'+(x+10)+'" y="'+(y+21)+'" font-size="13">Model '+r.id+' · '+escapeXml(r.label)+'</text>');
    if(r.geometry) {
      parts.push(preview(r.geometry,Math.PI/5,x+6,y+25,144,111),preview(r.geometry,Math.PI*0.73,x+150,y+25,144,111));
      const span=r.geometry.bounds.map(b=>b.span).join(" × ");
      parts.push('<text x="'+(x+10)+'" y="'+(y+151)+'" font-size="11">'+span+' · '+r.geometry.triangles.length+' faces · '+escapeXml(r.locs.slice(0,4).join(", "))+(r.locs.length>4?" …":"")+'</text>');
    } else parts.push('<text x="'+(x+10)+'" y="'+(y+80)+'" font-size="12">Unavailable: '+escapeXml(r.error?.slice(0,35)??"unknown")+'</text>');
  });
  return parts.join("")+"</g></svg>";
}
