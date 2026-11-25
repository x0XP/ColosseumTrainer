/** Verify visible native layers across camera angles; the near wall is
 * intentionally clipped, and a dark backdrop is not visible at every angle.
 * These are regression floors, not a measure of fidelity to RuneScape. */
export const SCENERY_LAYERS=["ocellus-native-rock-foundation","ocellus-native-curb","ocellus-native-backdrop"];
export function validateSceneryRaster(proof){
 if(!proof||!Number.isInteger(proof.width)||!Number.isInteger(proof.height)||proof.width<1||proof.height<1||!Array.isArray(proof.layers)||proof.layers.length!==SCENERY_LAYERS.length)throw Error("Malformed native scenery raster: "+JSON.stringify(proof));
 const area=proof.width*proof.height;
 const values={};
 for(const layer of proof.layers){
  if(!SCENERY_LAYERS.includes(layer.name)||Object.hasOwn(values,layer.name)||!Number.isInteger(layer.changed)||layer.changed<0||layer.changed>area||!Number.isFinite(layer.fraction)||Math.abs(layer.fraction-layer.changed/area)>1e-8)throw Error("Malformed native scenery layer: "+JSON.stringify(layer));
  values[layer.name]=layer.fraction;
 }
 return values;
}
export function verifySceneryRaster(views,portrait){
 if(views.length!==4)throw Error("Four native scenery orbit measurements required");
 const values=views.map(validateSceneryRaster);
 const mobile=validateSceneryRaster(portrait);
 if(portrait.width<380||portrait.height<690)throw Error("Native portrait raster dimensions changed");
 const maxima=Object.fromEntries(SCENERY_LAYERS.map(name=>[name,Math.max(...values.map(v=>v[name]),mobile[name])]));
 const minimum={"ocellus-native-rock-foundation":.003,"ocellus-native-curb":.003,"ocellus-native-backdrop":.001};
 if(SCENERY_LAYERS.some(name=>maxima[name]<minimum[name]))throw Error("Native scenery missing actual visible raster contribution: "+JSON.stringify({maxima,minimum,views,portrait}));
 // The exposed front cliff and curb must remain visible in the default
 // portrait encounter itself, not just some other camera position.
 if(mobile[SCENERY_LAYERS[0]]<.003||mobile[SCENERY_LAYERS[1]]<.003)throw Error("Native portrait cliff/curb missing: "+JSON.stringify(mobile));
 return {maxima,minimum,mobile};
}
