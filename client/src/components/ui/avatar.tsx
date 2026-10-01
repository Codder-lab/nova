import * as React from "react";
import { cn } from "@/lib/utils";

export interface AvatarProps extends React.HTMLAttributes<HTMLDivElement> {
  size?: "sm" | "md" | "lg";
}

export function Avatar({ className, size = "md", ...props }: AvatarProps) {
  const sizeClasses = {
    sm: "h-7 w-7 text-xs",
    md: "h-8 w-8 text-xs font-medium",
    lg: "h-10 w-10 text-sm font-medium",
  }[size];

  return (
    <div
      className={cn(
        "relative flex shrink-0 items-center justify-center overflow-hidden rounded-md bg-secondary text-secondary-foreground border border-border",
        sizeClasses,
        className,
      )}
      {...props}
    />
  );
}
