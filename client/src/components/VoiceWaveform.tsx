import React from "react";

interface VoiceWaveformProps {
  isListening: boolean;
  isSpeaking: boolean;
  audioLevel?: number; // 0 - 100
  barCount?: number;
  className?: string;
}

export const VoiceWaveform: React.FC<VoiceWaveformProps> = ({
  isListening,
  isSpeaking,
  audioLevel = 0,
  barCount = 16,
  className = "",
}) => {
  // Generate bar heights
  const bars = Array.from({ length: barCount }, (_, i) => {
    if (isListening) {
      // Dynamic height based on audio level with frequency variation
      const variance = Math.sin((i / barCount) * Math.PI) * 0.8 + 0.2;
      const height = Math.max(
        15,
        Math.min(100, (audioLevel * variance * 1.5) + (Math.random() * 10))
      );
      return height;
    } else if (isSpeaking) {
      // Gentle sine wave for speech synthesis
      const wave = Math.sin((Date.now() / 150) + i * 0.5);
      return 30 + Math.abs(wave) * 50;
    }
    // Idle state
    return 12;
  });

  return (
    <div
      className={`flex items-center justify-center gap-[3px] h-8 px-2 ${className}`}
      aria-label={
        isListening
          ? "Microphone listening"
          : isSpeaking
          ? "Assistant speaking"
          : "Voice idle"
      }
    >
      {bars.map((height, i) => (
        <span
          key={i}
          className={`w-[3px] rounded-full transition-all duration-75 ${
            isListening
              ? "bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.6)]"
              : isSpeaking
              ? "bg-cyan-400 shadow-[0_0_8px_rgba(34,211,238,0.6)]"
              : "bg-muted-foreground/30"
          }`}
          style={{
            height: `${height}%`,
            transitionProperty: "height, background-color, box-shadow",
          }}
        />
      ))}
    </div>
  );
};
