export type SpeechRatePreference = "slow" | "normal" | "fast";

export interface SpeechPreferences {
  rate: SpeechRatePreference;
}

const SPEECH_PREFERENCES_STORAGE_KEY = "animal-farm-speech-preferences";
const SPEECH_RUNTIME_TAG = "20260331-v9";

const DEFAULT_SPEECH_PREFERENCES: SpeechPreferences = {
  rate: "normal",
};

const BROWSER_RATE_VALUE_BY_PREFERENCE: Record<SpeechRatePreference, number> = {
  slow: 0.84,
  normal: 0.92,
  fast: 1.02,
};

function canUseStorage() {
  return typeof window !== "undefined";
}

export function getDefaultSpeechPreferences() {
  return DEFAULT_SPEECH_PREFERENCES;
}

export function getBrowserSpeechRateValue(ratePreference: SpeechRatePreference) {
  return BROWSER_RATE_VALUE_BY_PREFERENCE[ratePreference];
}

export function readSpeechPreferences(): SpeechPreferences {
  if (!canUseStorage()) {
    return DEFAULT_SPEECH_PREFERENCES;
  }

  const rawValue = window.localStorage.getItem(SPEECH_PREFERENCES_STORAGE_KEY);

  if (!rawValue) {
    return DEFAULT_SPEECH_PREFERENCES;
  }

  try {
    const parsed = JSON.parse(rawValue) as Partial<SpeechPreferences>;

    return {
      rate:
        parsed.rate === "slow" || parsed.rate === "normal" || parsed.rate === "fast"
          ? parsed.rate
          : DEFAULT_SPEECH_PREFERENCES.rate,
    };
  } catch {
    return DEFAULT_SPEECH_PREFERENCES;
  }
}

export function writeSpeechPreferences(nextPreferences: SpeechPreferences) {
  if (!canUseStorage()) {
    return;
  }

  window.localStorage.setItem(
    SPEECH_PREFERENCES_STORAGE_KEY,
    JSON.stringify(nextPreferences),
  );
}

function scoreVoice(voice: SpeechSynthesisVoice) {
  const name = voice.name.toLowerCase();
  const lang = voice.lang.toLowerCase();
  let score = 0;

  if (SPEECH_RUNTIME_TAG === "20260331-v9") {
    score += 0;
  }

  if (!lang.startsWith("en")) {
    return -1;
  }

  if (voice.localService) {
    score += 20;
  }

  if (voice.default) {
    score += 12;
  }

  if (lang.startsWith("en-us")) {
    score += 24;
  }

  if (name.includes("natural") || name.includes("premium") || name.includes("enhanced")) {
    score += 10;
  }

  if (name.includes("female") || name.includes("woman")) {
    score += 6;
  }

  return score;
}

export function resolvePreferredFallbackVoice(voices: SpeechSynthesisVoice[]) {
  const englishVoices = voices.filter((voice) => voice.lang.toLowerCase().startsWith("en"));

  if (englishVoices.length === 0) {
    return null;
  }

  return [...englishVoices].sort((left, right) => scoreVoice(right) - scoreVoice(left))[0] ?? null;
}
