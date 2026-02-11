import Link from "next/link";
import { getDashboardData } from "@/app/actions/user";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { LayerProgressCard } from "@/components/ui/layer-progress-card";
import { AlertTriangle, Code, BarChart3, Trophy, Layers } from "lucide-react";

export default async function DashboardPage() {
  const result = await getDashboardData();

  if (!result.success || !result.data) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">
          {result.error ?? "Failed to load dashboard"}
        </p>
      </div>
    );
  }

  const { user, progress, stuckSummary } = result.data;

  return (
    <div className="p-6 lg:p-8 max-w-6xl">
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">
            Welcome back{user.name ? `, ${user.name}` : ""}
          </h1>
          <p className="text-muted-foreground">
            Here&apos;s your skill overview
          </p>
        </div>
        <Badge variant="outline" className="capitalize">
          {user.subscriptionTier}
        </Badge>
      </div>

      {/* Quick stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Code className="h-4 w-4" />
              Sessions
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{progress.totalReviews}</div>
            <p className="text-xs text-muted-foreground">
              {user.reviewsRemaining} remaining this month
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Trophy className="h-4 w-4" />
              Level
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold capitalize">
              {progress.estimatedLevel}
            </div>
            <p className="text-xs text-muted-foreground">Estimated skill level</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Layers className="h-4 w-4" />
              Layer
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold capitalize">
              {progress.currentLayer.toLowerCase()}
            </div>
            <p className="text-xs text-muted-foreground">
              {progress.nextUnlock
                ? `Next: ${progress.nextUnlock.toLowerCase()}`
                : "All layers unlocked"}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <BarChart3 className="h-4 w-4" />
              Topics
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {progress.fundamentals.attemptedTopics +
                progress.intermediate.attemptedTopics +
                progress.patterns.attemptedTopics}
            </div>
            <p className="text-xs text-muted-foreground">
              of{" "}
              {progress.fundamentals.totalTopics +
                progress.intermediate.totalTopics +
                progress.patterns.totalTopics}{" "}
              attempted
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Stuck topics alert */}
      {stuckSummary.stuckCount > 0 && (
        <Card className="border-destructive/50">
          <CardContent className="pt-6">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-destructive mt-0.5" />
              <div>
                <p className="font-medium">
                  You&apos;re stuck on {stuckSummary.stuckCount} topic
                  {stuckSummary.stuckCount !== 1 ? "s" : ""}
                </p>
                <p className="text-sm text-muted-foreground mt-1">
                  {stuckSummary.mostUrgent
                    ? `Most urgent: ${stuckSummary.mostUrgent.name}. `
                    : ""}
                  Submit code to get targeted coaching.
                </p>
                {stuckSummary.atRiskCount > 0 && (
                  <p className="text-xs text-muted-foreground mt-1">
                    {stuckSummary.atRiskCount} more topic
                    {stuckSummary.atRiskCount !== 1 ? "s" : ""} at risk
                  </p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Layer progress */}
      <div>
        <h2 className="text-lg font-semibold mb-4">Layer Progress</h2>
        <div className="grid md:grid-cols-3 gap-4">
          <LayerProgressCard
            layer="FUNDAMENTALS"
            data={progress.fundamentals}
            isCurrentLayer={progress.currentLayer === "FUNDAMENTALS"}
          />
          <LayerProgressCard
            layer="INTERMEDIATE"
            data={progress.intermediate}
            isCurrentLayer={progress.currentLayer === "INTERMEDIATE"}
          />
          <LayerProgressCard
            layer="PATTERNS"
            data={progress.patterns}
            isCurrentLayer={progress.currentLayer === "PATTERNS"}
          />
        </div>
      </div>

      {/* CTA */}
      <div className="text-center pt-4">
        <Button size="lg" asChild>
          <Link href="/review">Get Coaching on Your Code</Link>
        </Button>
      </div>
    </div>
    </div>
  );
}
