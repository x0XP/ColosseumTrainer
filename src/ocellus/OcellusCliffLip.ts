import { PLATFORM_ROWS } from "./Phase4Rules";

type Point = { x:number; z:number };
type Face = { offset:number; corners:Point[]; heights:number[]; area:number };

const cross=(a:Point,b:Point,p:Point)=>(b.x-a.x)*(p.z-a.z)-(b.z-a.z)*(p.x-a.x);
const key=(x:number,z:number)=>x+":"+z;

/** Per-corner planar distance to each exposed shelf edge. Interpolation in
 * the shader gives a constant-width line even on a nearly horizontal shelf.
 * Internal triangulation and joins to the playable floor receive no line. */
export function cliffLipDistances(positions:readonly number[]):Float32Array {
  const distances=new Float32Array(positions.length).fill(10);
  const cells=new Map<string,Face[]>(),faces:Face[]=[];
  for(let i=0;i<positions.length;i+=9){
    const corners=[0,3,6].map(j=>({x:positions[i+j],z:positions[i+j+2]}));
    const heights=[positions[i+1],positions[i+4],positions[i+7]];
    if(Math.min(...heights)<-.48)continue;
    const [a,b,c]=corners,area=cross(a,b,c);
    // Upward winding in the renderer's X/Z basis is clockwise.
    if(area>=-1e-8)continue;
    const dx=(b.z-a.z)*(heights[2]-heights[0])-(c.z-a.z)*(heights[1]-heights[0]);
    const dz=(c.x-a.x)*(heights[1]-heights[0])-(b.x-a.x)*(heights[2]-heights[0]);
    if(Math.hypot(dx,dz)>Math.abs(area))continue;
    const face={offset:i,corners,heights,area};
    faces.push(face);
    for(let x=Math.floor(Math.min(a.x,b.x,c.x));x<=Math.floor(Math.max(a.x,b.x,c.x));x++)
      for(let z=Math.floor(Math.min(a.z,b.z,c.z));z<=Math.floor(Math.max(a.z,b.z,c.z));z++){
        const id=key(x,z);
        if(!cells.has(id))cells.set(id,[]);
        cells.get(id)!.push(face);
      }
  }
  const covered=(p:Point,height:number)=>{
    const x=Math.floor(p.x),z=Math.floor(p.z);
    if("#wb/".includes(PLATFORM_ROWS[z+1]?.[x]??"."))return true;
    return (cells.get(key(x,z))??[]).some(({corners:[a,b,c],heights,area})=>{
      if(cross(a,b,p)>1e-9||cross(b,c,p)>1e-9||cross(c,a,p)>1e-9)return false;
      // Projected overlap alone is insufficient: a lower shelf must not
      // hide the upper ledge. Interpolate the native surface elevation.
      const wa=cross(b,c,p)/area,wb=cross(c,a,p)/area,wc=1-wa-wb;
      return wa*heights[0]+wb*heights[1]+wc*heights[2]>=height-.04;
    });
  };
  for(const {offset,corners,heights,area} of faces){
    for(let edge=0;edge<3;edge++){
      const a=corners[edge],b=corners[(edge+1)%3];
      const dx=b.x-a.x,dz=b.z-a.z,length=Math.hypot(dx,dz);
      const outside=(t:number)=>({x:a.x+t*dx-.002*dz/length,z:a.z+t*dz+.002*dx/length});
      const heightAt=(t:number)=>heights[edge]+(heights[(edge+1)%3]-heights[edge])*t;
      if([.15,.35,.5,.65,.85].some(t=>covered(outside(t),heightAt(t))))continue;
      for(let j=0;j<3;j++)distances[offset+j*3+edge]=j===(edge+2)%3?Math.abs(area)/length:0;
    }
  }
  return distances;
}
