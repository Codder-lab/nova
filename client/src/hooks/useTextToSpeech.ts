import { useState, useEffect, useRef, useCallback } from "react";
import type { VoiceConfig, VoiceOption } from "@nova/shared";
import { sanitizeForSpeech } from "@/lib/speech-sanitizer";

export interface UseTextToSpeechOptions {
  config: VoiceConfig;
  onStart?: () => void;
  onEnd?: () => void;
  onError?: (err: any) => void;
}

export function useTextToSpeech(options: UseTextToSpeechOptions) {
  const { config, onStart, onEnd, onError } = options;
  const [voices, setVoices] = useState<VoiceOption[]>([]);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [currentText, setCurrentText] = useState<string | null>(null);

  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const isSupported =
    typeof window !== "undefined" && "speechSynthesis" in window;

  // Load and cache browser voices
  const refreshVoices = useCallback(() => {
    if (!isSupported) return;
    try {
      const rawVoices = window.speechSynthesis.getVoices();
      const mapped: VoiceOption[] = rawVoices.map((v) => ({
        voiceURI: v.voiceURI,
        name: v.name,
        lang: v.lang,
        default: v.default,
        localService: v.localService,
      }));
      setVoices(mapped);
    } catch {
      // Ignore
    }
  }, [isSupported]);

  useEffect(() => {
    if (!isSupported) return;

    refreshVoices();
    if (window.speechSynthesis.onvoiceschanged !== undefined) {
      window.speechSynthesis.onvoiceschanged = refreshVoices;
    }

    return () => {
      if (isSupported) {
        window.speechSynthesis.cancel();
      }
    };
  }, [isSupported, refreshVoices]);

  const stop = useCallback(() => {
    if (!isSupported) return;
    try {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
      setIsPaused(false);
      setCurrentText(null);
    } catch {
      // Ignore
    }
  }, [isSupported]);

  const pause = useCallback(() => {
    if (!isSupported) return;
    try {
      window.speechSynthesis.pause();
      setIsPaused(true);
    } catch {
      // Ignore
    }
  }, [isSupported]);

  const resume = useCallback(() => {
    if (!isSupported) return;
    try {
      window.speechSynthesis.resume();
      setIsPaused(false);
    } catch {
      // Ignore
    }
  }, [isSupported]);

  const speak = useCallback(
    (textToSpeak: string, customOnEnd?: () => void) => {
      if (!isSupported || !textToSpeak || !config.enabled) return;

      const cleanText = sanitizeForSpeech(textToSpeak);
      if (!cleanText.trim()) return;

      try {
        // Cancel any pending speech
        window.speechSynthesis.cancel();

        const utterance = new SpeechSynthesisUtterance(cleanText);
        utteranceRef.current = utterance;

        // Apply pitch, rate, volume
        utterance.pitch = Math.max(0.5, Math.min(1.5, config.pitch));
        utterance.rate = Math.max(0.5, Math.min(2.0, config.rate));
        utterance.volume = Math.max(0.0, Math.min(1.0, config.volume));

        // Find voice by URI or Name or default language
        const allVoices = window.speechSynthesis.getVoices();
        let selectedVoice = allVoices.find(
          (v) => v.voiceURI === config.voiceURI || v.name === config.voiceName
        );

        if (!selectedVoice && config.lang) {
          selectedVoice = allVoices.find((v) =>
            v.lang.toLowerCase().startsWith(config.lang.toLowerCase().slice(0, 2))
          );
        }

        if (selectedVoice) {
          utterance.voice = selectedVoice;
        }

        utterance.onstart = () => {
          setIsSpeaking(true);
          setIsPaused(false);
          setCurrentText(cleanText);
          onStart?.();
        };

        utterance.onend = () => {
          setIsSpeaking(false);
          setIsPaused(false);
          setCurrentText(null);
          onEnd?.();
          customOnEnd?.();
        };

        utterance.onerror = (event) => {
          setIsSpeaking(false);
          setIsPaused(false);
          setCurrentText(null);
          onError?.(event);
        };

        window.speechSynthesis.speak(utterance);
      } catch (err) {
        setIsSpeaking(false);
        setIsPaused(false);
        setCurrentText(null);
        onError?.(err);
      }
    },
    [config, isSupported, onStart, onEnd, onError]
  );

  return {
    isSupported,
    isSpeaking,
    isPaused,
    currentText,
    voices,
    speak,
    stop,
    pause,
    resume,
  };
}
