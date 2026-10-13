export interface VoiceConfig {
  enabled: boolean;
  voiceURI?: string;
  voiceName?: string;
  lang: string; // e.g. "en-US", "en-GB", "es-ES"
  pitch: number; // 0.5 - 1.5 (default: 1.0)
  rate: number; // 0.75 - 2.0 (default: 1.0)
  volume: number; // 0.0 - 1.0 (default: 1.0)
  autoSpeak: boolean; // Auto-read assistant responses
  handsFree: boolean; // Continuous conversational loop
  pushToTalk: boolean; // Spacebar to talk
  soundCues: boolean; // Audio feedback chimes
}

export interface VoiceOption {
  voiceURI: string;
  name: string;
  lang: string;
  default: boolean;
  localService: boolean;
}

export const DEFAULT_VOICE_CONFIG: VoiceConfig = {
  enabled: true,
  lang: "en-US",
  pitch: 1.0,
  rate: 1.0,
  volume: 1.0,
  autoSpeak: false,
  handsFree: false,
  pushToTalk: true,
  soundCues: true,
};
