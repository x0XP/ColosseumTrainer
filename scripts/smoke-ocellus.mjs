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
  console.log("Ocellus Rift native spawn 14896, detonation 14898 and death 14897 verified.");

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
