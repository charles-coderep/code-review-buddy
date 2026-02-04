"use client";

import ReactMarkdown from "react-markdown";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ArrowUp, ArrowDown, Minus, Sparkles, AlertTriangle } from "lucide-react";

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
            <CardTitle className="text-lg">Coach Feedback</CardTitle>
          </CardHeader>
          <CardContent className="prose prose-invert prose-sm max-w-none">
            <ReactMarkdown>{result.feedback.text}</ReactMarkdown>
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
    </div>
  );
}
