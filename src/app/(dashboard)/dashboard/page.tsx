import Link from "next/link";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { REVIEW_LIMITS } from "@/types";

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user?.id) return null;

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      name: true,
      subscriptionTier: true,
      reviewsThisMonth: true,
    },
  });

  const [totalReviews, recentFeedback, patterns] = await Promise.all([
    prisma.submission.count({ where: { userId: session.user.id } }),
    prisma.feedback.findMany({
      where: { userId: session.user.id },
      orderBy: { createdAt: "desc" },
      take: 5,
      include: {
        submission: { select: { language: true, createdAt: true } },
      },
    }),
    prisma.userPattern.findMany({
      where: { userId: session.user.id },
      orderBy: { masteryLevel: "desc" },
      take: 10,
    }),
  ]);

  const tier = (user?.subscriptionTier || "free") as keyof typeof REVIEW_LIMITS;
  const limit = REVIEW_LIMITS[tier];
  const reviewsUsed = user?.reviewsThisMonth || 0;
  const reviewsRemaining = limit === Infinity ? "Unlimited" : limit - reviewsUsed;

  return (
    <div className="space-y-8">
      {/* Welcome Header */}
      <div>
        <h1 className="text-3xl font-bold text-white">
          Welcome back{user?.name ? `, ${user.name}` : ""}!
        </h1>
        <p className="text-slate-400 mt-2">
          Track your progress and continue learning
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid md:grid-cols-4 gap-4">
        <div className="bg-slate-800 p-6 rounded-xl border border-slate-700">
          <p className="text-slate-400 text-sm">Total Reviews</p>
          <p className="text-3xl font-bold text-white mt-1">{totalReviews}</p>
        </div>
        <div className="bg-slate-800 p-6 rounded-xl border border-slate-700">
          <p className="text-slate-400 text-sm">Reviews This Month</p>
          <p className="text-3xl font-bold text-white mt-1">{reviewsUsed}</p>
        </div>
        <div className="bg-slate-800 p-6 rounded-xl border border-slate-700">
          <p className="text-slate-400 text-sm">Reviews Remaining</p>
          <p className="text-3xl font-bold text-white mt-1">{reviewsRemaining}</p>
        </div>
        <div className="bg-slate-800 p-6 rounded-xl border border-slate-700">
          <p className="text-slate-400 text-sm">Patterns Tracked</p>
          <p className="text-3xl font-bold text-white mt-1">{patterns.length}</p>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="flex gap-4">
        <Link
          href="/review"
          className="px-6 py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition"
        >
          + New Review
        </Link>
        <Link
          href="/pattern-library"
          className="px-6 py-3 border border-slate-600 text-white font-semibold rounded-lg hover:bg-slate-800 transition"
        >
          Browse Patterns
        </Link>
      </div>

      <div className="grid md:grid-cols-2 gap-8">
        {/* Recent Reviews */}
        <div className="bg-slate-800 rounded-xl border border-slate-700 p-6">
          <h2 className="text-xl font-semibold text-white mb-4">
            Recent Reviews
          </h2>
          {recentFeedback.length === 0 ? (
            <p className="text-slate-400">
              No reviews yet.{" "}
              <Link href="/review" className="text-blue-400 hover:underline">
                Submit your first code
              </Link>
            </p>
          ) : (
            <div className="space-y-3">
              {recentFeedback.map((fb) => (
                <div
                  key={fb.id}
                  className="p-3 bg-slate-900 rounded-lg border border-slate-700"
                >
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-blue-400">
                      {fb.submission.language}
                    </span>
                    <span className="text-xs text-slate-500">
                      {new Date(fb.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                  <p className="text-slate-300 text-sm mt-1 line-clamp-2">
                    {fb.feedbackText.slice(0, 100)}...
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Pattern Progress */}
        <div className="bg-slate-800 rounded-xl border border-slate-700 p-6">
          <h2 className="text-xl font-semibold text-white mb-4">
            Pattern Progress
          </h2>
          {patterns.length === 0 ? (
            <p className="text-slate-400">
              Patterns will appear here as you get reviews
            </p>
          ) : (
            <div className="space-y-3">
              {patterns.map((pattern) => (
                <div key={pattern.id} className="flex items-center gap-3">
                  <div className="flex-1">
                    <div className="flex justify-between mb-1">
                      <span className="text-slate-300 text-sm">
                        {pattern.patternName.replace(/-/g, " ")}
                      </span>
                      <span className="text-slate-500 text-xs">
                        {pattern.masteryLevel}/5
                      </span>
                    </div>
                    <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-blue-500 rounded-full transition-all"
                        style={{ width: `${(pattern.masteryLevel / 5) * 100}%` }}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Upgrade CTA for free users */}
      {tier === "free" && (
        <div className="bg-gradient-to-r from-blue-600/20 to-purple-600/20 rounded-xl border border-blue-500/30 p-6">
          <h3 className="text-xl font-semibold text-white">
            Upgrade to Pro for Unlimited Reviews
          </h3>
          <p className="text-slate-300 mt-2">
            Get unlimited reviews, full learning memory, and access to the
            complete pattern library.
          </p>
          <button className="mt-4 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition">
            Upgrade for £9/month
          </button>
        </div>
      )}
    </div>
  );
}
