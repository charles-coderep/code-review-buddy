"use client";

import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";
import { Loader2, Terminal } from "lucide-react";

export interface ConsoleEntry {
  method: "log" | "warn" | "error" | "info";
  text: string;
  timestamp: number;
}

interface ConsoleOutputProps {
  entries: ConsoleEntry[];
  isRunning: boolean;
}

const methodStyles: Record<string, string> = {
  log: "text-foreground",
  info: "text-blue-400",
  warn: "text-yellow-400",
  error: "text-red-400",
};

const methodPrefix: Record<string, string> = {
  log: "",
  info: "\u2139 ",
  warn: "\u26A0 ",
  error: "\u2715 ",
};

export function ConsoleOutput({ entries, isRunning }: ConsoleOutputProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [entries.length]);

  return (
    <div className="h-full flex flex-col bg-[#1e1e1e] font-mono text-sm">
      <div className="flex items-center gap-2 px-3 py-1.5 border-b border-border/50 text-xs text-muted-foreground shrink-0">
        <Terminal className="h-3 w-3" />
        <span>Console Output</span>
        {isRunning && <Loader2 className="h-3 w-3 animate-spin ml-auto" />}
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-0.5">
        {entries.length === 0 && !isRunning ? (
          <p className="text-muted-foreground text-xs">
            Click &quot;Run&quot; to execute your code and see output here.
          </p>
        ) : (
          entries.map((entry, i) => (
            <div
              key={i}
              className={cn(
                "py-0.5 px-2 rounded-sm whitespace-pre-wrap break-all",
                methodStyles[entry.method] ?? "text-foreground",
                entry.method === "error" && "bg-red-500/10",
                entry.method === "warn" && "bg-yellow-500/10"
              )}
            >
              <span className="opacity-60">{methodPrefix[entry.method]}</span>
              {entry.text}
            </div>
          ))
        )}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}
