"use client";

import { useState, useTransition } from "react";
import { getSkillMatrix, updateFrameworkPreferences } from "@/app/actions/user";
import type { SkillMatrixEntry } from "@/app/actions/user";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { StarRating } from "@/components/ui/star-rating";

interface SkillMatrixViewProps {
  initialData: SkillMatrixEntry[];
  initialFrameworks: string[];
}

const layerOrder = ["FUNDAMENTALS", "INTERMEDIATE", "PATTERNS"];
const layerLabels: Record<string, string> = {
  FUNDAMENTALS: "Fundamentals",
  INTERMEDIATE: "Intermediate",
  PATTERNS: "Patterns",
};

function affinityBadgeClass(affinity: string) {
  switch (affinity) {
    case "js-pure":
      return "bg-yellow-600/20 text-yellow-400 border-yellow-600/30";
    case "react-specific":
      return "bg-cyan-600/20 text-cyan-400 border-cyan-600/30";
    case "shared":
      return "bg-purple-600/20 text-purple-400 border-purple-600/30";
    default:
      return "";
  }
}

function groupByLayerAndCategory(data: SkillMatrixEntry[]) {
  const grouped: Record<string, Record<string, SkillMatrixEntry[]>> = {};

  for (const entry of data) {
    if (!grouped[entry.layer]) grouped[entry.layer] = {};
    if (!grouped[entry.layer][entry.category])
      grouped[entry.layer][entry.category] = [];
    grouped[entry.layer][entry.category].push(entry);
  }

  return grouped;
}

export function SkillMatrixView({
  initialData,
  initialFrameworks,
}: SkillMatrixViewProps) {
  const [data, setData] = useState(initialData);
  const [frameworks, setFrameworks] = useState(initialFrameworks);
  const [isPending, startTransition] = useTransition();

  function toggleFramework(framework: string) {
    const newFrameworks = frameworks.includes(framework)
      ? frameworks.filter((f) => f !== framework)
      : [...frameworks, framework];

    // Must have at least one
    if (newFrameworks.length === 0) return;

    setFrameworks(newFrameworks);

    startTransition(async () => {
      await updateFrameworkPreferences(newFrameworks);
      const result = await getSkillMatrix(newFrameworks);
      if (result.success && result.data) {
        setData(result.data);
      }
    });
  }

  const grouped = groupByLayerAndCategory(data);
  const attempted = data.filter((d) => d.timesEncountered > 0).length;
  const mastered = data.filter(
    (d) => d.rating >= 1650 && d.rd < 100
  ).length;
  const stuck = data.filter((d) => d.isStuck).length;

  return (
    <div className="space-y-6">
      {/* Framework toggle + summary */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Show:</span>
          <Button
            variant={frameworks.includes("js") ? "default" : "outline"}
            size="sm"
            onClick={() => toggleFramework("js")}
            disabled={isPending}
          >
            JavaScript
          </Button>
          <Button
            variant={frameworks.includes("react") ? "default" : "outline"}
            size="sm"
            onClick={() => toggleFramework("react")}
            disabled={isPending}
          >
            React
          </Button>
        </div>
        <div className="flex gap-4 text-sm text-muted-foreground">
          <span>
            <span className="font-medium text-foreground">{data.length}</span>{" "}
            topics
          </span>
          <span>
            <span className="font-medium text-foreground">{attempted}</span>{" "}
            attempted
          </span>
          <span>
            <span className="font-medium text-green-400">{mastered}</span>{" "}
            mastered
          </span>
          {stuck > 0 && (
            <span>
              <span className="font-medium text-red-400">{stuck}</span> stuck
            </span>
          )}
        </div>
      </div>

      {/* Grouped topics */}
      <div className="space-y-10">
        {layerOrder
          .filter((layer) => grouped[layer])
          .map((layer) => (
            <div key={layer}>
              <h2 className="text-xl font-semibold mb-1">
                {layerLabels[layer]}
              </h2>
              <p className="text-sm text-muted-foreground mb-4">
                {Object.values(grouped[layer]).flat().length} topics
              </p>

              <div className="space-y-6">
                {Object.entries(grouped[layer]).map(
                  ([category, categoryTopics]) => (
                    <div key={category}>
                      <h3 className="text-base font-medium text-muted-foreground mb-3">
                        {category}
                      </h3>
                      <div className="grid gap-2">
                        {categoryTopics.map((topic) => (
                          <div
                            key={topic.topicSlug}
                            className={`flex items-center justify-between bg-card rounded-lg border p-3 ${
                              topic.isStuck
                                ? "border-destructive/50"
                                : "border-border"
                            }`}
                          >
                            <div className="flex items-center gap-3 min-w-0">
                              <span className="text-sm font-medium truncate">
                                {topic.topicName}
                              </span>
                              <Badge
                                variant="outline"
                                className={`text-xs shrink-0 ${affinityBadgeClass(topic.frameworkAffinity)}`}
                              >
                                {topic.frameworkAffinity}
                              </Badge>
                              {topic.isStuck && (
                                <Badge
                                  variant="destructive"
                                  className="text-xs shrink-0"
                                >
                                  stuck
                                </Badge>
                              )}
                            </div>
                            <div className="flex items-center gap-4 shrink-0">
                              <span className="text-xs text-muted-foreground">
                                {topic.timesEncountered > 0
                                  ? `${topic.timesEncountered}x`
                                  : "\u2014"}
                              </span>
                              <StarRating
                                stars={topic.stars}
                                confidence={topic.confidence}
                                size="sm"
                              />
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )
                )}
              </div>
            </div>
          ))}
      </div>
    </div>
  );
}
