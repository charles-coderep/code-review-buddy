"use client";

import { useState, useEffect, useRef } from "react";
import dynamic from "next/dynamic";
import { submitReview } from "@/app/actions/review";
import type { ReviewResult } from "@/app/actions/review";
import { ReviewResults } from "@/components/review/review-results";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import {
  Loader2,
  Check,
  FileCode,
  Search,
  BarChart3,
  Brain,
  Database,
} from "lucide-react";

const MonacoEditor = dynamic(() => import("@monaco-editor/react"), {
  ssr: false,
  loading: () => <Skeleton className="h-[400px] w-full rounded-md" />,
});

const PIPELINE_STAGES = [
  { id: "parse", label: "Parsing AST", detail: "Building syntax tree with Babel", icon: FileCode, duration: 800 },
  { id: "detect", label: "Detecting patterns", detail: "Running 13 detectors across 98 topics", icon: Search, duration: 1200 },
  { id: "rate", label: "Updating Glicko-2 ratings", detail: "Calculating skill changes", icon: BarChart3, duration: 1500 },
  { id: "ai", label: "Coaching with AI", detail: "Generating feedback with Grok", icon: Brain, duration: 12000 },
  { id: "save", label: "Saving progress", detail: "Updating your skill profile", icon: Database, duration: 1500 },
];

function PipelineProgress({ currentStage }: { currentStage: number }) {
  return (
    <Card className="border-primary/30">
      <CardContent className="pt-6">
        <div className="space-y-3">
          {PIPELINE_STAGES.map((stage, i) => {
            const isComplete = i < currentStage;
            const isActive = i === currentStage;
            const isPending = i > currentStage;
            const Icon = stage.icon;

            return (
              <div
                key={stage.id}
                className={`flex items-center gap-3 transition-opacity duration-300 ${
                  isPending ? "opacity-30" : "opacity-100"
                }`}
              >
                <div className="w-6 h-6 flex items-center justify-center shrink-0">
                  {isComplete ? (
                    <Check className="h-4 w-4 text-green-400" />
                  ) : isActive ? (
                    <Loader2 className="h-4 w-4 animate-spin text-primary" />
                  ) : (
                    <Icon className="h-4 w-4 text-muted-foreground" />
                  )}
                </div>
                <div className="min-w-0">
                  <p className={`text-sm font-medium ${isActive ? "text-primary" : isComplete ? "text-green-400" : "text-muted-foreground"}`}>
                    {stage.label}
                  </p>
                  {(isActive || isComplete) && (
                    <p className="text-xs text-muted-foreground">{stage.detail}</p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

export default function ReviewPage() {
  const [code, setCode] = useState("");
  const [description, setDescription] = useState("");
  const [result, setResult] = useState<ReviewResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [pipelineStage, setPipelineStage] = useState(0);
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  // Clean up timers on unmount
  useEffect(() => {
    return () => {
      timersRef.current.forEach(clearTimeout);
    };
  }, []);

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

  async function handleSubmit() {
    if (!code.trim()) {
      setError("Please enter some code");
      return;
    }

    setLoading(true);
    setError("");
    setResult(null);
    startPipeline();

    const reviewResult = await submitReview({
      code,
      description: description || undefined,
    });

    stopPipeline();

    if (reviewResult.success) {
      setResult(reviewResult);
    } else {
      setError(reviewResult.error ?? "Something went wrong");
    }

    setLoading(false);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Get Code Coaching</h1>
        <p className="text-muted-foreground">
          Enter your JavaScript, React, or JSX code below. The system will
          automatically detect what you&apos;re writing and coach you accordingly.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Your Code</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="border border-border rounded-md overflow-hidden">
            <MonacoEditor
              height="400px"
              language="javascript"
              theme="vs-dark"
              value={code}
              onChange={(value) => setCode(value ?? "")}
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
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">
              Description (optional)
            </Label>
            <Input
              id="description"
              placeholder="What does this code do? Any specific areas you'd like feedback on?"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          {error && (
            <div className="text-sm text-destructive bg-destructive/10 p-3 rounded-md">
              {error}
            </div>
          )}

          <Button
            onClick={handleSubmit}
            disabled={loading || !code.trim()}
            className="w-full"
            size="lg"
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                Processing...
              </>
            ) : (
              "Submit for Coaching"
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Pipeline progress */}
      {loading && <PipelineProgress currentStage={pipelineStage} />}

      {/* Results */}
      {result && result.success && <ReviewResults result={result} />}
    </div>
  );
}
