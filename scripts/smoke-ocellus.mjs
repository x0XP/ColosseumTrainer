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
for (const id of [4309, 4310, 4311, 4313, 4314, 4328, 4329, 4330, 4339, 4340]) {
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
  for (let i = 0; i < 100; i++) {
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
  console.log("Ocellus browser smoke check passed: React sidebar and status mounted.");
} finally {
  connection?.close();
  chrome.kill("SIGTERM");
  await new Promise((resolve) => server.close(resolve));
}
