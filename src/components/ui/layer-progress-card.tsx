"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { StarRating } from "@/components/ui/star-rating";
import { Lock, Unlock } from "lucide-react";

interface LayerData {
  isUnlocked: boolean;
  unlockedAt: Date | null;
  totalTopics: number;
  attemptedTopics: number;
  masteredTopics: number;
  stuckTopics: number;
  averageRating: number;
  averageRd: number;
  overallProgress: number;
  stars: number;
  starsDisplay: string;
  confidence: number;
  confidenceDisplay: string;
}

interface LayerProgressCardProps {
  layer: string;
  data: LayerData;
  isCurrentLayer: boolean;
}

const layerLabels: Record<string, string> = {
  FUNDAMENTALS: "Fundamentals",
  INTERMEDIATE: "Intermediate",
  PATTERNS: "Patterns",
};

export function LayerProgressCard({
  layer,
  data,
  isCurrentLayer,
}: LayerProgressCardProps) {
  const coveragePercent =
    data.totalTopics > 0
      ? Math.round((data.attemptedTopics / data.totalTopics) * 100)
      : 0;

  return (
    <Card
      className={
        isCurrentLayer ? "border-primary/50" : data.isUnlocked ? "" : "opacity-60"
      }
    >
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {data.isUnlocked ? (
              <Unlock className="h-4 w-4 text-primary" />
            ) : (
              <Lock className="h-4 w-4 text-muted-foreground" />
            )}
            <CardTitle className="text-lg">
              {layerLabels[layer] ?? layer}
            </CardTitle>
          </div>
          {isCurrentLayer && <Badge variant="secondary">Current</Badge>}
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="text-sm text-muted-foreground">
            {data.attemptedTopics} / {data.totalTopics} topics
          </div>
          <StarRating
            stars={data.stars}
            confidence={data.confidence}
            size="sm"
          />
        </div>

        <Progress value={coveragePercent} className="h-2" />

        <div className="grid grid-cols-3 gap-2 text-center text-sm">
          <div>
            <div className="font-medium">{data.attemptedTopics}</div>
            <div className="text-xs text-muted-foreground">Attempted</div>
          </div>
          <div>
            <div className="font-medium text-green-400">
              {data.masteredTopics}
            </div>
            <div className="text-xs text-muted-foreground">Mastered</div>
          </div>
          <div>
            <div className="font-medium text-red-400">{data.stuckTopics}</div>
            <div className="text-xs text-muted-foreground">Stuck</div>
          </div>
        </div>

        {!data.isUnlocked && (
          <div className="text-xs text-muted-foreground text-center pt-1">
            {data.overallProgress}% toward unlock
          </div>
        )}
      </CardContent>
    </Card>
  );
}
