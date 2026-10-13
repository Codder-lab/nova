import React, { useState } from "react";
import {
  Mic,
  RotateCcw,
  Sparkles,
  Play,
  Square,
  Headphones,
  Sliders,
} from "lucide-react";
import type { VoiceConfig, VoiceOption } from "@nova/shared";
import { DEFAULT_VOICE_CONFIG } from "@nova/shared";
import {
  Dialog,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { sanitizeForSpeech } from "@/lib/speech-sanitizer";

interface VoiceSettingsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  config: VoiceConfig;
  onConfigChange: (newConfig: VoiceConfig) => void;
  voices: VoiceOption[];
}

const COMMON_LANGUAGES = [
  { code: "en-US", label: "English (US)" },
  { code: "en-GB", label: "English (UK)" },
  { code: "es-ES", label: "Spanish (Spain)" },
  { code: "es-MX", label: "Spanish (Mexico)" },
  { code: "fr-FR", label: "French (France)" },
  { code: "de-DE", label: "German" },
  { code: "ja-JP", label: "Japanese" },
  { code: "it-IT", label: "Italian" },
];

export const VoiceSettingsModal: React.FC<VoiceSettingsModalProps> = ({
  open,
  onOpenChange,
  config,
  onConfigChange,
  voices,
}) => {
  const [isPlayingPreview, setIsPlayingPreview] = useState(false);

  const filteredVoices = voices.filter(
    (v) =>
      !config.lang ||
      v.lang.toLowerCase().startsWith(config.lang.toLowerCase().slice(0, 2))
  );

  const displayVoices = filteredVoices.length > 0 ? filteredVoices : voices;

  const handleTestVoice = () => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;

    if (isPlayingPreview) {
      window.speechSynthesis.cancel();
      setIsPlayingPreview(false);
      return;
    }

    window.speechSynthesis.cancel();
    const previewText = sanitizeForSpeech(
      "Hello! I am Nova, your autonomous agent. Hands-free voice interface is active."
    );
    const utterance = new SpeechSynthesisUtterance(previewText);
    utterance.pitch = config.pitch;
    utterance.rate = config.rate;
    utterance.volume = config.volume;

    const matchedVoice = voices.find(
      (v) => v.voiceURI === config.voiceURI || v.name === config.voiceName
    );
    if (matchedVoice) {
      const allSysVoices = window.speechSynthesis.getVoices();
      const actualVoice = allSysVoices.find(
        (v) => v.voiceURI === matchedVoice.voiceURI
      );
      if (actualVoice) utterance.voice = actualVoice;
    }

    utterance.onstart = () => setIsPlayingPreview(true);
    utterance.onend = () => setIsPlayingPreview(false);
    utterance.onerror = () => setIsPlayingPreview(false);

    window.speechSynthesis.speak(utterance);
  };

  const handleReset = () => {
    onConfigChange({ ...DEFAULT_VOICE_CONFIG });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange} className="max-w-md">
      <DialogHeader>
        <DialogTitle onClose={() => onOpenChange(false)}>
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-primary/10 text-primary">
              <Headphones className="w-5 h-5" />
            </div>
            <span>Voice & Audio Settings</span>
          </div>
        </DialogTitle>
        <DialogDescription>
          Customize Nova's voice synthesizer, speech recognition, and hands-free conversational controls.
        </DialogDescription>
      </DialogHeader>

      <div className="space-y-5 py-2">
        {/* Voice Persona / Synthesizer */}
        <div className="space-y-3 p-3.5 rounded-xl border border-border bg-card/50">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
              <Sliders className="w-3.5 h-3.5 text-primary" />
              Speech Synthesis (TTS)
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={handleTestVoice}
              className="h-7 px-2.5 text-[11px] gap-1 cursor-pointer"
            >
              {isPlayingPreview ? (
                <>
                  <Square className="w-3 h-3 text-rose-500 fill-rose-500" />
                  <span>Stop Preview</span>
                </>
              ) : (
                <>
                  <Play className="w-3 h-3 text-primary fill-primary" />
                  <span>Test Voice</span>
                </>
              )}
            </Button>
          </div>

          {/* Language Selector */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-medium text-muted-foreground">
              Language
            </label>
            <select
              value={config.lang}
              onChange={(e) =>
                onConfigChange({ ...config, lang: e.target.value })
              }
              aria-label="Select voice language"
              className="w-full text-xs rounded-lg border border-border bg-background px-3 py-1.5 text-foreground focus:outline-hidden focus:ring-1 focus:ring-ring"
            >
              {COMMON_LANGUAGES.map((lang) => (
                <option key={lang.code} value={lang.code}>
                  {lang.label} ({lang.code})
                </option>
              ))}
            </select>
          </div>

          {/* Voice Model Selector */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-medium text-muted-foreground">
              Voice Persona
            </label>
            <select
              value={config.voiceURI || ""}
              onChange={(e) => {
                const selected = voices.find(
                  (v) => v.voiceURI === e.target.value
                );
                onConfigChange({
                  ...config,
                  voiceURI: e.target.value,
                  voiceName: selected?.name,
                });
              }}
              aria-label="Select voice persona"
              className="w-full text-xs rounded-lg border border-border bg-background px-3 py-1.5 text-foreground focus:outline-hidden focus:ring-1 focus:ring-ring"
            >
              {displayVoices.map((v) => (
                <option key={v.voiceURI} value={v.voiceURI}>
                  {v.name} {v.default ? "· Default" : ""}
                </option>
              ))}
            </select>
          </div>

          {/* Rate & Pitch Sliders */}
          <div className="grid grid-cols-2 gap-3 pt-1">
            <div className="space-y-1">
              <div className="flex justify-between text-[11px]">
                <span className="text-muted-foreground">Speed</span>
                <span className="font-mono text-foreground">
                  {config.rate.toFixed(2)}x
                </span>
              </div>
              <input
                type="range"
                min="0.75"
                max="1.75"
                step="0.05"
                value={config.rate}
                onChange={(e) =>
                  onConfigChange({
                    ...config,
                    rate: parseFloat(e.target.value),
                  })
                }
                aria-label="Speech speed slider"
                className="w-full accent-primary h-1.5 bg-muted rounded-lg cursor-pointer"
              />
            </div>

            <div className="space-y-1">
              <div className="flex justify-between text-[11px]">
                <span className="text-muted-foreground">Pitch</span>
                <span className="font-mono text-foreground">
                  {config.pitch.toFixed(2)}x
                </span>
              </div>
              <input
                type="range"
                min="0.6"
                max="1.4"
                step="0.05"
                value={config.pitch}
                onChange={(e) =>
                  onConfigChange({
                    ...config,
                    pitch: parseFloat(e.target.value),
                  })
                }
                aria-label="Speech pitch slider"
                className="w-full accent-primary h-1.5 bg-muted rounded-lg cursor-pointer"
              />
            </div>
          </div>
        </div>

        {/* Conversational & Interaction Preferences */}
        <div className="space-y-3 p-3.5 rounded-xl border border-border bg-card/50">
          <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
            <Mic className="w-3.5 h-3.5 text-primary" />
            Hands-Free & Microphone Controls
          </span>

          {/* Auto Speak Toggle */}
          <div className="flex items-center justify-between gap-3">
            <div className="space-y-0.5">
              <div className="text-xs font-medium text-foreground">
                Auto-Read Responses
              </div>
              <div className="text-[11px] text-muted-foreground">
                Read assistant answers aloud automatically upon generation.
              </div>
            </div>
            <Switch
              checked={config.autoSpeak}
              onCheckedChange={(checked) =>
                onConfigChange({ ...config, autoSpeak: checked })
              }
            />
          </div>

          {/* Hands-Free Loop Toggle */}
          <div className="flex items-center justify-between gap-3 pt-1 border-t border-border/50">
            <div className="space-y-0.5">
              <div className="text-xs font-medium text-foreground flex items-center gap-1.5">
                <span>Hands-Free Loop</span>
                <Sparkles className="w-3 h-3 text-amber-400" />
              </div>
              <div className="text-[11px] text-muted-foreground">
                Automatically re-arm microphone after Nova finishes speaking.
              </div>
            </div>
            <Switch
              checked={config.handsFree}
              onCheckedChange={(checked) =>
                onConfigChange({ ...config, handsFree: checked })
              }
            />
          </div>

          {/* Push-to-Talk Toggle */}
          <div className="flex items-center justify-between gap-3 pt-1 border-t border-border/50">
            <div className="space-y-0.5">
              <div className="text-xs font-medium text-foreground">
                Push-to-Talk (Hold Spacebar)
              </div>
              <div className="text-[11px] text-muted-foreground">
                Hold Spacebar outside input fields to dictate speech.
              </div>
            </div>
            <Switch
              checked={config.pushToTalk}
              onCheckedChange={(checked) =>
                onConfigChange({ ...config, pushToTalk: checked })
              }
            />
          </div>

          {/* Sound Cues Toggle */}
          <div className="flex items-center justify-between gap-3 pt-1 border-t border-border/50">
            <div className="space-y-0.5">
              <div className="text-xs font-medium text-foreground">
                Audio Cues & Chimes
              </div>
              <div className="text-[11px] text-muted-foreground">
                Play subtle synthesizer chimes when listening begins or ends.
              </div>
            </div>
            <Switch
              checked={config.soundCues}
              onCheckedChange={(checked) =>
                onConfigChange({ ...config, soundCues: checked })
              }
            />
          </div>
        </div>
      </div>

      <DialogFooter className="flex items-center justify-between sm:justify-between w-full">
        <Button
          variant="ghost"
          size="sm"
          onClick={handleReset}
          className="text-xs text-muted-foreground hover:text-foreground gap-1.5"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          Reset Defaults
        </Button>
        <Button
          size="sm"
          onClick={() => onOpenChange(false)}
          className="text-xs px-4"
        >
          Done
        </Button>
      </DialogFooter>
    </Dialog>
  );
};
