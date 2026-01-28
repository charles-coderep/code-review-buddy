"use client";

import { useState } from "react";
import { submitReview } from "@/app/actions/generateFeedback";
import { markFeedbackHelpful } from "@/app/actions/feedback";
import type { ReviewResult } from "@/types";

export default function ReviewPage() {
  const [code, setCode] = useState("");
  const [language, setLanguage] = useState<"javascript" | "jsx" | "typescript" | "tsx">("javascript");
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ReviewResult | null>(null);
  const [rated, setRated] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim()) return;

    setLoading(true);
    setResult(null);
    setRated(false);

    try {
      const response = await submitReview({ code, language, description });
      setResult(response);
    } catch (error) {
      setResult({
        success: false,
        error: error instanceof Error ? error.message : "Something went wrong",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleRate = async (helpful: boolean) => {
    if (!result?.feedbackId || rated) return;

    try {
      await markFeedbackHelpful(result.feedbackId, helpful);
      setRated(true);
    } catch (error) {
      console.error("Failed to rate feedback:", error);
    }
  };

  return (
    <div className="max-w-6xl mx-auto">
      <h1 className="text-3xl font-bold text-white mb-2">Submit Code for Review</h1>
      <p className="text-slate-400 mb-8">
        Paste your JavaScript or React code below to get personalized feedback
      </p>

      <div className="grid lg:grid-cols-2 gap-8">
        {/* Input Section */}
        <div className="space-y-4">
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Language Selector */}
            <div>
              <label className="block text-sm text-slate-300 mb-2">
                Language
              </label>
              <div className="flex gap-2">
                {(["javascript", "jsx", "typescript", "tsx"] as const).map((lang) => (
                  <button
                    key={lang}
                    type="button"
                    onClick={() => setLanguage(lang)}
                    className={`px-4 py-2 rounded-lg text-sm transition ${
                      language === lang
                        ? "bg-blue-600 text-white"
                        : "bg-slate-800 text-slate-300 hover:bg-slate-700"
                    }`}
                  >
                    {lang.toUpperCase()}
                  </button>
                ))}
              </div>
            </div>

            {/* Code Input */}
            <div>
              <label className="block text-sm text-slate-300 mb-2">
                Your Code
              </label>
              <textarea
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="Paste your code here..."
                className="w-full h-80 px-4 py-3 bg-slate-800 border border-slate-700 rounded-lg text-slate-100 font-mono text-sm focus:outline-none focus:border-blue-500 resize-none"
                required
              />
            </div>

            {/* Context (Optional) */}
            <div>
              <label className="block text-sm text-slate-300 mb-2">
                Context (optional)
              </label>
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="What should this code do?"
                className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-blue-500"
              />
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading || !code.trim()}
              className="w-full py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                      fill="none"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    />
                  </svg>
                  Analyzing...
                </span>
              ) : (
                "Get Review"
              )}
            </button>
          </form>
        </div>

        {/* Results Section */}
        <div>
          {!result && !loading && (
            <div className="bg-slate-800 rounded-xl border border-slate-700 p-8 text-center h-full flex items-center justify-center">
              <div>
                <div className="text-4xl mb-4">🔍</div>
                <p className="text-slate-400">
                  Your personalized feedback will appear here
                </p>
              </div>
            </div>
          )}

          {loading && (
            <div className="bg-slate-800 rounded-xl border border-slate-700 p-8 text-center h-full flex items-center justify-center">
              <div>
                <div className="text-4xl mb-4 animate-pulse">🤔</div>
                <p className="text-slate-300">Analyzing your code...</p>
                <p className="text-slate-500 text-sm mt-2">
                  This usually takes a few seconds
                </p>
              </div>
            </div>
          )}

          {result && !loading && (
            <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
              {result.success ? (
                <>
                  {/* Patterns Detected */}
                  {result.patterns && result.patterns.length > 0 && (
                    <div className="px-6 py-4 border-b border-slate-700 bg-slate-800/50">
                      <p className="text-sm text-slate-400 mb-2">
                        Patterns detected:
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {result.patterns.map((pattern) => (
                          <span
                            key={pattern}
                            className="px-2 py-1 bg-blue-600/20 text-blue-400 text-xs rounded"
                          >
                            {pattern.replace(/-/g, " ")}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Feedback */}
                  <div className="p-6">
                    <div className="prose prose-invert prose-sm max-w-none">
                      <div
                        className="text-slate-200 whitespace-pre-wrap"
                        dangerouslySetInnerHTML={{
                          __html: result.feedback
                            ?.replace(/```(\w+)?\n([\s\S]*?)```/g, '<pre class="bg-slate-900 p-4 rounded-lg overflow-x-auto"><code>$2</code></pre>')
                            .replace(/## (.*)/g, '<h3 class="text-lg font-semibold text-white mt-4 mb-2">$1</h3>')
                            .replace(/\*\*(.*?)\*\*/g, '<strong class="text-white">$1</strong>')
                            || "",
                        }}
                      />
                    </div>
                  </div>

                  {/* Rating */}
                  <div className="px-6 py-4 border-t border-slate-700 bg-slate-800/50">
                    {!rated ? (
                      <div className="flex items-center justify-between">
                        <p className="text-slate-400 text-sm">
                          Was this helpful?
                        </p>
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleRate(true)}
                            className="px-4 py-2 bg-green-600/20 text-green-400 rounded-lg hover:bg-green-600/30 transition text-sm"
                          >
                            Yes, helpful
                          </button>
                          <button
                            onClick={() => handleRate(false)}
                            className="px-4 py-2 bg-red-600/20 text-red-400 rounded-lg hover:bg-red-600/30 transition text-sm"
                          >
                            Not helpful
                          </button>
                        </div>
                      </div>
                    ) : (
                      <p className="text-slate-400 text-sm text-center">
                        Thanks for your feedback! This helps improve your future reviews.
                      </p>
                    )}
                  </div>

                  {/* Stats */}
                  <div className="px-6 py-3 border-t border-slate-700 bg-slate-900/50 text-xs text-slate-500 flex justify-between">
                    <span>Tokens: {result.tokensUsed}</span>
                    <span>Cost: £{result.estimatedCost?.toFixed(4)}</span>
                  </div>
                </>
              ) : (
                <div className="p-6">
                  <div className="bg-red-500/10 border border-red-500 text-red-400 px-4 py-3 rounded-lg">
                    {result.error}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
