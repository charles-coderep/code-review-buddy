"use client";

import { Card, CardContent } from "@/components/ui/card";
import {
  Loader2,
  Check,
  FileCode,
  Search,
  Shield,
  GitBranch,
  BarChart3,
  Brain,
  Database,
} from "lucide-react";

export const PIPELINE_STAGES = [
  { id: "parse", label: "Parsing AST", detail: "Building syntax tree with Babel", icon: FileCode, duration: 800 },
  { id: "detect", label: "Detecting patterns", detail: "Running 30 detectors across 180+ topics", icon: Search, duration: 1000 },
  { id: "lint", label: "Running ESLint", detail: "Checking ~120 code quality rules", icon: Shield, duration: 500 },
  { id: "dataflow", label: "Analyzing data flow", detail: "Detecting semantic patterns and reference issues", icon: GitBranch, duration: 400 },
  { id: "rate", label: "Updating Glicko-2 ratings", detail: "Calculating skill changes", icon: BarChart3, duration: 1500 },
  { id: "ai", label: "Coaching with AI", detail: "Generating feedback with Grok", icon: Brain, duration: 12000 },
  { id: "save", label: "Saving progress", detail: "Updating your skill profile", icon: Database, duration: 1500 },
];

export function PipelineProgress({ currentStage }: { currentStage: number }) {
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
