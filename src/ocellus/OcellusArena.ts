import * as THREE from "three";
import { cliffLipDistances } from "./OcellusCliffLip";
import { floorLighting } from "./OcellusFloorLighting";
import { bossShadowLift, flameGlowScale, markGlowOpacity, SHADOW_PADDING_TILES, SHADOW_RAY_X, SHADOW_RAY_Z, stoneGrade, cliffFacetExposure, rimReflectionPixels, environmentLightAt, fragmentLight, playerContactPosition, nativeRockHeightAssignment } from "./OcellusArenaLighting";
import { starfieldLevels } from "./OcellusStarfield";
import {
  CacheRenderInstancedModel, CacheRenderReferences,
  CollisionType, Entity, LineOfSightMask, GROUND_OVERLAY_Y,
} from "osrs-sdk";
import type { Location3, Model, Region } from "osrs-sdk";
import { BOARD_WIDTH, BOARD_HEIGHT, FLOOR_TILES, HOLE_TILES, BOSS_ANCHOR, bossVisibleAt, inNearSquare } from "./Phase4Rules";
import type { Tile } from "./Phase4Rules";
import type { OcellusView } from "./OcellusRegion";
import { effectCue, orbDepartureCue, nativeEffectPlaybackAt } from "./OcellusVisualCues";
import type { EffectLayer } from "./OcellusVisualCues";
import { cliffBoundarySegments, insetCliffBoundary, voidSurfaceTriangles, voidRimVertices, nativeVoidUv, stoneSurfaceTriangles, voidRimSegments } from "./OcellusArenaTopology";
import { loadBackdrop, loadArenaJson, loadArenaImage, loadNativeSurrounding } from "./OcellusArenaAssets";
import {NATIVE_FOUNDATION_TOP_Y,NATIVE_FOUNDATION_MIN_Y,NATIVE_SCENERY_MAX_Y,ARENA_ABYSS_RGB,cliffBackingDepthProfile,cliffVisibility,nativeCliffSampler,nativeCliffSection,nativeBackingPoint,NATIVE_CLIFF_FADE_END,CLIFF_BOTTOM_Y} from "./OcellusNativeMesh";
import { fixtureHeight, fixtureRotation, OCELLUS_CENSER_FIXTURES } from "./OcellusNativeScenery";
import { VOID_RIM_COLOR, VOID_RIM_DEPTH } from "./OcellusStone";
import type { NativeFixture } from "./OcellusNativeScenery";

/**
 * Visual-only Phase 4 arena. Scenery and effects have no collision, timers or
 * combat rules. Colours and shapes are based on documented arena observations;
 * effects use the native cache spotanims; remaining arena surfaces are
 * reconstructed from the observed region 16472 collision and location flags.
 */
// SDK ground floor is -0.49. Place the stone base slightly underneath
// the original void overlay to eliminate flicker and floating geometry.
const SURFACE = GROUND_OVERLAY_Y + 0.003;
const EDGE = SURFACE + 0.002;
// The recovered rock tops are at -1/128 (floor) and 63/128 (curb).
const NATIVE_FLOOR_Y = GROUND_OVERLAY_Y - 1 / 128;
const RIM = VOID_RIM_COLOR;
const flameTile=OCELLUS_CENSER_FIXTURES[1].tile;
const flameX=flameTile.x+.5, flameZ=flameTile.y-.5;
// Display-space match for the exposed olive stone in the P4 walking clip.
const STONE_EXPOSURE = 1.06;
const CLIFF_EXPOSURE = 1.48;

function gradeStone(colour:THREE.Color,amount:number):THREE.Color {
  return colour.setRGB(...stoneGrade(colour.r,colour.g,colour.b,amount));
}

type Vertex = readonly [number, number, number];
const v = (x: number, y: number, z: number): Vertex => [x, y, z];
function geometry(points: readonly Vertex[], colours?: readonly string[], uv?: readonly [number, number][]): THREE.BufferGeometry {
  const result = new THREE.BufferGeometry();
  result.setAttribute("position", new THREE.Float32BufferAttribute(points.flatMap((p) => [...p]), 3));
  if (colours) {
    const arr = colours.flatMap((col) => {
      const c = new THREE.Color(col);
      return [c.r, c.g, c.b];
    });
    result.setAttribute("color", new THREE.Float32BufferAttribute(arr, 3));
  }
  if (uv) result.setAttribute("uv", new THREE.Float32BufferAttribute(uv.flatMap((pair) => [...pair]), 2));
  return result;
}

/** One native-coloured surface, retaining the 84-tile geometry and exact
 * cache floor height. The baked texture comes from original rock faces.
 * UV v=0 is the north row (image data uses flipY=false).
 */
function stoneFloorMesh(texture: THREE.Texture): THREE.Mesh {
  const positions: Vertex[] = [];
  const uv: [number, number][] = [];
  for (const triangle of stoneSurfaceTriangles(FLOOR_TILES)) {
    for (const corner of triangle) {
      positions.push(v(corner.x, NATIVE_FLOOR_Y, corner.z));
      uv.push([corner.x / BOARD_WIDTH, (corner.z + 1) / BOARD_HEIGHT]);
    }
  }
  const mesh = new THREE.Mesh(geometry(positions, undefined, uv), new THREE.MeshBasicMaterial({
    map: texture, color:new THREE.Color().setScalar(STONE_EXPOSURE), side: THREE.DoubleSide,
  }));
  mesh.name = "ocellus-native-stone-floor";
  return mesh;
}

/** Reconstructed standing-quadrant depth. All geometry sits below the floor,
 * so it cannot obscure game-cache NPCs, floor effects or walkable tiles.
 * It does not reproduce the missing 16472 room archive or affect collision.
 */
function cliffMesh(inset: number, backingTiles: readonly Tile[], sample: (x:number,z:number,y:number)=>number,nativePositions:readonly number[]): THREE.Mesh {
  const points: Vertex[]=[];
  const colours:number[]=[];
  const profile=cliffBackingDepthProfile(inset),abyss=new THREE.Color(ARENA_ABYSS_RGB);
  const boundary=cliffBoundarySegments(FLOOR_TILES,backingTiles);
  const bands=profile.map((level,i)=>{
    const contour=insetCliffBoundary(boundary,level.inset);
    if(i===0||i===profile.length-1)return contour;
    const sections=nativeCliffSection(nativePositions,level.y);
    // Reuse the exact same adjusted coordinates at shared contour joins.
    const adjusted=new Map<string,{x:number;z:number}>();
    const point=(edge:{x:number;z:number},p:{x:number;z:number})=>{
      const key=[edge.x,edge.z,p.x,p.z].join(":");
      const cached=adjusted.get(key);if(cached)return cached;
      const next=nativeBackingPoint(edge,p,sections);adjusted.set(key,next);return next;
    };
    return contour.map((e,j)=>({from:point(boundary[j].from,e.from),to:point(boundary[j].to,e.to)}));
  });
  const append=(point:Vertex,colour:THREE.Color)=>{
    points.push(point);colours.push(colour.r,colour.g,colour.b);
  };
  // Every strip joins the same inset contour on its shared depth plane.
  // The backing narrows under the true rock and never defines its outer lip.
  for(let j=0;j<boundary.length;j++){
    const bandColours=bands.map((band,i)=>{
      const {from,to}=band[j],{y,visibility}=profile[i];
      return [from,to].map(p=>abyss.clone().lerp(gradeStone(new THREE.Color(sample(p.x,p.z,y)),1).multiplyScalar(CLIFF_EXPOSURE*.86),visibility));
    });
    for(let i=0;i<profile.length-1;i++){
      const top=profile[i],bottom=profile[i+1],upper=bands[i][j],lower=bands[i+1][j];
      const a=v(upper.from.x,GROUND_OVERLAY_Y+top.y,upper.from.z),b=v(upper.to.x,GROUND_OVERLAY_Y+top.y,upper.to.z);
      const c=v(lower.to.x,GROUND_OVERLAY_Y+bottom.y,lower.to.z),d=v(lower.from.x,GROUND_OVERLAY_Y+bottom.y,lower.from.z);
      const [ca,cb]=bandColours[i],[cd,cc]=bandColours[i+1];
      append(a,ca);append(b,cb);append(c,cc);append(a,ca);append(c,cc);append(d,cd);
    }
  }
  const geo=geometry(points);
  geo.setAttribute("color",new THREE.Float32BufferAttribute(colours,3));
  const mesh=new THREE.Mesh(geo,new THREE.MeshBasicMaterial({vertexColors:true,side:THREE.DoubleSide}));
  mesh.name="ocellus-recessed-cliff-backing";
  return mesh;
}

/** Native rock facets recovered from plane 1 and clipped at build time.
 * No geometry above the floor or outside the surviving quadrant is allowed.
 * Native HSL face colours are shaded into the existing dark abyss; the
 * inset reconstructed cliff is retained behind them for coverage.
 */
// One two-channel, board-aligned distance field serves every stone receiver.
// It is derived from the exact visible rim, including diagonal halves.
const REFLECTION_PADDING=2;
function makeRimReflectionTexture():THREE.DataTexture{
 const data=rimReflectionPixels(BOARD_WIDTH,BOARD_HEIGHT,REFLECTION_PADDING,12,
   voidRimSegments(floorMask(true)),voidRimSegments(floorMask(false)));
 const texture=new THREE.DataTexture(data.pixels,data.width,data.height,THREE.RGBAFormat);
 texture.magFilter=THREE.LinearFilter;texture.minFilter=THREE.LinearFilter;
 texture.needsUpdate=true;return texture;
}
type ArenaLightUniforms={
 rimField:{value:THREE.DataTexture};
 environment:{value:THREE.Vector3};
 innerFragment:{value:THREE.Vector4};
 outerFragment:{value:THREE.Vector4};
 playerContact:{value:THREE.Vector3};
};
function addFragmentLighting(shader:{uniforms:Record<string,THREE.IUniform>;vertexShader:string;fragmentShader:string},lights:ArenaLightUniforms,strength:number){
 shader.uniforms.ocellusInnerFragment=lights.innerFragment;
 shader.uniforms.ocellusOuterFragment=lights.outerFragment;
 shader.uniforms.ocellusPlayerContact=lights.playerContact;
 shader.vertexShader="varying vec3 fragmentReceiver;\n"+shader.vertexShader.replace("#include <begin_vertex>",`#include <begin_vertex>\nfragmentReceiver=position-vec3(0.,${GROUND_OVERLAY_Y.toFixed(6)},0.);`);
 shader.fragmentShader=`varying vec3 fragmentReceiver;\n uniform vec4 ocellusInnerFragment;\n uniform vec4 ocellusOuterFragment;
 uniform vec3 ocellusPlayerContact;\n float fragmentReflection(vec4 light){\n   float d=length(vec3(fragmentReceiver.xz-light.xy,fragmentReceiver.y*1.5));\n   float falloff=1.-smoothstep(0.,max(light.w,.01),d);\n   return light.z*falloff*falloff;\n }\n `+shader.fragmentShader.replace("#include <map_fragment>",`#include <map_fragment>
 vec2 playerOffset=(fragmentReceiver.xz-ocellusPlayerContact.xy)/vec2(.42,.32);
 float contact=1.-smoothstep(.1,1.,length(playerOffset));
 float contactHeight=1.-smoothstep(.02,.12,abs(fragmentReceiver.y));
 diffuseColor.rgb*=1.-.18*contact*contactHeight*ocellusPlayerContact.z;
 diffuseColor.rgb+=vec3(.014,.070,.064)*(fragmentReflection(ocellusInnerFragment)+fragmentReflection(ocellusOuterFragment))*${strength.toFixed(2)};`);
}
function addEnvironmentLighting(shader:{uniforms:Record<string,THREE.IUniform>;vertexShader:string;fragmentShader:string},lights:ArenaLightUniforms){
 shader.uniforms.ocellusRimField=lights.rimField;
 shader.uniforms.ocellusEnvironment=lights.environment;
 shader.vertexShader="varying vec3 ocellusReceiver;\n"+shader.vertexShader.replace("#include <begin_vertex>",`#include <begin_vertex>
   ocellusReceiver=position-vec3(0.,${GROUND_OVERLAY_Y.toFixed(6)},0.);`);
 shader.fragmentShader=`varying vec3 ocellusReceiver;
 uniform sampler2D ocellusRimField;
 uniform vec3 ocellusEnvironment;
 `+shader.fragmentShader.replace("#include <color_fragment>",`#include <color_fragment>
   vec2 rimUV=(ocellusReceiver.xz+vec2(${REFLECTION_PADDING.toFixed(1)},${(REFLECTION_PADDING+1).toFixed(1)}))
     /vec2(${(BOARD_WIDTH+2*REFLECTION_PADDING).toFixed(1)},${(BOARD_HEIGHT+2*REFLECTION_PADDING).toFixed(1)});
   vec2 rimMargin=min(rimUV,1.-rimUV);
   float rimInside=smoothstep(0.,.02,min(rimMargin.x,rimMargin.y));
   vec2 rimField=texture2D(ocellusRimField,clamp(rimUV,0.,1.)).rg;
   float reflected=dot(rimField,ocellusEnvironment.xy)*rimInside;
   float reliefFade=1.-smoothstep(.02,.8,abs(ocellusReceiver.y));
   diffuseColor.rgb+=vec3(.037,.008,.063)*reflected*reliefFade;
 `);
 addFragmentLighting(shader,lights,1);
}

/** Evaluate native depth at each fragment so large triangles do not create
 * broad linear colour wedges. The reconstructed backing keeps its own fade. */
function nativeRockDepth(shader:{vertexShader:string;fragmentShader:string}){
 shader.vertexShader="varying float nativeRockY;\n"+shader.vertexShader.replace("#include <begin_vertex>",`#include <begin_vertex>\n ${nativeRockHeightAssignment(GROUND_OVERLAY_Y)}`);
 shader.fragmentShader="varying float nativeRockY;\n"+shader.fragmentShader.replace("#include <map_fragment>",`#include <map_fragment>
 float rockT=clamp((nativeRockY-(${CLIFF_BOTTOM_Y.toFixed(6)}))/(${(NATIVE_FOUNDATION_TOP_Y-CLIFF_BOTTOM_Y).toFixed(6)}),0.,1.);
 float upperRock=.28+.72*(1.-pow(1.-rockT,2.5));
 float lowerRock=.28*smoothstep(${NATIVE_CLIFF_FADE_END.toFixed(6)},${CLIFF_BOTTOM_Y.toFixed(6)},nativeRockY);
 float rockVisibility=nativeRockY>=${CLIFF_BOTTOM_Y.toFixed(6)}?upperRock:lowerRock;
 if(rockVisibility<=.0001)discard;
 diffuseColor.rgb*=rockVisibility;`);
}

async function loadNativeFoundation(lights:ArenaLightUniforms): Promise<{ mesh: THREE.Mesh; backingTiles: readonly Tile[]; sample:(x:number,z:number,y:number)=>number; nativePositions:readonly number[] }> {
  const data = await loadArenaJson("ocellus-native-foundation.json");
  // The shared asset loader has already checked source IDs and all vertices.
  if(!data.backingTiles)throw new Error("Missing native cliff backing footprint");
  const points = new Float32Array(data.positions.length);
  const colours = new Float32Array(data.positions.length);
  const colour = new THREE.Color();
  let facetExposure=1;
  for (let i = 0; i < data.positions.length; i += 3) {
    if(i%9===0)facetExposure=cliffFacetExposure(data.positions,i);
    const x = data.positions[i], y = data.positions[i + 1], z = data.positions[i + 2];
    if (![x,y,z].every(Number.isFinite) || y > NATIVE_FOUNDATION_TOP_Y || y < NATIVE_FOUNDATION_MIN_Y) throw new Error("Native rock exceeds visual depth");
    points[i] = x; points[i + 1] = GROUND_OVERLAY_Y + y; points[i + 2] = z;
    const rgb = data.vertexColors[i / 3];
    if (!Number.isInteger(rgb) || rgb < 0 || rgb > 0xffffff) throw new Error("Invalid lit native vertex colour");
    colour.setHex(rgb);
    gradeStone(colour,1).multiplyScalar(CLIFF_EXPOSURE*facetExposure);
    colours.set([colour.r, colour.g, colour.b], i);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(points,3));
  geo.setAttribute("color", new THREE.BufferAttribute(colours,3));
  // The recovered cache model preserves its original triangle winding.
  // Cull backfaces as on the original model; never expose internal rock faces.
  const material=new THREE.MeshBasicMaterial({vertexColors:true,side:THREE.FrontSide,polygonOffset:true,polygonOffsetFactor:1,polygonOffsetUnits:1});
  geo.setAttribute("lipDistance",new THREE.BufferAttribute(cliffLipDistances(data.positions),3));
  material.onBeforeCompile=shader=>{
    shader.uniforms.lipColour={value:new THREE.Color(0x805281)};
    shader.vertexShader="attribute vec3 lipDistance;\nvarying vec3 vLipDistance;\n"+shader.vertexShader.replace(
      "#include <begin_vertex>","#include <begin_vertex>\nvLipDistance=lipDistance;");
    shader.fragmentShader="varying vec3 vLipDistance;\nuniform vec3 lipColour;\n"+shader.fragmentShader.replace(
      "#include <color_fragment>",`#include <color_fragment>
      float distanceToLip=min(vLipDistance.x,min(vLipDistance.y,vLipDistance.z));
      float softness=clamp(fwidth(distanceToLip)*0.5,0.005,0.025);
      float lip=1.0-smoothstep(0.035-softness,0.035+softness,distanceToLip);
      diffuseColor.rgb=mix(diffuseColor.rgb,lipColour,0.53*lip);`);
    addEnvironmentLighting(shader,lights);
    nativeRockDepth(shader);
  };
  material.customProgramCacheKey=()=>"ocellus-native-foundation-depth-v4";
  const mesh = new THREE.Mesh(geo,material);
  mesh.name = "ocellus-native-rock-foundation";
  return { mesh, backingTiles: data.backingTiles, sample:nativeCliffSampler(data.positions,data.vertexColors),nativePositions:data.positions };
}

/** Original clipped curb faces. Heights are in the same cache coordinate
 * system as the native playable floor, so their shared edge remains aligned.
 */
async function loadNativeCurb(lighting: THREE.Texture,lights:ArenaLightUniforms): Promise<THREE.Mesh> {
  const data = await loadArenaJson("ocellus-native-curb.json");
  // Validated before caching; each arena owns its own GPU buffers.
  const points = new Float32Array(data.positions.length);
  const colours = new Float32Array(data.positions.length);
  const colour = new THREE.Color();
  for (let i = 0; i < data.positions.length; i += 3) {
    const x=data.positions[i], y=data.positions[i+1], z=data.positions[i+2];
    if (![x,y,z].every(Number.isFinite) || y < -1/128-1e-6 || y > NATIVE_SCENERY_MAX_Y+1e-6) throw new Error("Native curb outside recovered height band");
    points[i]=x; points[i+1]=GROUND_OVERLAY_Y+y; points[i+2]=z;
    const rgb = data.vertexColors[i / 3];
    if (!Number.isInteger(rgb) || rgb < 0 || rgb > 0xffffff) throw new Error("Invalid lit native vertex colour");
    colour.setHex(rgb);
    // The stone-to-trunk transition crosses the extractor's .75-tile split.
    // Fade through it so neighbouring vertices share the same exposure.
    const stoneWeight=1-THREE.MathUtils.smoothstep(y,.45,1.65);
    gradeStone(colour,stoneWeight).multiplyScalar(1+(STONE_EXPOSURE-1)*stoneWeight);
    colours.set([colour.r,colour.g,colour.b],i);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position",new THREE.BufferAttribute(points,3));
  geo.setAttribute("color",new THREE.BufferAttribute(colours,3));
  const mesh = new THREE.Mesh(geo, stoneLightingMaterial(lighting,lights));
  mesh.name="ocellus-native-curb";
  return mesh;
}

/** Apply the same world-space lighting to the native floor and its raised
 * fragments. Project low receivers back along the shadow ray, then fade the
 * ground mask away on vertical scenery. The flame falloff runs per pixel so
 * its shape is independent of the size of the original cache triangles. */
function stoneLightingMaterial(lighting: THREE.Texture,lights:ArenaLightUniforms): THREE.MeshBasicMaterial {
  const material = new THREE.MeshBasicMaterial({vertexColors:true, side:THREE.FrontSide});
  material.onBeforeCompile = shader => {
    shader.uniforms.stoneShadow = {value:lighting};
    shader.uniforms.flamePosition = {value:new THREE.Vector2(flameX, flameZ)};
    shader.vertexShader = "varying vec3 stonePosition;\n" + shader.vertexShader.replace(
      "#include <begin_vertex>", `#include <begin_vertex>
      stonePosition = position - vec3(0., ${GROUND_OVERLAY_Y.toFixed(6)}, 0.);`);
    shader.fragmentShader = `varying vec3 stonePosition;
      uniform sampler2D stoneShadow;
      uniform vec2 flamePosition;
      ` + shader.fragmentShader.replace("#include <color_fragment>", `#include <color_fragment>
      float h = max(stonePosition.y, 0.);
      vec2 shadowUv = (stonePosition.xz + vec2(${SHADOW_PADDING_TILES.toFixed(1)}, ${(1+SHADOW_PADDING_TILES).toFixed(1)}) - h * vec2(${SHADOW_RAY_X}, ${SHADOW_RAY_Z}))
        / vec2(${(BOARD_WIDTH+2*SHADOW_PADDING_TILES).toFixed(1)}, ${(BOARD_HEIGHT+2*SHADOW_PADDING_TILES).toFixed(1)});
      vec3 shade = texture2D(stoneShadow, clamp(shadowUv, 0., 1.)).rgb;
      vec2 margin = min(shadowUv, 1. - shadowUv);
      float inside = smoothstep(0., .015, min(margin.x, margin.y));
      float receive = (1. - smoothstep(.05, .75, h)) * inside;
      diffuseColor.rgb *= mix(vec3(1.), shade, receive);
      vec3 toFlame = vec3(stonePosition.xz - flamePosition, (h - .65) * .8);
      float warmth = 1. - smoothstep(.25, 2.15, length(toFlame));
      diffuseColor.rgb += vec3(.051, .020, .003) * warmth * warmth;`);
    addEnvironmentLighting(shader,lights);
    shader.fragmentShader=shader.fragmentShader.replace("warmth * warmth;","warmth * warmth * ocellusEnvironment.z;");
  };
  return material;
}

/** Draw original face boundaries and Gouraud colours at all zoom levels.
 * Every playable tile is independently validated for exact unit area.
 * The decoded baked floor remains a hidden fallback, not a coplanar draw. */
async function loadNativeFlatFloor(lighting: THREE.Texture,lights:ArenaLightUniforms):Promise<THREE.Mesh<THREE.BufferGeometry,THREE.MeshBasicMaterial>>{
 const data=await loadArenaJson("ocellus-native-flat-floor.json");
 const points=new Float32Array(data.positions),colours=new Float32Array(data.positions.length);
 const colour=new THREE.Color();
 for(let i=0;i<points.length;i+=3){
  points[i+1]+=GROUND_OVERLAY_Y;
  gradeStone(colour.setHex(data.vertexColors[i/3]),1).multiplyScalar(STONE_EXPOSURE);colours.set([colour.r,colour.g,colour.b],i);
 }
 const geo=new THREE.BufferGeometry();
 geo.setAttribute("position",new THREE.BufferAttribute(points,3));
 geo.setAttribute("color",new THREE.BufferAttribute(colours,3));
 const material=stoneLightingMaterial(lighting,lights);
 const mesh=new THREE.Mesh(geo,material);mesh.name="ocellus-native-flat-floor";return mesh;
}

function floorMask(inner: boolean): readonly Tile[] {
  return FLOOR_TILES.filter((at) => inNearSquare(at) === inner);
}

function voidGeometry(tiles: readonly Tile[]): THREE.BufferGeometry {
  const positions: Vertex[] = [];
  const uv: [number, number][] = [];
  // The original map square 16472 keeps northwest floor halves on type-9
  // diagonal walls; a plain tile mask otherwise leaves visible triangular gaps.
  for (const triangle of voidSurfaceTriangles(tiles)) {
    for (const point of triangle) {
      positions.push(v(point.x, SURFACE, point.z));
      uv.push(nativeVoidUv(point));
    }
  }
  return geometry(positions, undefined, uv);
}

function rimGeometry(tiles: readonly Tile[]): THREE.BufferGeometry {
  const {positions,alphas}=voidRimVertices(tiles,EDGE,VOID_RIM_DEPTH,.085);
  const colour=new THREE.Color(RIM),rgba=new Float32Array(alphas.length*4);
  for(let i=0;i<alphas.length;i++)rgba.set([colour.r,colour.g,colour.b,alphas[i]],i*4);
  const result=new THREE.BufferGeometry();
  result.setAttribute("position",new THREE.Float32BufferAttribute(positions,3));
  result.setAttribute("color",new THREE.BufferAttribute(rgba,4));
  return result;
}

function makeVoidLayer(tiles: readonly Tile[], stars: THREE.Texture,lights:ArenaLightUniforms): THREE.Group {
  const group = new THREE.Group();
  const surface=new THREE.Mesh(voidGeometry(tiles), new THREE.MeshBasicMaterial({
    map: stars, side: THREE.DoubleSide,
    polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1,
  }));
  surface.material.onBeforeCompile=shader=>addFragmentLighting(shader,lights,.65);
  surface.material.customProgramCacheKey=()=>"ocellus-flood-fragment-light-v2";
  surface.name="ocellus-void-surface";
  const rim=new THREE.Mesh(rimGeometry(tiles), new THREE.MeshBasicMaterial({
    vertexColors: true, side: THREE.DoubleSide, transparent: true,
    blending: THREE.NormalBlending, depthWrite: false, forceSinglePass:true,
  }));
  rim.name="ocellus-void-rim";
  group.add(surface,rim);
  return group;
}

// A shared falloff keeps contact shading and reflected spell light soft
// without adding a dynamic light or changing the cache model materials.
function contactTexture(): THREE.CanvasTexture {
  const canvas=document.createElement("canvas");
  canvas.width=canvas.height=64;
  const ctx=canvas.getContext("2d")!;
  const ramp=ctx.createRadialGradient(32,32,0,32,32,32);
  ramp.addColorStop(0,"white");
  ramp.addColorStop(.48,"rgba(255,255,255,.75)");
  ramp.addColorStop(1,"rgba(255,255,255,0)");
  ctx.fillStyle=ramp;
  ctx.fillRect(0,0,64,64);
  return new THREE.CanvasTexture(canvas);
}

class ArenaModel implements Model {
  private readonly root = new THREE.Group();
  private readonly inner: THREE.Group;
  private readonly outer: THREE.Group;
  private readonly texture: THREE.Texture;
  private readonly textureReady: Promise<void>;
  private readonly backdropReady: Promise<void>;
  private readonly surroundingReady: Promise<void>;
  private readonly foundationReady: Promise<void>;
  private readonly curbReady: Promise<void>;
  private readonly floorTexture: THREE.Texture;
  private readonly floorReady: Promise<void>;
  private readonly flatFloorReady:Promise<void>;
  private lighting?: THREE.Texture;
  private readonly lights:ArenaLightUniforms={rimField:{value:makeRimReflectionTexture()},environment:{value:new THREE.Vector3(0,0,1)},
    innerFragment:{value:new THREE.Vector4(0,0,0,1)},outerFragment:{value:new THREE.Vector4(0,0,0,1)},
    playerContact:{value:new THREE.Vector3(0,0,0)}};
  private readonly contactMap=contactTexture();
  private readonly flameGlow=new THREE.Sprite(new THREE.SpriteMaterial({
    map:this.contactMap,color:0xffa535,transparent:true,opacity:.18,
    blending:THREE.AdditiveBlending,depthWrite:false,
  }));
  private readonly markLight=new THREE.Mesh(new THREE.PlaneGeometry(.96,.96),
    new THREE.MeshBasicMaterial({map:this.contactMap,color:0xb24cff,transparent:true,
      opacity:.35,blending:THREE.AdditiveBlending,depthWrite:false}));
  private readonly bossShadow = new THREE.Mesh(new THREE.CircleGeometry(1, 20),
    new THREE.MeshBasicMaterial({ map:this.contactMap, color:0x160f20, transparent:true, opacity:.46, depthWrite:false }));
  private destroyed = false;

  constructor(private readonly read: () => OcellusView,private readonly playerPosition:()=>Tile|undefined) {
    // The ground uses the native texture 215 star positions with the
    // measured flood palette; model textures 215 remain unmodified.
    // A loader promise prevents silently displaying a placeholder.
    this.texture = new THREE.Texture();
    this.texture.flipY = false;
    this.texture.wrapS = THREE.RepeatWrapping;
    this.texture.wrapT = THREE.RepeatWrapping;
    this.texture.colorSpace = THREE.SRGBColorSpace;
    // r163 requires LinearFilter magnification for anisotropic sampling.
    // This slightly softens close-up texels but reduces grazing-angle shimmer.
    // Sharp native star clusters rather than softened grey dots.
    // Nearest magnification intentionally disables r163 anisotropy on this
    // map; mipmap-linear minification still limits distant shimmering.
    this.texture.magFilter = THREE.NearestFilter;
    this.texture.minFilter = THREE.NearestMipmapLinearFilter;
    this.texture.anisotropy = 1;
    this.floorTexture = new THREE.Texture();
    this.floorTexture.flipY = false;
    this.floorTexture.colorSpace = THREE.SRGBColorSpace;
    this.floorTexture.magFilter = THREE.LinearFilter;
    // r163 only applies anisotropy with linear magnification. Preserve
    // nearest texels within each mip level for the original stone facets.
    this.floorTexture.minFilter = THREE.NearestMipmapLinearFilter;
    this.floorTexture.anisotropy = 4;
    this.floorTexture.generateMipmaps = true;
    // Each attempt owns its GPU textures; the decoded CPU-side images
    // are shared. A late load cannot resurrect a destroyed GPU texture.
    this.textureReady = loadArenaImage("ocellus-flood.png").then(image=>{
      if (!this.destroyed) { this.texture.image=image; this.texture.mipmaps=[...starfieldLevels(image)]; this.texture.generateMipmaps=false; this.texture.needsUpdate=true; }
    });
    this.floorReady = loadArenaImage("ocellus-native-floor-sampling.png").then(image=>{
      if (!this.destroyed) { this.floorTexture.image=image; this.floorTexture.needsUpdate=true; }
    });
    this.inner = makeVoidLayer(floorMask(true), this.texture,this.lights);
    this.outer = makeVoidLayer(floorMask(false), this.texture,this.lights);
    this.bossShadow.rotation.x=-Math.PI/2;
    this.bossShadow.scale.set(1.18,.83,1);
    this.bossShadow.position.set(BOSS_ANCHOR.x+1.5,NATIVE_FLOOR_Y+.002,BOSS_ANCHOR.y-1.5);
    this.markLight.rotation.x=-Math.PI/2;
    this.markLight.visible=false;
    this.flameGlow.position.set(flameX,GROUND_OVERLAY_Y+2.45,flameZ);
    this.root.add(this.bossShadow,this.markLight,this.flameGlow);
    this.root.name="ocellus-arena";
    this.inner.name="ocellus-inner-void";
    this.outer.name="ocellus-outer-void";
    this.inner.visible=false;
    this.outer.visible=false;
    // The viewport supplies one uniform scene background, not a finite plane.
    const bakedFloor=stoneFloorMesh(this.floorTexture);
    this.root.add(bakedFloor, this.inner, this.outer);
    const lightingReady=loadArenaJson("ocellus-native-curb.json").then(curb=>{
      if(!this.destroyed)this.lighting=floorLighting(curb.positions);
      return this.lighting;
    });
    this.flatFloorReady=lightingReady.then(async lighting=>{
      if(!lighting)return;
      const mesh=await loadNativeFlatFloor(lighting,this.lights);
      if(this.destroyed){mesh.geometry.dispose();mesh.material.dispose();return;}
      this.root.add(mesh);
      bakedFloor.visible=false;
    });
    this.curbReady=lightingReady.then(async lighting=>{
      if(!lighting)return;
      const mesh=await loadNativeCurb(lighting,this.lights);
      if(this.destroyed){mesh.geometry.dispose();(mesh.material as THREE.Material).dispose();return;}
      this.root.add(mesh);
    });
    this.backdropReady=loadBackdrop(new URL("osrs-assets/ocellus-native-backdrop.json",document.baseURI).href).then(data=>{
      if(this.destroyed)return;
      const geometry=new THREE.BufferGeometry();
      geometry.setAttribute("position",new THREE.Float32BufferAttribute(data.positions,3));
      const colours=new Float32Array(data.positions.length),colour=new THREE.Color();
      let facadeExposure=1;
      data.vertexColors.forEach((rgb,i)=>{
        const index=i*3;
        if(i%3===0)facadeExposure=cliffFacetExposure(data.positions,index);
        gradeStone(colour.setHex(rgb),.65).multiplyScalar(facadeExposure).toArray(colours,index);
      });
      geometry.setAttribute("color",new THREE.BufferAttribute(colours,3));
      const material=new THREE.MeshBasicMaterial({vertexColors:true});
      // Cut away the near wall on a reversed orbit. A wall behind the
      // player keeps its normal depth buffer and occludes its own back faces.
      material.onBeforeCompile=shader=>{
        shader.vertexShader="varying vec2 rearDirection;\nvarying float wallHeight;\n"+shader.vertexShader.replace(
          "#include <begin_vertex>","#include <begin_vertex>\nrearDirection=position.xz-vec2(6.5,5.5);\nwallHeight=position.y;");
        shader.fragmentShader="varying vec2 rearDirection;\nvarying float wallHeight;\n"+shader.fragmentShader.replace(
          "#include <color_fragment>",`#include <color_fragment>
          vec2 cameraBack=vec2(viewMatrix[0][2],viewMatrix[2][2]);
          // Fade the last few world tiles on the far side of the cut.
          // Normalising the bearing keeps the width stable as pitch changes.
          float depth=dot(rearDirection,cameraBack)/max(length(cameraBack),0.001);
          if(depth>=0.) discard;
          float radialFade=.91-.59*smoothstep(17.,33.,length(rearDirection));
          float lowerFade=.24+.76*smoothstep(-13.,-3.,wallHeight);
          diffuseColor.rgb *= radialFade*lowerFade*smoothstep(0.,4.5,-depth);`);
      };
      const mesh=new THREE.Mesh(geometry,material);
      mesh.position.y=GROUND_OVERLAY_Y;
      mesh.name="ocellus-native-backdrop";
      this.root.add(mesh);
    });
    this.surroundingReady=loadNativeSurrounding(new URL("osrs-assets/ocellus-native-surrounding.json",document.baseURI).href).then(data=>{
      if(this.destroyed)return;
      const geometry=new THREE.BufferGeometry(),points=new Float32Array(data.positions),colours=new Float32Array(data.positions.length);
      const colour=new THREE.Color();
      let facet=1;
      for(let i=0;i<points.length;i+=3){
        if(i%9===0)facet=cliffFacetExposure(data.positions,i);
        points[i+1]+=GROUND_OVERLAY_Y;
        gradeStone(colour.setHex(data.vertexColors[i/3]),1).multiplyScalar(CLIFF_EXPOSURE*facet).toArray(colours,i);
      }
      geometry.setAttribute("position",new THREE.BufferAttribute(points,3));geometry.setAttribute("color",new THREE.BufferAttribute(colours,3));
      const material=new THREE.MeshBasicMaterial({vertexColors:true,side:THREE.FrontSide,polygonOffset:true,polygonOffsetFactor:1,polygonOffsetUnits:1});
      material.onBeforeCompile=shader=>{addEnvironmentLighting(shader,this.lights);nativeRockDepth(shader);};
      material.customProgramCacheKey=()=>"ocellus-native-surrounding-depth-v4";
      const mesh=new THREE.Mesh(geometry,material);mesh.name="ocellus-native-surrounding";this.root.add(mesh);
    });
    this.foundationReady = loadNativeFoundation(this.lights).then(({ mesh, backingTiles, sample,nativePositions }) => {
      if (this.destroyed) { mesh.geometry.dispose(); (mesh.material as THREE.Material).dispose(); return; }
      this.root.add(cliffMesh(0.20, backingTiles, sample,nativePositions), mesh);
    });
  }

  draw(scene: THREE.Scene, _delta: number, progress: number, _location: Location3,
    _angle: number, _pitch: number, visible: boolean): void {
    if(this.destroyed)return;
    if (this.root.parent !== scene) scene.add(this.root);
    const state = this.read();
    this.root.visible = visible;
    this.bossShadow.visible = state.bossHp>0 && bossVisibleAt(state.frame);
    const lift=bossShadowLift(state.frame.stage,state.frame.offset,progress);
    this.bossShadow.position.y=state.frame.stage==="inner-void"?EDGE+.0005:NATIVE_FLOOR_Y+.002;
    this.bossShadow.material.opacity=.46-.29*lift;
    this.bossShadow.scale.set(1.18+.28*lift,.83+.22*lift,1);
    const light=environmentLightAt(state.frame.stage,state.frame.tick,progress);
    this.lights.environment.value.set(light.inner,light.outer,light.flame);
    this.lights.playerContact.value.set(...playerContactPosition(this.playerPosition(),state.playerHp));
    const updateFragment=(layer:EffectLayer,target:THREE.Vector4)=>{
      const cue=effectCue(state,layer)??orbDepartureCue(state,layer);
      const playback=cue?nativeEffectPlaybackAt(cue,state.frame.tick,progress):null;
      if(!cue||!playback||playback.finished){target.set(0,0,0,1);return;}
      const [intensity,radius]=fragmentLight(cue.spotAnim,playback.elapsed,cue.durationCycles);
      target.set(cue.tile.x+.5,cue.tile.y-.5,intensity,radius);
    };
    updateFragment("inner-orb",this.lights.innerFragment.value);
    updateFragment("outer-orb",this.lights.outerFragment.value);
    this.flameGlow.scale.setScalar(flameGlowScale(state.frame.tick,progress));
    this.flameGlow.material.opacity=.18*light.flame;
    const innerRim=this.inner.children[1] as THREE.Mesh<THREE.BufferGeometry,THREE.MeshBasicMaterial>;
    const outerRim=this.outer.children[1] as THREE.Mesh<THREE.BufferGeometry,THREE.MeshBasicMaterial>;
    innerRim.material.opacity=light.inner;outerRim.material.opacity=light.outer;
    const impact=state.frame.events.some(e=>e.kind==="explosion-hit")?state.impactMark:null;
    const mark=impact ?? state.marks[0];
    const explosion=effectCue(state,"explosion");
    const explosionPlayback=explosion?nativeEffectPlaybackAt(explosion,state.frame.tick,progress):null;
    this.markLight.material.opacity=markGlowOpacity(!!impact,progress);
    this.markLight.visible=!!mark&&!!explosionPlayback&&!explosionPlayback.finished;
    if(mark)this.markLight.position.set(mark.tile.x+.5,EDGE+.001,mark.tile.y-.5);
    this.inner.visible = state.frame.stage === "inner-void";
    this.outer.visible = state.frame.stage === "outer-void";

  }

  /** The SDK compiles the whole detached root, including hidden flood layers. */
  sceneRoot(): THREE.Object3D { return this.root; }
  getWorldPosition(): THREE.Vector3 { return this.root.getWorldPosition(new THREE.Vector3()); }
  async preload(): Promise<void> {
    await Promise.all([this.textureReady, this.foundationReady, this.backdropReady,this.surroundingReady, this.floorReady, this.curbReady,this.flatFloorReady]);
  }
  destroy(scene: THREE.Scene): void {
    if(this.destroyed)return;
    this.destroyed = true;
    if (this.root.parent === scene) scene.remove(this.root);
    this.root.traverse((node) => {
      if (!(node instanceof THREE.Mesh)) return;
      node.geometry.dispose();
      const material = node.material;
      if (Array.isArray(material)) material.forEach((entry) => entry.dispose());
      else material.dispose();
    });
    this.root.clear();
    this.texture.dispose();
    this.floorTexture.dispose();
    this.lighting?.dispose();
    this.lights.rimField.value.dispose();
    this.flameGlow.material.dispose();
    this.contactMap.dispose();
  }
}

export class OcellusArena extends Entity {
  constructor(region: Region, private readonly read: () => OcellusView,private readonly playerPosition:()=>Tile|undefined=()=>undefined) {
    super(region, { x: 0, y: 0 });
  }
  override get collisionType(): CollisionType { return CollisionType.NONE; }
  override get lineOfSight(): LineOfSightMask { return LineOfSightMask.NONE; }
  override get drawOutline(): boolean { return false; }
  override draw(): void { /* Three.js scenery only: prevent a blue 2D entity tile. */ }
  override create3dModel(): Model { return new ArenaModel(this.read,this.playerPosition); }
}

/** Original static-map scenery at the censer tile. No mechanics/collision. */
export class OcellusNativeFixture extends Entity {
  constructor(region: Region, private readonly fixture: NativeFixture) {
    super(region, { ...fixture.tile });
  }
  override get collisionType(): CollisionType { return CollisionType.NONE; }
  override get lineOfSight(): LineOfSightMask { return LineOfSightMask.NONE; }
  override get drawOutline(): boolean { return false; }
  override get animationIndex(): number { return this.fixture.animation; }
  override draw(): void { /* Native 3D scenery only. */ }
  override getPerceivedLocation(): Location3 {
    return { ...this.location, z: fixtureHeight(this.fixture) };
  }
  override getPerceivedRotation(): number { return fixtureRotation(this.fixture); }
  override create3dModel(): Model {
    return CacheRenderInstancedModel.forRenderable(this, CacheRenderReferences.model(this.fixture.modelId));
  }
}

export class OcellusFloorHole extends Entity {
  constructor(region: Region, at: Tile, private readonly stage: () => string) {
    super(region, at);
  }
  override get collisionType(): CollisionType { return CollisionType.NONE; }
  override get lineOfSight(): LineOfSightMask { return LineOfSightMask.NONE; }
  override get drawOutline(): boolean { return false; }
  override get animationIndex(): number { return 14891; }
  override visible(): boolean { return this.stage() !== "outer-void"; }
  override draw(): void { /* FloorTile paints the 2D hole below. */ }
  override create3dModel(): Model {
    return CacheRenderInstancedModel.forRenderable(this, CacheRenderReferences.model(62508));
  }
}
