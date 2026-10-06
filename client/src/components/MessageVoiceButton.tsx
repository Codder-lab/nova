import React from "react";
import { Volume2, Square } from "lucide-react";
import { cn } from "@/lib/utils";

interface MessageVoiceButtonProps {
  isSpeakingThis: boolean;
  onToggle: () => void;
  disabled?: boolean;
  className?: string;
}

export const MessageVoiceButton: React.FC<MessageVoiceButtonProps> = ({
  isSpeakingThis,
  onToggle,
  disabled = false,
  className = "",
}) => {
  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        onToggle();
      }}
      disabled={disabled}
      className={cn(
        "flex items-center gap-1 text-[11px] py-0.5 px-1.5 rounded transition-colors cursor-pointer",
        isSpeakingThis
          ? "bg-primary/10 text-primary font-medium"
          : "text-muted-foreground hover:text-foreground hover:bg-muted",
        disabled && "opacity-50 cursor-not-allowed",
        className
      )}
      title={isSpeakingThis ? "Stop speaking" : "Read aloud"}
      aria-label={isSpeakingThis ? "Stop reading message aloud" : "Read message aloud"}
    >
      {isSpeakingThis ? (
        <>
          <div className="flex items-center gap-0.5 h-3">
            <span className="w-0.5 h-2.5 bg-primary rounded-full animate-pulse" />
            <span
              className="w-0.5 h-3.5 bg-primary rounded-full animate-pulse"
              style={{ animationDelay: "150ms" }}
            />
            <span
              className="w-0.5 h-2 bg-primary rounded-full animate-pulse"
              style={{ animationDelay: "300ms" }}
            />
          </div>
          <Square className="w-2.5 h-2.5 fill-current ml-0.5" />
          <span className="text-[10px]">Stop</span>
        </>
      ) : (
        <>
          <Volume2 className="w-3 h-3" />
          <span className="text-[10px]">Read</span>
        </>
      )}
    </button>
  );
};
