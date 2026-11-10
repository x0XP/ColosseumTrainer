import React, { useEffect, useState, useSyncExternalStore } from "react";
import {
  CacheRender,
  cacheSound,
  ControlPanelController,
  Region,
  Settings,
  Sound,
  SoundCache,
  Trainer,
  TrainerInstance,
  TrainerLoadingState,
} from "osrs-sdk";
import { AdvancedSettingsPanel, GameOverlay, LoadoutManager, Modal, RuneScapeButton, RuneScapePanel, TrainerApp, TrainerLoadingSplash, useSettingsStore } from "osrs-sdk-react";
import { ColosseumRegion } from "./content/colosseum/js/ColosseumRegion";
import { ImportedReinforcements, WAVE_COMPOSITIONS, WaveNumber, WavesRegion } from "./content/colosseum/js/WavesRegion";
import { COLOSSEUM_ASSETS } from "./assets";
import { colosseumLoadout, wavesLoadout } from "./content/colosseum/js/ColosseumLoadout";
import {
  colosseumSettings,
  ColosseumSettingsState,
} from "./content/colosseum/js/ColosseumSettings";
import { decodePastedLosWaveUrl } from "./content/colosseum/js/LosWaveUrl";
import { formatWaveTime } from "./content/colosseum/js/WaveTimer";
import { formatAttemptTime } from "./content/colosseum/js/AttemptSummary";

declare const __OSRS_CACHE_RENDER_MANIFEST_URL__: string;

declare global {
  interface Window {
    OSRS_CACHE_RENDER_MANIFEST_URL?: string;
  }
}

const loadoutTemplates = [colosseumLoadout, wavesLoadout];

type TransferredSettings = {
  version: 1;
  hotkeys?: Partial<Record<"inventory" | "spellbook" | "equipment" | "prayer" | "combat", string>>;
  ui?: {
    zoomScale?: number;
    maxUiScale?: number;
    menuVisible?: boolean;
  };
};

function applyTransferredSettings() {
  const encodedSettings = new URLSearchParams(window.location.search).get("settings");
  if (!encodedSettings) return;

  try {
    const base64 = encodedSettings.replace(/-/g, "+").replace(/_/g, "/");
    const paddedBase64 = base64.padEnd(base64.length + ((4 - base64.length % 4) % 4), "=");
    const settings = JSON.parse(atob(paddedBase64)) as TransferredSettings;
    if (settings.version !== 1) return;

    const hotkeySettings: Record<
      keyof NonNullable<TransferredSettings["hotkeys"]>,
      "inventory_key" | "spellbook_key" | "equipment_key" | "prayer_key" | "combat_key"
    > = {
      inventory: "inventory_key",
      spellbook: "spellbook_key",
      equipment: "equipment_key",
      prayer: "prayer_key",
      combat: "combat_key",
    };
    for (const [key, setting] of Object.entries(hotkeySettings)) {
      const value = settings.hotkeys?.[key as keyof typeof hotkeySettings];
      if (typeof value === "string" && value.length > 0) Settings[setting] = value;
    }

    if (Number.isFinite(settings.ui?.zoomScale)) {
      Settings.zoomScale = Math.max(0.5, Math.min(2, settings.ui.zoomScale));
    }
    if (Number.isFinite(settings.ui?.maxUiScale)) {
      Settings.maxUiScale = Math.max(0.5, Math.min(2, settings.ui.maxUiScale));
    }
    if (typeof settings.ui?.menuVisible === "boolean") {
      Settings.menuVisible = settings.ui.menuVisible;
    }

    Settings.persistToStorage();
    window.history.replaceState({}, "", `${window.location.pathname}${window.location.hash}`);
  } catch {
    // Ignore malformed or obsolete transfer links and use the saved settings.
  }
}

function createTrainer() {
  CacheRender.configure(
    __OSRS_CACHE_RENDER_MANIFEST_URL__
      || window.OSRS_CACHE_RENDER_MANIFEST_URL
      || new URL("osrs-assets/manifest.json", window.location.href).href,
  );
  Settings.readFromStorage();
  applyTransferredSettings();
  colosseumSettings.load();

  const regions: Record<string, Region> = {
    "colosseum.html": new ColosseumRegion(loadoutTemplates),
    "waves.html": new WavesRegion(loadoutTemplates),
  };
  const regionName = window.location.pathname.split("/").pop() ?? "colosseum.html";
  const region = regions[regionName] ?? regions["colosseum.html"];
  return new TrainerInstance(region, { readyTimer: 5 });
}

type AttackSetting = Exclude<
  keyof ColosseumSettingsState,
  "forceDoubleSouth" | "npcsAggressive" | "waveNumber" | "showSolarFlareTiles" | "solarFlareLevel"
>;

function AttackCheckbox({ label, setting }: { label: string; setting: AttackSetting }) {
  const settings = useSettingsStore(colosseumSettings);
  return (
    <label className="trainer-setting-row">
      <input
        type="checkbox"
        checked={settings[setting]}
        onChange={(event) => colosseumSettings.set({ [setting]: event.currentTarget.checked })}
      />
      <span>{label}</span>
    </label>
  );
}

function Credits() {
  return (
    <ul>
      <li>Jagex</li>
      <li>Supalosa (engine and logic)</li>
      <li>Tesla Owner (engine)</li>
      <li>KiwiIskadda (detailed feedback)</li>
      <li>Syndra, Varadium, ro0bo, zyth (early feedback and testing)</li>
      <li>kattykoo (Colosseum tips and tricks)</li>
    </ul>
  );
}

function WavesSidebar() {
  const settings = useSettingsStore(colosseumSettings);
  return (
    <section className="trainer-control-section" aria-label="Wave practice settings">
      <h3>Wave practice</h3>
      <label className="trainer-setting-row">
        <input
          type="checkbox"
          checked={settings.npcsAggressive}
          onChange={(event) => colosseumSettings.set({ npcsAggressive: event.currentTarget.checked })}
        />
        <span>Aggressive NPCs on wave start</span>
      </label>
      <button className="trainer-menu-button" type="button" onClick={() => Trainer.reset()}>Reset wave</button>
    </section>
  );
}

function WaveStartModal({ region }: { region: WavesRegion }) {
  const settings = useSettingsStore(colosseumSettings);
  const open = useSyncExternalStore(
    region.subscribeWaveState,
    region.isWaveStartModalOpen,
    region.isWaveStartModalOpen,
  );
  const selectedWave = useSyncExternalStore(
    region.subscribeWaveState,
    region.getSelectedWave,
    region.getSelectedWave,
  );
  const importedReinforcements = useSyncExternalStore(
    region.subscribeWaveState,
    region.getImportedReinforcements,
    region.getImportedReinforcements,
  );
  const imported = region.isLosWaveImport();

  const waveLabels: Record<WaveNumber, string> = {
    1: "Shaman",
    2: "Shaman, Javelin",
    3: "Shaman, 2x Javelin",
    4: "Shaman, Manticore",
    5: "Shaman, Javelin, Manticore",
    6: "Shaman, 2x Javelin, Manticore",
    7: "Javelin, Manticore, Shockwave",
    8: "2x Javelin, Manticore, Shockwave",
    9: "Javelin, 2x Manticore",
    10: "2x Javelin, 2x Manticore",
    11: "Javelin, 2x Manticore, Shockwave",
  };

  return (
    <Modal blocking={false} open={open} aria-label="Start wave">
      <RuneScapePanel style={{ width: 280 }}>
        <h2 style={{ marginTop: 0, textAlign: "center" }}>Secret double south trainer</h2>
        <p style={{ marginTop: 0, textAlign: "center" }}>
          Javelin toss and minotaur heal is not implemented yet.
        </p>
        {imported ?
          <>
            <p style={{ marginTop: 0, textAlign: "center", color: 'white' }}>Custom wave imported.</p>
            <label>
              Reinforcements
              <select
                aria-label="Reinforcements"
                value={importedReinforcements}
                onChange={(event) => region.setImportedReinforcements(event.currentTarget.value as ImportedReinforcements)}
              >
                <option value="none">None</option>
                <option value="jaguar">Jaguar Warrior</option>
                <option value="shaman-jaguar">Serpent Shaman + Jaguar Warrior</option>
                <option value="minotaur">Minotaur</option>
                <option value="minotaur-shaman">Minotaur + Serpent Shaman</option>
              </select>
            </label>
          </> :
          <>
            <select
              aria-label="Wave"
              value={selectedWave}
              onChange={(event) => region.setSelectedWave(Number(event.currentTarget.value) as WaveNumber)}
            >
              {(Object.keys(WAVE_COMPOSITIONS) as unknown as WaveNumber[]).map((wave) => (
                <option key={wave} value={wave}>Wave {wave} — {waveLabels[wave]}</option>
              ))}
            </select>
            <label>
              <input
                type="checkbox"
                checked={settings.forceDoubleSouth}
                onChange={(event) => colosseumSettings.set({ forceDoubleSouth: event.currentTarget.checked })}
              />
              Force double south
            </label>
          </>
        }
        <RuneScapeButton
          type="button"
          onClick={() => region.requestWaveStart()}
          onMouseEnter={() => SoundCache.play(new Sound(cacheSound(COLOSSEUM_ASSETS.sounds.waveStartStartHover.id), 0.05))}
        >
          Start
        </RuneScapeButton>
      </RuneScapePanel>
    </Modal>
  );
}

function WaveTimer({ region }: { region: WavesRegion }) {
  const ticks = useSyncExternalStore(
    region.subscribeWaveState,
    region.getWaveTick,
    region.getWaveTick,
  );

  return (
    <div style={{
      bottom: 90,
      color: "white",
      fontFamily: "OSRS",
      fontSize: 24,
      left: 10,
      pointerEvents: "none",
      position: "absolute",
      textShadow: "1px 1px 0 black",
      zIndex: 1,
    }}>
      Wave timer: {formatWaveTime(ticks)}
    </div>
  );
}

function BossSidebar({ region }: { region: ColosseumRegion }) {
  const settings = useSettingsStore(colosseumSettings);
  return (
    <>
      <section className="trainer-control-section" aria-label="Attack practice settings">
        <h3>Attack sequences</h3>
        <p className="trainer-help-text">Choose which mechanics Sol can use.</p>
        <AttackCheckbox label="Shields" setting="useShields" />
        <AttackCheckbox label="Spears" setting="useSpears" />
        <AttackCheckbox label="Triple Parry" setting="useTriple" />
        <AttackCheckbox label="Grapple" setting="useGrapple" />
        <AttackCheckbox label="Phase Transitions" setting="usePhaseTransitions" />
      </section>
      <section className="trainer-control-section" aria-label="Solar Flare settings">
        <h3>Solar Flare</h3>
        <select
          aria-label="Solar Flare level"
          value={settings.solarFlareLevel}
          onChange={(event) => region.setSolarFlareLevel(Number(event.currentTarget.value))}
        >
          <option value={0}>None</option>
          <option value={1}>Level 1</option>
          <option value={2}>Level 2</option>
          <option value={3}>Level 3</option>
        </select>
        <label className="trainer-setting-row">
          <input
            type="checkbox"
            checked={settings.showSolarFlareTiles}
            onChange={(event) => region.setShowSolarFlareTiles(event.currentTarget.checked)}
          />
          <span>Show Solar Flare tiles</span>
        </label>
      </section>
      <p className="trainer-tip">Right-click Sol to jump to a specific phase.</p>
    </>
  );
}

function Sidebar({ onLoadoutToggle, onAdvancedSettings, region }: {
  onLoadoutToggle: () => void;
  onAdvancedSettings: () => void;
  region: ColosseumRegion;
}) {
  const [showCredits, setShowCredits] = useState(false);
  const isWaves = region instanceof WavesRegion;

  return (
    <div className="trainer-sidebar-content">
      <header className="trainer-sidebar-heading">
        <span className="trainer-eyebrow">PRACTICE CONTROLS</span>
        <strong>{isWaves ? "Colosseum Waves" : "Sol Heredit"}</strong>
      </header>
      {isWaves ? <WavesSidebar /> : <BossSidebar region={region} />}
      <div id="gpu_warning" className="trainer-gpu-warning" role="status" />
      <section className="trainer-control-section" aria-label="Trainer tools">
        <h3>Tools</h3>
        <button className="trainer-menu-button" type="button" onClick={onLoadoutToggle}>Loadout</button>
        <button className="trainer-menu-button" type="button" onClick={() => ControlPanelController.controller.setActiveControl("SETTINGS")}>Settings</button>
        <button className="trainer-menu-button" type="button" onClick={() => window.location.assign("https://los.colosim.com")}>Line-of-Sight Solver</button>
        <button className="trainer-menu-button" type="button" aria-expanded={showCredits} onClick={() => setShowCredits((visible) => !visible)}>Credits</button>
        {showCredits && <div className="trainer-credit-list"><Credits /></div>}
        <button className="trainer-menu-button" type="button" onClick={onAdvancedSettings}>Advanced settings</button>
      </section>
    </div>
  );
}

function TrainerSidebar({ onLoadoutToggle, region }: { onLoadoutToggle: () => void; region: ColosseumRegion }) {
  const menuVisible = useSyncExternalStore(Settings.subscribe, Settings.getSnapshot).menuVisible;
  const [advancedSettingsOpen, setAdvancedSettingsOpen] = useState(false);

  return (
    <>
      <aside
        id="right_panel"
        className="trainer-sidebar-shell"
        style={{
          display: menuVisible ? "flex" : "none",
          flex: "0 0 auto",
          flexDirection: "column",
          height: "100%",
          minWidth: 0,
          overflowY: "auto",
          width: 240,
        }}
      >
        <div className="trainer-sidebar-panel">
          <Sidebar
            onLoadoutToggle={onLoadoutToggle}
            onAdvancedSettings={() => setAdvancedSettingsOpen(true)}
            region={region}
          />
        </div>
      </aside>
      <AdvancedSettingsPanel open={advancedSettingsOpen} onClose={() => setAdvancedSettingsOpen(false)} />
    </>
  );
}

function SidebarToggle() {
  const menuVisible = useSyncExternalStore(
    Settings.subscribe,
    () => Settings.getSnapshot().menuVisible,
  );

  return (
    <button
      className="trainer-sidebar-toggle"
      type="button"
      aria-controls="right_panel"
      aria-expanded={menuVisible}
      onClick={() => {
        Settings.setMenuVisible(!menuVisible);
        Settings.persistToStorage();
      }}
    >
      {menuVisible ? "Hide controls" : "Controls"}
    </button>
  );
}

function AttemptResults({ trainer }: { trainer: TrainerInstance }) {
  const region = trainer.region as ColosseumRegion;
  const gameOver = useSyncExternalStore(region.subscribeGameOver, region.getGameOver);
  const attempt = region.getAttemptSummary();
  if (!gameOver || !attempt) return null;

  const solHp = attempt.solHpRemaining === null || attempt.solMaxHp === null
    ? "Unavailable" : `${attempt.solHpRemaining.toLocaleString()} / ${attempt.solMaxHp.toLocaleString()}`;
  const phase = attempt.phaseReached === null ? "Unavailable" : `Phase ${attempt.phaseReached}`;
  const grapples = attempt.grapplesDefended + attempt.grapplesMissed;

  // No restart until Reset is explicitly pressed; this does not re-create
  // the trainer or reload the iframe.
  return (
    <div id="embedded_reset" className="trainer-reset-backdrop">
      <div className="trainer-reset-panel" role="group" aria-label="Attempt ended">
        <span className="trainer-eyebrow">PRACTICE ENDED</span>
        <strong>{attempt.outcome === "victory" ? "Sol defeated" : "Fight over"}</strong>
        <p>Attempt breakdown</p>
        <dl className="trainer-attempt-grid">
          <div><dt>Game time</dt><dd>{formatAttemptTime(attempt.elapsedTicks)}</dd></div>
          <div><dt>Sol HP remaining</dt><dd>{solHp}</dd></div>
          <div><dt>Phase reached</dt><dd>{phase}</dd></div>
          <div><dt>Grapples defended</dt><dd>{attempt.grapplesDefended} / {grapples}</dd></div>
        </dl>
        <section className="trainer-attempt-attacks" aria-label="Sol attacks encountered">
          <h3>Attacks encountered</h3>
          <dl>
            <div><dt>Spears</dt><dd>{attempt.attacks.spear}</dd></div>
            <div><dt>Shields</dt><dd>{attempt.attacks.shield}</dd></div>
            <div><dt>Triple Parry</dt><dd>{attempt.attacks.triple}</dd></div>
            <div><dt>Grapples</dt><dd>{attempt.attacks.grapple}</dd></div>
          </dl>
        </section>
        <button type="button" className="trainer-menu-button trainer-reset-button" onClick={() => trainer.reset()}>
          Reset
        </button>
      </div>
    </div>
  );
}

export function ColosseumApp() {
  const [trainer] = useState(createTrainer);
  const [loading, setLoading] = useState<TrainerLoadingState>();
  const [loadoutOpen, setLoadoutOpen] = useState(false);

  const isLoaded = loading?.status === "ready";

  // Use the same pointer-relative highlight as the main x0XP website.
  // Scope this to trainer UI buttons, not the RuneScape game canvas/HUD.
  useEffect(() => {
    const targets = '#right_panel.trainer-sidebar-shell button, .trainer-sidebar-toggle, .trainer-reset-panel button, [role="dialog"] button';
    const buttonFrom = (target: EventTarget | null): HTMLButtonElement | null =>
      target instanceof Element ? target.closest<HTMLButtonElement>(targets) : null;

    const trackPointer = (event: PointerEvent) => {
      if (event.pointerType === "touch") return;
      const button = buttonFrom(event.target);
      if (!button || button.disabled || button.getAttribute("aria-disabled") === "true") return;
      const bounds = button.getBoundingClientRect();
      button.style.setProperty("--glow-x", `${event.clientX - bounds.left}px`);
      button.style.setProperty("--glow-y", `${event.clientY - bounds.top}px`);
      button.classList.add("pointer-lit");
    };

    const clearPointer = (event: PointerEvent) => {
      const button = buttonFrom(event.target);
      if (!button) return;
      // Pointer movement between nested SDK spans is still inside this button.
      if (event.relatedTarget instanceof Node && button.contains(event.relatedTarget)) return;
      button.classList.remove("pointer-lit");
    };

    const clearFocusPosition = (event: FocusEvent) => {
      const button = buttonFrom(event.target);
      if (button && !button.classList.contains("pointer-lit")) {
        button.style.removeProperty("--glow-x");
        button.style.removeProperty("--glow-y");
      }
    };

    document.addEventListener("pointermove", trackPointer, { passive: true });
    document.addEventListener("pointerout", clearPointer, { passive: true });
    document.addEventListener("focusin", clearFocusPosition);
    return () => {
      document.removeEventListener("pointermove", trackPointer);
      document.removeEventListener("pointerout", clearPointer);
      document.removeEventListener("focusin", clearFocusPosition);
    };
  }, []);

  useEffect(() => {
    if (!(trainer.region instanceof WavesRegion)) return;
    const region = trainer.region;
    const onPaste = (event: ClipboardEvent) => {
      const imported = decodePastedLosWaveUrl(event.clipboardData?.getData("text/plain") ?? "");
      if (!imported) return;
      event.preventDefault();
      region.importLosWave(imported);
    };
    document.addEventListener("paste", onPaste);
    return () => document.removeEventListener("paste", onPaste);
  }, [trainer]);

  return (
    <TrainerApp
      trainer={trainer}
      onLoadingStateChange={setLoading}
    >
      <GameOverlay>
        <div id="disclaimer_panel">Work in progress.<br />All assets are property of Jagex.</div>
        <TrainerLoadingSplash state={loading} />
        <SidebarToggle />
        <AttemptResults trainer={trainer} />
        {trainer.region instanceof WavesRegion && isLoaded && <WaveTimer region={trainer.region} />}
        {trainer.region instanceof WavesRegion && isLoaded && <WaveStartModal region={trainer.region} />}
        <LoadoutManager
          loadouts={loadoutTemplates}
          open={loadoutOpen}
          onClose={() => setLoadoutOpen(false)}
        />
      </GameOverlay>
      <TrainerSidebar
        onLoadoutToggle={() => setLoadoutOpen((open) => !open)}
        region={trainer.region as ColosseumRegion}
      />
    </TrainerApp>
  );
}
