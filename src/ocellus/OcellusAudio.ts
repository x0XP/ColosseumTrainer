/**
 * Ocellus audio preferences are independent of the SDK's shared storage.
 * Both sound channels start enabled for a new Ocellus visit, but a player's
 * explicit Ocellus mute choice persists across reloads.
 */
export type OcellusAudioPreference = Readonly<{
  effects: boolean;
  area: boolean;
}>;
export const OCELLUS_AUDIO_KEY = "x0xp:ocellus:audio:v1";
export const DEFAULT_OCELLUS_AUDIO: OcellusAudioPreference = Object.freeze({
  effects: true, area: true,
});

export function parseOcellusAudio(raw: string | null): OcellusAudioPreference {
  if (raw === null) return DEFAULT_OCELLUS_AUDIO;
  try {
    const value: unknown = JSON.parse(raw);
    if (typeof value === "object" && value !== null &&
        "effects" in value && "area" in value) {
      const item = value as Record<string, unknown>;
      if (typeof item.effects === "boolean" && typeof item.area === "boolean") {
        return Object.freeze({ effects: item.effects, area: item.area });
      }
    }
  } catch { /* Gracefully replace invalid per-trainer settings. */ }
  return DEFAULT_OCELLUS_AUDIO;
}

export function readOcellusAudio(storage: Pick<Storage, "getItem">): OcellusAudioPreference {
  try { return parseOcellusAudio(storage.getItem(OCELLUS_AUDIO_KEY)); }
  catch { return DEFAULT_OCELLUS_AUDIO; }
}

export function saveOcellusAudio(
  storage: Pick<Storage, "setItem">, preference: OcellusAudioPreference,
): void {
  try { storage.setItem(OCELLUS_AUDIO_KEY, JSON.stringify(preference)); }
  catch { /* Browser storage may be disabled; session settings still work. */ }
}
