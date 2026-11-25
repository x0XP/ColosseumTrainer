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
for (const id of [4274, 4275, 4276, 4306, 4309, 4310, 4311, 4312, 4313, 4314, 4316, 4328, 4329, 4330, 4339, 4340]) {
  if (!manifest.spotAnims?.[String(id)]) throw new Error("Ocellus spotanim " + id + " is missing from the compiled cache manifest");
}
for (const id of [62357, 62739]) {
  const asset = manifest.assets?.["model-" + id];
  if (!asset || !manifest.references?.["model:" + id]?.includes("model-" + id)) throw new Error("Native censer fixture model missing: " + id);
  if (!fs.statSync(path.join(root,"osrs-assets",asset.file)).size) throw new Error("Empty native fixture asset: " + id);
}
for (const frame of [11, 15, 16]) {
  if (!fs.statSync(path.join(root, "osrs-assets", "sprites", "440-" + frame + ".png")).size)
    throw new Error("Ocellus overhead sprite is empty: 440-" + frame);
}
const foundation = JSON.parse(fs.readFileSync(path.join(root, "osrs-assets", "ocellus-native-foundation.json"), "utf8"));
if (foundation.cache !== 2746 || foundation.square !== 16472 || foundation.sources.map(s=>s.model).join(",") !== "62274,62275,62277" || !foundation.colors.length || foundation.positions.length !== foundation.colors.length * 9 || foundation.lighting!=="cache-object" || foundation.vertexColors?.length!==foundation.colors.length*3) throw new Error("Native foundation was not packaged");
if (foundation.backingTiles?.length !== 24 || new Set(foundation.backingTiles.map(t => t.x+":"+t.y)).size!==24 || foundation.backingTiles.some(t => (t.x===13&&t.y<=3)||(t.x===0&&t.y===12))) throw new Error("Cliff backing extends into thin native edge fragments");
if(foundation.topY!==-0.00783||foundation.envelope?.bands?.length!==6||foundation.envelope.bands[0].margin!==.48||foundation.envelope.bands[1].margin!==.60||foundation.envelope.bands[2].bottom!==-3.19||foundation.envelope.bands[2].margin!==.75||foundation.envelope.bands[3].top!==-3.19||foundation.envelope.bands[3].bottom!==-3.85||foundation.envelope.bands[3].margin!==.60||foundation.envelope.bands[4].top!==-3.85||foundation.envelope.bands[4].bottom!==-4.7||foundation.envelope.bands[4].margin!==.52||foundation.envelope.bands[5].top!==-4.7||foundation.envelope.bands[5].bottom!==-5.25||foundation.envelope.bands[5].margin!==.42||!Number.isInteger(foundation.envelope.mergedBoxes)||foundation.envelope.mergedBoxes>=foundation.envelope.rawBoxes||!foundation.positions.some((v,i)=>i%3===1&&v< -4)||foundation.envelope.deepVertices!==foundation.positions.filter((v,i)=>i%3===1&&v< -1.69).length)throw Error("Incorrect native foundation envelope");
for (let i=1;i<foundation.positions.length;i+=3) if (foundation.positions[i]>foundation.topY||foundation.positions[i]<-5.25) throw new Error("Native foundation crosses the floor plane");
const curb=JSON.parse(fs.readFileSync(path.join(root,"osrs-assets","ocellus-native-curb.json"),"utf8"));
if(curb.cache!==2746||curb.square!==16472||curb.plane!==1||curb.tiles!==29||curb.reliefTiles!==84||!curb.tall||!Number.isInteger(curb.tall.faces)||!Number.isInteger(curb.tall.components)||curb.tall.faces<0||curb.tall.components<0||curb.tall.maxHeight<.75||curb.tall.maxHeight>7||curb.curbFaces+curb.tall.faces!==curb.colors.length||!Number.isInteger(curb.overhangBoxes)||curb.overhangBoxes<=0||!Number.isInteger(curb.overhangFaces)||curb.overhangFaces<0||curb.overhangFaces>curb.colors.length||!Number.isInteger(curb.floorEdgeFaces)||curb.floorEdgeFaces<0||curb.floorEdgeFaces>curb.overhangFaces||!Number.isInteger(curb.raisedFloorFaces)||curb.raisedFloorFaces<0||curb.raisedFloorFaces>curb.colors.length||curb.sources.map(s=>s.model).join(",")!=="62274,62275,62277"||!curb.colors.length||curb.positions.length!==curb.colors.length*9||curb.lighting!=="cache-object"||curb.vertexColors?.length!==curb.colors.length*3)throw Error("Native curb was not packaged");
let tallMax=.75;
for(let i=1;i<curb.positions.length;i+=3){
 const y=curb.positions[i],upper=i>=curb.curbFaces*9;
 if(!Number.isFinite(y)||upper&&(y<.75-1e-6||y>7+1e-6)||!upper&&(y<-1/128-1e-6||y>.75+1e-6))throw Error("Native curb or rooted scenery height band violated");
 if(upper)tallMax=Math.max(tallMax,y);
}
if(Math.abs(tallMax-curb.tall.maxHeight)>1e-6)throw Error("Native upper scenery measured height mismatch");
const flatFloor=JSON.parse(fs.readFileSync(path.join(root,"osrs-assets","ocellus-native-flat-floor.json"),"utf8"));
if(flatFloor.cache!==2746||flatFloor.square!==16472||flatFloor.plane!==1||flatFloor.tiles!==84||flatFloor.floorY!==-1/128||flatFloor.lighting!=="cache-object"||flatFloor.sources.map(s=>s.model).join(",")!=="62274,62275,62277"||!flatFloor.colors.length||flatFloor.positions.length!==flatFloor.colors.length*9||flatFloor.vertexColors.length!==flatFloor.colors.length*3||flatFloor.positions.some((v,i)=>!Number.isFinite(v)||i%3===1&&v!==-1/128))throw Error("Native flat floor geometry not packaged");
// Validate original floor winding and total area before relying on native
// front-face culling. Coordinates are in tile units; projected double area
// is 168 for all 84 fully recovered tiles.
let nativeFloorDoubleArea=0;
for(let i=0;i<flatFloor.positions.length;i+=9){
 const [ax,,az,bx,,bz,cx,,cz]=flatFloor.positions.slice(i,i+9);
 const ny=(bz-az)*(cx-ax)-(bx-ax)*(cz-az);
 if(!(ny>0))throw Error("Native flat stone winding reversed");
 nativeFloorDoubleArea+=ny;
}
if(Math.abs(nativeFloorDoubleArea-168)>1e-5)throw Error("Native stone geometry area mismatch: "+nativeFloorDoubleArea);
const floorProof=JSON.parse(fs.readFileSync(path.join(root,"osrs-assets","ocellus-native-floor.json"),"utf8"));
const floorPng=fs.readFileSync(path.join(root,"osrs-assets","textures","ocellus-native-floor.png"));
const samplingPng=fs.readFileSync(path.join(root,"osrs-assets","textures","ocellus-native-floor-sampling.png"));
const upperPng=fs.readFileSync(path.join(root,"osrs-assets","textures","ocellus-native-upper.png"));
if(upperPng.readUInt32BE(16)!==896||upperPng.readUInt32BE(20)!==832||!floorProof.upper||floorProof.upper.curb<=0||floorProof.upper.native+floorProof.upper.repaired-floorProof.upper.curb!==84*64*64)throw Error("Native upper surface proof mismatch");
 const reliefPng=fs.readFileSync(path.join(root,"osrs-assets","textures","ocellus-native-relief.png"));
 if(reliefPng.readUInt32BE(16)!==896||reliefPng.readUInt32BE(20)!==832||!floorProof.relief||floorProof.relief.covered<=0||floorProof.relief.covered>floorProof.upper.native||floorProof.relief.threshold!==.003)throw Error("Native raised-surface mask proof mismatch");
if(samplingPng.readUInt32BE(16)!==896||samplingPng.readUInt32BE(20)!==832||floorProof.samplingPaddingPixels!==896*832-84*64*64)throw Error("Native floor sampling proof mismatch");
if(floorProof.cache!==2746||floorProof.square!==16472||floorProof.tiles!==84||floorProof.floorY!==-1/128||floorProof.lighting!=="cache-object"||floorProof.pixels!==84*64*64||floorProof.models.join(",")!=="62274,62275,62277"||floorPng.readUInt32BE(16)!==14*64||floorPng.readUInt32BE(20)!==13*64)throw Error("Native floor proof/texture mismatch");
const floodTexture=path.join(root,"osrs-assets","textures","ocellus-flood.png");
if(!fs.existsSync(floodTexture)||fs.statSync(floodTexture).size<100)throw Error("Derived native flood texture missing");
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
let nativeFoundationStatus = null;
let nativeFloorStatus = null;
let nativeMinimapStatus = null;
let nativeCurbStatus = null;
const nativeGeometryRequests = new Map();
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
    if (event.method === "Network.requestWillBeSent") {
      const url = event.params.request?.url ?? "";
      const match = url.match(/\/osrs-assets\/(?:textures\/)?(ocellus-native-(?:curb|foundation|flat-floor)\.json|ocellus-native-floor(?:-sampling)?\.png|ocellus-flood\.png|ocellus-native-minimap\.png)(?:[?#]|$)/);
      if (match) nativeGeometryRequests.set(match[1], (nativeGeometryRequests.get(match[1]) ?? 0) + 1);
    }
    if (event.method === "Network.responseReceived") {
      const { url, status } = event.params.response ?? {};
      const match = url?.match(/\/sprites\/440-(11|15|16)\.png(?:[?#]|$)/);
      if (match) headIconResponses.set(Number(match[1]), status);
      if (url?.match(/\/osrs-assets\/textures\/ocellus-flood\.png(?:[?#]|$)/))
        nativeVoidTextureStatus = status;
      if (url?.match(/\/osrs-assets\/ocellus-native-foundation\.json(?:[?#]|$)/)) nativeFoundationStatus = status;
      if (url?.match(/\/osrs-assets\/textures\/ocellus-native-floor-sampling\.png(?:[?#]|$)/)) nativeFloorStatus = status;
      if (url?.match(/\/osrs-assets\/textures\/ocellus-native-minimap\.png(?:[?#]|$)/)) nativeMinimapStatus = status;
      if (url?.match(/\/osrs-assets\/ocellus-native-curb\.json(?:[?#]|$)/)) nativeCurbStatus = status;
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
  // The 242px sidebar must not force encounter labels or values onto
  // two lines in a standard 1280px desktop viewport. The screenshot fixture
  // caught this regression while the previous smoke test checked only DOM
  // presence, not whether the UI was actually readable.
  const encounterLayoutResult = await call("Runtime.evaluate", {
    expression: `(() => {
      const status = document.querySelector(".ocellus-fight-status");
      if (!status) return null;
      const rows = [...status.children].map((element) => {
        const box = element.getBoundingClientRect();
        const style = getComputedStyle(element);
        return {
          text: element.textContent?.trim() ?? "",
          height: box.height, lineHeight: Number.parseFloat(style.lineHeight),
          overflowing: element.scrollWidth > element.clientWidth + 1,
        };
      });
      return { width: status.getBoundingClientRect().width,
        viewport: window.innerWidth, rows };
    })()`,
    returnByValue: true,
  });
  const encounterLayout = encounterLayoutResult.result?.value;
  if (!encounterLayout || encounterLayout.viewport < 1100 ||
      encounterLayout.rows.some((row) =>
        row.overflowing || row.height > row.lineHeight * 1.55)) {
    throw new Error("Ocellus encounter status wraps or overflows in desktop view: " +
      JSON.stringify(encounterLayout));
  }
  console.log("Ocellus encounter sidebar labels remain single-line in Chromium.");
  const panelSizing=await call("Runtime.evaluate",{expression:`(() => {
    const p=document.querySelector("#right_panel");
    const css=getComputedStyle(p);
    return {width:p.getBoundingClientRect().width,basis:css.flexBasis,
      overflow:p.scrollWidth>p.clientWidth+1,
      tracks:[...p.querySelectorAll(".ocellus-live-track")].every(t=>t.getAttribute("aria-hidden")==="true")};
  })()`,returnByValue:true});
  const panel=panelSizing.result?.value;
  if(!panel||Math.abs(panel.width-242)>1||panel.basis!=="242px"||panel.overflow||!panel.tracks)throw Error("Ocellus sidebar layout failed: "+JSON.stringify(panel));
  console.log("Ocellus sidebar flex sizing verified: "+JSON.stringify(panel));

  // Trace REAL native NPC animations at the region boundary. This probe is
  // attached only to the isolated localhost smoke page, before combat starts;
  // no production state or animation timing is overridden.
  const bossProbeStart = await call("Runtime.evaluate", {
    expression: `(() => {
      const region = window.__ocellusSmokeRegion;
      const boss = region?.boss;
      if (!boss || !region?.sim?.current || !region?.updateView)
        return { error: "Boss animation instrumentation unavailable" };
      const trace = { actions: [], poses: [], renderedPoses: [] };
      const originalPlay = boss.playAnimation.bind(boss);
      boss.playAnimation = (animation, ...args) => {
        trace.actions.push({ tick: region.sim.current().tick, animation });
        return originalPlay(animation, ...args);
      };
      const originalUpdate = region.updateView.bind(region);
      region.updateView = (...args) => {
        const result = originalUpdate(...args);
        const frame = region.getSnapshot().frame;
        if ([3, 4, 7, 8, 10, 11, 15, 28, 29, 30, 31, 32, 33,
             38, 39, 42, 43, 59, 60, 61, 67, 68, 70, 71, 88, 89,
             90, 92, 93].includes(frame.tick)) {
          trace.poses.push({
            tick: frame.tick, stage: frame.stage,
            idle: boss.idlePoseId, visible: boss.visible(),
          });
        }
        return result;
      };
      window.__ocellusBossAnimationProbe = trace;
      // Capture measured native posed geometry, not just the idle getter.
      // Limit to one sample per game tick and active sequence.
      const seen=new Set();
      const samplePose=()=>{
        const tick=region.getSnapshot().frame.tick;
        if(tick>94||window.__ocellusSmokeRegion!==region)return;
        const model=boss.animationChangeListener??boss.cachedModel;
        const mesh=model?.mesh,position=mesh?.geometry.getAttribute("position");
        const id=model?.activeAnimation,key=tick+":"+id;
        if(model?.root?.visible&&position?.count===14373&&!seen.has(key)){
          seen.add(key);
          let lo=Infinity,hi=-Infinity,finite=true;
          const scale=model.root.scale.y,base=model.root.position.y;
          for(let i=0;i<position.count;i++){
            const y=base+position.getY(i)*scale;
            if(!Number.isFinite(y)){finite=false;break;}
            lo=Math.min(lo,y);hi=Math.max(hi,y);
          }
          trace.renderedPoses.push({tick,id,scale,base,lo,hi,finite,vertices:position.count,age:model.animationTime});
        }
        requestAnimationFrame(samplePose);
      };
      requestAnimationFrame(samplePose);
      return { installedAt: region.sim.current().tick };
    })()`,
    returnByValue: true,
  });
  const bossProbeInstalled = bossProbeStart.result?.value;
  if (bossProbeInstalled?.error || bossProbeInstalled?.installedAt >= 4)
    throw new Error("Boss animation trace was not installed before lead-in: " +
      JSON.stringify(bossProbeInstalled));

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
  if (nativeCurbStatus !== 200) throw new Error("Native curb not loaded by Chromium: "+nativeCurbStatus);
  console.log("Original Ocellus curb faces loaded: "+curb.colors.length);
  if (nativeMinimapStatus !== 200) throw Error("Native minimap not loaded: "+nativeMinimapStatus);
  const mapProbe=await call("Runtime.evaluate",{expression:`(() => {
    const region=window.__ocellusSmokeRegion,ctx=new OffscreenCanvas(152,152).getContext("2d");
    region.drawOcellusMinimap(ctx);
    const data=ctx.getImageData(0,0,152,152).data;
    let opaque=0;for(let i=3;i<data.length;i+=4)if(data[i]===255)opaque++;
    const player=region.player,boss=region.boss;
    const markerX=76+(boss.location.x+(boss.size-1)/2-player.location.x)*4;
    const markerY=76+(boss.location.y-(boss.size-1)/2-player.location.y)*4;
    return {opaque,center:Array.from(ctx.getImageData(76,76,1,1).data),
      marker:Array.from(ctx.getImageData(markerX,markerY,1,1).data),
      markerVisible:boss.dying===-1&&boss.currentStats.hitpoint>0&&region.getSnapshot().frame.tick>=8};
  })()`,returnByValue:true});
  if(mapProbe.result?.value?.opaque<1000||mapProbe.result?.value?.opaque>2500||mapProbe.result?.value?.center?.join(",")!=="255,255,255,255")throw Error("Native minimap draw mismatch: "+JSON.stringify(mapProbe.result?.value));
  const mapState=mapProbe.result?.value;
  if(mapState?.markerVisible&&mapState.marker?.join(",")!=="255,255,0,255"&&mapState.marker?.join(",")!=="255,255,255,255")throw Error("Native NPC marker not centred on its footprint: "+JSON.stringify(mapState));
  console.log("Native minimap painted: "+JSON.stringify(mapState));
  const rotatedMap=await call("Runtime.evaluate",{expression:`(() => {
    const region=window.__ocellusSmokeRegion;
    const ctx=new OffscreenCanvas(152,152).getContext("2d");
    const player=region.player,boss=region.boss;
    const x=(boss.location.x+(boss.size-1)/2-player.location.x)*4;
    const y=(boss.location.y-(boss.size-1)/2-player.location.y)*4;
    return [Math.PI/4,Math.PI/2,-Math.PI/4].map(angle=>{
      ctx.clearRect(0,0,152,152);
      region.drawOcellusMinimap(ctx,angle);
      const px=76+Math.round(x*Math.cos(angle)-y*Math.sin(angle));
      const py=76+Math.round(x*Math.sin(angle)+y*Math.cos(angle));
      const playerPixels=Array.from(ctx.getImageData(75,75,3,3).data);
      const bossPixels=Array.from(ctx.getImageData(px-1,py-1,3,3).data);
      const solid=(pixels,colour)=>pixels.every((v,i)=>v===colour[i%4]);
      return {angle,playerSolid:solid(playerPixels,[255,255,255,255]),
        bossSolid:solid(bossPixels,[255,255,0,255]),
        markerVisible:boss.dying===-1&&boss.currentStats.hitpoint>0&&region.getSnapshot().frame.tick>=8&&
          (Math.abs(px-76)>=3||Math.abs(py-76)>=3)};
    });
  })()`,returnByValue:true});
  const rotatedStates=rotatedMap.result?.value;
  if(!Array.isArray(rotatedStates)||rotatedStates.length!==3||rotatedStates.some(m=>!m.playerSolid||(m.markerVisible&&!m.bossSolid)))throw Error("Rotated minimap dots lost pixel alignment: "+JSON.stringify(rotatedStates));
  console.log("Native minimap rotation pixel checks: "+JSON.stringify(rotatedStates));
  const interpolatedMap=await call("Runtime.evaluate",{expression:`(() => {
    const region=window.__ocellusSmokeRegion,player=region.player,boss=region.boss;
    const ctx=new OffscreenCanvas(152,152).getContext("2d");
    const read=player.getPerceivedLocation;
    // One render-only sample. Never change the actual player location,
    // path, camera, or encounter state.
    const at={x:player.location.x+.25,y:player.location.y};
    try{
      player.getPerceivedLocation=()=>({...at,z:0});
      region.drawOcellusMinimap(ctx,0,true);
      const px=76+Math.round((boss.location.x+(boss.size-1)/2-at.x)*4);
      const py=76+Math.round((boss.location.y-(boss.size-1)/2-at.y)*4);
      return {player:Array.from(ctx.getImageData(76,76,1,1).data),
        marker:Array.from(ctx.getImageData(px,py,1,1).data),
        visible:boss.dying===-1&&boss.currentStats.hitpoint>0&&region.getSnapshot().frame.tick>=8&&(Math.abs(px-76)>=3||Math.abs(py-76)>=3)};
    }finally{player.getPerceivedLocation=read;}
  })()`,returnByValue:true});
  const fractional=interpolatedMap.result?.value;
  if(fractional?.player?.join(",")!=="255,255,255,255"||(fractional.visible&&fractional.marker.join(",")!=="255,255,0,255"))throw Error("Fractional minimap mismatch: "+JSON.stringify(fractional));
  console.log("Interpolated player minimap pixels verified: "+JSON.stringify(fractional));
  if (nativeFloorStatus !== 200) throw new Error("Original floor texture not loaded by Chromium: "+nativeFloorStatus);
  console.log("Original Ocellus floor texture loaded: "+floorProof.pixels+" pixels, "+floorProof.extendedPixels+" edge-extension pixels");
  // Read the actual generated textures in Chromium. The masked artwork
  // remains separate; every original opaque texel must match the 3D image.
  const samplingProof=await call("Runtime.evaluate",{expression:`(async()=>{
    const read=async name=>{
      const img=new Image();img.src=new URL("osrs-assets/textures/"+name,document.baseURI).href;await img.decode();
      const c=new OffscreenCanvas(img.naturalWidth,img.naturalHeight).getContext("2d");c.drawImage(img,0,0);
      return c.getImageData(0,0,img.naturalWidth,img.naturalHeight).data;
    };
    const [source,padded,upper,relief]=await Promise.all([read("ocellus-native-floor.png"),read("ocellus-native-floor-sampling.png"),read("ocellus-native-upper.png"),read("ocellus-native-relief.png")]);
    let original=0,added=0,mismatch=0,transparent=0,reliefPixels=0,reliefMismatch=0;
    for(let i=0;i<relief.length;i+=4){
      if(relief[i+3]===0)continue;
      reliefPixels++;
      if(relief[i+3]!==255||upper[i+3]!==255||relief[i]!==upper[i]||relief[i+1]!==upper[i+1]||relief[i+2]!==upper[i+2])reliefMismatch++;
    }
    for(let i=0;i<source.length;i+=4){
      if(padded[i+3]!==255)transparent++;
      if(source[i+3]===255){original++;if(source[i]!==padded[i]||source[i+1]!==padded[i+1]||source[i+2]!==padded[i+2])mismatch++;}
      else added++;
    }
    return {original,added,mismatch,transparent,reliefPixels,reliefMismatch};
  })()`,awaitPromise:true,returnByValue:true});
  const sampling=samplingProof.result?.value;
  if(sampling?.original!==floorProof.pixels||sampling.added!==floorProof.samplingPaddingPixels||sampling.mismatch!==0||sampling.transparent!==0||sampling.reliefPixels!==floorProof.relief.covered||sampling.reliefMismatch!==0)throw Error("Native floor/raised relief pixel proof failed: "+JSON.stringify(sampling));
  console.log("Native floor sampling verified: "+JSON.stringify(sampling));
  if(!Number.isInteger(floorProof.extendedPixels)||floorProof.extendedPixels>floorProof.pixels*.10)throw Error("Native floor edge reconstruction exceeds allowed coverage");
  if (nativeFoundationStatus !== 200) throw new Error("Native foundation was not loaded by Chromium: " + nativeFoundationStatus);
  console.log("Original Ocellus rock faces loaded: " + foundation.colors.length);
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
  const visualFrames = [];
  const recordVisualFrame=(file,requestedTick,observedTick,details={})=>{
    visualFrames.push({file,requestedTick,observedTick,...details});
    fs.writeFileSync("artifacts/ocellus-visual-frames.json",JSON.stringify({
      source:fs.existsSync("artifacts/ocellus-source-revision.txt")?fs.readFileSync("artifacts/ocellus-source-revision.txt","utf8").trim():null,
      frames:visualFrames
    },null,2)+"\n");
  };
  const captureStage=async(file,requestedTick,stage)=>{
    const read=async()=>(await call("Runtime.evaluate",{expression:`(() => {
      const r=window.__ocellusSmokeRegion,s=r.getSnapshot();
      return {tick:s.frame.tick,stage:s.frame.stage,player:{...r.player.location},orbs:s.orbs.filter(o=>!o.picked).map(o=>({tile:o.tile,void:o.void,mature:s.frame.tick>=o.maturesAt}))};
    })()`,returnByValue:true})).result?.value;
    const before=await read();
    if(before?.stage!==stage)throw Error("Expected visual phase "+stage+": "+JSON.stringify(before));
    const shot=await call("Page.captureScreenshot",{format:"png",captureBeyondViewport:false,fromSurface:true});
    if(!shot.data)throw Error("Missing visual phase screenshot "+file);
    const after=await read();
    const output=path.resolve("artifacts",file);
    fs.writeFileSync(output,Buffer.from(shot.data,"base64"));
    if(fs.statSync(output).size<20000)throw Error("Incomplete visual phase screenshot "+file);
    recordVisualFrame(file,requestedTick,before.tick,{stage,player:before.player,orbs:before.orbs,afterTick:after?.tick,afterStage:after?.stage});
    console.log("Ocellus phase evidence "+file+" "+JSON.stringify({before,after}));
  };
  const imagePath = path.resolve("artifacts/ocellus-first-mark.png");
  fs.writeFileSync(imagePath, Buffer.from(shot.data, "base64"));
  if (fs.statSync(imagePath).size < 20000)
    throw new Error("Ocellus WebGL visual evidence was unexpectedly small");
  recordVisualFrame("ocellus-first-mark.png",17,markTick);
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
  const materialProbe=await call("Runtime.evaluate",{expression:`(() => {
    const boss=window.__ocellusSmokeRegion.boss;
    const model=boss.animationChangeListener??boss.cachedModel;
    const effect=model?.spotAnims?.find(s=>[4328,4329,4330].includes(s.mesh.userData.spotAnimId));
    if(!effect)return null;
    const mesh=effect.mesh,geometry=mesh.geometry;
    const materials=Array.isArray(mesh.material)?mesh.material:[mesh.material];
    const textured=geometry.groups.filter(g=>materials[g.materialIndex]?.map);
    const opaque=geometry.groups.filter(g=>materials[g.materialIndex]?.transparent===false).reduce((n,g)=>n+g.count/3,0);
    let textureRuns=0,lastTexture;
    for(const g of geometry.groups){const texture=materials[g.materialIndex]?.map?.uuid??null;if(texture!==lastTexture){textureRuns++;lastTexture=texture;}}
    const alpha=geometry.getAttribute("color");
    const data=mesh.userData;
    const toLinear=v=>{v/=255;return v<=.04045?v/12.92:Math.pow((v+.055)/1.055,2.4);};
    let coreVertices=0,coreMismatch=0;
    for(let i=0;i<alpha.count;i++){
      if(data.cacheFaceColors[i]!==4||data.cacheTextureIds[i]>=0)continue;
      coreVertices++;
      const packed=data.cacheBaseColors[i];
      const expected=[toLinear(packed>>16&255),toLinear(packed>>8&255),toLinear(packed&255)];
      if(expected.some((value,c)=>Math.abs(value-alpha.array[i*4+c])>1e-6))coreMismatch++;
    }
    // Exercise the actual browser placement method against a separate
    // synthetic graphic. Do not change the live boss, camera or fight.
    const placement=[];
    const probe={channel:"ci-placement",mesh:{userData:{spotAnimId:7},position:{set(...args){placement.push(args)}},rotation:{}},height:0,rotation:0};
    const scale=model.root.scale.x;
    model.updateOcellusSpotPlacement.call({
      spotAnims:[probe],spotAnimPlacements:new Map([["ci-placement",{id:7,offset:{x:.5,y:-.25},height:.75}]]),
      root:{rotation:{y:Math.PI/2},scale:{x:scale,y:scale,z:scale}}
    });
    const p=placement[0]??[];
    const worldPlacement=p.length===3?[p[2]*scale,p[1]*scale,-p[0]*scale]:null;
    return {id:mesh.userData.spotAnimId,coreVertices,coreMismatch,scale,worldPlacement,textureTriangles:textured.reduce((n,g)=>n+g.count/3,0),
      drawRuns:geometry.groups.length,textureRuns,opaque,alphaTriangles:geometry.groups.reduce((n,g)=>n+g.count/3,0)-opaque,uvs:geometry.getAttribute("uv")?.count,
      depthPasses:geometry.groups.every(g=>{const m=materials[g.materialIndex];return !!m&&m.depthWrite===!m.transparent;}),
      vertices:geometry.getAttribute("position")?.count,alphaItemSize:alpha?.itemSize,
      textureSize:materials.find(m=>m.map)?.map?.image?.width,
      textureColorSpace:materials.find(m=>m.map)?.map?.colorSpace,
      textureWrapS:materials.find(m=>m.map)?.map?.wrapS,
      textureWrapT:materials.find(m=>m.map)?.map?.wrapT,
      culled:mesh.frustumCulled};
  })()`,returnByValue:true});
  const materialProof=materialProbe.result?.value;
  if(!materialProof||materialProof.coreVertices!==888||materialProof.coreMismatch!==0||materialProof.scale!==83/128||!materialProof.worldPlacement||materialProof.worldPlacement.some((v,i)=>Math.abs(v-[.5,.75,-.25][i])>1e-8)||materialProof.textureTriangles!==144||materialProof.textureRuns!==33||materialProof.drawRuns!==(materialProof.id===4330?80:126)||materialProof.opaque!==(materialProof.id===4330?642:1026)||materialProof.alphaTriangles!==1876-materialProof.opaque||materialProof.uvs!==5628||materialProof.vertices!==5628||materialProof.alphaItemSize!==4||materialProof.textureSize!==128||materialProof.textureColorSpace!=="srgb"||materialProof.textureWrapS!==1000||materialProof.textureWrapT!==1000||materialProof.culled!==false||!materialProof.depthPasses)
    throw Error("Native transition texture material not attached in browser: "+JSON.stringify(materialProof));
  console.log("Native transition material verified: "+JSON.stringify(materialProof));
  fs.writeFileSync(path.join("artifacts","ocellus-scenery","transition-material-proof.json"),JSON.stringify(materialProof,null,2)+"\n");
  const specialShot = await call("Page.captureScreenshot", {
    format: "png", captureBeyondViewport: false, fromSurface: true,
  });
  const specialPath = path.resolve("artifacts/ocellus-first-transition.png");
  if (!specialShot.data) throw new Error("Ocellus transition screenshot was empty");
  fs.writeFileSync(specialPath, Buffer.from(specialShot.data, "base64"));
  if (fs.statSync(specialPath).size < 20000)
    throw new Error("Ocellus transition screenshot was unexpectedly small");
  recordVisualFrame("ocellus-first-transition.png",33,transitionTick);
  console.log("Ocellus native transition visual frame captured at tick " +
    transitionTick + " (" + fs.statSync(specialPath).size + " bytes).");

  // Move the LOCAL browser-test player onto the north edge of the safe 5x5
  // ring before the outer orb is spawned at tick 43. From (5,3), either
  // furthest south-ring corner (3,7)/(7,7) is six Manhattan tiles away.
  // This is within the original frame sound's audible radius and does not
  // claim the fragment or move the boss. No live player is repositioned.
  const outerAudioFixture = await call("Runtime.evaluate", {
    expression: `(() => {
      const region = window.__ocellusSmokeRegion;
      const player = region?.player;
      if (!player || typeof player.setLocation !== "function")
        return { error: "SDK player positioning unavailable" };
      const at = { x: 5, y: 3 };
      player.setLocation(at);
      // The SDK keeps the previous path destination separate from location.
      // Without updating it, Player.moveTowardsDestination walks the
      // Chromium-only actor straight back to spawn before chimes play.
      player.destinationLocation = { ...at };
      player.pathTargetLocation = null;
      return { tick: region.getSnapshot().frame.tick,
        location: { ...player.location },
        destination: { ...player.destinationLocation } };
    })()`,
    returnByValue: true,
  });
  const outerAudioSetup = outerAudioFixture.result?.value;
  if (outerAudioSetup?.error ||
      outerAudioSetup?.location?.x !== 5 || outerAudioSetup?.location?.y !== 3 ||
      outerAudioSetup?.tick >= 43)
    throw new Error("Local outer-orb audio positioning failed: " +
      JSON.stringify(outerAudioSetup));
  console.log("Ocellus audio test player moved inside the safe ring for outer-orb chimes.");

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

  // Compare playback to the same native spotanim 4309 used by the reference.
  // Each orb plays one 9,922-frame starting chime followed by three
  // 12,127-frame chimes; the outer sequence is at about ticks 43–49.
  const outerPosition = await call("Runtime.evaluate", {
    expression: `(() => {
      const region = window.__ocellusSmokeRegion;
      const player = region?.player?.location;
      const orb = region?.sim?.snapshot()?.orbs?.find(
        (item) => item.void === "outer" && !item.picked);
      return {
        player, orb: orb?.tile ?? null,
        manhattan: player && orb
          ? Math.abs(player.x - orb.tile.x) + Math.abs(player.y - orb.tile.y)
          : null,
      };
    })()`,
    returnByValue: true,
  });
  const proximity = outerPosition.result?.value;
  console.log("OCELLUS_OUTER_AUDIO_PROXIMITY " + JSON.stringify(proximity));
  if (!proximity?.orb || proximity.manhattan > 7 || proximity.manhattan < 1)
    throw new Error("Outer audio playback was not proven within orb hearing range: " +
      JSON.stringify(proximity));
  const outerStartChimes = playingAt(9922, 42, 45);
  const outerFollowupChimes = playingAt(12127, 44, 51);
  if (outerStartChimes.length !== 1 || outerFollowupChimes.length < 3)
    throw new Error("In-range outer lifeforce orb did not play all four native chimes: " +
      JSON.stringify({ proximity, outerStartChimes, outerFollowupChimes, cues }));
  console.log("Ocellus original outer lifeforce orb chimes verified in-range: " +
    JSON.stringify({ tick: 43, player: proximity.player,
      orb: proximity.orb, distance: proximity.manhattan,
      starts: [...outerStartChimes, ...outerFollowupChimes] }));

  // Real SDK walking around the boss while the outer void is active.
  // The existing audio fixture already suppresses damage, but movement
  // and collision below are real; no position changes occur during the route.
  const routeArmed=await call("Runtime.evaluate",{
    expression:`(() => {
      const region=window.__ocellusSmokeRegion,player=region.player;
      const footprint=()=>region.entities.filter(e=>e.omitFromOcellus3d&&e.location.x>=4&&e.location.x<=6&&e.location.y>=4&&e.location.y<=6&&e.collisionType!==0).length;
      const state=region.getSnapshot(),start={...player.location};
      if(state.frame.tick<39||state.frame.tick>53||start.x!==5||start.y!==3||footprint()!==9)return {error:"wrong route start",tick:state.frame.tick,start,blocked:footprint()};
      const trace=window.__ocellusFootprintTrace={start,tick:state.frame.tick,steps:[],cleared:false};
      const stop=region.subscribe(()=>{
        const view=region.getSnapshot(),tick=view.frame.tick;
        if(!trace.steps.some(p=>p.tick===tick))trace.steps.push({tick,...player.location,blocked:footprint()});
        if(tick>=59){
          trace.cleared=footprint()===0;
          stop();
          // Restore the prior audio fixture's position for later rift captures.
          player.setLocation(start);player.destinationLocation={...start};player.pathTargetLocation=null;
        }
      });
      player.moveTo(5,7,"run-setting");
      player.running=true;
      return {armed:true};
    })()`,returnByValue:true
  });
  if(!routeArmed.result?.value?.armed)throw Error("Outer-void pathing setup failed: "+JSON.stringify(routeArmed.result?.value));
  await captureStage("ocellus-outer-void.png",51,"outer-void");
  const fragmentAtStart=await call("Runtime.evaluate",{expression:`(() => {
    const region=window.__ocellusSmokeRegion;
    const entity=region.entities.find(e=>e.layer==="outer-orb");
    const model=entity?.cachedModel,playing=model?.playing;
    if(!playing)return null;
    window.__ocellusOuterLoopProof={playing,slot:playing.slot,elapsed:playing.elapsed};
    const frame=playing.pool?.frames?.[playing.currentFrame];
    const draws=frame?[frame.mesh,...frame.textured].filter(m=>m.geometry.getIndex()?.count!==0):[];
    const expectedCount=frame?Math.max(0,...Array.from(frame.active,slot=>slot+1)):0;
    return {slot:playing.slot,elapsed:playing.elapsed,loop:playing.options?.ocellusLoop===true,key:model.instanceKey,
      drawCounts:draws.map(m=>m.count),expectedCount,normalAttributes:draws.filter(m=>m.geometry.getAttribute("normal")).length,warmClaim:playing.ocellusWarmClaim===true,
      alphaPasses:draws.map(m=>({triangles:m.geometry.getIndex().count/3,transparent:m.material.transparent,depthWrite:m.material.depthWrite})),
      sceneryPasses:region.entities.flatMap(entity=>{
        const m=entity.cachedModel,id=m?.reference?.modelId;
        if(![62440,62357,62739,62508].includes(id)||!m?.pool?.frames?.length)return [];
        const f=m.pool.frames[0];
        return [{id,height:entity.getPerceivedLocation().z,passes:[f.mesh,...f.textured].filter(mesh=>mesh.geometry.getIndex()?.count>0).map(mesh=>({triangles:mesh.geometry.getIndex().count/3,transparent:mesh.material.transparent,depthWrite:mesh.material.depthWrite}))}];
      })};
  })()`,returnByValue:true});
  const fragmentStart=fragmentAtStart.result?.value;
  if(!fragmentStart||!fragmentStart.loop||fragmentStart.slot<0||!Number.isFinite(fragmentStart.elapsed)||fragmentStart.elapsed<.64||!fragmentStart.drawCounts?.length||fragmentStart.drawCounts.some(n=>n!==fragmentStart.expectedCount)||fragmentStart.normalAttributes!==0||!fragmentStart.warmClaim)throw Error("Native outer fragment continuous loop not active: "+JSON.stringify(fragmentStart));
  const validPass=p=>Number.isInteger(p.triangles)&&p.triangles>0&&p.depthWrite===!p.transparent;
  if(!fragmentStart.alphaPasses?.length||!fragmentStart.alphaPasses.every(validPass)||
     ![62357,62739,62508].every(id=>fragmentStart.sceneryPasses?.some(s=>s.id===id&&s.passes.length>0&&s.passes.every(validPass))))
    throw Error("Native scenery/fragment alpha pass proof failed: "+JSON.stringify(fragmentStart));
  if(fragmentStart.sceneryPasses.some(s=>s.id===62440)||[62357,62739].some(id=>fragmentStart.sceneryPasses.find(s=>s.id===id)?.height!==.5))throw Error("Native censer assembly vertical placement failed");
  fs.writeFileSync(path.join("artifacts","ocellus-scenery","native-instanced-alpha-passes.json"),JSON.stringify({fragment:fragmentStart.alphaPasses,scenery:fragmentStart.sceneryPasses},null,2)+"\n");
  let route;
  for(let i=0;i<100;i++){
    await sleep(100);
    route=(await call("Runtime.evaluate",{expression:"window.__ocellusFootprintTrace",returnByValue:true})).result?.value;
    if(route?.cleared||runtimeErrors.length)break;
  }
  if(!route?.cleared||!route.steps.some(p=>p.tick<59&&(p.x===3||p.x===7))||
    !route.steps.some(p=>p.tick<59&&p.x===5&&p.y===7)||
    route.steps.some(p=>p.tick<59&&p.x>=4&&p.x<=6&&p.y>=4&&p.y<=6))
    throw Error("Outer-void SDK route crossed the blocked boss or failed to reach the other side: "+JSON.stringify(route));
  console.log("Outer-void boss footprint route verified: "+JSON.stringify(route));
  await captureStage("ocellus-after-outer.png",59,"after-outer");
  const fragmentAtEnd=await call("Runtime.evaluate",{expression:`(() => {
    const region=window.__ocellusSmokeRegion;
    const entity=region.entities.find(e=>e.layer==="outer-orb");
    const model=entity?.cachedModel,playing=model?.playing,prior=window.__ocellusOuterLoopProof;
    if(!playing||!prior)return null;
    const result={sameInstance:prior.playing===playing,sameSlot:prior.slot===playing.slot,
      elapsed:playing.elapsed,elapsedIncrease:playing.elapsed-prior.elapsed,
      loop:playing.options?.ocellusLoop===true,key:model.instanceKey};
    delete window.__ocellusOuterLoopProof;
    return result;
  })()`,returnByValue:true});
  const fragmentEnd=fragmentAtEnd.result?.value;
  if(!fragmentEnd?.sameInstance||!fragmentEnd.sameSlot||!fragmentEnd.loop||fragmentEnd.elapsedIncrease<.64||fragmentEnd.key!==fragmentStart.key)throw Error("Native fragment was recreated at its loop boundary: "+JSON.stringify(fragmentEnd));
  fs.writeFileSync(path.join("artifacts","ocellus-scenery","continuous-fragment-proof.json"),JSON.stringify({start:fragmentStart,end:fragmentEnd},null,2)+"\n");
  console.log("Native continuous fragment actor verified: "+JSON.stringify(fragmentEnd));

  // Follow the REAL simulation's first two rifts, not only the synthetic
  // 9001/9002 animation fixtures above. Instrument the SDK's native
  // playAnimation and the player's flare while preserving normal mechanics.
  // Killing one actual Rift at 70 allows the other to detonate at tick 97.
  const nativeRiftSetup = await call("Runtime.evaluate", {
    expression: `(() => {
      const region = window.__ocellusSmokeRegion;
      if (!region?.addMob || !region?.updateView || !region?.onUnitDeath || !region.player)
        return { error: "Live Rift instrumentation unavailable" };
      const probe = { mobs: [], animationEvents: [], deathEvents: [],
        snapshots: [], flareEvents: [], alphaFrames: [], killedFixture: false };
      window.__ocellusNativeRiftProbe = probe;
      const addMob = region.addMob.bind(region);
      region.addMob = (mob) => {
        if (Number.isInteger(mob?.riftId) && mob.riftId > 0 && mob.riftId < 9000) {
          probe.mobs.push(mob);
          const play = mob.playAnimation.bind(mob);
          mob.playAnimation = (id, ...args) => {
            probe.animationEvents.push({ id, rift: mob.riftId, tick: region.sim.current().tick, worldTick:region.world.globalTickCounter,dying:mob.dying });
            return play(id, ...args);
          };
        }
        return addMob(mob);
      };
      const onDeath = region.onUnitDeath.bind(region);
      region.onUnitDeath = (mob) => {
        if (probe.mobs.includes(mob))
          probe.deathEvents.push({ rift: mob.riftId, tick: region.sim.current().tick,worldTick:region.world.globalTickCounter,dying:mob.dying });
        return onDeath(mob);
      };
      const originalFlare = region.player.addSpotAnim.bind(region.player);
      region.player.addSpotAnim = (effect) => {
        if (effect.id === 4306)
          probe.flareEvents.push({ tick: region.sim.current().tick, id: effect.id });
        return originalFlare(effect);
      };
      const update = region.updateView.bind(region);
      region.updateView = (...args) => {
        const result = update(...args);
        const tick = region.getSnapshot().frame.tick;
        if ([67, 68, 69, 70, 71, 72, 82, 96, 97, 98, 99].includes(tick)
            && !probe.snapshots.some(entry => entry.tick === tick)) {
          probe.snapshots.push({
            tick, alive: region.sim.snapshot().rifts.map(r => r.id),
            mobs: probe.mobs.map(mob => ({ id: mob.riftId, dying: mob.dying,
              hp: mob.currentStats.hitpoint, spawnedAt: mob.spawnedAt,
              charge: Math.max(0, Math.min(1, (tick - mob.spawnedAt) / 30)) })),
          });
        }
        if (tick === 70 && !probe.killedFixture) {
          const rift = probe.mobs.find(mob => mob.dying === -1 && mob.currentStats.hitpoint > 0);
          if (rift) {
            probe.killedFixture = true;
            probe.killedId = rift.riftId;
            // The normal SDK death detector processes this on its next turn.
            rift.currentStats.hitpoint = 0;
          }
        }
        return result;
      };
      // Sample material groups after native pose updates, on the actual
      // WebGL actor rather than assuming a cached sequence changed opacity.
      const sample=()=>{
        const tick=region.getSnapshot().frame.tick;
        if(tick>100||window.__ocellusSmokeRegion!==region)return;
        if(tick>=67){
          for(const mob of probe.mobs){
            if(mob.dying===0)continue;
            const model=mob.animationChangeListener??mob.cachedModel;
            const mesh=model?.mesh,geometry=mesh?.geometry,index=geometry?.getIndex(),alpha=geometry?.getAttribute("cacheAlpha");
            if(!mesh||!index||!alpha)continue;
            const material=Array.isArray(mesh.material)?mesh.material:[mesh.material];
            const groups=geometry.groups.length?geometry.groups:[{start:0,count:index.count,materialIndex:0}];
            let opaque=0,translucent=0,mismatch=0;
            for(const group of groups){
              const m=material[group.materialIndex??0];
              for(let i=group.start;i<group.start+group.count;i+=3){
                const solid=[index.getX(i),index.getX(i+1),index.getX(i+2)].every(v=>alpha.getX(v)===1);
                if(solid)opaque++;else translucent++;
                if(m?.transparent===solid||m?.depthWrite!==solid)mismatch++;
              }
            }
            const frame={tick,rift:mob.riftId,partitioned:typeof mesh.userData.ocellusRiftAlphaMaterial==="number",opaque,translucent,mismatch,triangles:index.count/3};
            const previous=probe.alphaFrames[probe.alphaFrames.length-1];
            if(!previous||JSON.stringify(previous)!==JSON.stringify(frame))probe.alphaFrames.push(frame);
          }
        }
        requestAnimationFrame(sample);
      };
      requestAnimationFrame(sample);
      return { installedAt: region.getSnapshot().frame.tick };
    })()`,
    returnByValue: true,
  });
  if (nativeRiftSetup.result?.value?.error ||
      nativeRiftSetup.result?.value?.installedAt >= 67)
    throw new Error("Native Rift tracking was not armed before the spawn: " +
      JSON.stringify(nativeRiftSetup.result?.value));

  // Evidence frames cover spawn, half-charge and detonation. An exact
  // tick-by-tick mechanical trace is captured in the region itself above,
  // independent of screenshot frame scheduling on software-rendered Chromium.
  for (const target of [68, 82, 97]) {
    let observedTick = 0;
    for (let attempt = 0; attempt < 190; attempt++) {
      const current = await call("Runtime.evaluate", {
        expression: 'window.__ocellusSmokeRegion?.getSnapshot()?.frame?.tick ?? 0',
        returnByValue: true,
      });
      observedTick = current.result?.value ?? 0;
      if (observedTick >= target || runtimeErrors.length) break;
      await sleep(135);
    }
    if (observedTick < target || observedTick > target + 2 || runtimeErrors.length)
      throw new Error("Native Rift evidence frame missed tick " + target + ": " +
        JSON.stringify({ observedTick, errors: runtimeErrors.slice(-3) }));
    const frameShot = await call("Page.captureScreenshot", {
      format: "png", captureBeyondViewport: false, fromSurface: true,
    });
    const imagePath = path.resolve("artifacts/ocellus-rift-tick-" + target + ".png");
    if (!frameShot.data) throw new Error("Rift screenshot missing at tick " + target);
    fs.writeFileSync(imagePath, Buffer.from(frameShot.data, "base64"));
    if (fs.statSync(imagePath).size < 20000)
      throw new Error("Rift screenshot unexpectedly small at tick " + target);
    recordVisualFrame("ocellus-rift-tick-"+target+".png",target,observedTick);
    console.log("Ocellus native Rift visual evidence requested at " + target +
      " and captured near tick " + observedTick);
  }
  let finalRiftTick = 0;
  for (let attempt = 0; attempt < 45; attempt++) {
    const value = await call("Runtime.evaluate", {
      expression: 'window.__ocellusSmokeRegion?.getSnapshot()?.frame?.tick ?? 0',
      returnByValue: true,
    });
    finalRiftTick = value.result?.value ?? 0;
    if (finalRiftTick >= 99 || runtimeErrors.length) break;
    await sleep(120);
  }
  if (finalRiftTick < 99 || runtimeErrors.length)
    throw new Error("Rift test never reached the end of native detonation: " +
      JSON.stringify({ finalRiftTick, errors: runtimeErrors.slice(-3) }));
  await sleep(180);
  const nativeRiftTrace = await call("Runtime.evaluate", {
    expression: `JSON.stringify({
      snapshots: window.__ocellusNativeRiftProbe?.snapshots ?? [],
      animations: window.__ocellusNativeRiftProbe?.animationEvents ?? [],
      deaths: window.__ocellusNativeRiftProbe?.deathEvents ?? [],
      flares: window.__ocellusNativeRiftProbe?.flareEvents ?? [],
      alphaFrames: window.__ocellusNativeRiftProbe?.alphaFrames ?? [],
      killed: window.__ocellusNativeRiftProbe?.killedId ?? null,
      sounds: (window.__ocellusSoundStarts ?? [])
        .filter(entry => entry.hz === 22050 &&
          [7717, 11025, 14332, 26460].includes(entry.frames) &&
          entry.tick >= 66)
        .map(entry => ({ tick: entry.tick, frames: entry.frames, state: entry.state })),
    })`,
    returnByValue: true,
  });
  const nativeRifts = JSON.parse(nativeRiftTrace.result?.value ?? "{}");
  console.log("OCELLUS_REAL_RIFT_TRACE " + JSON.stringify(nativeRifts));
  const at = (tick) => nativeRifts.snapshots?.find(s => s.tick === tick);
  const anim = (id, tick) => nativeRifts.animations?.filter(a => a.id === id && a.tick === tick) ?? [];
  if (at(67)?.alive.length !== 2 || anim(14896, 67).length !== 2)
    throw new Error("Two native 14896 Rifts were not spawned at tick 67");
  if (!nativeRifts.killed || !nativeRifts.deaths?.some(d => d.rift === nativeRifts.killed))
    throw new Error("Killing a living Rift did not call the native NPC death detector");
  const killedAnim = nativeRifts.animations?.find(a =>
    a.rift === nativeRifts.killed && a.id === 14897);
  const killEvent=nativeRifts.deaths?.find(d=>d.rift===nativeRifts.killed);
  if(!killedAnim||!killEvent||killedAnim.tick<70||killedAnim.tick>72||killedAnim.worldTick!==killEvent.worldTick||killEvent.dying!==1)
    throw Error("Native Rift despawn did not start on its death-detection tick: "+JSON.stringify({killedAnim,killEvent}));
  const partitioned=nativeRifts.alphaFrames?.filter(f=>f.partitioned)??[];
  // If the asset contains textures the guarded renderer falls back to
  // original materials. Record that explicitly, rather than claim a split.
  if(partitioned.some(f=>f.mismatch!==0||f.opaque+f.translucent!==f.triangles||f.triangles!==333))
    throw Error("Native Rift opacity groups do not match the posed mesh");
  fs.writeFileSync(path.join("artifacts","ocellus-scenery","native-rift-alpha.json"),JSON.stringify({partitioned:partitioned.length>0,frames:nativeRifts.alphaFrames,killEvent,killedAnim},null,2)+"\n");
  if (at(82)?.alive.length !== 1 ||
      at(82).mobs.find(m => m.id !== nativeRifts.killed)?.charge < 0.49 ||
      at(82).mobs.find(m => m.id !== nativeRifts.killed)?.charge > 0.51)
    throw new Error("Surviving Rift charge bar was not half full at tick 82");
  if (at(96)?.alive.length !== 1 ||
      at(96).mobs.find(m => m.id !== nativeRifts.killed)?.charge < 0.96)
    throw new Error("Surviving Rift charge bar was not nearly full at tick 96");
  if (anim(14898, 97).length !== 1 || at(97)?.alive.length !== 0 ||
      nativeRifts.flares?.filter(f => f.tick === 97).length !== 1)
    throw new Error("Rift detonation did not trigger one native 14898 and flare 4306 at tick 97");
  for (const [frames, first, last] of [
    [7717, 67, 69], [11025, 70, 73], [14332, 97, 99], [26460, 97, 100],
  ]) {
    if (!nativeRifts.sounds?.some(s => s.frames === frames && s.state === "running"
      && s.tick >= first && s.tick <= last))
      throw new Error("Native Rift animation frame sound missing: " +
        JSON.stringify({ frames, first, last, sounds: nativeRifts.sounds }));
  }
  console.log("Ocellus authentic Rift cycle confirmed: two spawn at 67, " +
    "one plays despawn 14897, survivor reaches half charge at 82, " +
    "then detonation 14898 + native 4306 at 97 with all four frame sounds.");

  // The NPC-action log distinguishes native animation calls from static
  // sequence metadata. The WebAudio trace verifies that the 4-tick native
  // landing 14865 reaches its embedded frame sounds before the transition
  // animation 14844 starts, on BOTH the first and second void clear.
  const bossTraceResult = await call("Runtime.evaluate", {
    expression: `JSON.stringify({
      actions: window.__ocellusBossAnimationProbe?.actions ?? [],
      poses: window.__ocellusBossAnimationProbe?.poses ?? [],
      renderedPoses:window.__ocellusBossAnimationProbe?.renderedPoses??[],
      sounds: (window.__ocellusSoundStarts ?? [])
        .filter(s => s.hz === 22050 && [19845, 33075, 22050].includes(s.frames)
          && s.tick !== null && s.tick <= 94)
        .map(s => ({ tick: s.tick, frames: s.frames, state: s.state })),
    })`,
    returnByValue: true,
  });
  const bossTrace = JSON.parse(bossTraceResult.result?.value ?? "{}");
  console.log("OCELLUS_NATIVE_BOSS_ANIMATION_TRACE " + JSON.stringify(bossTrace));
  const expectsAction = (id, tick) => bossTrace.actions?.some(a =>
    a.animation === id && a.tick === tick);
  for (const [id, tick] of [
    [14863, 8], [14855, 11], [14865, 29], [14844, 32],
    [14855, 42], [14844, 60],
    [14863, 68], [14855, 71], [14865, 89], [14844, 92],
  ]) {
    if (!expectsAction(id, tick))
      throw new Error("Original Ocellus animation absent or off-tick: " +
        JSON.stringify({ id, tick, actions: bossTrace.actions }));
  }
  const poseAt = tick => bossTrace.poses?.find(p => p.tick === tick);
  for (const tick of [8, 10, 15, 28, 29, 68, 70, 71, 88, 89]) {
    if (poseAt(tick)?.idle !== 14864)
      throw new Error("Native hover loop 14864 absent at tick " + tick + ": " +
        JSON.stringify(poseAt(tick)));
  }
  for (const tick of [4, 7, 30, 32, 39, 42, 60, 90, 92]) {
    if (poseAt(tick)?.idle !== 14840 || poseAt(tick)?.visible !== true)
      throw new Error("Original idle pose/visibility incorrect at tick " + tick + ": " +
        JSON.stringify(poseAt(tick)));
  }
  if (poseAt(3)?.visible !== false)
    throw new Error("Ocellus model was visible before the lead-in finished: " +
      JSON.stringify(poseAt(3)));
  for (const start of [29, 89]) {
    const soundAt = (frames, from, to) => bossTrace.sounds?.filter(s =>
      s.frames === frames && s.state === "running" &&
      s.tick >= from && s.tick <= to) ?? [];
    const first = soundAt(19845, start, start + 1);
    const second = soundAt(33075, start, start + 2);
    const lastTwo = soundAt(22050, start + 1, start + 4);
    if (first.length < 1 || second.length < 1 || lastTwo.length < 2)
      throw new Error("Original 14865 landing frame-sound sequence incomplete: " +
        JSON.stringify({ start, first, second, lastTwo, sounds: bossTrace.sounds }));
  }
  const rendered=bossTrace.renderedPoses??[];
  if(!rendered.length||rendered.some(p=>!p.finite||p.scale!==83/128||p.vertices!==14373||![p.base,p.lo,p.hi,p.age].every(Number.isFinite)||p.lo>p.hi))
    throw Error("Native boss rendered pose geometry invalid");
  fs.writeFileSync(path.join("artifacts","ocellus-scenery","native-boss-pose-heights.json"),JSON.stringify(rendered,null,2)+"\n");
  console.log("Ocellus NPC 16677 animation timeline verified: first and second " +
    "rise, hover, lifeforce, landing, transition, and both native four-cue landings.");

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
      const deathTiming={started:null,finished:null};
      const sample=()=>({worldTick:region.world.globalTickCounter,clientTick:region.world.clientTickCounter,dying:boss.dying});
      const original = boss.playAnimation.bind(boss);
      boss.playAnimation = (id, ...args) => {
        played.push(id);
        if(id===14872&&deathTiming.started===null)deathTiming.started=sample();
        return original(id, ...args);
      };
      const originalPostTick=region.postTick.bind(region);
      region.postTick=()=>{
        originalPostTick();
        if(region.getSnapshot().result==="won"&&deathTiming.finished===null)deathTiming.finished=sample();
      };
      window.__ocellusSmokeDeathTiming=deathTiming;
      window.__ocellusSmokeBossAnimations = played;
      boss.currentStats.hitpoint = 0;
      return true;
    })()`,
    returnByValue: true,
  });
  if (!armed.result?.value) throw new Error("Local-only NPC death regression harness missing");
  let observedNativeDeath = false;
  let victoryReached = false;
  let deathTimingProof=null;
  const deathCaptures=new Set();
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
          timing:window.__ocellusSmokeDeathTiming,
          dying:boss?.dying,
          worldTick:region?.world.globalTickCounter,
        });
      })()`,
      returnByValue: true,
    });
    const current = JSON.parse(probe.result?.value ?? "{}");
    const originalEffects = [4274, 4275, 4276].every((id) => current.effects?.includes(id));
    if (current.dead && current.anim && originalEffects) observedNativeDeath = true;
    if(current.timing?.started&&!current.won&&current.dying>0){
      const elapsed=current.worldTick-current.timing.started.worldTick;
      const phase=elapsed<=2?"start":elapsed>=6&&elapsed<=9?"middle":elapsed>=12?"end":null;
      if(phase&&!deathCaptures.has(phase)){
        const shot=await call("Page.captureScreenshot",{format:"png",captureBeyondViewport:false,fromSurface:true});
        fs.writeFileSync(path.join("artifacts","ocellus-scenery","native-death-"+phase+".png"),Buffer.from(shot.data,"base64"));
        deathCaptures.add(phase);
      }
    }
    if (current.won) {
      victoryReached = true;
      deathTimingProof=current.timing;
      break;
    }
    if (runtimeErrors.length) break;
  }
  if (!observedNativeDeath || !victoryReached || runtimeErrors.length)
    throw new Error("Ocellus native death sequence or victory failed: " +
      JSON.stringify({ observedNativeDeath, victoryReached,
        runtimeErrors: runtimeErrors.slice(-5) }));
  const deathStart=deathTimingProof?.started,deathEnd=deathTimingProof?.finished;
  if(!deathStart||!deathEnd||deathStart.dying!==15||deathEnd.dying!==0||deathEnd.worldTick-deathStart.worldTick!==15)
    throw Error("Native death animation ended before its 15 elapsed world ticks: "+JSON.stringify(deathTimingProof));
  fs.writeFileSync(path.join("artifacts","ocellus-scenery","native-death-timing.json"),JSON.stringify({...deathTimingProof,captures:[...deathCaptures]},null,2)+"\n");
  console.log("Ocellus NPC death validated: animation 14872, cache effects 4274/4275/4276, full 15 elapsed world ticks, and victory.");
  // Inspect the real completed attempt, not a fabricated result panel.
  const resultLayout=await call("Runtime.evaluate",{expression:`(() => {
    const panel=document.querySelector("#ocellus_reset .trainer-reset-panel");
    const header=panel?.querySelector(".ocellus-result-header");
    const body=panel?.querySelector(".ocellus-result-body");
    const footer=panel?.querySelector(".ocellus-result-footer");
    const button=footer?.querySelector("button");
    if(!panel||!header||!body||!footer||!button)return null;
    const rect=e=>{const r=e.getBoundingClientRect();return {top:r.top,bottom:r.bottom,width:r.width,height:r.height};};
    const before=rect(button);
    body.scrollTop=body.scrollHeight;
    const after=rect(button),scrolled=body.scrollTop;
    body.scrollTop=0;
    return {panel:rect(panel),header:rect(header),body:rect(body),footer:rect(footer),
      before,after,scrolled,overflow:getComputedStyle(body).overflowY,scrollHeight:body.scrollHeight};
  })()`,returnByValue:true});
  const resultPanel=resultLayout.result?.value;
  if(!resultPanel||resultPanel.overflow!=="auto"||resultPanel.body.height<=0||resultPanel.header.bottom>resultPanel.body.top+1||resultPanel.body.bottom>resultPanel.footer.top+1||
     resultPanel.before.top!==resultPanel.after.top||resultPanel.after.bottom>resultPanel.panel.bottom+1)
    throw Error("Attempt result header/footer layout mismatch: "+JSON.stringify(resultPanel));
  fs.writeFileSync(path.join("artifacts","ocellus-scenery","attempt-layout-proof.json"),JSON.stringify(resultPanel,null,2)+"\n");
  const resultShot=await call("Page.captureScreenshot",{format:"png",captureBeyondViewport:false,fromSurface:true});
  fs.writeFileSync(path.join("artifacts","ocellus-attempt-results.png"),Buffer.from(resultShot.data,"base64"));
  console.log("Attempt layout and fixed reset control verified: "+JSON.stringify(resultPanel));

  // The completed attempt's world is stopped. Exercise the real SDK hit
  // queue on its local-only player, not a simulated HP arithmetic helper.
  const recovery = await call("Runtime.evaluate", {
    expression: `(() => {
      const region = window.__ocellusSmokeRegion;
      const player = region?.player;
      if (!player || typeof player.processIncomingAttacks !== "function"
          || typeof player.restoreHitpoints !== "function")
        return { error: "Native health queue unavailable" };
      const apply = Object.getPrototypeOf(region).applyEffect.bind(region);
      player.incomingProjectiles = [];
      player.currentStats.hitpoint = 90;
      apply({kind:"heal",amount:49,reason:"Lifeforce returned"});
      player.processIncomingAttacks();
      const overheal = player.currentStats.hitpoint;
      const greenHit = player.hitsThisTick.some(h => h.damage === -49);
      player.currentStats.hitpoint = 95;
      player.restoreHitpoints(20);
      const normalHeal = player.currentStats.hitpoint;
      player.currentStats.hitpoint = 10;
      apply({kind:"heal",amount:49,reason:"Lifeforce returned"});
      apply({kind:"damage",amount:35,reason:"Smoke test combined health queue"});
      player.processIncomingAttacks();
      return {overheal,greenHit,normalHeal,combined:player.currentStats.hitpoint};
    })()`,
    returnByValue: true,
  });
  const health = recovery.result?.value;
  if (health?.overheal !== 139 || health.greenHit !== true ||
      health.normalHeal !== 99 || health.combined !== 24)
    throw new Error("Native lifeforce/ordinary healing queue mismatch: " + JSON.stringify(health));
  console.log("Actual SDK health queue verified: 90+49=139, ordinary healing caps at 99, heal+damage lands in order.");

  // Real result-panel Reset must create a fresh attempt and reuse the
  // decoded native geometry. CI remains explicitly deterministic.
  const beforeReset = await call("Runtime.evaluate", {
    expression: `(() => {
      const region=window.__ocellusSmokeRegion,button=document.querySelector(".trainer-reset-button");
      if (!region || !button) return null;
      window.__ocellusPreviousPlayer=region.player;
      button.click();
      return {seed:region.sim.seed};
    })()`,
    returnByValue: true,
  });
  if (beforeReset.result?.value?.seed !== 42)
    throw new Error("Result reset did not use the fixed CI seed");
  let resetState;
  for (let i=0;i<40;i++) {
    await sleep(100);
    const probe=await call("Runtime.evaluate",{
      expression:`(() => {
        const region=window.__ocellusSmokeRegion,state=region?.getSnapshot();
        return {fresh:region?.player!==window.__ocellusPreviousPlayer,result:state?.result,
          tick:state?.frame.tick,playerHp:state?.playerHp,bossHp:state?.bossHp,
          counters:state?.stats,screen:!!document.querySelector("#ocellus_reset"),
          labels:document.querySelector(".ocellus-attempt-status")?.textContent??""};
      })()`,returnByValue:true,
    });
    resetState=probe.result?.value;
    if(resetState?.fresh&&!resetState.screen&&resetState.result===null)break;
  }
  if(!resetState?.fresh||resetState.screen||resetState.result!==null||
      resetState.tick>7||resetState.playerHp!==99||resetState.bossHp!==1313||
      Object.values(resetState.counters??{}).some(v=>v!==0)||
      !resetState.labels.includes("Explosions dodged0/0")||
      !resetState.labels.includes("Specials defended0/0")||
      !resetState.labels.includes("Fragments collected0/0")||
      !resetState.labels.includes("Speed-bonus dodges0/0"))
    throw new Error("Attempt reset failed to clear the previous encounter: "+JSON.stringify(resetState));
  for(const name of ["ocellus-native-foundation.json","ocellus-native-curb.json","ocellus-native-flat-floor.json","ocellus-flood.png","ocellus-native-minimap.png"])
    if(nativeGeometryRequests.get(name)!==1)
      throw new Error("Reset fetched the immutable arena asset again: "+name);
  if(runtimeErrors.length)throw new Error("Runtime error after reset: "+JSON.stringify(runtimeErrors.slice(-5)));
  console.log("Actual result-screen reset verified: new player, clean stats, fixed CI seed, cached native geometry.");
  // Use the newly reset player and restore the real methods after the
  // earlier diagnostic fixtures. No health edits, teleports or damage masks.
  const movementArmed=await call("Runtime.evaluate",{
    expression:`(() => {
      const region=window.__ocellusSmokeRegion;
      for(const method of ["applyEffect","updateView","addMob","onUnitDeath"])delete region[method];
      const player=region.player;
      const trace=window.__ocellusMovementTrace={start:region.getSnapshot().frame.tick,mark:null,impact:null};
      if(trace.start>=17)return false;
      const stop=region.subscribe(()=>{
        const view=region.getSnapshot();
        if(!trace.mark&&view.frame.tick===17&&view.marks.length){
          const tile=view.marks[0].tile;
          trace.mark={x:tile.x,y:tile.y};
          player.moveTo(tile.x+1,tile.y,"walk");
        }
        if(trace.mark&&view.frame.tick===18){
          trace.impact={tile:{...player.location},dodged:view.stats.explosionsDodged,bonus:view.stats.speedBonusDodges,damage:view.stats.explosionDamage};
          stop();
        }
      });
      return true;
    })()`,returnByValue:true
  });
  if(movementArmed.result?.value!==true)throw Error("Could not arm normal-input movement regression");
  let movement;
  for(let attempt=0;attempt<180;attempt++){
    await sleep(100);
    const read=await call("Runtime.evaluate",{expression:"window.__ocellusMovementTrace",returnByValue:true});
    movement=read.result?.value;
    if(movement?.impact||runtimeErrors.length)break;
  }
  if(!movement?.mark||!movement?.impact||movement.impact.tile.x!==movement.mark.x+1||movement.impact.tile.y!==movement.mark.y||movement.impact.dodged!==1||movement.impact.bonus!==1||movement.impact.damage!==0||runtimeErrors.length)
    throw Error("Normal-input one-tile dodge failed: "+JSON.stringify({movement,errors:runtimeErrors.slice(-3)}));
  console.log("Normal-input one-tick dodge verified: "+JSON.stringify(movement));
  const actorProof=await call("Runtime.evaluate",{expression:`(() => {
    const region=window.__ocellusSmokeRegion;
    const describe=unit=>{
      const model=unit.animationChangeListener??unit.cachedModel,mesh=model?.mesh;
      const materials=Array.isArray(mesh?.material)?mesh.material:mesh?[mesh.material]:[];
      const groups=mesh?.geometry.groups??[];
      return {positions:mesh?.geometry.getAttribute("position")?.count,culled:mesh?.frustumCulled,
        materialRuns:groups.length,opaqueTriangles:groups.filter(g=>materials[g.materialIndex]?.transparent===false).reduce((n,g)=>n+g.count/3,0),
        translucentTriangles:groups.filter(g=>materials[g.materialIndex]?.transparent===true).reduce((n,g)=>n+g.count/3,0),
        depthWrite:materials.map(m=>m.depthWrite),
        generation:model?.modelGeneration,meshGeneration:model?.meshGeneration,
        animation:model?.activeAnimation,hasAnimation:!!model?.animations?.[String(model.activeAnimation)]};
    };
    return {boss:describe(region.boss),player:describe(region.player)};
  })()`,returnByValue:true});
  const actorState=actorProof.result?.value;
  if(actorState?.boss?.positions!==14373||!actorState?.player?.positions||[actorState.boss,actorState.player].some(a=>a.culled!==false||a.generation!==a.meshGeneration||!a.hasAnimation))throw Error("Live posed actor proof failed: "+JSON.stringify(actorState));
  if(actorState.boss.opaqueTriangles!==4645||actorState.boss.translucentTriangles!==146||actorState.boss.materialRuns!==3||actorState.boss.depthWrite.join(",")!=="true,false")throw Error("Native boss alpha pass proof failed: "+JSON.stringify(actorState.boss));
  if(actorState.player.opaqueTriangles<=0||actorState.player.translucentTriangles<=0||
     (actorState.player.opaqueTriangles+actorState.player.translucentTriangles)*3!==actorState.player.positions||
     actorState.player.depthWrite.join(",")!=="true,true")throw Error("Native player alpha pass proof failed: "+JSON.stringify(actorState.player));
  fs.writeFileSync(path.join("artifacts","ocellus-scenery","live-posed-actors.json"),JSON.stringify(actorState,null,2)+"\n");
  console.log("Live posed boss and player geometry verified: "+JSON.stringify(actorState));

  // A successful reset notification precedes the first render. Measure
  // after the live dodge instead of the transient empty WebGL reset frame.
  const performanceProbe=await call("Runtime.evaluate",{
    expression:`(() => {
      const region=window.__ocellusSmokeRegion;
      const entities=region.entities;
      return {warmup:window.__ocellusWarmup??null,logicalTiles:entities.filter(e=>e.omitFromOcellus3d===true).length,
        visibleEntities:entities.filter(e=>e.omitFromOcellus3d!==true).length,
        metrics:window.__ocellusViewportMetrics??null};
    })()`,returnByValue:true,
  });
  const perf=performanceProbe.result?.value;
  if(perf?.logicalTiles!==182||!perf.metrics||perf.metrics.actors>=182||!Number.isFinite(perf.metrics.calls)||perf.metrics.calls<=0)throw new Error("No-op tile actor reduction failed: "+JSON.stringify(perf));
  if(perf.metrics.abyss!=="000000"||perf.metrics.finiteAbyss||perf.metrics.innerVoid&&perf.metrics.outerVoid)
    throw Error("Arena background or void visibility regression: "+JSON.stringify(perf.metrics));
  const rims=perf.metrics.rims;
  if(rims?.length!==2||rims[0].vertices!==1080||rims[1].vertices<=1080||
     rims.some(r=>r.channels!==4||r.colour!=="b660dc"||r.alphaEdge!==1||r.alphaFade!==0||!r.normalBlend||r.depthWrite))
    throw Error("Native void rim blend proof failed: "+JSON.stringify(rims));
  const scenery=perf.metrics.scenery;
  const backdrop=JSON.parse(fs.readFileSync(path.join(root,"osrs-assets/ocellus-native-backdrop.json"),"utf8"));
  const surrounding=JSON.parse(fs.readFileSync(path.join(root,"osrs-assets/ocellus-native-surrounding.json"),"utf8"));
  if(surrounding.models?.join(",")!=="62249,62250"||surrounding.sources?.length!==2||surrounding.sources.some(s=>s.retainedFaces<=0))throw Error("Native surrounding scenery extraction missing");
  const expectedScenery=[
    ["ocellus-native-backdrop",backdrop.positions.length/9,true],
    ["ocellus-native-surrounding",surrounding.positions.length/9,true],
    ["ocellus-native-rock-foundation",foundation.colors.length,true],
    ["ocellus-native-curb",curb.colors.length,true],
    ["ocellus-native-stone-floor",168,false],
    ["ocellus-native-flat-floor",flatFloor.colors.length,true],
    ["ocellus-recessed-cliff-backing",null,true],
  ];
  if(scenery?.length!==expectedScenery.length||expectedScenery.some(([name,triangles,coloured])=>{
    const mesh=scenery.find(item=>item.name===name);
    return !mesh||!mesh.finite||mesh.visible!==(name!=="ocellus-native-stone-floor")||!Number.isInteger(mesh.triangles)||mesh.triangles<=0||
      (triangles!==null&&mesh.triangles!==triangles)||(coloured?mesh.colourVertices!==mesh.vertices:mesh.colourVertices!==0)||
      mesh.side!==(["ocellus-native-backdrop","ocellus-native-surrounding","ocellus-native-rock-foundation","ocellus-native-curb","ocellus-native-flat-floor"].includes(name)?0:2);
  }))throw Error("Native runtime scenery geometry proof failed: "+JSON.stringify(scenery));
  fs.writeFileSync(path.join("artifacts","ocellus-scenery","native-runtime-scenery.json"),JSON.stringify(scenery,null,2)+"\n");
  if(!perf.warmup?.arena||perf.warmup.roots<1||perf.warmup.textures<2)throw Error("Native arena/effect shader and texture warmup missing: "+JSON.stringify(perf.warmup));
  const groundTextures=perf.metrics.groundTextures;
  const floorTexture=groundTextures?.find(t=>t.name==="ocellus-native-stone-floor"),voidTexture=groundTextures?.find(t=>t.name==="ocellus-inner-void");
  if(!floorTexture||!voidTexture||groundTextures.length!==2||groundTextures.some(t=>t.colourSpace!=="srgb")||floorTexture.anisotropy!==4||floorTexture.magFilter!==1006||voidTexture.anisotropy!==1||voidTexture.magFilter!==1003||floorTexture.minFilter!==1005||voidTexture.minFilter!==1005||floorTexture.width!==896||floorTexture.height!==832||voidTexture.width!==128||voidTexture.height!==128)
    throw Error("Native terrain sampling proof failed: "+JSON.stringify(groundTextures));
  fs.writeFileSync(path.join("artifacts","ocellus-scenery","native-ground-textures.json"),JSON.stringify(groundTextures,null,2)+"\n");
  fs.writeFileSync(path.join("artifacts","ocellus-scenery","ocellus-viewport-metrics.json"),JSON.stringify(perf,null,2)+"\n");
  console.log("Ocellus viewport actor reduction: "+JSON.stringify(perf));
  // Read-only native camera evidence after the existing normal-input dodge.
  // Focal interpolation legitimately lags the exact player target.
  const camera=perf.metrics.camera;
  if(!camera||![camera.focusX,camera.focusY,camera.targetX,camera.targetY,camera.yaw,camera.pitch,camera.distance,camera.canvasWidth,camera.canvasHeight].every(Number.isFinite)||
     Math.abs(camera.focusX-camera.targetX)>2||Math.abs(camera.focusY-camera.targetY)>2||camera.canvasWidth<=0||camera.canvasHeight<=0)
    throw Error("Player-follow camera diagnostic failed: "+JSON.stringify(camera));
  const projection=camera.projection;
  if(!projection||![projection.fov,projection.near,projection.far,projection.scalePixels,projection.focalPixel?.x,projection.focalPixel?.y,
    projection.playerRoot?.x,projection.playerRoot?.y,projection.playerRoot?.z,projection.playerPixel?.x,projection.playerPixel?.y].every(Number.isFinite)||
    projection.near!==50/128||Math.abs(projection.scalePixels-camera.canvasHeight/(2*Math.tan(projection.fov*Math.PI/360)))>1e-6||
    Math.abs(projection.focalPixel.x-Math.floor(camera.canvasWidth/2))>1||
    Math.abs(projection.focalPixel.y-Math.floor(camera.canvasHeight/2+(projection.viewOffsetY??0)))>1||
    (projection.floorPick&&(projection.floorPick.x!==projection.floorTile?.x||projection.floorPick.y!==projection.floorTile?.y)))
    throw Error("Player-follow projection/picking diagnostic failed: "+JSON.stringify(projection));
  fs.writeFileSync(path.join("artifacts","ocellus-scenery","player-camera-proof.json"),JSON.stringify(camera,null,2)+"\n");
  const cameraShot=await call("Page.captureScreenshot",{format:"png",captureBeyondViewport:false,fromSurface:true});
  fs.writeFileSync(path.join("artifacts","ocellus-player-follow.png"),Buffer.from(cameraShot.data,"base64"));
  console.log("Native player-follow camera evidence: "+JSON.stringify(camera));

  // Use real SDK inventory actions at the very end of the smoke run,
  // after every deterministic encounter and camera assertion has passed.
  // No gameplay state is changed by this diagnostic before those checks.
  const equipmentProof=[];
  const readEquipment=async()=>(await call("Runtime.evaluate",{expression:`(() => {
    const p=window.__ocellusSmokeRegion.player,m=p.animationChangeListener??p.cachedModel;
    const mesh=m?.mesh,materials=Array.isArray(mesh?.material)?mesh.material:mesh?[mesh.material]:[];
    const groups=mesh?.geometry.groups??[];
    const weapon=p.equipment.weapon,pose=p.animationIndex;
    return {weapon:weapon?.cacheItemId,loadout:m?.reference?.loadout,positions:mesh?.geometry.getAttribute("position")?.count,
      generation:m?.modelGeneration,meshGeneration:m?.meshGeneration,animation:m?.activeAnimation,
      pose,expectedPose:m?.poseMap?.[String(pose)]??pose,hasAnimation:!!m?.animations?.[String(m.activeAnimation)],
      opaque:groups.filter(g=>materials[g.materialIndex]?.transparent===false).reduce((n,g)=>n+g.count/3,0),
      alpha:groups.filter(g=>materials[g.materialIndex]?.transparent===true).reduce((n,g)=>n+g.count/3,0),
      visible:mesh?.visible,logicalHeight:m?.getLogicalHeight?.()};
  })()`,returnByValue:true})).result?.value;
  const swaps=[
    {id:22325,vertices:11424,opaque:2984,alpha:824,name:"scythe"},
    {id:12926,vertices:9495,opaque:2984,alpha:181,name:"blowpipe"},
    {id:20997,vertices:10200,opaque:2984,alpha:416,name:"bow"},
  ];
  for(const wanted of swaps){
    const previous=await readEquipment();
    const switched=await call("Runtime.evaluate",{expression:`(() => {
      const p=window.__ocellusSmokeRegion.player;
      const item=p.inventory.find(i=>i?.cacheItemId===${wanted.id});
      if(!item||typeof item.inventoryLeftClick!=="function")return false;
      item.inventoryLeftClick(p);
      return p.equipment.weapon?.cacheItemId===${wanted.id};
    })()`,returnByValue:true});
    if(switched.result?.value!==true)throw Error("Native weapon switch input failed: "+wanted.id);
    let current;
    for(let retry=0;retry<80;retry++){
      await sleep(50);current=await readEquipment();
      if(runtimeErrors.length)break;
      if(current?.weapon===wanted.id&&current.loadout?.includes(wanted.id)&&
         !current.loadout?.includes(previous.weapon)&&current.generation===current.meshGeneration&&
         current.positions===wanted.vertices&&current.hasAnimation&&current.animation===current.expectedPose)break;
    }
    if(current?.weapon!==wanted.id||!current.loadout?.includes(wanted.id)||current.loadout?.includes(previous.weapon)||
       current.generation!==current.meshGeneration||current.positions!==wanted.vertices||
       current.opaque!==wanted.opaque||current.alpha!==wanted.alpha||!current.visible||
       !current.hasAnimation||current.animation!==current.expectedPose||!(current.logicalHeight>0)||runtimeErrors.length)
      throw Error("Native equipped mesh did not settle: "+JSON.stringify({wanted,current,errors:runtimeErrors.slice(-3)}));
    equipmentProof.push({wanted,previous:previous.weapon,...current});
    const shot=await call("Page.captureScreenshot",{format:"png",captureBeyondViewport:false,fromSurface:true});
    fs.writeFileSync(path.join("artifacts","ocellus-weapon-"+wanted.name+".png"),Buffer.from(shot.data,"base64"));
  }
  fs.writeFileSync(path.join("artifacts","ocellus-scenery","native-weapon-switches.json"),JSON.stringify(equipmentProof,null,2)+"\n");
  console.log("Native inventory weapon switches and poses verified: "+JSON.stringify(equipmentProof));

  // Resize and DPR verification after the deterministic encounter tests.
  const baselineViewport=(await call("Runtime.evaluate",{expression:"({width:innerWidth,height:innerHeight,dpr:devicePixelRatio})",returnByValue:true})).result?.value;
  if(!baselineViewport?.width||!baselineViewport?.height)throw Error("Missing initial viewport size");
  const viewportProof=[];
  for(const requested of [{width:1024,height:720,deviceScaleFactor:1},{width:1120,height:760,deviceScaleFactor:2}]){
    await call("Emulation.setDeviceMetricsOverride",{...requested,mobile:false});
    let actual;
    for(let retry=0;retry<50;retry++){
      await sleep(100);
      const probe=await call("Runtime.evaluate",{expression:`(() => {
        const hud=document.querySelector("#world"),gl=hud?.previousElementSibling;
        if(!hud||!gl)return null;
        const describe=c=>{const r=c.getBoundingClientRect();return {width:c.width,height:c.height,boxWidth:r.width,boxHeight:r.height,left:r.left,top:r.top}};
        return {dpr:devicePixelRatio,innerWidth,innerHeight,hud:describe(hud),gl:describe(gl),
          camera:window.__ocellusViewportMetrics?.camera};
      })()`,returnByValue:true});
      actual=probe.result?.value;
      if(actual?.dpr===requested.deviceScaleFactor&&actual.innerWidth===requested.width&&actual.innerHeight===requested.height&&
         actual.gl.width===Math.round(actual.gl.boxWidth)&&actual.gl.height===Math.round(actual.gl.boxHeight)&&
         actual.hud.width===actual.gl.width&&actual.hud.height===actual.gl.height&&
         actual.camera?.canvasWidth===actual.gl.width&&actual.camera?.canvasHeight===actual.gl.height)break;
    }
    if(!actual||actual.dpr!==requested.deviceScaleFactor||actual.innerWidth!==requested.width||actual.innerHeight!==requested.height||
       actual.gl.width!==Math.round(actual.gl.boxWidth)||actual.gl.height!==Math.round(actual.gl.boxHeight)||
       actual.hud.width!==actual.gl.width||actual.hud.height!==actual.gl.height||
       Math.abs(actual.hud.left-actual.gl.left)>1||Math.abs(actual.hud.top-actual.gl.top)>1||
       actual.camera?.canvasWidth!==actual.gl.width||actual.camera?.canvasHeight!==actual.gl.height||
       Math.abs(actual.camera.focusX-actual.camera.targetX)>2||Math.abs(actual.camera.focusY-actual.camera.targetY)>2||runtimeErrors.length)
       throw Error("Native viewport resize/DPR mismatch: "+JSON.stringify({requested,actual,errors:runtimeErrors.slice(-3)}));
    viewportProof.push({requested,actual});
    const shot=await call("Page.captureScreenshot",{format:"png",captureBeyondViewport:false,fromSurface:true});
    fs.writeFileSync(path.join("artifacts","ocellus-viewport-dpr-"+requested.deviceScaleFactor+".png"),Buffer.from(shot.data,"base64"));
  }
  fs.writeFileSync(path.join("artifacts","ocellus-scenery","native-viewport-resize.json"),JSON.stringify(viewportProof,null,2)+"\n");
  await call("Emulation.clearDeviceMetricsOverride",{});
  // Wait for BOTH native canvas dimensions and metrics from the resized
  // frame. Software WebGL may render far below 5 FPS on the CI runner.
  const readCamera=async()=>(await call("Runtime.evaluate",{expression:`(() => {
    const hud=document.querySelector("#world"),r=hud?.getBoundingClientRect();
    const camera=window.__ocellusViewportMetrics?.camera;
    return {camera,width:innerWidth,height:innerHeight,dpr:devicePixelRatio,
      canvasWidth:r?.width,canvasHeight:r?.height};
  })()`,returnByValue:true})).result?.value;
  const awaitCamera=async(predicate,label)=>{
    let actual;
    for(let retry=0;retry<80;retry++){
      actual=await readCamera();
      const c=actual?.camera;
      if(c&&actual.width===baselineViewport.width&&actual.height===baselineViewport.height&&actual.dpr===baselineViewport.dpr&&
         c.canvasWidth===Math.round(actual.canvasWidth)&&c.canvasHeight===Math.round(actual.canvasHeight)&&predicate(c))return c;
      await sleep(100);
    }
    throw Error("Native camera did not settle: "+label+" "+JSON.stringify(actual));
  };
  console.log("Native viewport resize and high-DPI alignment verified: "+JSON.stringify(viewportProof));

  // Dispatch once per step: never retry the input itself, only observe
  // its result after the next completed render at the correct size.
  const zoomProbe=async(deltaY,expected,ctrlKey=false)=>{
    await call("Runtime.evaluate",{expression:`(() => {
      const canvas=document.querySelector("#world"),r=canvas.getBoundingClientRect();
      canvas.dispatchEvent(new WheelEvent("wheel",{deltaY:${deltaY},deltaMode:0,ctrlKey:${ctrlKey},clientX:r.left+r.width/2,clientY:r.top+r.height/2,cancelable:true}));
    })()`,returnByValue:true});
    await call("Runtime.evaluate",{expression:"new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))",awaitPromise:true,returnByValue:true});
    return awaitCamera(c=>Math.abs(c.distance-expected)<1e-6,"wheel "+deltaY);
  };
  const zoomBefore=await awaitCamera(()=>true,"restored viewport");
  const far=await zoomProbe(10000,20),near=await zoomProbe(-10000,2),reverse=await zoomProbe(100,2.5),shortcut=await zoomProbe(1000,2.5,true);
  if([far,near,reverse,shortcut].some(c=>Math.abs(c.focusX-c.targetX)>2||Math.abs(c.focusY-c.targetY)>2||c.pitch!==zoomBefore.pitch||c.yaw!==zoomBefore.yaw))
    throw Error("Native zoom clamp/player-follow proof failed: "+JSON.stringify({zoomBefore,far,near,reverse,shortcut}));
  const restored=await zoomProbe((zoomBefore.distance-reverse.distance)/.005,zoomBefore.distance);
  fs.writeFileSync(path.join("artifacts","ocellus-scenery","native-camera-zoom.json"),JSON.stringify({zoomBefore,far,near,reverse,shortcut,restored},null,2)+"\n");
  // Capture the native scenery from four sides of the player, using the
  // real touch rotation handler instead of modifying the camera's target.
  // This is evidence for geometry review, not a claimed in-game match.
  const angularDistance=(a,b)=>Math.abs(Math.atan2(Math.sin(a-b),Math.cos(a-b)));
  const orbitBy=async(delta)=>{
    const before=await awaitCamera(()=>true,"before scenery orbit");
    await call("Runtime.evaluate",{expression:`(() => {
      const canvas=document.querySelector("#world"),r=canvas.getBoundingClientRect();
      const x=r.left+r.width/2,y=r.top+r.height/2;
      const makeTouch=(clientX)=>new Touch({identifier:773,target:canvas,clientX,clientY:y,pageX:clientX,pageY:y});
      const fire=(type,touches)=>canvas.dispatchEvent(new TouchEvent(type,{touches,targetTouches:touches,changedTouches:touches,bubbles:true,cancelable:true}));
      fire("touchstart",[makeTouch(x)]);
      fire("touchmove",[makeTouch(x-(${delta})/.012)]);
      fire("touchend",[]);
    })()`,returnByValue:true});
    return awaitCamera(c=>angularDistance(c.yaw,before.yaw+delta)<.025,"scenery orbit "+delta);
  };
  // The end-of-attempt overlay is verified earlier. Hide it only on this
  // local test page during capture; keep the underlying game state intact.
  await call("Runtime.evaluate",{expression:`(() => {const overlay=document.querySelector("#ocellus_reset");if(overlay)overlay.style.visibility="hidden";})()`,returnByValue:true});
  const orbitProof=[];
  const orbitStart=restored.yaw;
  for(let i=0;i<4;i++){
    const camera=i===0?restored:await orbitBy(Math.PI/2);
    if(angularDistance(camera.yaw,orbitStart+i*Math.PI/2)>.08||
       Math.abs(camera.focusX-camera.targetX)>2||Math.abs(camera.focusY-camera.targetY)>2||
       Math.abs(camera.pitch-restored.pitch)>1e-6||Math.abs(camera.distance-restored.distance)>1e-6)
      throw Error("Native scenery orbit did not retain player tracking: "+JSON.stringify(camera));
    const filename="native-orbit-"+i+".png";
    const shot=await call("Page.captureScreenshot",{format:"png",captureBeyondViewport:false,fromSurface:true});
    fs.writeFileSync(path.join("artifacts","ocellus-scenery",filename),Buffer.from(shot.data,"base64"));
    orbitProof.push({filename,camera});
  }
  const orbitRestored=await orbitBy(Math.PI/2);
  if(angularDistance(orbitRestored.yaw,orbitStart)>.08)throw Error("Native scenery orbit did not return to initial yaw");
  fs.writeFileSync(path.join("artifacts","ocellus-scenery","native-orbit-proof.json"),JSON.stringify({views:orbitProof,restored:orbitRestored},null,2)+"\n");
  console.log("Native scenery captured at four player-relative camera angles.");
  // Last diagnostic: exercise actual attached graphics on the loaded player,
  // after the encounter, equipment, camera and resize assertions have passed.
  const channelResult=await call("Runtime.evaluate",{expression:`(() => {
    const player=window.__ocellusSmokeRegion?.player,m=player?.animationChangeListener??player?.cachedModel;
    if(!m||typeof m.updateOcellusSpotPlacement!=="function")return {error:"missing native actor model"};
    const channelA="ocellus-ci-graphic-a",channelB="ocellus-ci-graphic-b";
    const find=channel=>m.spotAnims.find(spot=>spot.channel===channel);
    const describe=spot=>spot?{
      id:spot.mesh.userData.spotAnimId,channel:spot.channel,
      height:spot.mesh.position.y*m.root.scale.y,
      vertices:spot.mesh.geometry.getAttribute("position")?.count,
      frameCount:spot.animation?.lengths?.length
    }:null;
    let proof;
    try{
      player.addSpotAnim({id:4314,channel:channelA,height:.25,offset:{x:.5,y:0}});
      player.addSpotAnim({id:4314,channel:channelB,height:.5,offset:{x:-.5,y:0}});
      m.updateOcellusSpotPlacement();
      const a=find(channelA),b=find(channelB);
      if(!a||!b)return {error:"missing independent native meshes"};
      const initial=[describe(a),describe(b)],distinct=a.mesh!==b.mesh;
      player.addSpotAnim({id:4314,channel:channelA,height:.75});
      m.updateOcellusSpotPlacement();
      const replaced=[describe(find(channelA)),describe(find(channelB))];
      const retained=find(channelA)===a&&find(channelB)===b;
      player.clearSpotAnim(channelA);
      const siblingRetained=!find(channelA)&&find(channelB)===b;
      proof={initial,replaced,distinct,retained,siblingRetained};
    }finally{
      player.clearSpotAnim(channelA);player.clearSpotAnim(channelB);
    }
    return {...proof,cleared:!find(channelA)&&!find(channelB)};
  })()`,returnByValue:true});
  const channelProof=channelResult.result?.value;
  const validGraphic=graphic=>graphic?.id===4314&&graphic.vertices>0&&graphic.frameCount>0;
  if(!channelProof?.distinct||!channelProof.retained||!channelProof.siblingRetained||!channelProof.cleared||
     !channelProof.initial?.every(validGraphic)||!channelProof.replaced?.every(validGraphic)||
     Math.abs(channelProof.initial[0].height-.25)>1e-8||Math.abs(channelProof.initial[1].height-.5)>1e-8||
     Math.abs(channelProof.replaced[0].height-.75)>1e-8||Math.abs(channelProof.replaced[1].height-.5)>1e-8)
    throw Error("Native attached graphic channel proof failed: "+JSON.stringify(channelProof));
  fs.writeFileSync(path.join("artifacts","ocellus-scenery","native-attached-channels.json"),JSON.stringify(channelProof,null,2)+"\n");
  // Reproduce the portrait layout from the reported iPhone screenshot.
  // Use the existing Controls button rather than altering SDK settings.
  await call("Emulation.setDeviceMetricsOverride",{width:390,height:720,deviceScaleFactor:2,mobile:false});
  await call("Runtime.evaluate",{expression:`(() => {
    const toggle=document.querySelector(".trainer-sidebar-toggle");
    if(toggle?.getAttribute("aria-expanded")==="true")toggle.click();
  })()`,returnByValue:true});
  let portrait;
  for(let retry=0;retry<80;retry++){
    portrait=await readCamera();
    const camera=portrait?.camera,projection=camera?.projection;
    if(portrait?.width===390&&portrait?.height===720&&camera?.canvasWidth>=380&&camera?.canvasHeight>=700&&
       projection?.fov>95&&projection.viewOffsetY>=85&&projection.viewOffsetY<=87&&Math.abs(projection.focalPixel.y-Math.floor(camera.canvasHeight/2+projection.viewOffsetY))<=1)break;
    await sleep(100);
  }
  if(!portrait?.camera||portrait.width!==390||portrait.camera.canvasWidth<380||portrait.camera.projection?.fov<=95||
    portrait.camera.projection?.viewOffsetY<85||portrait.camera.projection?.viewOffsetY>87||
    Math.abs(portrait.camera.focusX-portrait.camera.targetX)>2||Math.abs(portrait.camera.focusY-portrait.camera.targetY)>2)
    throw Error("Portrait camera framing proof failed: "+JSON.stringify(portrait));
  await call("Runtime.evaluate",{expression:`(() => {const overlay=document.querySelector("#ocellus_reset");if(overlay)overlay.style.visibility="hidden";})()`,returnByValue:true});
  const portraitShot=await call("Page.captureScreenshot",{format:"png",captureBeyondViewport:false,fromSurface:true});
  fs.writeFileSync(path.join("artifacts","ocellus-scenery","native-portrait-390x720.png"),Buffer.from(portraitShot.data,"base64"));
  fs.writeFileSync(path.join("artifacts","ocellus-scenery","native-portrait-proof.json"),JSON.stringify(portrait,null,2)+"\n");
  console.log("Native portrait camera framing verified: "+JSON.stringify(portrait));
  // A fresh portrait fight supplies comparable captures with the player camera
  // and actual fight active. The earlier portrait resize uses a finished run.
  await call("Page.reload",{ignoreCache:false});
  for(const [tick,stage] of [[12,"inner-void"],[34,"after-inner"],[44,"outer-void"]]){
    let sample;
    for(let retry=0;retry<450;retry++){
      const observed=await call("Runtime.evaluate",{expression:`(() => {
        const region=window.__ocellusSmokeRegion,metrics=window.__ocellusViewportMetrics;
        if(!region?.player||!metrics)return null;
        // Keep this unattended screenshot fixture alive through the outer flood.
        // No actions or visuals are injected into the production encounter.
        region.player.currentStats.hitpoint=99;
        const toggle=document.querySelector(".trainer-sidebar-toggle");
        if(toggle?.getAttribute("aria-expanded")==="true")toggle.click();
        const {tick,stage}=region.getSnapshot().frame;
        return {tick,stage,width:metrics.camera.canvasWidth,yaw:metrics.camera.yaw,pitch:metrics.camera.pitch};
      })()`,returnByValue:true});
      sample=observed.result?.value;
      if(sample?.tick>=tick&&sample.width>=380)break;
      await sleep(200);
    }
    if(sample?.stage!==stage||Math.abs(Math.cos(sample.yaw-(Math.PI+.36))-1)>.001||
       Math.abs(sample.pitch+52*Math.PI/180)>.01)throw Error("Portrait fight camera mismatch: "+JSON.stringify(sample));
    await captureStage("ocellus-scenery/portrait-"+stage+".png",tick,stage);
  }
  console.log("Ocellus browser smoke check passed: 3D scene, native assets, first hit, void mark and boss death.");
} finally {
  connection?.close();
  chrome.kill("SIGTERM");
  await new Promise((resolve) => server.close(resolve));
}
