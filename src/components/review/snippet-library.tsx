"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus, Trash2, FileCode, Save, Loader2 } from "lucide-react";
import type { SnippetListItem } from "@/app/actions/snippets";
import { cn } from "@/lib/utils";

interface SnippetLibraryProps {
  snippets: SnippetListItem[];
  activeId: string | null;
  loading: boolean;
  onSelect: (id: string) => void;
  onNew: () => void;
  onDelete: (id: string) => void;
  // File controls
  title: string;
  onTitleChange: (title: string) => void;
  onSave: () => void;
  isDirty: boolean;
  isSaving: boolean;
  hasUnsavedDraft: boolean;
}

function timeAgo(date: Date): string {
  const seconds = Math.floor(
    (Date.now() - new Date(date).getTime()) / 1000
  );
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export function SnippetLibrary({
  snippets,
  activeId,
  loading,
  onSelect,
  onNew,
  onDelete,
  title,
  onTitleChange,
  onSave,
  isDirty,
  isSaving,
  hasUnsavedDraft,
}: SnippetLibraryProps) {
  return (
    <div className="h-full flex flex-col bg-background border-r border-border">
      {/* File controls header */}
      <div className="p-2 border-b border-border shrink-0">
        <div className="flex items-center gap-1">
          <Input
            value={title}
            onChange={(e) => {
              onTitleChange(e.target.value);
            }}
            className="h-7 text-xs flex-1 min-w-0"
            placeholder="Snippet name..."
          />
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 shrink-0 cursor-pointer"
            onClick={onSave}
            disabled={!isDirty || isSaving}
          >
            {isSaving ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Save className="h-3.5 w-3.5" />
            )}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 shrink-0 cursor-pointer"
            onClick={onNew}
          >
            <Plus className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {/* Snippet list */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="p-2 space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        ) : snippets.length === 0 && !hasUnsavedDraft ? (
          <div className="p-4 text-center text-sm text-muted-foreground">
            <FileCode className="h-8 w-8 mx-auto mb-2 opacity-50" />
            No snippets yet.
            <br />
            Create one to get started.
          </div>
        ) : (
          <div className="p-1 space-y-0.5">
            {/* Unsaved draft entry */}
            {hasUnsavedDraft && !activeId && (
              <div
                className={cn(
                  "w-full text-left px-3 py-2 rounded-md text-sm",
                  "ring-1 ring-primary/40 bg-transparent opacity-60"
                )}
              >
                <p className="font-medium truncate italic">
                  {title || "Untitled"}
                </p>
                <span className="text-xs text-muted-foreground">Unsaved</span>
              </div>
            )}

            {/* Saved snippets */}
            {snippets.map((snippet) => (
              <div
                key={snippet.id}
                role="button"
                tabIndex={0}
                onClick={() => onSelect(snippet.id)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") onSelect(snippet.id);
                }}
                className={cn(
                  "w-full text-left px-3 py-2 rounded-md text-sm transition-colors group flex items-center justify-between cursor-pointer",
                  snippet.id === activeId
                    ? "ring-1 ring-white/60 bg-accent text-accent-foreground"
                    : "bg-muted/40 hover:bg-accent/50"
                )}
              >
                <div className="min-w-0 flex-1">
                  <p className="font-medium truncate">{snippet.title}</p>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Badge
                      variant="outline"
                      className="text-[10px] px-1 py-0"
                    >
                      {snippet.language}
                    </Badge>
                    <span>{timeAgo(snippet.updatedAt)}</span>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 opacity-0 group-hover:opacity-100 shrink-0 ml-1 cursor-pointer"
                  onClick={(e) => {
                    e.stopPropagation();
                    onDelete(snippet.id);
                  }}
                >
                  <Trash2 className="h-3 w-3 text-destructive" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
