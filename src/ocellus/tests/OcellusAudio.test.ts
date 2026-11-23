import {
  OCELLUS_AUDIO_KEY, DEFAULT_OCELLUS_AUDIO,
  parseOcellusAudio, readOcellusAudio, saveOcellusAudio,
} from "../OcellusAudio";

describe("Ocellus's own audio settings", () => {
  test("defaults both OSRS sound channels to enabled", () => {
    expect(parseOcellusAudio(null)).toEqual({ effects: true, area: true });
    expect(DEFAULT_OCELLUS_AUDIO).toEqual({ effects: true, area: true });
  });

  test("preserves explicit mute and mixed sound preferences", () => {
    expect(parseOcellusAudio('{"effects":false,"area":false}'))
      .toEqual({ effects: false, area: false });
    expect(parseOcellusAudio('{"effects":false,"area":true}'))
      .toEqual({ effects: false, area: true });
  });

  test("rejects corrupt or nonboolean settings instead of coercing them", () => {
    for (const raw of ['oops', 'null', '[]', '{"effects":"false","area":true}', '{}']) {
      expect(parseOcellusAudio(raw)).toEqual(DEFAULT_OCELLUS_AUDIO);
    }
  });

  test("reads and writes only the Ocellus key, never shared SDK audio", () => {
    const data: Record<string, string> = {
      "osrs-sdk:settings": '{"playsAudio":false,"playsAreaAudio":false}',
    };
    const storage = {
      getItem: jest.fn((key: string) => data[key] ?? null),
      setItem: jest.fn((key: string, value: string) => { data[key] = value; }),
    };
    expect(readOcellusAudio(storage)).toEqual(DEFAULT_OCELLUS_AUDIO);
    saveOcellusAudio(storage, { effects: false, area: true });
    expect(storage.setItem).toHaveBeenCalledWith(
      OCELLUS_AUDIO_KEY, '{"effects":false,"area":true}',
    );
    expect(readOcellusAudio(storage)).toEqual({ effects: false, area: true });
    expect(data["osrs-sdk:settings"]).toBe('{"playsAudio":false,"playsAreaAudio":false}');
  });

  test("keeps the session usable when browser storage is blocked", () => {
    expect(readOcellusAudio({ getItem: () => { throw new Error("blocked"); } }))
      .toEqual(DEFAULT_OCELLUS_AUDIO);
    expect(() => saveOcellusAudio({
      setItem: () => { throw new Error("blocked"); },
    }, { effects: false, area: false })).not.toThrow();
  });
});
