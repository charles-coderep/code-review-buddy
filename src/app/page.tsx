import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Code, BarChart3, Brain, Target } from "lucide-react";

export default async function LandingPage() {
  const session = await auth();

  if (session?.user) {
    redirect("/dashboard");
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <h1 className="text-xl font-bold">Cortext</h1>
          <div className="flex gap-3">
            <Button variant="ghost" asChild>
              <Link href="/login">Sign In</Link>
            </Button>
            <Button asChild>
              <Link href="/signup">Get Started</Link>
            </Button>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="max-w-6xl mx-auto px-4 py-24 text-center">
        <h2 className="text-5xl font-bold tracking-tight mb-4">
          Your AI Coding Coach
        </h2>
        <p className="text-xl text-muted-foreground max-w-2xl mx-auto mb-8">
          Not a tutorial platform. An always-on coach that uses your own code to
          push your JavaScript and React skills forward. Tracks what you know,
          finds where you struggle, and tells you what to practice next.
        </p>
        <div className="flex gap-4 justify-center">
          <Button size="lg" asChild>
            <Link href="/signup">Start Coaching</Link>
          </Button>
          <Button size="lg" variant="outline" asChild>
            <Link href="/login">Sign In</Link>
          </Button>
        </div>
      </section>

      {/* Features */}
      <section className="max-w-6xl mx-auto px-4 pb-24">
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardHeader>
              <BarChart3 className="h-8 w-8 mb-2 text-primary" />
              <CardTitle className="text-lg">Glicko-2 Ratings</CardTitle>
              <CardDescription>
                Every skill tracked with a real rating system. See exactly where
                you stand across 98 topic markers.
              </CardDescription>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader>
              <Brain className="h-8 w-8 mb-2 text-primary" />
              <CardTitle className="text-lg">Adaptive Feedback</CardTitle>
              <CardDescription>
                AI coaching that adjusts to your level. Beginners get guidance,
                experts get challenged.
              </CardDescription>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader>
              <Code className="h-8 w-8 mb-2 text-primary" />
              <CardTitle className="text-lg">AST Analysis</CardTitle>
              <CardDescription>
                Your code is parsed and analyzed at the syntax tree level to
                detect patterns, not just surface issues.
              </CardDescription>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader>
              <Target className="h-8 w-8 mb-2 text-primary" />
              <CardTitle className="text-lg">Stuck Detection</CardTitle>
              <CardDescription>
                The system knows when you're stuck and changes strategy. It finds
                prerequisite gaps holding you back.
              </CardDescription>
            </CardHeader>
          </Card>
        </div>
      </section>
    </div>
  );
}
