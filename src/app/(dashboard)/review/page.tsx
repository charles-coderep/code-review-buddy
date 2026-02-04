"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { submitReview } from "@/app/actions/review";
import type { ReviewResult } from "@/app/actions/review";
import { ReviewResults } from "@/components/review/review-results";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Loader2 } from "lucide-react";

const MonacoEditor = dynamic(() => import("@monaco-editor/react"), {
  ssr: false,
  loading: () => <Skeleton className="h-[400px] w-full rounded-md" />,
});

export default function ReviewPage() {
  const [code, setCode] = useState("");
  const [description, setDescription] = useState("");
  const [result, setResult] = useState<ReviewResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit() {
    if (!code.trim()) {
      setError("Please enter some code");
      return;
    }

    setLoading(true);
    setError("");
    setResult(null);

    const reviewResult = await submitReview({
      code,
      description: description || undefined,
    });

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
                Analyzing...
              </>
            ) : (
              "Submit for Coaching"
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Results */}
      {result && result.success && <ReviewResults result={result} />}
    </div>
  );
}
