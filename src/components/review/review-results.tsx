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
  X,
  Check,
  Braces,
  Shield,
  GitBranch,
  Activity,
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
    tier: "scored" | "neutral";
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
    neutralCount: number;
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
      isInferred?: boolean;
      details?: string;
      location?: { line: number; column: number };
      source?: "babel" | "eslint" | "dataflow";
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
  scoringAudit?: Array<{
    topicSlug: string;
    topicName: string;
    tier: "scored" | "neutral";
    ratingBefore: number;
    rdBefore: number;
    volatilityBefore: number;
    aiScore: number | null;
    aiReason: string | null;
    performanceScore: number;
    expectedScore: number;
    surprise: number;
    ratingAfter: number;
    rdAfter: number;
    ratingChange: number;
    errorType: string | null;
  }>;
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

function SkillChanges({
  changes,
  aiEvaluations,
}: {
  changes: NonNullable<ReviewResultData["skillChanges"]>;
  aiEvaluations?: Array<{ slug: string; score: number; reason: string }>;
}) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const toggleExpand = (slug: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(slug)) next.delete(slug);
      else next.add(slug);
      return next;
    });
  };

  const evalMap = new Map(aiEvaluations?.map((e) => [e.slug, e]) ?? []);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Skill Changes</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {changes.map((change, i) => {
            const evaluation = evalMap.get(change.topicSlug);
            const isExpanded = expanded.has(change.topicSlug);
            const isNeutral = change.tier === "neutral";
            return (
              <div key={i}>
                {i > 0 && <Separator className="mb-2" />}
                <div
                  className={`flex items-center justify-between ${
                    isNeutral ? "" : evaluation ? "cursor-pointer" : ""
                  }`}
                  onClick={() => !isNeutral && evaluation && toggleExpand(change.topicSlug)}
                >
                  <div className="flex items-center gap-2">
                    {!isNeutral && evaluation && (
                      isExpanded ? (
                        <ChevronDown className="h-3 w-3 text-muted-foreground shrink-0" />
                      ) : (
                        <ChevronRight className="h-3 w-3 text-muted-foreground shrink-0" />
                      )
                    )}
                    <span className={`text-sm font-medium ${isNeutral ? "text-muted-foreground" : ""}`}>
                      {change.topicName}
                    </span>
                    {isNeutral ? (
                      <Badge
                        variant="outline"
                        className="text-[10px] px-1.5 py-0 bg-muted/30 text-muted-foreground border-border"
                      >
                        NEUTRAL
                      </Badge>
                    ) : (
                      change.errorType && (
                        <Badge
                          variant={errorTypeBadgeVariant(change.errorType)}
                          className="text-xs"
                        >
                          {change.errorType}
                        </Badge>
                      )
                    )}
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    {isNeutral ? (
                      <span className="text-xs text-muted-foreground italic">not scored</span>
                    ) : (
                      <>
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
                      </>
                    )}
                  </div>
                </div>
                {!isNeutral && isExpanded && evaluation && (
                  <div className="ml-5 mt-1 text-xs text-muted-foreground bg-muted/30 rounded px-3 py-2 flex items-center gap-2">
                    <span
                      className={`font-mono font-medium shrink-0 ${
                        evaluation.score >= 0.8
                          ? "text-green-400"
                          : evaluation.score >= 0.5
                            ? "text-yellow-400"
                            : "text-red-400"
                      }`}
                    >
                      {evaluation.score.toFixed(1)}
                    </span>
                    <span>&mdash;</span>
                    <span>{evaluation.reason}</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
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
          <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
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
              Detections:{" "}
              <span className="font-medium text-amber-400">
                {details.detections.filter((d) => d.source !== "eslint" && d.source !== "dataflow").length} Babel
              </span>
              {details.detections.some((d) => d.source === "eslint") && (
                <>
                  {" + "}
                  <span className="font-medium text-purple-400">
                    {details.detections.filter((d) => d.source === "eslint" && d.isNegative).length}
                  </span>
                  {details.detections.some((d) => d.source === "eslint" && d.isInferred) && (
                    <>
                      /
                      <span className="font-medium text-muted-foreground">
                        {details.detections.filter((d) => d.source === "eslint" && d.isInferred).length}
                      </span>
                    </>
                  )}
                  <span className="font-medium text-purple-400"> ESLint</span>
                </>
              )}
              {details.detections.some((d) => d.source === "dataflow") && (
                <>
                  {" + "}
                  <span className="font-medium text-blue-400">
                    {details.detections.filter((d) => d.source === "dataflow" && d.isNegative).length}
                  </span>
                  {details.detections.some((d) => d.source === "dataflow" && d.isInferred) && (
                    <>
                      /
                      <span className="font-medium text-muted-foreground">
                        {details.detections.filter((d) => d.source === "dataflow" && d.isInferred).length}
                      </span>
                    </>
                  )}
                  <span className="font-medium text-blue-400"> Data Flow</span>
                </>
              )}
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

          {/* Detection sections by source */}
          {(() => {
            const babelDetections = details.detections.filter((d) => d.source !== "eslint" && d.source !== "dataflow");
            const eslintDetections = details.detections.filter((d) => d.source === "eslint");
            const dataflowDetections = details.detections.filter((d) => d.source === "dataflow");
            return (
              <>
                {/* Babel AST Detections — orange/amber */}
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1.5">
                    <Braces className="h-3 w-3 text-amber-400" />
                    Babel Patterns Detected ({babelDetections.length})
                  </p>
                  <div className="space-y-1">
                    {babelDetections.map((d, i) => (
                      <div
                        key={i}
                        className="flex items-center justify-between text-xs bg-amber-950/20 border border-amber-900/20 rounded px-3 py-1.5"
                      >
                        <div className="flex items-center gap-2">
                          <code className="text-amber-400">{d.topicSlug}</code>
                          {d.location && (
                            <span className="text-muted-foreground">
                              L{d.location.line}:{d.location.column}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          {d.isNegative && (
                            <Badge
                              variant="outline"
                              className="text-[10px] px-1.5 py-0 bg-red-600/10 text-red-400 border-red-600/30"
                            >
                              <X className="h-2.5 w-2.5 mr-0.5" />
                              violation
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

                {/* ESLint Detections — purple */}
                {eslintDetections.length > 0 && (
                  <div>
                    <p className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1.5">
                      <Shield className="h-3 w-3 text-purple-400" />
                      ESLint Detections ({eslintDetections.filter((d) => d.isNegative).length} violations
                      {eslintDetections.some((d) => d.isInferred) && (
                        <>, {eslintDetections.filter((d) => d.isInferred).length} inferred</>
                      )})
                    </p>
                    <div className="space-y-1">
                      {eslintDetections.map((d, i) => (
                        <div
                          key={i}
                          className={`flex items-center justify-between text-xs rounded px-3 py-1.5 ${
                            d.isInferred
                              ? "bg-muted/20 border border-border"
                              : d.isPositive && !d.isNegative
                                ? "bg-green-950/20 border border-green-900/20"
                                : "bg-purple-950/20 border border-purple-900/20"
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <code className={d.isInferred ? "text-muted-foreground" : d.isPositive && !d.isNegative ? "text-green-400" : "text-purple-400"}>{d.topicSlug}</code>
                            {d.location && (
                              <span className="text-muted-foreground">
                                L{d.location.line}:{d.location.column}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            {d.isNegative ? (
                              <Badge
                                variant="outline"
                                className="text-[10px] px-1.5 py-0 bg-red-600/10 text-red-400 border-red-600/30"
                              >
                                <X className="h-2.5 w-2.5 mr-0.5" />
                                violation
                              </Badge>
                            ) : d.isInferred ? (
                              <Badge
                                variant="outline"
                                className="text-[10px] px-1.5 py-0 bg-muted/30 text-muted-foreground border-border"
                              >
                                <Minus className="h-2.5 w-2.5 mr-0.5" />
                                inferred
                              </Badge>
                            ) : d.isPositive ? (
                              <Badge
                                variant="outline"
                                className="text-[10px] px-1.5 py-0 bg-green-600/10 text-green-400 border-green-600/30"
                              >
                                <Check className="h-2.5 w-2.5 mr-0.5" />
                                correct
                              </Badge>
                            ) : null}
                            {d.details && (
                              <span className="text-muted-foreground max-w-[250px] truncate">
                                {d.details}
                              </span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Data Flow Detections — blue */}
                {dataflowDetections.length > 0 && (
                  <div>
                    <p className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1.5">
                      <GitBranch className="h-3 w-3 text-blue-400" />
                      Data Flow Detections ({dataflowDetections.filter((d) => d.isNegative).length} issues
                      {dataflowDetections.some((d) => d.isInferred) && (
                        <>, {dataflowDetections.filter((d) => d.isInferred).length} inferred</>
                      )})
                    </p>
                    <div className="space-y-1">
                      {dataflowDetections.map((d, i) => (
                        <div
                          key={i}
                          className={`flex items-center justify-between text-xs rounded px-3 py-1.5 ${
                            d.isInferred
                              ? "bg-muted/20 border border-border"
                              : d.isPositive && !d.isNegative
                                ? "bg-green-950/20 border border-green-900/20"
                                : "bg-blue-950/20 border border-blue-900/20"
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <code className={d.isInferred ? "text-muted-foreground" : d.isPositive && !d.isNegative ? "text-green-400" : "text-blue-400"}>{d.topicSlug}</code>
                            {d.location && (
                              <span className="text-muted-foreground">
                                L{d.location.line}:{d.location.column}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            {d.isNegative ? (
                              <Badge
                                variant="outline"
                                className="text-[10px] px-1.5 py-0 bg-red-600/10 text-red-400 border-red-600/30"
                              >
                                <X className="h-2.5 w-2.5 mr-0.5" />
                                issue
                              </Badge>
                            ) : d.isInferred ? (
                              <Badge
                                variant="outline"
                                className="text-[10px] px-1.5 py-0 bg-muted/30 text-muted-foreground border-border"
                              >
                                <Minus className="h-2.5 w-2.5 mr-0.5" />
                                inferred
                              </Badge>
                            ) : d.isPositive ? (
                              <Badge
                                variant="outline"
                                className="text-[10px] px-1.5 py-0 bg-green-600/10 text-green-400 border-green-600/30"
                              >
                                <Check className="h-2.5 w-2.5 mr-0.5" />
                                correct
                              </Badge>
                            ) : null}
                            {d.details && (
                              <span className="text-muted-foreground max-w-[250px] truncate">
                                {d.details}
                              </span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            );
          })()}

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
                      {p.idiomaticCount > 0 && ` / \u2605${p.idiomaticCount}`}
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

function surpriseLabel(surprise: number): { text: string; color: string } {
  if (surprise >= 0.3) return { text: "Big Win", color: "text-green-400" };
  if (surprise > 0.05) return { text: "Win", color: "text-green-400" };
  if (surprise > -0.05) return { text: "Neutral", color: "text-muted-foreground" };
  if (surprise > -0.3) return { text: "Miss", color: "text-red-400" };
  return { text: "Big Miss", color: "text-red-400" };
}

function ScoringAudit({
  audit,
}: {
  audit: NonNullable<ReviewResultData["scoringAudit"]>;
}) {
  const [open, setOpen] = useState(false);

  return (
    <Card className="border-muted">
      <CardHeader className="pb-0">
        <Button
          variant="ghost"
          className="w-full justify-between p-0 h-auto hover:bg-transparent cursor-pointer"
          onClick={() => setOpen(!open)}
        >
          <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-1.5">
            <Activity className="h-3.5 w-3.5" />
            Scoring Audit Log
          </CardTitle>
          {open ? (
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          ) : (
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          )}
        </Button>
      </CardHeader>
      {open && (
        <CardContent className="pt-4 space-y-2">
          {audit.map((entry, i) => {
            const isNeutral = entry.tier === "neutral";

            if (isNeutral) {
              return (
                <div
                  key={i}
                  className="text-xs rounded px-3 py-2.5 space-y-1 border bg-muted/20 border-border"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-muted-foreground text-sm">
                      {entry.topicName}
                    </span>
                    <Badge
                      variant="outline"
                      className="text-[10px] px-1.5 py-0 bg-muted/30 text-muted-foreground border-border"
                    >
                      NEUTRAL
                    </Badge>
                  </div>
                  <div className="text-muted-foreground font-mono text-[11px]">
                    Inferred from absence of violations — not scored, no rating change
                  </div>
                </div>
              );
            }

            const label = surpriseLabel(entry.surprise);
            const isGain = entry.ratingChange > 0;
            const isLoss = entry.ratingChange < 0;
            const aiOverridden =
              entry.aiScore !== null &&
              Math.round(entry.aiScore * 100) !== Math.round(entry.performanceScore * 100);

            return (
              <div
                key={i}
                className={`text-xs rounded px-3 py-2.5 space-y-1.5 border ${
                  isGain
                    ? "bg-green-950/20 border-green-900/20"
                    : isLoss
                      ? "bg-red-950/20 border-red-900/20"
                      : "bg-muted/30 border-border"
                }`}
              >
                {/* Topic header */}
                <div className="flex items-center justify-between">
                  <span className="font-medium text-foreground text-sm">
                    {entry.topicName}
                  </span>
                  <div className="flex items-center gap-1.5">
                    {entry.errorType && (
                      <Badge
                        variant={errorTypeBadgeVariant(entry.errorType)}
                        className="text-[10px] px-1.5 py-0"
                      >
                        {entry.errorType}
                      </Badge>
                    )}
                    <span
                      className={`font-mono font-semibold ${
                        isGain
                          ? "text-green-400"
                          : isLoss
                            ? "text-red-400"
                            : "text-muted-foreground"
                      }`}
                    >
                      {isGain ? "+" : ""}
                      {entry.ratingChange}
                    </span>
                  </div>
                </div>

                {/* Audit trail */}
                <div className="text-muted-foreground font-mono leading-relaxed space-y-0.5">
                  <div>
                    Rated{" "}
                    <span className="text-foreground">{entry.ratingBefore}</span>
                    {" "}(RD {entry.rdBefore}, σ {entry.volatilityBefore}) vs
                    Difficulty 1500
                  </div>
                  <div>
                    Expected:{" "}
                    <span className="text-foreground">
                      {entry.expectedScore.toFixed(2)}
                    </span>
                    {" | "}Actual:{" "}
                    <span className="text-foreground">
                      {entry.performanceScore.toFixed(2)}
                    </span>
                    {aiOverridden && (
                      <span className="text-yellow-400">
                        {" "}(AI: {entry.aiScore!.toFixed(1)} &rarr; {entry.errorType} override)
                      </span>
                    )}
                  </div>
                  <div>
                    Surprise:{" "}
                    <span className={label.color}>
                      {entry.surprise > 0 ? "+" : ""}
                      {entry.surprise.toFixed(2)} ({label.text})
                    </span>
                  </div>
                  <div>
                    Result:{" "}
                    <span className="text-foreground">{entry.ratingBefore}</span>
                    {" \u2192 "}
                    <span
                      className={
                        isGain
                          ? "text-green-400"
                          : isLoss
                            ? "text-red-400"
                            : "text-foreground"
                      }
                    >
                      {entry.ratingAfter}
                    </span>
                    {" "}
                    <span
                      className={
                        isGain
                          ? "text-green-400"
                          : isLoss
                            ? "text-red-400"
                            : "text-muted-foreground"
                      }
                    >
                      ({isGain ? "+" : ""}
                      {entry.ratingChange})
                    </span>
                    {" | "}RD: {entry.rdBefore} &rarr; {entry.rdAfter}
                  </div>
                </div>
              </div>
            );
          })}
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
          {result.analysisPreview.neutralCount > 0 && (
            <span className="text-muted-foreground">
              <span className="font-medium text-muted-foreground">
                {result.analysisPreview.neutralCount}
              </span>{" "}
              neutral
            </span>
          )}
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

      {/* Skill changes with inline AI evaluations */}
      {result.skillChanges && result.skillChanges.length > 0 && (
        <SkillChanges
          changes={result.skillChanges}
          aiEvaluations={result.engineDetails?.aiEvaluations}
        />
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

      {/* Scoring audit log (collapsible) */}
      {result.scoringAudit && result.scoringAudit.length > 0 && (
        <ScoringAudit audit={result.scoringAudit} />
      )}

      {/* Engine details (collapsible) */}
      {result.engineDetails && <EngineDetails details={result.engineDetails} />}
    </div>
  );
}
