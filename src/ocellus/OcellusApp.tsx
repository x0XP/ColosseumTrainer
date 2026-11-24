import React, { useEffect, useRef, useState, useSyncExternalStore } from "react";
import {
  CacheRender, ControlPanelController, Settings, SoundCache, TrainerInstance,
} from "osrs-sdk";
import type { TrainerLoadingState } from "osrs-sdk";
import {
  AdvancedSettingsPanel, GameOverlay, LoadoutManager,
  TrainerApp, TrainerLoadingSplash,
} from "osrs-sdk-react";
import { OcellusRegion, primeOcellusPrayerIcons } from "./OcellusRegion";
import { MAX_HP, STARTING_HP, bossOverheadAt } from "./Phase4Rules";
import { enhanceLoadout } from "../ui/loadoutInteractions";
import { readOcellusAudio, saveOcellusAudio } from "./OcellusAudio";
import { attemptMetrics, formatAttemptTime, damageBreakdown, attemptPercentage } from "./OcellusAttempt";

declare const __OSRS_CACHE_RENDER_MANIFEST_URL__: string;
const OCELLUS_LOADOUT = {
  name: "Ocellus / Ranged",
  equipment: {
    weapon: 20997, offhand: null,
    helmet: 27235, necklace: 33639, cape: 28951,
    ammo: 11212, chest: 27238, legs: 27241,
    feet: 31097, gloves: 26235, ring: 28310,
  },
  inventory: [
    22325, 12926, 12695, 2444,
    6685, 6685, 6685, 6685,
    6685, 6685, 3024, 3024,
    6685, 6685, 3024, 3024,
    6685, 6685, 3024, 3024,
    6685, 6685, 6685, 3024,
    6685, 6685, 3024, 3024,
  ],
};

function createTrainer() {
  CacheRender.configure(
    __OSRS_CACHE_RENDER_MANIFEST_URL__
      || new URL("osrs-assets/manifest.json", window.location.href).href,
  );
  primeOcellusPrayerIcons();
  Settings.readFromStorage();
  // This encounter requires original cache models and 3D spotanims.
  // Do not inherit a saved 2D camera from Sol's shared SDK storage.
  // Apply only for this trainer session: preserve the Sol user's settings.
  Settings.use3dView = true;
  Settings.rotated = "north";
  // Audio is session-local in the SDK: Ocellus preferences use their own key
  // rather than writing to Sol's shared osrs-sdk:settings storage.
  const audio = readOcellusAudio(window.localStorage);
  Settings.playsAudio = audio.effects;
  Settings.playsAreaAudio = audio.area;
  Settings.notifyChanged();
  // Local Chromium regression harness ONLY. The production trainer uses a
  // new random seed for each attempt, including resets.
  const ci = window.location.hostname === "127.0.0.1"
      && window.location.search === "?ocellus-ci=1";
  const region = new OcellusRegion([OCELLUS_LOADOUT], ci ? 42 : undefined);
  if (ci) {
    (window as Window & { __ocellusSmokeRegion?: OcellusRegion }).__ocellusSmokeRegion = region;
  }
  return new TrainerInstance(region, { readyTimer: 5 });
}

function SidebarToggle() {
  const visible = useSyncExternalStore(Settings.subscribe, () => Settings.getSnapshot().menuVisible);
  return (
    <button className="trainer-sidebar-toggle" type="button" aria-expanded={visible}
      aria-controls="right_panel" onClick={() => {
        Settings.setMenuVisible(!visible);
        Settings.persistToStorage();
      }}>{visible ? "Hide controls" : "Controls"}</button>
  );
}

function OcellusSidebar({ region, openLoadout, openAdvanced }: {
  region: OcellusRegion; openLoadout: () => void; openAdvanced: () => void;
}) {
  const visible = useSyncExternalStore(Settings.subscribe, () => Settings.getSnapshot().menuVisible);
  const state = useSyncExternalStore(region.subscribe, region.getSnapshot);
  const audio = useSyncExternalStore(Settings.subscribe, Settings.getSnapshot);
  const updateAudio = (patch: { effects?: boolean; area?: boolean }) => {
    const next = {
      effects: patch.effects ?? Settings.playsAudio,
      area: patch.area ?? Settings.playsAreaAudio,
    };
    Settings.playsAudio = next.effects;
    Settings.playsAreaAudio = next.area;
    Settings.notifyChanged();
    saveOcellusAudio(window.localStorage, next);
  };
  const stage = state.frame.stage.replace("-", " ");
  return (
    <aside id="right_panel" className="trainer-sidebar-shell ocellus-sidebar-shell"
      style={{ display: visible ? "flex" : "none",
        flexDirection: "column", height: "100%", overflowY: "auto", minWidth: 0 }}>
      <div className="trainer-sidebar-panel">
        <div className="trainer-sidebar-content">
          <header className="trainer-sidebar-heading">
            <span className="trainer-eyebrow">THE FRACTURED ARCHIVE</span>
            <strong>Ocellus</strong>
            <small>Phase 4 trainer · experimental</small>
          </header>
          <section className="trainer-control-section" aria-label="Encounter information">
            <h3>Encounter</h3>
            <div className="ocellus-fight-status">
              <span>Current stage</span><strong>{stage}</strong>
              <span>Boss overhead</span><strong>{bossOverheadAt(state.frame)}</strong>
              <span>Cycle</span><strong>{state.frame.cycle || "Intro"}</strong>
              <span>Game tick</span><strong>{state.frame.tick}</strong>
              <span>Ocellus HP</span><strong>{state.bossHp.toLocaleString()} / {MAX_HP.toLocaleString()}</strong>
              <span>Your HP</span><strong>{state.playerHp}</strong>
            </div>
            {state.tell && <p className="ocellus-attack-tell" role="status">{state.tell}</p>}
          </section>
          <section className="trainer-control-section ocellus-live-attempt" aria-label="Current attempt performance">
            <h3>Attempt performance</h3>
            <div className="ocellus-attempt-status">
              {attemptMetrics(state.stats).map(({label,good,total}) => {
                const percentage=attemptPercentage(good,total);
                return <React.Fragment key={label}>
                  <span>{label}</span><strong>{good}/{total}</strong>
                  {percentage!==null&&<div className="ocellus-live-track" aria-hidden="true"><span style={{width:percentage+"%"}}/></div>}
                </React.Fragment>;
              })}
              <span>Lifeforce returned</span><strong>{state.stats.returned}/{state.stats.drained} HP</strong>
              <span>Mechanic damage</span><strong>{state.stats.damageTaken}</strong>
            </div>
          </section>
          <section className="trainer-control-section" aria-label="Loadout and settings">
            <h3>Tools</h3>
            <button type="button" className="trainer-menu-button" onClick={openLoadout}>Loadout</button>
            <button type="button" className="trainer-menu-button"
              onClick={() => ControlPanelController.controller.setActiveControl("SETTINGS")}>Settings & keybinds</button>
            <button type="button" className="trainer-menu-button" onClick={openAdvanced}>Advanced settings</button>
          </section>
          <section className="trainer-control-section" aria-label="Audio controls">
            <h3>Sound</h3>
            <label className="ocellus-audio-row" htmlFor="ocellus-sound-effects">
              <span>Sound effects</span>
              <input id="ocellus-sound-effects" type="checkbox"
                checked={audio.playsAudio} onChange={(event) =>
                  updateAudio({ effects: event.currentTarget.checked })} />
            </label>
            <label className="ocellus-audio-row" htmlFor="ocellus-area-sounds">
              <span>Area sounds</span>
              <input id="ocellus-area-sounds" type="checkbox"
                checked={audio.playsAreaAudio} onChange={(event) =>
                  updateAudio({ area: event.currentTarget.checked })} />
            </label>
          </section>
          <section className="trainer-control-section" aria-label="Phase 4 explanation">
            <h3>Phase 4 practice</h3>
            <p>Stay outside the purple centre during the inner void, then move inside when the outer floor floods.</p>
            <p>Recover your turquoise lifeforce orb and step off the purple explosion mark before it detonates. Switch the correct prayer for each special.</p>
            <p className="ocellus-caveat">Deflect Melee and Deflect Range now block matching hits based on the prayer active when you fire. Reflected damage remains unimplemented because its amount is unverified. All timings remain provisional.</p>
          </section>
        </div>
      </div>
    </aside>
  );
}

function OcellusGameChat({ region }: { region: OcellusRegion }) {
  const state = useSyncExternalStore(region.subscribe, region.getSnapshot);
  const chatRef=useRef<HTMLDivElement>(null);
  useEffect(()=>{
    const chat=chatRef.current;
    if(chat)chat.scrollTop=chat.scrollHeight;
  },[state.chat]);
  if (state.chat.length === 0) return null;
  return (
    <div ref={chatRef} id="game_chat" className="ocellus-game-chat" role="log"
      aria-label="Ocellus game messages" aria-live="polite">
      {state.chat.map((line) =>
        <div key={line.id} className="ocellus-game-chat-line">{line.text}</div>)}
    </div>
  );
}

function AttemptResults({ region, reset }: { region: OcellusRegion; reset: () => void }) {
  const state = useSyncExternalStore(region.subscribe, region.getSnapshot);
  const resetRef=useRef<HTMLButtonElement>(null);
  useEffect(()=>{if(state.result)resetRef.current?.focus({preventScroll:true});},[state.result]);
  if (!state.result) return null;
  const stats = state.stats;
  const attempts = attemptMetrics(stats);
  const time = formatAttemptTime(state.frame.tick);
  return (
    <div className="trainer-reset-backdrop" id="ocellus_reset">
      <div className="trainer-reset-panel" role="group" aria-label="Ocellus attempt ended">
        <header className="ocellus-result-header">
          <span className="trainer-eyebrow">THE FRACTURED ARCHIVE</span>
          <strong>{state.result === "won" ? "Ocellus defeated" : "Fight over"}</strong>
          <p>Phase 4 attempt breakdown</p>
        </header>
        <div className="ocellus-result-body" tabIndex={0} aria-label="Scrollable attempt breakdown">
        <dl className="trainer-attempt-grid">
          <div><dt>Game time</dt><dd>{time}</dd></div>
          <div><dt>Ocellus HP</dt><dd>{state.bossHp.toLocaleString()} / {MAX_HP.toLocaleString()}</dd></div>
          <div><dt>Cycles reached</dt><dd>{state.stats.cycles}</dd></div>
        </dl>
        <section className="trainer-attempt-attacks" aria-label="Mechanics defended">
          <h3>Mechanics defended</h3>
          <dl>
            {attempts.map(({label, good, total: all}) => {
              const percentage = attemptPercentage(good,all);
              return (
                <div className="trainer-defence-row" key={label}>
                  <div className="trainer-defence-heading">
                    <dt>{label}</dt>
                    <dd>{good} / {all}{percentage === null ? "" : " · " + percentage + "%"}</dd>
                  </div>
                  {percentage !== null && <div className="trainer-defence-track" aria-hidden="true"><span style={{ width: percentage + "%" }}/></div>}
                </div>
              );
            })}
          </dl>
        </section>
        <section className="trainer-attempt-attacks ocellus-damage-breakdown" aria-label="Mechanic damage breakdown">
          <h3>Damage breakdown · {stats.damageTaken} HP</h3>
          <dl>
            {damageBreakdown(stats).filter(({amount})=>amount>0).map(({label,amount})=>(
              <div className="trainer-defence-row" key={label}>
                <div className="trainer-defence-heading"><dt>{label}</dt><dd>{amount} HP</dd></div>
                <div className="trainer-defence-track" aria-hidden="true"><span style={{width:(attemptPercentage(amount,stats.damageTaken)??0)+"%"}}/></div>
              </div>
            ))}
            {stats.damageTaken===0&&<div className="ocellus-result-note">No mechanic damage taken.</div>}
          </dl>
        </section>
        <div className="ocellus-recovery-summary">
          <div><span>Lifeforce recovered</span><strong>{stats.returned} / {stats.drained} HP</strong></div>
          {attemptPercentage(stats.returned,stats.drained)!==null&&<div className="trainer-defence-track" aria-hidden="true"><span style={{width:attemptPercentage(stats.returned,stats.drained)+"%"}}/></div>}
          <div><span>Fragments expired</span><strong>{stats.fragmentsExpired}</strong></div>
        </div>
        {state.result === "lost" && state.lastCause &&
          <p className="ocellus-result-note">Last recorded mechanic: {state.lastCause}</p>}
        </div>
        <footer className="ocellus-result-footer">
          <button ref={resetRef} className="trainer-menu-button trainer-reset-button" type="button" onClick={reset}>
            Reset
          </button>
        </footer>
      </div>
    </div>
  );
}

export function OcellusApp() {
  const [trainer] = useState(createTrainer);
  const region = trainer.region as OcellusRegion;
  const [loading, setLoading] = useState<TrainerLoadingState>();
  const [loadoutOpen, setLoadoutOpen] = useState(false);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const loadoutHost = useRef<HTMLDivElement>(null);
  useEffect(() => {
    // The pinned SDK creates AudioContext before the user interacts but
    // doesn't resume it. Browser audio requires a real pointer gesture.
    const resume = () => {
      if (SoundCache.context?.state === "suspended") {
        void SoundCache.context.resume().catch(() => undefined);
      }
    };
    document.addEventListener("pointerdown", resume, { capture: true });
    return () => document.removeEventListener("pointerdown", resume, { capture: true });
  }, []);
  useEffect(() => {
    if (!loadoutOpen || !loadoutHost.current) return;
    const release = enhanceLoadout(loadoutHost.current);
    return release;
  }, [loadoutOpen]);
  useEffect(() => {
    // Reuse the Sol trainer's mouse-relative gold glow for UI controls.
    const listener = (event: PointerEvent) => {
      if (event.pointerType === "touch" || !(event.target instanceof Element)) return;
      const button = event.target.closest<HTMLButtonElement>(
        "#right_panel button, .trainer-reset-panel button, .trainer-sidebar-toggle, [role=dialog] button",
      );
      if (!button) return;
      const bounds = button.getBoundingClientRect();
      button.style.setProperty("--glow-x", (event.clientX - bounds.left) + "px");
      button.style.setProperty("--glow-y", (event.clientY - bounds.top) + "px");
      button.classList.add("pointer-lit");
    };
    const leave = (event: PointerEvent) => {
      if (!(event.target instanceof Element)) return;
      const button = event.target.closest<HTMLButtonElement>(
        "#right_panel button, .trainer-reset-panel button, .trainer-sidebar-toggle, [role=dialog] button",
      );
      if (button && !(event.relatedTarget instanceof Node && button.contains(event.relatedTarget))) {
        button.classList.remove("pointer-lit");
      }
    };
    document.addEventListener("pointermove", listener, { passive: true });
    document.addEventListener("pointerout", leave, { passive: true });
    return () => {
      document.removeEventListener("pointermove", listener);
      document.removeEventListener("pointerout", leave);
    };
  }, []);
  return (
    <TrainerApp trainer={trainer} onLoadingStateChange={setLoading}>
      <GameOverlay>
        <TrainerLoadingSplash state={loading} />
        <SidebarToggle />
        <OcellusGameChat region={region} />
        <AttemptResults region={region} reset={() => trainer.reset()} />
        <div className="trainer-loadout-root" ref={loadoutHost}>
          <LoadoutManager loadouts={[OCELLUS_LOADOUT]} open={loadoutOpen}
            onClose={() => setLoadoutOpen(false)} />
        </div>
      </GameOverlay>
      <OcellusSidebar region={region}
        openLoadout={() => setLoadoutOpen(true)}
        openAdvanced={() => setAdvancedOpen(true)} />
      <AdvancedSettingsPanel open={advancedOpen} onClose={() => setAdvancedOpen(false)} />
    </TrainerApp>
  );
}
