"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import dynamic from "next/dynamic";
import { Group as PanelGroup, Panel, Separator as PanelResizeHandle } from "react-resizable-panels";
import { submitReview } from "@/app/actions/review";
import type { ReviewResult } from "@/app/actions/review";
import {
  createSnippet,
  updateSnippet,
  deleteSnippet,
  getUserSnippets,
  getSnippet,
  type SnippetListItem,
} from "@/app/actions/snippets";
import { ReviewResults } from "@/components/review/review-results";
import {
  PipelineProgress,
  PIPELINE_STAGES,
} from "@/components/review/pipeline-progress";
import { SnippetLibrary } from "@/components/review/snippet-library";
import {
  ConsoleOutput,
  type ConsoleEntry,
} from "@/components/review/console-output";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Sheet,
  SheetContent,
  SheetTrigger,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Loader2,
  Play,
  Send,
  Save,
  PanelLeftClose,
  PanelLeft,
} from "lucide-react";

const MonacoEditor = dynamic(() => import("@monaco-editor/react"), {
  ssr: false,
  loading: () => <Skeleton className="h-full w-full rounded-md" />,
});

export default function ReviewPage() {
  // -- Snippet state --
  const [activeSnippetId, setActiveSnippetId] = useState<string | null>(null);
  const [title, setTitle] = useState("Untitled");
  const [code, setCode] = useState("");
  const [language] = useState("javascript");

  // -- Snippet list --
  const [snippets, setSnippets] = useState<SnippetListItem[]>([]);
  const [snippetsLoading, setSnippetsLoading] = useState(true);

  // -- Review/coaching state --
  const [result, setResult] = useState<ReviewResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [pipelineStage, setPipelineStage] = useState(0);

  // -- Console state --
  const [consoleEntries, setConsoleEntries] = useState<ConsoleEntry[]>([]);
  const [isRunning, setIsRunning] = useState(false);

  // -- UX state --
  const [isDirty, setIsDirty] = useState(false);
  const [isStale, setIsStale] = useState(false);
  const [activeTab, setActiveTab] = useState("coaching");
  const [mobileTab, setMobileTab] = useState("editor");
  const [showLibrary, setShowLibrary] = useState(true);
  const [mobileLibraryOpen, setMobileLibraryOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // -- Refs --
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const workerRef = useRef<Worker | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const codeAtCoachingRef = useRef<string>("");

  // =============================================
  // Load snippets on mount
  // =============================================
  useEffect(() => {
    getUserSnippets().then((res) => {
      if (res.success && res.data) setSnippets(res.data);
      setSnippetsLoading(false);
    });
  }, []);

  // =============================================
  // Cleanup on unmount
  // =============================================
  useEffect(() => {
    return () => {
      workerRef.current?.terminate();
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      timersRef.current.forEach(clearTimeout);
    };
  }, []);

  // =============================================
  // Pipeline animation
  // =============================================
  function startPipeline() {
    setPipelineStage(0);
    timersRef.current.forEach(clearTimeout);
    timersRef.current = [];

    let elapsed = 0;
    for (let i = 0; i < PIPELINE_STAGES.length; i++) {
      elapsed += PIPELINE_STAGES[i].duration;
      const timer = setTimeout(() => {
        setPipelineStage(i + 1);
      }, elapsed);
      timersRef.current.push(timer);
    }
  }

  function stopPipeline() {
    timersRef.current.forEach(clearTimeout);
    timersRef.current = [];
    setPipelineStage(0);
  }

  // =============================================
  // Handlers
  // =============================================
  const handleCodeChange = useCallback(
    (value: string | undefined) => {
      const newCode = value ?? "";
      setCode(newCode);
      setIsDirty(true);
      if (result && newCode !== codeAtCoachingRef.current) {
        setIsStale(true);
      } else if (result && newCode === codeAtCoachingRef.current) {
        setIsStale(false);
      }
    },
    [result]
  );

  const refreshSnippetList = useCallback(async () => {
    const res = await getUserSnippets();
    if (res.success && res.data) setSnippets(res.data);
  }, []);

  const handleLoadSnippet = useCallback(
    async (id: string) => {
      const res = await getSnippet(id);
      if (res.success && res.data) {
        setActiveSnippetId(res.data.id);
        setTitle(res.data.title);
        setCode(res.data.code);
        setIsDirty(false);
        setIsStale(false);
        setResult(null);
        setConsoleEntries([]);
        setError("");
      }
      setMobileLibraryOpen(false);
    },
    []
  );

  const handleSave = useCallback(async () => {
    setIsSaving(true);
    try {
      if (activeSnippetId) {
        await updateSnippet(activeSnippetId, { title, code, language });
      } else {
        const res = await createSnippet({ title, code, language });
        if (res.success && res.data) {
          setActiveSnippetId(res.data.id);
        }
      }
      setIsDirty(false);
      await refreshSnippetList();
    } finally {
      setIsSaving(false);
    }
  }, [activeSnippetId, title, code, language, refreshSnippetList]);

  const handleNewSnippet = useCallback(() => {
    setActiveSnippetId(null);
    setTitle("Untitled");
    setCode("");
    setIsDirty(false);
    setIsStale(false);
    setResult(null);
    setConsoleEntries([]);
    setError("");
    setMobileLibraryOpen(false);
  }, []);

  const handleDeleteSnippet = useCallback(
    async (id: string) => {
      await deleteSnippet(id);
      if (id === activeSnippetId) {
        handleNewSnippet();
      }
      await refreshSnippetList();
    },
    [activeSnippetId, handleNewSnippet, refreshSnippetList]
  );

  const handleRun = useCallback(() => {
    if (!code.trim()) return;

    setConsoleEntries([]);
    setIsRunning(true);
    setActiveTab("console");
    setMobileTab("console");

    // Terminate any existing worker
    if (workerRef.current) workerRef.current.terminate();
    if (timeoutRef.current) clearTimeout(timeoutRef.current);

    const worker = new Worker("/sandbox-worker.js");
    workerRef.current = worker;

    worker.onmessage = (event) => {
      const { type, method, args } = event.data;
      if (type === "console") {
        setConsoleEntries((prev) => [
          ...prev,
          { method, text: args.join(" "), timestamp: Date.now() },
        ]);
      } else if (type === "done") {
        setIsRunning(false);
        if (timeoutRef.current) clearTimeout(timeoutRef.current);
      }
    };

    worker.onerror = () => {
      setConsoleEntries((prev) => [
        ...prev,
        { method: "error", text: "Worker error", timestamp: Date.now() },
      ]);
      setIsRunning(false);
    };

    worker.postMessage({ type: "execute", code });

    // 3-second timeout safety valve
    timeoutRef.current = setTimeout(() => {
      worker.terminate();
      workerRef.current = null;
      setConsoleEntries((prev) => [
        ...prev,
        {
          method: "error",
          text: "Execution timed out (3s limit)",
          timestamp: Date.now(),
        },
      ]);
      setIsRunning(false);
    }, 3000);
  }, [code]);

  const handleSubmitForCoaching = useCallback(async () => {
    if (!code.trim()) {
      setError("Please enter some code");
      return;
    }

    setLoading(true);
    setError("");
    setResult(null);
    setIsStale(false);
    codeAtCoachingRef.current = code;
    setActiveTab("coaching");
    setMobileTab("coaching");
    startPipeline();

    const reviewResult = await submitReview({
      code,
      snippetId: activeSnippetId || undefined,
    });

    stopPipeline();

    if (reviewResult.success) {
      setResult(reviewResult);
    } else {
      setError(reviewResult.error ?? "Something went wrong");
    }

    setLoading(false);
  }, [code, activeSnippetId]);

  // =============================================
  // Keyboard shortcuts
  // =============================================
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const mod = e.ctrlKey || e.metaKey;
      if (mod && e.key === "s") {
        e.preventDefault();
        handleSave();
      }
      if (mod && e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleRun();
      }
      if (mod && e.shiftKey && e.key === "Enter") {
        e.preventDefault();
        handleSubmitForCoaching();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleSave, handleRun, handleSubmitForCoaching]);

  // =============================================
  // Shared sub-components
  // =============================================
  const monacoEditor = (
    <MonacoEditor
      height="100%"
      language={language}
      theme="vs-dark"
      value={code}
      onChange={handleCodeChange}
      options={{
        minimap: { enabled: false },
        fontSize: 14,
        lineNumbers: "on",
        scrollBeyondLastLine: false,
        automaticLayout: true,
        wordWrap: "on",
        tabSize: 2,
        padding: { top: 12 },
      }}
    />
  );

  const coachingContent = (
    <div className={isStale ? "opacity-50" : ""}>
      {isStale && (
        <p className="text-xs text-yellow-500 mb-2">
          Code has changed since this coaching. Re-submit for updated results.
        </p>
      )}
      {loading && <PipelineProgress currentStage={pipelineStage} />}
      {error && (
        <div className="text-sm text-destructive bg-destructive/10 p-3 rounded-md">
          {error}
        </div>
      )}
      {result && result.success && <ReviewResults result={result} />}
      {!loading && !result && !error && (
        <div className="flex items-center justify-center h-32 text-muted-foreground text-sm">
          Submit code for AI coaching feedback
        </div>
      )}
    </div>
  );

  const staleDot = isStale && (
    <span className="ml-1 w-2 h-2 rounded-full bg-yellow-500 inline-block" />
  );

  // =============================================
  // Render
  // =============================================
  return (
    <div className="h-[calc(100dvh-49px)] lg:h-screen flex flex-col">
      {/* ============ TOOLBAR ============ */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-border bg-background shrink-0">
        {/* Library toggle - desktop */}
        <Button
          variant="ghost"
          size="icon"
          className="hidden lg:inline-flex"
          onClick={() => setShowLibrary(!showLibrary)}
        >
          {showLibrary ? (
            <PanelLeftClose className="h-4 w-4" />
          ) : (
            <PanelLeft className="h-4 w-4" />
          )}
        </Button>

        {/* Library toggle - mobile (Sheet) */}
        <Sheet open={mobileLibraryOpen} onOpenChange={setMobileLibraryOpen}>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" className="lg:hidden">
              <PanelLeft className="h-4 w-4" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-72 p-0">
            <SheetTitle className="sr-only">Snippet Library</SheetTitle>
            <SnippetLibrary
              snippets={snippets}
              activeId={activeSnippetId}
              loading={snippetsLoading}
              onSelect={handleLoadSnippet}
              onNew={handleNewSnippet}
              onDelete={handleDeleteSnippet}
            />
          </SheetContent>
        </Sheet>

        {/* Title input - desktop */}
        <Input
          value={title}
          onChange={(e) => {
            setTitle(e.target.value);
            setIsDirty(true);
          }}
          className="hidden sm:block w-48 h-8 text-sm"
          placeholder="Snippet title..."
        />

        {/* Title label - mobile */}
        <span className="sm:hidden text-sm font-medium truncate max-w-32">
          {title}
        </span>

        <div className="flex-1" />

        {/* Save */}
        <Button
          variant="ghost"
          size="sm"
          onClick={handleSave}
          disabled={!isDirty || isSaving}
        >
          {isSaving ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Save className="h-4 w-4" />
          )}
          <span className="hidden sm:inline ml-1">Save</span>
        </Button>

        {/* Run */}
        <Button
          variant="outline"
          size="sm"
          onClick={handleRun}
          disabled={isRunning || !code.trim()}
        >
          <Play className="h-4 w-4" />
          <span className="hidden sm:inline ml-1">Run</span>
        </Button>

        {/* Submit for Coaching */}
        <Button
          size="sm"
          onClick={handleSubmitForCoaching}
          disabled={loading || !code.trim()}
        >
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Send className="h-4 w-4" />
          )}
          <span className="hidden sm:inline ml-1">Submit for Coaching</span>
        </Button>
      </div>

      {/* ============ DESKTOP 3-PANE LAYOUT ============ */}
      <div className="flex-1 hidden lg:block overflow-hidden">
        <PanelGroup
          orientation="horizontal"
        >
          {/* Pane A: Snippet Library */}
          {showLibrary && (
            <>
              <Panel defaultSize="18%" minSize="14%" maxSize="30%">
                <SnippetLibrary
                  snippets={snippets}
                  activeId={activeSnippetId}
                  loading={snippetsLoading}
                  onSelect={handleLoadSnippet}
                  onNew={handleNewSnippet}
                  onDelete={handleDeleteSnippet}
                />
              </Panel>
              <PanelResizeHandle className="w-1 bg-border hover:bg-primary/50 transition-colors" />
            </>
          )}

          {/* Pane B: Monaco Editor */}
          <Panel defaultSize={showLibrary ? "50%" : "58%"} minSize="30%">
            {monacoEditor}
          </Panel>

          <PanelResizeHandle className="w-1 bg-border hover:bg-primary/50 transition-colors" />

          {/* Pane C: Tabbed Output */}
          <Panel defaultSize="32%" minSize="20%">
            <Tabs
              value={activeTab}
              onValueChange={setActiveTab}
              className="h-full flex flex-col"
            >
              <TabsList className="shrink-0 mx-2 mt-2">
                <TabsTrigger value="console">Console</TabsTrigger>
                <TabsTrigger value="coaching">
                  Coaching
                  {staleDot}
                </TabsTrigger>
              </TabsList>
              <TabsContent
                value="console"
                className="flex-1 overflow-hidden"
              >
                <ConsoleOutput
                  entries={consoleEntries}
                  isRunning={isRunning}
                />
              </TabsContent>
              <TabsContent
                value="coaching"
                className="flex-1 overflow-auto p-3"
              >
                {coachingContent}
              </TabsContent>
            </Tabs>
          </Panel>
        </PanelGroup>
      </div>

      {/* ============ MOBILE TAB LAYOUT ============ */}
      <div className="flex-1 lg:hidden flex flex-col overflow-hidden">
        <Tabs
          value={mobileTab}
          onValueChange={setMobileTab}
          className="flex-1 flex flex-col"
        >
          <TabsList className="shrink-0 mx-2 mt-1">
            <TabsTrigger value="editor">Editor</TabsTrigger>
            <TabsTrigger value="console">Console</TabsTrigger>
            <TabsTrigger value="coaching">
              Coaching
              {staleDot}
            </TabsTrigger>
          </TabsList>

          <TabsContent
            value="editor"
            className="flex-1 overflow-hidden"
          >
            {monacoEditor}
          </TabsContent>

          <TabsContent
            value="console"
            className="flex-1 overflow-hidden"
          >
            <ConsoleOutput entries={consoleEntries} isRunning={isRunning} />
          </TabsContent>

          <TabsContent
            value="coaching"
            className="flex-1 overflow-auto p-3"
          >
            {coachingContent}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
