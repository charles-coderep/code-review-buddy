"use client";

import { useState } from "react";
import ReactMarkdown from "react-markdown";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import {
  ArrowUp,
  ArrowDown,
  Minus,
  Sparkles,
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  Check,
  X,
  Star,
} from "lucide-react";

interface ReviewResultData {
  feedback?: {
    id: string;
    text: string;
    tokensUsed: number;
  };
  skillChanges?: Array<{
    topicSlug: string;
    topicName: string;
    ratingBefore: number;
    ratingAfter: number;
    change: number;
    errorType: string | null;
  }>;
  progressUpdates?: {
    newUnlocks: string[];
    stuckTopics: Array<{ slug: string; name: string }>;
  };
  analysisPreview?: {
    issuesCount: number;
    positiveCount: number;
    topicsDetected: string[];
  };
  engineDetails?: {
    language: string;
    isReact: boolean;
    parseErrors: number;
    detections: Array<{
      topicSlug: string;
      detected: boolean;
      isPositive: boolean;
      isNegative: boolean;
      isIdiomatic: boolean;
      details?: string;
      location?: { line: number; column: number };
    }>;
    performanceScores: Array<{
      topicSlug: string;
      score: number;
      positiveCount: number;
      negativeCount: number;
      idiomaticCount: number;
    }>;
    aiEvaluations: Array<{
      slug: string;
      score: number;
      reason: string;
    }>;
    scoringSource: "ai" | "ast-fallback";
  };
}

function errorTypeBadgeVariant(
  errorType: string | null
): "default" | "secondary" | "destructive" | "outline" {
  switch (errorType) {
    case "SLIP":
      return "secondary";
    case "MISCONCEPTION":
      return "destructive";
    case "MISTAKE":
      return "default";
    default:
      return "outline";
  }
}

function stripLeadingHeadings(text: string): string {
  return text.replace(/^(?:#{1,3}\s+.+\n+)+/, "").trimStart();
}

function EngineDetails({
  details,
}: {
  details: NonNullable<ReviewResultData["engineDetails"]>;
}) {
  const [open, setOpen] = useState(false);

  return (
    <Card className="border-muted">
      <CardHeader className="pb-0">
        <Button
          variant="ghost"
          className="w-full justify-between p-0 h-auto hover:bg-transparent"
          onClick={() => setOpen(!open)}
        >
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Engine Details
          </CardTitle>
          {open ? (
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          ) : (
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          )}
        </Button>
      </CardHeader>
      {open && (
        <CardContent className="pt-4 space-y-4">
          {/* Detection context */}
          <div className="flex gap-4 text-xs text-muted-foreground">
            <span>
              Language:{" "}
              <span className="font-medium text-foreground">
                {details.language}
              </span>
            </span>
            <span>
              React:{" "}
              <span className="font-medium text-foreground">
                {details.isReact ? "yes" : "no"}
              </span>
            </span>
            <span>
              Parse errors:{" "}
              <span className="font-medium text-foreground">
                {details.parseErrors}
              </span>
            </span>
            <span>
              Scoring:{" "}
              <Badge
                variant="outline"
                className={`text-[10px] px-1.5 py-0 ${
                  details.scoringSource === "ai"
                    ? "bg-blue-600/10 text-blue-400 border-blue-600/30"
                    : "bg-yellow-600/10 text-yellow-400 border-yellow-600/30"
                }`}
              >
                {details.scoringSource === "ai" ? "AI" : "AST fallback"}
              </Badge>
            </span>
          </div>

          {/* Raw detections */}
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-2">
              AST Detections — topic presence ({details.detections.length})
            </p>
            <div className="space-y-1">
              {details.detections.map((d, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between text-xs bg-muted/30 rounded px-3 py-1.5"
                >
                  <div className="flex items-center gap-2">
                    <code className="text-primary">{d.topicSlug}</code>
                    {d.location && (
                      <span className="text-muted-foreground">
                        L{d.location.line}:{d.location.column}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {d.isPositive && (
                      <Badge
                        variant="outline"
                        className="text-[10px] px-1.5 py-0 bg-green-600/10 text-green-400 border-green-600/30"
                      >
                        <Check className="h-2.5 w-2.5 mr-0.5" />
                        positive
                      </Badge>
                    )}
                    {d.isNegative && (
                      <Badge
                        variant="outline"
                        className="text-[10px] px-1.5 py-0 bg-red-600/10 text-red-400 border-red-600/30"
                      >
                        <X className="h-2.5 w-2.5 mr-0.5" />
                        negative
                      </Badge>
                    )}
                    {d.isIdiomatic && (
                      <Badge
                        variant="outline"
                        className="text-[10px] px-1.5 py-0 bg-yellow-600/10 text-yellow-400 border-yellow-600/30"
                      >
                        <Star className="h-2.5 w-2.5 mr-0.5" />
                        idiomatic
                      </Badge>
                    )}
                    {d.details && (
                      <span className="text-muted-foreground max-w-[200px] truncate">
                        {d.details}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* AI evaluations */}
          {details.aiEvaluations.length > 0 && (
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-2">
                AI Evaluations ({details.aiEvaluations.length})
              </p>
              <div className="space-y-1">
                {details.aiEvaluations.map((ev, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between text-xs bg-muted/30 rounded px-3 py-1.5"
                  >
                    <div className="flex items-center gap-2">
                      <code className="text-primary">{ev.slug}</code>
                      <span className="text-muted-foreground max-w-[300px] truncate">
                        {ev.reason}
                      </span>
                    </div>
                    <span
                      className={`font-mono font-medium ${
                        ev.score >= 0.8
                          ? "text-green-400"
                          : ev.score >= 0.5
                            ? "text-yellow-400"
                            : "text-red-400"
                      }`}
                    >
                      {ev.score.toFixed(1)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Performance scores (AST fallback) */}
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-2">
              AST Performance Scores{details.scoringSource === "ast-fallback" ? " (active)" : " (reference)"}
            </p>
            <div className="space-y-1">
              {details.performanceScores.map((p, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between text-xs bg-muted/30 rounded px-3 py-1.5"
                >
                  <code className="text-primary">{p.topicSlug}</code>
                  <div className="flex items-center gap-3">
                    <span className="text-muted-foreground">
                      +{p.positiveCount} / -{p.negativeCount}
                      {p.idiomaticCount > 0 && ` / ★${p.idiomaticCount}`}
                    </span>
                    <span
                      className={`font-mono font-medium ${
                        p.score >= 0.8
                          ? "text-green-400"
                          : p.score >= 0.5
                            ? "text-yellow-400"
                            : "text-red-400"
                      }`}
                    >
                      {p.score.toFixed(2)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      )}
    </Card>
  );
}

export function ReviewResults({ result }: { result: ReviewResultData }) {
  return (
    <div className="space-y-6">
      {/* New unlocks */}
      {result.progressUpdates &&
        result.progressUpdates.newUnlocks.length > 0 && (
          <Card className="border-primary/50">
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <Sparkles className="h-5 w-5 text-primary" />
                <div>
                  <p className="font-medium">Layer Unlocked!</p>
                  <p className="text-sm text-muted-foreground">
                    You unlocked:{" "}
                    {result.progressUpdates.newUnlocks.join(", ")}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

      {/* Analysis summary */}
      {result.analysisPreview && (
        <div className="flex gap-4 text-sm">
          <span className="text-muted-foreground">
            <span className="font-medium text-foreground">
              {result.analysisPreview.topicsDetected.length}
            </span>{" "}
            topics detected
          </span>
          <span className="text-muted-foreground">
            <span className="font-medium text-green-400">
              {result.analysisPreview.positiveCount}
            </span>{" "}
            positive
          </span>
          <span className="text-muted-foreground">
            <span className="font-medium text-red-400">
              {result.analysisPreview.issuesCount}
            </span>{" "}
            issues
          </span>
        </div>
      )}

      {/* AI Feedback */}
      {result.feedback && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Coaching Feedback</CardTitle>
          </CardHeader>
          <CardContent className="prose prose-invert prose-sm max-w-none">
            <ReactMarkdown>
              {stripLeadingHeadings(result.feedback.text)}
            </ReactMarkdown>
          </CardContent>
        </Card>
      )}

      {/* Skill changes */}
      {result.skillChanges && result.skillChanges.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Skill Changes</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {result.skillChanges.map((change, i) => (
                <div key={i}>
                  {i > 0 && <Separator className="mb-2" />}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">
                        {change.topicName}
                      </span>
                      {change.errorType && (
                        <Badge
                          variant={errorTypeBadgeVariant(change.errorType)}
                          className="text-xs"
                        >
                          {change.errorType}
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <span className="text-muted-foreground">
                        {change.ratingBefore}
                      </span>
                      <span className="text-muted-foreground">&rarr;</span>
                      <span>{change.ratingAfter}</span>
                      <span
                        className={
                          change.change > 0
                            ? "text-green-400"
                            : change.change < 0
                              ? "text-red-400"
                              : "text-muted-foreground"
                        }
                      >
                        {change.change > 0 ? (
                          <ArrowUp className="h-3 w-3 inline" />
                        ) : change.change < 0 ? (
                          <ArrowDown className="h-3 w-3 inline" />
                        ) : (
                          <Minus className="h-3 w-3 inline" />
                        )}
                        {change.change > 0 ? "+" : ""}
                        {change.change}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Stuck topics warning */}
      {result.progressUpdates &&
        result.progressUpdates.stuckTopics.length > 0 && (
          <Card className="border-destructive/50">
            <CardContent className="pt-6">
              <div className="flex items-start gap-3">
                <AlertTriangle className="h-5 w-5 text-destructive mt-0.5" />
                <div>
                  <p className="font-medium">Stuck Topics</p>
                  <p className="text-sm text-muted-foreground">
                    You&apos;re stuck on:{" "}
                    {result.progressUpdates.stuckTopics
                      .map((t) => t.name)
                      .join(", ")}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

      {/* Engine details (collapsible) */}
      {result.engineDetails && <EngineDetails details={result.engineDetails} />}
    </div>
  );
}
