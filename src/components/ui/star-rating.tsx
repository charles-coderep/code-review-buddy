"use client";

import { cn } from "@/lib/utils";

interface StarRatingProps {
  stars: number;
  confidence: number;
  size?: "sm" | "md" | "lg";
  showLabel?: boolean;
  level?: string;
}

export function StarRating({
  stars,
  confidence,
  size = "md",
  showLabel = false,
  level,
}: StarRatingProps) {
  const sizeClasses = {
    sm: "text-sm",
    md: "text-base",
    lg: "text-xl",
  };

  const starsDisplay = "\u2605".repeat(stars) + "\u2606".repeat(5 - stars);
  const confidenceDisplay =
    "\u25CF".repeat(confidence) + "\u25CB".repeat(3 - confidence);

  return (
    <div className="flex flex-col items-end gap-0.5">
      {showLabel && level && (
        <span
          className={cn("text-muted-foreground", size === "lg" ? "text-sm" : "text-xs")}
        >
          {level}
        </span>
      )}
      <span className={cn("tracking-wider", sizeClasses[size])}>
        {starsDisplay}
      </span>
      <span
        className={cn(
          "text-muted-foreground tracking-wider",
          size === "lg" ? "text-sm" : "text-xs"
        )}
      >
        {confidenceDisplay}
      </span>
    </div>
  );
}
