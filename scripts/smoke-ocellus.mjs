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
  await call("Page.navigate", { url: "http://" + host + ":" + webPort + "/" });
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
  const iconCheck = await call("Runtime.evaluate", {
    expression: `JSON.stringify([11,15,16].map(frame =>
      performance.getEntriesByType("resource").some(entry =>
        entry.name.includes("/osrs-assets/sprites/440-" + frame + ".png"))))`,
    returnByValue: true,
  });
  const iconsRequested = JSON.parse(iconCheck.result?.value ?? "[]");
  if (iconsRequested.length !== 3 || iconsRequested.some((loaded) => !loaded)) {
    throw new Error("Ocellus native prayer sprites were not preloaded: " +
      JSON.stringify(iconsRequested));
  }
  console.log("All three original Ocellus headicons requested before battle.");

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
  console.log("Ocellus browser smoke check passed: 3D scene, original sprites, first hit and void mark.");
} finally {
  connection?.close();
  chrome.kill("SIGTERM");
  await new Promise((resolve) => server.close(resolve));
}
