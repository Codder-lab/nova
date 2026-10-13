import { useState, useEffect, useRef, useCallback } from "react";
import type { VoiceConfig } from "@nova/shared";
import { audioCues } from "@/lib/audio-cues";

export interface UseVoiceRecognitionOptions {
  config: VoiceConfig;
  onTranscriptChange?: (interim: string, isFinal: boolean) => void;
  onFinalTranscript?: (transcript: string) => void;
  onError?: (error: string) => void;
}

export function useVoiceRecognition(options: UseVoiceRecognitionOptions) {
  const { config, onTranscriptChange, onFinalTranscript, onError } = options;

  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [interimTranscript, setInterimTranscript] = useState("");
  const [audioLevel, setAudioLevel] = useState(0); // 0 - 100 for visualizer
  const [error, setError] = useState<string | null>(null);

  const recognitionRef = useRef<any>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const animFrameRef = useRef<number | null>(null);

  const isSupported =
    typeof window !== "undefined" &&
    !!((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition);

  // Setup Web Audio Analyser for live frequency levels
  const startAudioAnalyser = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true },
      });
      mediaStreamRef.current = stream;

      const AudioCtx =
        window.AudioContext || (window as any).webkitAudioContext;
      const audioCtx = new AudioCtx();
      audioContextRef.current = audioCtx;

      const source = audioCtx.createMediaStreamSource(stream);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 64;
      analyser.smoothingTimeConstant = 0.5;
      analyserRef.current = analyser;

      source.connect(analyser);

      const dataArray = new Uint8Array(analyser.frequencyBinCount);

      const updateLevel = () => {
        if (!analyserRef.current) return;
        analyserRef.current.getByteFrequencyData(dataArray);

        let sum = 0;
        for (let i = 0; i < dataArray.length; i++) {
          sum += dataArray[i];
        }
        const average = sum / dataArray.length;
        // Normalize to 0 - 100
        const normalized = Math.min(100, Math.round((average / 128) * 100));
        setAudioLevel(normalized);

        animFrameRef.current = requestAnimationFrame(updateLevel);
      };

      updateLevel();
    } catch {
      // Audio stream error (e.g. mic permission denied)
    }
  };

  const stopAudioAnalyser = () => {
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
    }
    if (audioContextRef.current) {
      audioContextRef.current.close().catch(() => {});
      audioContextRef.current = null;
    }
    analyserRef.current = null;
    setAudioLevel(0);
  };

  const stopListening = useCallback(() => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {
        // Ignore
      }
    }
    stopAudioAnalyser();
    setIsListening(false);
    if (config.soundCues) {
      audioCues.playStopCue();
    }
  }, [config.soundCues]);

  const startListening = useCallback(() => {
    if (!isSupported) {
      setError("Speech recognition is not supported in this browser.");
      onError?.("Speech recognition not supported");
      return;
    }

    // Stop any existing instance
    if (recognitionRef.current) {
      try {
        recognitionRef.current.abort();
      } catch {
        // Ignore
      }
    }

    try {
      const SpeechRec =
        (window as any).SpeechRecognition ||
        (window as any).webkitSpeechRecognition;
      const recognition = new SpeechRec();
      recognitionRef.current = recognition;

      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = config.lang || "en-US";

      let finalResult = "";

      recognition.onstart = () => {
        setIsListening(true);
        setError(null);
        setTranscript("");
        setInterimTranscript("");
        if (config.soundCues) {
          audioCues.playStartCue();
        }
        startAudioAnalyser();
      };

      recognition.onresult = (event: any) => {
        let interim = "";
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          const item = event.results[i];
          if (item.isFinal) {
            finalResult += item[0].transcript + " ";
          } else {
            interim += item[0].transcript;
          }
        }

        const currentFinal = finalResult.trim();
        const currentInterim = interim.trim();

        setTranscript(currentFinal);
        setInterimTranscript(currentInterim);
        onTranscriptChange?.(currentInterim || currentFinal, false);
      };

      recognition.onerror = (event: any) => {
        if (event.error !== "no-speech") {
          setError(event.error);
          onError?.(event.error);
        }
      };

      recognition.onend = () => {
        stopAudioAnalyser();
        setIsListening(false);
        const complete = (finalResult || "").trim();
        if (complete) {
          onFinalTranscript?.(complete);
          onTranscriptChange?.(complete, true);
        }
      };

      recognition.start();
    } catch (err: any) {
      setError(err.message || "Failed to start speech recognition");
      onError?.(err.message);
      setIsListening(false);
    }
  }, [
    isSupported,
    config.lang,
    config.soundCues,
    onError,
    onFinalTranscript,
    onTranscriptChange,
  ]);

  const toggleListening = useCallback(() => {
    if (isListening) {
      stopListening();
    } else {
      startListening();
    }
  }, [isListening, startListening, stopListening]);

  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort();
        } catch {
          // Ignore
        }
      }
      stopAudioAnalyser();
    };
  }, []);

  return {
    isSupported,
    isListening,
    transcript,
    interimTranscript,
    audioLevel,
    error,
    startListening,
    stopListening,
    toggleListening,
  };
}
