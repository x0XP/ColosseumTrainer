/**
 * Chromium runtime smoke test without external npm dependencies.
 * Catches client-side exceptions that TypeScript and Jest cannot detect.
 */
import { spawn, spawnSync } from "node:child_process";
import fs from "node:fs";
import http from "node:http";
import path from "node:path";

const root = path.resolve("dist");
const manifest = JSON.parse(fs.readFileSync(path.join(root, "osrs-assets/manifest.json"), "utf8"));
for (const id of [4274, 4275, 4276, 4306, 4309, 4310, 4311, 4313, 4314, 4316, 4328, 4329, 4330, 4339, 4340]) {
  if (!manifest.spotAnims?.[String(id)]) throw new Error("Ocellus spotanim " + id + " is missing from the compiled cache manifest");
}
for (const frame of [11, 15, 16]) {
  if (!fs.statSync(path.join(root, "osrs-assets", "sprites", "440-" + frame + ".png")).size)
    throw new Error("Ocellus overhead sprite is empty: 440-" + frame);
}
const nativeVoidTexture = path.join(root, "osrs-assets", "textures", "215.png");
if (!fs.existsSync(nativeVoidTexture) || fs.statSync(nativeVoidTexture).size < 100)
  throw new Error("Original Ocellus cache texture 215 was not packaged");
const host = "127.0.0.1";
const webPort = 8765;
const debuggerPort = 9325;
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const browserPath = ["google-chrome", "google-chrome-stable", "chromium"].map((name) =>
  spawnSync("which", [name], { encoding: "utf8" }).stdout?.trim()).find(Boolean);
if (!browserPath) throw new Error("Chrome or Chromium is required for browser smoke test");

const mime = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json",
  ".png": "image/png", ".ogg": "audio/ogg", ".bin": "application/octet-stream", ".soundpack": "application/octet-stream" };
const server = http.createServer((request, response) => {
  let requested;
  try { requested = decodeURIComponent(new URL(request.url ?? "/", "http://localhost").pathname); }
  catch { response.writeHead(400).end(); return; }
  const file = path.resolve(root, "." + (requested.endsWith("/") ? requested + "index.html" : requested));
  if (!(file === root || file.startsWith(root + path.sep))) { response.writeHead(403).end(); return; }
  fs.stat(file, (error, info) => {
    if (error || !info.isFile()) { response.writeHead(404).end(); return; }
    response.writeHead(200, { "Content-Type": mime[path.extname(file)] ?? "application/octet-stream",
      "Content-Length": info.size, "Cache-Control": "no-store" });
    fs.createReadStream(file).pipe(response);
  });
});
await new Promise((resolve, reject) => {
  server.once("error", reject);
  server.listen(webPort, host, resolve);
});

const chrome = spawn(browserPath, [
  "--headless=new", "--no-sandbox", "--disable-dev-shm-usage",
  // Capture a normal desktop layout, not Chromium's narrow 780px default.
  "--window-size=1280,800", "--force-device-scale-factor=1",
  "--enable-unsafe-swiftshader", "--use-gl=angle", "--use-angle=swiftshader",
  "--no-first-run", "--disable-background-networking",
  "--remote-allow-origins=*", "--remote-debugging-port=" + debuggerPort,
  "--user-data-dir=/tmp/ocellus-smoke-chrome",
  "about:blank",
], { stdio: ["ignore", "ignore", "pipe"] });
let browserLog = "";
chrome.stderr.on("data", (data) => { browserLog = (browserLog + data.toString()).slice(-18000); });
const runtimeErrors = [];
const consoleErrors = [];
const failedRequests = [];
const headIconResponses = new Map();
let nativeVoidTextureStatus = null;
let connection;
try {
  let target;
  // GitHub's software WebGL runner occasionally takes more than ten seconds
  // to launch Chromium. Allow up to 45 seconds, and detect an actual crash.
  for (let i = 0; i < 450; i++) {
    if (chrome.exitCode !== null)
      throw new Error("Chromium exited before DevTools was available: " +
        chrome.exitCode + "\n" + browserLog);
    try {
      const response = await fetch("http://" + host + ":" + debuggerPort + "/json/new?about:blank", { method: "PUT" });
      if (response.ok) { target = await response.json(); break; }
    } catch {}
    await sleep(100);
  }
  if (!target) throw new Error("Chromium DevTools endpoint not available\n" + browserLog);

  const socket = new WebSocket(target.webSocketDebuggerUrl);
  connection = socket;
  await new Promise((resolve, reject) => {
    socket.addEventListener("open", resolve, { once: true });
    socket.addEventListener("error", reject, { once: true });
  });
  const pending = new Map();
  let nextId = 0;
  socket.addEventListener("message", ({ data }) => {
    const event = JSON.parse(data);
    if (event.id !== undefined) {
      const promise = pending.get(event.id);
      if (promise) { pending.delete(event.id); promise(event); }
      return;
    }
    if (event.method === "Runtime.exceptionThrown") {
      const e = event.params.exceptionDetails;
      runtimeErrors.push(e.exception?.description ?? e.text ?? "unknown exception");
    }
    if (event.method === "Runtime.consoleAPICalled" && event.params.type === "error") {
      consoleErrors.push(event.params.args.map((arg) => arg.value ?? arg.description ?? "").join(" "));
    }
    if (event.method === "Network.responseReceived") {
      const { url, status } = event.params.response ?? {};
      const match = url?.match(/\/sprites\/440-(11|15|16)\.png(?:[?#]|$)/);
      if (match) headIconResponses.set(Number(match[1]), status);
      if (url?.match(/\/osrs-assets\/textures\/215\.png(?:[?#]|$)/))
        nativeVoidTextureStatus = status;
    }
    if (event.method === "Network.loadingFailed") {
      failedRequests.push(event.params.errorText);
    }
  });
  const call = async (method, params = {}) => {
    const id = ++nextId;
    const answer = new Promise((resolve) => pending.set(id, resolve));
    socket.send(JSON.stringify({ id, method, params }));
    const result = await Promise.race([answer, sleep(8000).then(() => { throw new Error("CDP timeout: " + method); })]);
    if (result.error) throw new Error(method + ": " + JSON.stringify(result.error));
    return result.result;
  };
  await call("Page.enable");
  await call("Runtime.enable");
  await call("Log.enable");
  await call("Network.enable");
  // Instrument the ACTUAL WebAudio nodes before the SDK imports. Reading
  // Settings flags alone would not reveal silent or unscheduled OSRS cues.
  await call("Page.addScriptToEvaluateOnNewDocument", {
    source: `(() => {
      window.__ocellusAudioContexts = [];
      window.__ocellusSoundStarts = [];
      const NativeContext = window.AudioContext;
      if (NativeContext) {
        window.AudioContext = class extends NativeContext {
          constructor(...args) {
            super(...args);
            window.__ocellusAudioContexts.push(this);
          }
        };
      }
      const nativeStart = AudioBufferSourceNode.prototype.start;
      AudioBufferSourceNode.prototype.start = function (...args) {
        window.__ocellusSoundStarts.push({
          frames: this.buffer?.length ?? null,
          hz: this.buffer?.sampleRate ?? null,
          state: this.context?.state ?? null,
          tick: window.__ocellusSmokeRegion?.getSnapshot?.().frame?.tick ?? null,
        });
        return nativeStart.apply(this, args);
      };
    })()`,
  });
  await call("Page.navigate", { url: "http://" + host + ":" + webPort + "/?ocellus-ci=1" });
  let sidebar = false;
  let current = "";
  for (let attempt = 0; attempt < 80; attempt++) {
    await sleep(250);
    const value = await call("Runtime.evaluate", {
      expression: 'JSON.stringify({ title: document.title, body: document.body?.innerText?.slice(0, 1500), rootLength: document.querySelector("#root")?.innerHTML.length, sidebar: !!document.querySelector("#right_panel"), status: !!document.querySelector(".ocellus-fight-status") })',
      returnByValue: true,
    });
    current = value.result?.value ?? String(value.exceptionDetails?.text ?? "");
    try {
      const data = JSON.parse(current);
      if (data.sidebar && data.status) { sidebar = true; break; }
    } catch {}
    if (runtimeErrors.length) break;
  }
  if (!sidebar || runtimeErrors.length) {
    throw new Error(
      "Ocellus browser startup failed\n" +
      "DOM: " + current + "\n" +
      "Exceptions: " + JSON.stringify(runtimeErrors.slice(0, 8)) + "\n" +
      "Console errors: " + JSON.stringify(consoleErrors.slice(0, 12)) + "\n" +
      "Network failures: " + JSON.stringify(failedRequests.slice(0, 10)) + "\n" +
      "Chromium stderr: " + browserLog.slice(-2500)
    );
  }
  // Audio controls must be present and enabled for a new Ocellus visitor.
  // Their saved preference is separate from Sol's shared SDK storage.
  const audioBefore = await call("Runtime.evaluate", {
    expression: `(() => {
      const effects = document.querySelector("#ocellus-sound-effects");
      const area = document.querySelector("#ocellus-area-sounds");
      return JSON.stringify({
        effects: effects?.checked, area: area?.checked,
        dedicated: localStorage.getItem("x0xp:ocellus:audio:v1"),
        shared: localStorage.getItem("osrs-sdk:settings"),
      });
    })()`,
    returnByValue: true,
  });
  const initialAudio = JSON.parse(audioBefore.result?.value ?? "{}");
  if (!initialAudio.effects || !initialAudio.area || initialAudio.dedicated !== null)
    throw new Error("Ocellus audio does not default on without modifying storage: " +
      JSON.stringify(initialAudio));

  // Browser-level click is used rather than a synthetic React event: it
  // confirms the native pointer gesture can resume a suspended AudioContext.
  const muted = await call("Runtime.evaluate", {
    expression: `(() => {
      document.querySelector("#ocellus-sound-effects").click();
      document.querySelector("#ocellus-area-sounds").click();
      return JSON.stringify({
        dedicated: localStorage.getItem("x0xp:ocellus:audio:v1"),
        shared: localStorage.getItem("osrs-sdk:settings"),
      });
    })()`,
    returnByValue: true,
  });
  const mutedAudio = JSON.parse(muted.result?.value ?? "{}");
  if (mutedAudio.dedicated !== '{"effects":false,"area":false}' ||
      mutedAudio.shared !== initialAudio.shared)
    throw new Error("Ocellus mute state did not persist separately: " +
      JSON.stringify({ mutedAudio, initialAudio }));
  await sleep(80);
  const muteView = await call("Runtime.evaluate", {
    expression: `JSON.stringify({
      effects: document.querySelector("#ocellus-sound-effects")?.checked,
      area: document.querySelector("#ocellus-area-sounds")?.checked,
    })`,
    returnByValue: true,
  });
  if (JSON.parse(muteView.result?.value ?? "{}").effects ||
      JSON.parse(muteView.result?.value ?? "{}").area)
    throw new Error("Ocellus audio checkboxes failed to show muted state");

  await call("Runtime.evaluate", {
    expression: `(() => {
      document.querySelector("#ocellus-sound-effects").click();
      document.querySelector("#ocellus-area-sounds").click();
    })()`,
    returnByValue: true,
  });
  console.log("Ocellus audio controls verified: enabled initially, independently mutable and persisted.");

  // Headless Chrome can start audio automatically, hiding a desktop-browser
  // failure where AudioContext stays suspended until a genuine user gesture.
  // Explicitly suspend the SDK-created context and click the game sidebar
  // using CDP's native mouse events, not element.click().
  const suspendedAudio = await call("Runtime.evaluate", {
    expression: `(async () => {
      const contexts = window.__ocellusAudioContexts ?? [];
      if (contexts.length === 0) return { error: "No SDK AudioContext captured" };
      await Promise.all(contexts.map((context) => context.suspend()));
      const heading = document.querySelector("#right_panel .trainer-sidebar-heading");
      if (!heading) return { error: "Ocellus sidebar heading unavailable" };
      const rect = heading.getBoundingClientRect();
      return { states: contexts.map((context) => context.state),
        x: Math.round(rect.left + rect.width / 2),
        y: Math.round(rect.top + rect.height / 2) };
    })()`,
    awaitPromise: true,
    returnByValue: true,
  });
  const audioFixture = suspendedAudio.result?.value;
  if (audioFixture?.error || !audioFixture?.states?.length ||
      audioFixture.states.some((state) => state !== "suspended"))
    throw new Error("Audio fixture could not suspend native WebAudio: " +
      JSON.stringify(audioFixture));
  await call("Input.dispatchMouseEvent", {
    type: "mouseMoved", x: audioFixture.x, y: audioFixture.y,
  });
  await call("Input.dispatchMouseEvent", {
    type: "mousePressed", x: audioFixture.x, y: audioFixture.y,
    button: "left", clickCount: 1,
  });
  await call("Input.dispatchMouseEvent", {
    type: "mouseReleased", x: audioFixture.x, y: audioFixture.y,
    button: "left", clickCount: 1,
  });
  let resumed = false;
  for (let attempt = 0; attempt < 15; attempt++) {
    const states = await call("Runtime.evaluate", {
      expression: 'window.__ocellusAudioContexts.map((context) => context.state)',
      returnByValue: true,
    });
    if (states.result?.value?.every((state) => state === "running")) {
      resumed = true;
      break;
    }
    await sleep(80);
  }
  if (!resumed)
    throw new Error("A native pointer gesture failed to resume the SDK AudioContext");
  console.log("Ocellus native WebAudio resumed from a real pointer event.");

  // The recorded first P4 cue is the End... shout, cache effect 12490.
  // OSRS's 22050Hz synthesizer renders 7,717 frames for this cue. Check
  // that an AudioBufferSourceNode actually starts on the fight's opening
  // ticks, not just that the sound is present in the asset manifest.
  let heardEndCue = null;
  for (let attempt = 0; attempt < 85; attempt++) {
    const soundView = await call("Runtime.evaluate", {
      expression: `JSON.stringify({
        tick: window.__ocellusSmokeRegion?.getSnapshot()?.frame?.tick ?? null,
        starts: (window.__ocellusSoundStarts ?? []).filter((entry) =>
          entry.frames === 7717 && entry.hz === 22050),
      })`,
      returnByValue: true,
    });
    const observation = JSON.parse(soundView.result?.value ?? "{}");
    heardEndCue = observation.starts?.find((entry) =>
      entry.state === "running" && entry.tick !== null &&
      entry.tick >= 3 && entry.tick <= 8) ?? null;
    if (heardEndCue || observation.tick >= 10 || runtimeErrors.length) break;
    await sleep(160);
  }
  if (!heardEndCue)
    throw new Error("Native Ocellus End... cue 12490 did not start on an active WebAudio node");
  console.log("Ocellus native End... cue 12490 played via WebAudio at tick " +
    heardEndCue.tick + " (7717 frames at 22050Hz).");

  // The requested game viewport is free of extra experiment/attribution boxes.
  const unwantedLabel = await call("Runtime.evaluate", {
    expression: 'Boolean(document.querySelector(".ocellus-beta-label"))',
    returnByValue: true,
  });
  if (unwantedLabel.result?.value)
    throw new Error("Legacy Ocellus viewport attribution box is still present");

  // The game must progress through the first lifeforce hit, not just mount
  // React. This catches a paused engine or mechanics that fail to damage the
  // player when routed through the SDK's hitsplat/projectile pipeline.
  let progressed = false;
  for (let attempt = 0; attempt < 100; attempt++) {
    await sleep(200);
    const observed = await call("Runtime.evaluate", {
      expression: `(() => {
        const names = [...document.querySelectorAll(".ocellus-fight-status > span")];
        const hp = names.find((node) => node.textContent?.trim() === "Your HP");
        const tick = names.find((node) => node.textContent?.trim() === "Game tick");
        return JSON.stringify({ hp: Number(hp?.nextElementSibling?.textContent),
          tick: Number(tick?.nextElementSibling?.textContent) });
      })()`,
      returnByValue: true,
    });
    const value = JSON.parse(observed.result?.value ?? "{}");
    if (value.tick >= 12 && value.hp > 0 && value.hp < 99) {
      progressed = true;
      console.log("Ocellus first lifeforce hit verified at tick " + value.tick + ": " + value.hp + " HP.");
      break;
    }
    if (runtimeErrors.length) break;
  }
  if (!progressed) throw new Error(
    "Ocellus fight did not resolve the first lifeforce hit in Chromium. " +
    JSON.stringify({ runtimeErrors: runtimeErrors.slice(-5), consoleErrors: consoleErrors.slice(-5) }),
  );
  // The recorded lifeforce tell is game chat, not boss overhead text.
  const lifeforceChat = await call("Runtime.evaluate", {
    expression: 'document.querySelector("#game_chat")?.textContent ?? ""',
    returnByValue: true,
  });
  if (!lifeforceChat.result?.value?.includes("Ocellus manipulates your lifeforce!"))
    throw new Error("The native lifeforce tell was missing from the game chat: " +
      JSON.stringify(lifeforceChat.result?.value));
  console.log("Ocellus lifeforce tell is visible in the game chat.");

  const sceneCheck = await call("Runtime.evaluate", {
    expression: `(() => {
      const worldCanvas = document.querySelector("#world");
      const webglCanvas = worldCanvas?.previousElementSibling;
      const isThreeCanvas = webglCanvas instanceof HTMLCanvasElement
        && !!webglCanvas.getContext("webgl2");
      return JSON.stringify({ isThreeCanvas,
        canvasWidth: webglCanvas?.width, canvasHeight: webglCanvas?.height,
        hidden: webglCanvas?.hidden });
    })()`,
    returnByValue: true,
  });
  const scene = JSON.parse(sceneCheck.result?.value ?? "{}");
  if (!scene.isThreeCanvas || scene.canvasWidth < 2 || scene.canvasHeight < 2)
    throw new Error("Ocellus 3D WebGL renderer not active: " + JSON.stringify(scene));
  console.log("Ocellus 3D WebGL renderer verified: " + JSON.stringify(scene));
  // Resource Timing can discard early images after hundreds of cache assets
  // fill Chrome's buffer. DevTools network responses are collected from the
  // start of navigation, and distinguish a missing asset from a timing eviction.
  const headIcons = [11, 15, 16].map((frame) => ({
    frame, status: headIconResponses.get(frame) ?? null,
  }));
  console.log("Ocellus prayer icon responses: " + JSON.stringify(headIcons));
  if (headIcons.some(({ status }) => status === null || status < 200 || status >= 400))
    throw new Error("Original Ocellus prayer icons were not loaded before combat: " +
      JSON.stringify(headIcons));
  console.log("All three original Ocellus headicons loaded before battle.");
  if (nativeVoidTextureStatus !== 200)
    throw new Error("Original Ocellus void texture 215 failed to load: HTTP " +
      nativeVoidTextureStatus);
  console.log("Original Ocellus 128x128 starfield texture 215 loaded (HTTP 200).");

  // Capture the first native void-chain mark in a real WebGL frame. This is
  // evidence for later frame-by-frame comparison, not proof of game accuracy.
  let markTick = 0;
  for (let attempt = 0; attempt < 45; attempt++) {
    await sleep(175);
    const observed = await call("Runtime.evaluate", {
      expression: `(() => {
        const tickLabel = [...document.querySelectorAll(".ocellus-fight-status > span")]
          .find((node) => node.textContent?.trim() === "Game tick");
        return Number(tickLabel?.nextElementSibling?.textContent) || 0;
      })()`,
      returnByValue: true,
    });
    markTick = Number(observed.result?.value) || 0;
    if (markTick >= 17) break;
    if (runtimeErrors.length) break;
  }
  if (markTick < 17 || runtimeErrors.length)
    throw new Error("Ocellus first explosion mark did not display: tick=" + markTick +
      " exceptions=" + JSON.stringify(runtimeErrors.slice(-3)));
  await sleep(100);
  const shot = await call("Page.captureScreenshot", {
    format: "png", captureBeyondViewport: false, fromSurface: true,
  });
  if (!shot.data) throw new Error("Ocellus WebGL screenshot was empty");
  fs.mkdirSync("artifacts", { recursive: true });
  const imagePath = path.resolve("artifacts/ocellus-first-mark.png");
  fs.writeFileSync(imagePath, Buffer.from(shot.data, "base64"));
  if (fs.statSync(imagePath).size < 20000)
    throw new Error("Ocellus WebGL visual evidence was unexpectedly small");
  console.log("Ocellus first-mark WebGL visual evidence captured at tick " + markTick +
    " (" + fs.statSync(imagePath).size + " bytes).");

  // Ocellus Rift lifecycle browser regression. Cache 2746 gives spawn 14896
  // 30 client cycles, kill/despawn 14897 30 cycles and detonation 14898
  // 60 cycles. Exercise both paths in WebGL rather than trusting animation IDs
  // in static fixtures. Rift IDs are reserved for this localhost-only test.
  const riftFixture = await call("Runtime.evaluate", {
    expression: `(() => {
      const region = window.__ocellusSmokeRegion;
      if (!region?.applyEffect || !region?.riftMobs) return JSON.stringify({ error: "Rift fixture unavailable" });
      const animations = [];
      const addMob = region.addMob;
      region.addMob = function(mob) {
        if (mob && (mob.riftId === 9001 || mob.riftId === 9002)) {
          const original = mob.playAnimation.bind(mob);
          mob.playAnimation = (id, ...args) => {
            animations.push({ rift: mob.riftId, id });
            return original(id, ...args);
          };
        }
        return addMob.call(this, mob);
      };
      try {
        region.applyEffect({ kind: "rift-spawn", id: 9001, tile: { x: 5, y: 6 } });
        const detonated = region.riftMobs.get(9001);
        if (!detonated) return JSON.stringify({ error: "Detonation Rift did not spawn" });
        region.applyEffect({ kind: "rift-detonate", id: 9001 });
        const detonationCountdown = detonated.dying;
        const detonationRemoved = !region.riftMobs.has(9001);
        region.applyEffect({ kind: "rift-spawn", id: 9002, tile: { x: 6, y: 6 } });
        const killed = region.riftMobs.get(9002);
        if (!killed) return JSON.stringify({ error: "Kill Rift did not spawn" });
        // This fixture must register a LIVING Rift in the simulator too.
        // The earlier visual-only NPC could die but was deliberately unable
        // to award the native kill-empowerment effect or its chat message.
        if (!Array.isArray(region.sim?.rifts))
          return JSON.stringify({ error: "Simulation Rift state unavailable" });
        region.sim.rifts.push({
          id: 9002, tile: { x: 6, y: 6 },
          spawnedAt: region.sim.current().tick, alive: true,
        });
        window.__ocellusSmokeRifts = { animations, detonated, killed };
        killed.currentStats.hitpoint = 0;
        return JSON.stringify({ animations, detonationCountdown, detonationRemoved });
      } finally {
        region.addMob = addMob;
      }
    })()`,
    returnByValue: true,
  });
  const firstRift = JSON.parse(riftFixture.result?.value ?? "{}");
  if (firstRift.error || !firstRift.detonationRemoved ||
      firstRift.detonationCountdown !== 3 ||
      !firstRift.animations?.some(({ rift, id }) => rift === 9001 && id === 14896) ||
      !firstRift.animations?.some(({ rift, id }) => rift === 9001 && id === 14898) ||
      !firstRift.animations?.some(({ rift, id }) => rift === 9002 && id === 14896))
    throw new Error("Ocellus Rift spawn/detonation sequence failed: " + JSON.stringify(firstRift));
  let killedRiftDeath = false;
  for (let attempt = 0; attempt < 22; attempt++) {
    await sleep(200);
    const riftProbe = await call("Runtime.evaluate", {
      expression: `(() => {
        const region = window.__ocellusSmokeRegion;
        const fixture = window.__ocellusSmokeRifts;
        return JSON.stringify({
          death: fixture?.animations?.some(({ rift, id }) => rift === 9002 && id === 14897),
          removed: !region?.riftMobs?.has(9002),
          dying: fixture?.killed?.dying,
          detonationCountdown: fixture?.detonated?.dying,
        });
      })()`,
      returnByValue: true,
    });
    const observed = JSON.parse(riftProbe.result?.value ?? "{}");
    if (observed.death && observed.removed) { killedRiftDeath = true; break; }
    if (runtimeErrors.length) break;
  }
  if (!killedRiftDeath || runtimeErrors.length)
    throw new Error("Native Void Rift 14897 death/despawn failed: " +
      JSON.stringify({ killedRiftDeath, runtimeErrors: runtimeErrors.slice(-5) }));
  let riftChat = "";
  for (let attempt = 0; attempt < 16; attempt++) {
    const current = await call("Runtime.evaluate", {
      expression: 'document.querySelector("#game_chat")?.textContent ?? ""',
      returnByValue: true,
    });
    riftChat = current.result?.value ?? "";
    if (riftChat.includes("Destroying the void rift empowers you!")) break;
    await sleep(100); // allow React to commit the tick's message
  }
  if (!riftChat.includes("Destroying the void rift empowers you!"))
    throw new Error("A living Rift died but its kill message was missing: " +
      JSON.stringify(riftChat));
  console.log("Ocellus Rift native spawn 14896, detonation 14898, death 14897 and game chat verified.");

  // The early screenshot cannot prove the original phase-transition VFX
  // are visible. Capture the first actual cache effect at P4 tick 33 in the
  // SAME Chromium/WebGL session. Suppress only damage in the LOCAL CI fixture
  // so six normal void explosions cannot kill the idle screenshot player.
  const visualFixture = await call("Runtime.evaluate", {
    expression: `(() => {
      const region = window.__ocellusSmokeRegion;
      if (!region?.player || !region?.boss || !region?.applyEffect)
        return { error: "Local visual capture fixture unavailable" };
      region.player.currentStats.hitpoint = 99;
      const apply = region.applyEffect.bind(region);
      region.applyEffect = (effect) => {
        if (effect.kind !== "damage") apply(effect);
      };
      return { tick: region.getSnapshot().frame.tick };
    })()`,
    returnByValue: true,
  });
  if (visualFixture.result?.value?.error)
    throw new Error("Ocellus local visual capture failed: " +
      visualFixture.result.value.error);
  let transitionTick = 0;
  for (let attempt = 0; attempt < 120; attempt++) {
    await sleep(125);
    const observed = await call("Runtime.evaluate", {
      expression: 'window.__ocellusSmokeRegion?.getSnapshot()?.frame?.tick ?? 0',
      returnByValue: true,
    });
    transitionTick = observed.result?.value ?? 0;
    if (transitionTick >= 33 || runtimeErrors.length) break;
  }
  if (transitionTick < 33 || runtimeErrors.length)
    throw new Error("Original Ocellus transition attack did not render: tick=" +
      transitionTick + " errors=" + JSON.stringify(runtimeErrors.slice(-3)));
  await sleep(125);
  // An earlier build incorrectly showed a long yellow practice instruction
  // as Ocellus overhead speech. Only the game's short "End..." line belongs
  // on the NPC; all other combat hints remain confined to the sidebar.
  const overheadText = await call("Runtime.evaluate", {
    expression: 'window.__ocellusSmokeRegion?.boss?.overheadText ?? ""',
    returnByValue: true,
  });
  if (/Incoming|switch prayers|Void explosion|manipulates your lifeforce/i
      .test(overheadText.result?.value ?? ""))
    throw new Error("Non-native trainer instruction appeared above Ocellus: " +
      overheadText.result.value);
  const specialShot = await call("Page.captureScreenshot", {
    format: "png", captureBeyondViewport: false, fromSurface: true,
  });
  const specialPath = path.resolve("artifacts/ocellus-first-transition.png");
  if (!specialShot.data) throw new Error("Ocellus transition screenshot was empty");
  fs.writeFileSync(specialPath, Buffer.from(specialShot.data, "base64"));
  if (fs.statSync(specialPath).size < 20000)
    throw new Error("Ocellus transition screenshot was unexpectedly small");
  console.log("Ocellus native transition visual frame captured at tick " +
    transitionTick + " (" + fs.statSync(specialPath).size + " bytes).");

  // Confirm the other native Phase 4 sounds actually reach WebAudio. The
  // original 12497 flood is 66,150 samples at 22,050 Hz and plays at tick 39.
  // The first inner-orb chime (12624) is 9,922 samples; its other three
  // chimes (12621/12622/12623) are 12,127 samples each. We identify these
  // by the verified OSRS synth lengths, rather than a fake cue log.
  // The localhost damage-only fixture above keeps the player alive until
  // the end of the first outer-void stage, without changing audio playback.
  let audioTick = transitionTick;
  for (let attempt = 0; attempt < 130; attempt++) {
    await sleep(175);
    const observed = await call("Runtime.evaluate", {
      expression: 'window.__ocellusSmokeRegion?.getSnapshot()?.frame?.tick ?? 0',
      returnByValue: true,
    });
    audioTick = observed.result?.value ?? 0;
    if (audioTick >= 51 || runtimeErrors.length) break;
  }
  if (audioTick < 51 || runtimeErrors.length)
    throw new Error("Ocellus audio audit did not reach the outer void: " +
      JSON.stringify({ audioTick, errors: runtimeErrors.slice(-3) }));

  const audioTrace = await call("Runtime.evaluate", {
    expression: `JSON.stringify((window.__ocellusSoundStarts ?? [])
      .filter((entry) => entry.hz === 22050
        && [7717, 9922, 12127, 66150].includes(entry.frames))
      .map((entry) => ({
        tick: entry.tick, frames: entry.frames, state: entry.state,
      })))`,
    returnByValue: true,
  });
  const cues = JSON.parse(audioTrace.result?.value ?? "[]");
  console.log("OCELLUS_NATIVE_AUDIO_TRACE " + JSON.stringify(cues));
  const playingAt = (frames, first, last) =>
    cues.filter((entry) => entry.frames === frames
      && entry.state === "running" && entry.tick >= first
      && entry.tick <= last);
  if (playingAt(66150, 38, 41).length === 0)
    throw new Error("Original outer-void flood 12497 did not start at tick 39: " +
      JSON.stringify(cues));
  console.log("Ocellus native outer-void flood 12497 verified in WebAudio at tick 39.");

  // The inner orb appears a few tiles from the idle player in this seed,
  // within the SDK's area-sound reach. Keep a full trace if an individual
  // animation frame's cue is missing, rather than claiming an audible chime.
  if (playingAt(9922, 11, 15).length === 0)
    throw new Error("Original lifeforce orb chime 12624 did not start in WebAudio: " +
      JSON.stringify(cues));
  const innerChimes = playingAt(12127, 14, 25);
  if (innerChimes.length < 2)
    throw new Error("Original lifeforce orb chime sequence is incomplete: " +
      JSON.stringify(cues));
  console.log("Ocellus native lifeforce orb chimes verified: " +
    (1 + innerChimes.length) + " buffers started on the inner-orb cycle.");

  // End-to-end NPC death regression. The original prototype accidentally
  // suppressed Mob.attackStep and so never called the SDK's detectDeath().
  // In the localhost-only fixture, set boss HP to zero after the combat shot;
  // verify its real 14872 action, all three death visuals, and the win screen.
  const armed = await call("Runtime.evaluate", {
    expression: `(() => {
      const region = window.__ocellusSmokeRegion;
      const boss = region?.boss;
      if (!boss || !region?.getSnapshot) return false;
      const played = [];
      const original = boss.playAnimation.bind(boss);
      boss.playAnimation = (id, ...args) => {
        played.push(id);
        return original(id, ...args);
      };
      window.__ocellusSmokeBossAnimations = played;
      boss.currentStats.hitpoint = 0;
      return true;
    })()`,
    returnByValue: true,
  });
  if (!armed.result?.value) throw new Error("Local-only NPC death regression harness missing");
  let observedNativeDeath = false;
  let victoryReached = false;
  for (let attempt = 0; attempt < 90; attempt++) {
    await sleep(200);
    const probe = await call("Runtime.evaluate", {
      expression: `(() => {
        const region = window.__ocellusSmokeRegion;
        const boss = region?.boss;
        return JSON.stringify({
          won: region?.getSnapshot()?.result === "won",
          dead: boss?.dying >= 0,
          anim: window.__ocellusSmokeBossAnimations?.includes(14872) ?? false,
          effects: boss?.spotAnims?.map(s => s.id) ?? [],
        });
      })()`,
      returnByValue: true,
    });
    const current = JSON.parse(probe.result?.value ?? "{}");
    const originalEffects = [4274, 4275, 4276].every((id) => current.effects?.includes(id));
    if (current.dead && current.anim && originalEffects) observedNativeDeath = true;
    if (current.won) {
      victoryReached = true;
      break;
    }
    if (runtimeErrors.length) break;
  }
  if (!observedNativeDeath || !victoryReached || runtimeErrors.length)
    throw new Error("Ocellus native death sequence or victory failed: " +
      JSON.stringify({ observedNativeDeath, victoryReached,
        runtimeErrors: runtimeErrors.slice(-5) }));
  console.log("Ocellus NPC death validated: animation 14872, cache effects 4274/4275/4276, and victory.");
  console.log("Ocellus browser smoke check passed: 3D scene, native assets, first hit, void mark and boss death.");
} finally {
  connection?.close();
  chrome.kill("SIGTERM");
  await new Promise((resolve) => server.close(resolve));
}
