/** Cache object lighting matching the pinned SDK's scene-lighting convention.
 * Original face colours and definition ambient/contrast remain the inputs.
 * See osrs-sdk-assets adapter.mts (OBJECT_LIGHTING and modelLighting).
 * This does not claim to recreate the live client's final screen postprocess.
 */
export function nativeFaceRgb(packed) {
  const h=((packed>>>10)&63)/64+1/128;
  const s=((packed>>>7)&7)/8+1/16;
  const l=(packed&127)/128;
  const q=l<.5?l*(1+s):l+s-l*s,p=2*l-q;
  const channel=t=>{
    t=(t%1+1)%1;
    const v=t<1/6?p+(q-p)*6*t:t<1/2?q:t<2/3?p+(q-p)*(2/3-t)*6:p;
    const quantized=Math.floor(Math.max(0,Math.min(1,v))*256)/256;
    return Math.min(255,Math.floor(Math.pow(quantized,.8)*256));
  };
  return (channel(h+1/3)*65536+channel(h)*256+channel(h-1/3))||1;
}

export function shadePacked(packed,brightness){
  return (packed&0xff80)|Math.max(2,Math.min(126,((packed&127)*brightness)>>7));
}

export function objectFaceLighting(model,placement,definition){
  const n=model.vertexCount;
  const turn=placement.orientation&3;
  const vertices=Array.from({length:n},(_,i)=>{
    const x=model.vertexPositionsX[i],y=model.vertexPositionsY[i],z=model.vertexPositionsZ[i];
    return [[x,y,z],[z,y,-x],[-x,y,-z],[-z,y,x]][turn];
  });
  const smooth=Array.from({length:n},()=>[0,0,0,0]),flat=[];
  const ids=face=>[model.faceVertexIndices1[face],model.faceVertexIndices2[face],model.faceVertexIndices3[face]];
  const type=face=>Math.max(0,model.faceRenderTypes?.[face]??0);
  for(let face=0;face<model.faceCount;face++){
    const indices=ids(face),[a,b,c]=indices.map(i=>vertices[i]);
    if(!a||!b||!c)continue;
    const u=b.map((v,i)=>v-a[i]),v=c.map((value,i)=>value-a[i]);
    let x=u[1]*v[2]-u[2]*v[1],y=u[2]*v[0]-u[0]*v[2],z=u[0]*v[1]-u[1]*v[0];
    while(Math.max(Math.abs(x),Math.abs(y),Math.abs(z))>8192){x>>=1;y>>=1;z>>=1;}
    const length=Math.max(1,Math.floor(Math.hypot(x,y,z)));
    const normal=[Math.trunc(x*256/length),Math.trunc(y*256/length),Math.trunc(z*256/length)];
    if(type(face)===1)flat[face]=normal;
    else if(type(face)===0)for(const id of indices){
      const target=smooth[id];
      for(let axis=0;axis<3;axis++)target[axis]+=normal[axis];
      target[3]++;
    }
  }
  const ambient=(definition.ambient??0)+64,contrast=(definition.contrast??0)+768;
  const light=[-50,-10,-50];
  const scaled=(Math.floor(Math.hypot(...light))*contrast)>>8;
  const brightness=(face,vertex)=>{
    if(((model.faceAlphas?.[face]??0)&255)===254)return 128;
    const isFlat=type(face)===1,normal=isFlat?flat[face]:smooth[vertex];
    if(!normal)return ambient;
    const divisor=isFlat?scaled+Math.trunc(scaled/2):scaled*Math.max(1,normal[3]);
    return ambient+Math.trunc((normal[0]*light[0]+normal[1]*light[1]+normal[2]*light[2])/Math.max(1,divisor));
  };
  return face=>{
    const packed=(model.faceColors?.[face]??0)&65535;
    return ids(face).map(vertex=>nativeFaceRgb(shadePacked(packed,brightness(face,vertex))));
  };
}

export function interpolateRgb(colours,weights){
  const toLinear=byte=>{const v=byte/255;return v<=.04045?v/12.92:Math.pow((v+.055)/1.055,2.4);};
  const toByte=linear=>Math.round(255*Math.max(0,Math.min(1,linear<=.0031308?12.92*linear:1.055*Math.pow(linear,1/2.4)-.055)));
  const channel=shift=>toByte(colours.reduce((sum,c,i)=>sum+toLinear((c>>>shift)&255)*weights[i],0));
  return channel(16)*65536+channel(8)*256+channel(0);
}

export function triangleColorAt(triangle,colours,point){
  const [a,b,c]=triangle;
  const u=b.map((v,i)=>v-a[i]),v=c.map((value,i)=>value-a[i]),w=point.map((value,i)=>value-a[i]);
  const dot=(a,b)=>a.reduce((sum,x,i)=>sum+x*b[i],0);
  const uu=dot(u,u),uv=dot(u,v),vv=dot(v,v),wu=dot(w,u),wv=dot(w,v);
  const det=uu*vv-uv*uv;
  if(Math.abs(det)<1e-12)return colours[0];
  const bu=(wu*vv-wv*uv)/det,bv=(wv*uu-wu*uv)/det;
  const weights=[1-bu-bv,bu,bv].map(x=>Math.max(0,Math.min(1,x)));
  const total=weights.reduce((a,b)=>a+b,0);
  return interpolateRgb(colours,weights.map(w=>w/total));
}
