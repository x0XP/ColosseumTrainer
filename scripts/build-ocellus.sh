#!/usr/bin/env bash
set -euo pipefail
# Ocellus pinned SDK and reader used by validated OpenRS2 2746 reference build.
: "${OSRS_SDK_COMMIT:?Must pin SDK commit}"
: "${OSRS_CACHE_READER_COMMIT:?Must pin reader commit}"

# Build the selected SDK and reader branches, then compile this trainer's assets.
WORK_TMP="$(mktemp -d)"
SDK_TMP="${WORK_TMP}/osrs-sdk"
READER_TMP="${WORK_TMP}/osrscachereader"
CACHE_ROOT="${NETLIFY_CACHE_DIR:-/opt/build/cache}/osrs-cache-render"

npm ci
mkdir -p "${CACHE_ROOT}"
git init -q "${SDK_TMP}"
git -C "${SDK_TMP}" fetch --quiet --depth 1 "${OSRS_SDK_REPO}" "${OSRS_SDK_COMMIT}"
git -C "${SDK_TMP}" checkout --quiet FETCH_HEAD
[[ "$(git -C "${SDK_TMP}" rev-parse HEAD)" == "${OSRS_SDK_COMMIT}" ]] || { echo "SDK pin mismatch" >&2; exit 1; }
git init -q "${READER_TMP}"
git -C "${READER_TMP}" fetch --quiet --depth 1 "${OSRS_CACHE_READER_REPO}" "${OSRS_CACHE_READER_COMMIT}"
git -C "${READER_TMP}" checkout --quiet FETCH_HEAD
[[ "$(git -C "${READER_TMP}" rev-parse HEAD)" == "${OSRS_CACHE_READER_COMMIT}" ]] || { echo "Reader pin mismatch" >&2; exit 1; }
pushd "${READER_TMP}" >/dev/null
npm ci
popd >/dev/null
# The pinned SDK has no per-trainer starting-pitch option. Patch its
# temporary source checkout for Ocellus only; never alter the stable Sol SDK.
node --test scripts/patch-ocellus-camera.test.mjs
node scripts/patch-ocellus-camera.mjs "${SDK_TMP}/src/sdk/Viewport3d.ts"
node --test scripts/patch-ocellus-bossbar.test.mjs scripts/patch-ocellus-object-lighting.test.mjs
node scripts/patch-ocellus-bossbar.mjs "${SDK_TMP}/src/sdk/Viewport.ts"
node scripts/patch-ocellus-object-lighting.mjs "${SDK_TMP}/packages/osrs-sdk-assets/src/adapter.mts"
node --test scripts/patch-ocellus-viewport.test.mjs scripts/patch-ocellus-instanced-frames.test.mjs
node scripts/patch-ocellus-viewport.mjs "${SDK_TMP}/src/sdk/Viewport3d.ts"
node scripts/patch-ocellus-instanced-frames.mjs "${SDK_TMP}/src/sdk/rendering/CacheRenderInstancedModel.ts"
node --test scripts/patch-ocellus-animation-cycles.test.mjs
node scripts/patch-ocellus-animation-cycles.mjs "${SDK_TMP}/src/sdk/rendering/utils/animations.ts"
node --test scripts/patch-ocellus-attached-textures.test.mjs
node scripts/patch-ocellus-attached-textures.mjs "${SDK_TMP}/src/sdk/rendering/CacheRenderModel.ts"
node --test scripts/patch-ocellus-actor-lifetime.test.mjs
node scripts/patch-ocellus-actor-lifetime.mjs "${SDK_TMP}/src/sdk/rendering/CacheRenderModel.ts"
node --test scripts/patch-ocellus-actor-presentation.test.mjs
node scripts/patch-ocellus-actor-presentation.mjs "${SDK_TMP}/src/sdk/rendering/CacheRenderModel.ts"
node --test scripts/patch-ocellus-hitsplats.test.mjs
node scripts/patch-ocellus-hitsplats.mjs "${SDK_TMP}/src/sdk/Unit.ts"
node --test scripts/patch-ocellus-texture-sampling.test.mjs
node scripts/patch-ocellus-texture-sampling.mjs "${SDK_TMP}/src/sdk/rendering/utils/textureImages.ts"
node --test scripts/patch-ocellus-world.test.mjs
node scripts/patch-ocellus-world.mjs "${SDK_TMP}/src/sdk/World.ts"
node --test scripts/patch-ocellus-minimap.test.mjs
node scripts/patch-ocellus-minimap.mjs "${SDK_TMP}/src/sdk/MapController.ts"
# The pinned RuneScape sequences may refer to effects that the actual cache
# does not contain (Ocellus death 14872 references unavailable sound 12826).
# Scope this fix to the separate temporary Ocellus SDK; leave Sol untouched.
node scripts/patch-ocellus-missing-frame-sounds.mjs "${SDK_TMP}/src/sdk/rendering/AnimationFrameSounds.ts"
pushd "${SDK_TMP}" >/dev/null
npm ci
npm run build
SDK_VERSION="$(node -p "require('./package.json').version")"
TOOL_VERSION="$(node -p "require('./packages/osrs-sdk-assets/package.json').version")"
REACT_VERSION="$(node -p "require('./packages/osrs-sdk-react/package.json').version")"
if [[ "${TOOL_VERSION}" != "${SDK_VERSION}" ]]; then
  echo "osrs-sdk and osrs-sdk-assets versions must match"
  exit 1
fi
npm pack --pack-destination "${WORK_TMP}" --silent
npm pack --workspace osrs-sdk-assets --pack-destination "${WORK_TMP}" --silent
npm pack --workspace osrs-sdk-react --pack-destination "${WORK_TMP}" --silent
popd >/dev/null

# Use the locally packed SDK packages for this build.
# Keep the lockfile's Node types pinned: resolving the SDK tarballs can otherwise
# select a newer @types/node release that TypeScript 4.9 cannot parse.
npm install --no-save "@types/node@16.4.0" \
  "${WORK_TMP}/osrs-sdk-${SDK_VERSION}.tgz" \
  "${WORK_TMP}/osrs-sdk-assets-${SDK_VERSION}.tgz" \
  "${WORK_TMP}/osrs-sdk-react-${REACT_VERSION}.tgz"
# The Sol bundle is preserved by the shared publishing workflow.
rm -rf dist public/osrs-assets
ASSET_ARGS=(--config osrs-assets.ocellus.config.ts --cache-dir "${CACHE_ROOT}/openrs2" --reader-path "${READER_TMP}")
if [[ -n "${OSRS_OPENRS2_CACHE_ID:-}" ]]; then
  ASSET_ARGS+=(--cache "${OSRS_OPENRS2_CACHE_ID}")
fi
npm run assets -- "${ASSET_ARGS[@]}"
node --test scripts/audit-ocellus-spot-assets.test.mjs
node scripts/audit-ocellus-spot-assets.mjs public/osrs-assets
node --test scripts/audit-ocellus-native-actors.test.mjs
node scripts/audit-ocellus-native-actors.mjs public/osrs-assets
# Verify the direct-region reader before inspecting the original arena.
node --test scripts/ocellus-native-region.test.mjs
node scripts/audit-ocellus-map.mjs "${ASSET_ARGS[@]}"
# Diagnostic renders are CI artifacts, not live or guessed scenery.
node --test scripts/ocellus-scenery-preview.test.mjs
node scripts/audit-ocellus-scenery.mjs "${ASSET_ARGS[@]}"
node --test scripts/ocellus-native-foundation.test.mjs scripts/ocellus-native-surface.test.mjs scripts/ocellus-object-lighting.test.mjs
node scripts/extract-ocellus-foundation.mjs "${ASSET_ARGS[@]}"
node scripts/audit-ocellus-npc-animations.mjs "${ASSET_ARGS[@]}"
# The cache-render asset pack deliberately omits UI sprite frames; extract the
# exact Ocellus head icons from the same pinned cache before webpack copies them.
node scripts/extract-ocellus-icons.mjs "${ASSET_ARGS[@]}"
# Recover the actual texture used by the Ocellus void-hole and transition
# cache models so it can be visually validated before replacing fake stars.
node --test scripts/ocellus-flood-texture.test.mjs
node scripts/extract-ocellus-texture.mjs "${ASSET_ARGS[@]}"
test -s public/osrs-assets/textures/215.png
test -s public/osrs-assets/textures/ocellus-flood.png
test -s public/osrs-assets/textures/ocellus-native-floor.png
test -s public/osrs-assets/textures/ocellus-native-floor-sampling.png
test -s public/osrs-assets/textures/ocellus-native-minimap.png
test -s public/osrs-assets/ocellus-native-floor.json
test -s public/osrs-assets/ocellus-native-curb.json
for frame in 11 15 16; do
  test -s "public/osrs-assets/sprites/440-${frame}.png"
done
TRAINER_VARIANT=ocellus npm run build
for frame in 11 15 16; do
  test -s "dist/osrs-assets/sprites/440-${frame}.png"
done
