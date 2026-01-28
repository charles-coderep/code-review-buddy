import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { REVIEW_LIMITS } from "@/types";

export default async function ProfilePage() {
  const session = await auth();
  if (!session?.user?.id) return null;

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      id: true,
      email: true,
      name: true,
      subscriptionTier: true,
      reviewsThisMonth: true,
      createdAt: true,
      _count: {
        select: {
          submissions: true,
          patterns: true,
        },
      },
    },
  });

  if (!user) return null;

  const tier = user.subscriptionTier as keyof typeof REVIEW_LIMITS;
  const limit = REVIEW_LIMITS[tier];

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-3xl font-bold text-white mb-8">Profile</h1>

      <div className="bg-slate-800 rounded-xl border border-slate-700 divide-y divide-slate-700">
        {/* Account Info */}
        <div className="p-6">
          <h2 className="text-lg font-semibold text-white mb-4">
            Account Information
          </h2>
          <div className="space-y-4">
            <div>
              <label className="text-sm text-slate-400">Email</label>
              <p className="text-white">{user.email}</p>
            </div>
            <div>
              <label className="text-sm text-slate-400">Name</label>
              <p className="text-white">{user.name || "Not set"}</p>
            </div>
            <div>
              <label className="text-sm text-slate-400">Member since</label>
              <p className="text-white">
                {new Date(user.createdAt).toLocaleDateString("en-GB", {
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                })}
              </p>
            </div>
          </div>
        </div>

        {/* Subscription */}
        <div className="p-6">
          <h2 className="text-lg font-semibold text-white mb-4">Subscription</h2>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-white font-medium capitalize">
                {user.subscriptionTier} Plan
              </p>
              <p className="text-slate-400 text-sm">
                {user.reviewsThisMonth} / {limit === Infinity ? "Unlimited" : limit}{" "}
                reviews used this month
              </p>
            </div>
            {tier === "free" && (
              <button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition text-sm">
                Upgrade to Pro
              </button>
            )}
          </div>
        </div>

        {/* Stats */}
        <div className="p-6">
          <h2 className="text-lg font-semibold text-white mb-4">Statistics</h2>
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-slate-900 rounded-lg p-4">
              <p className="text-2xl font-bold text-white">
                {user._count.submissions}
              </p>
              <p className="text-slate-400 text-sm">Total Reviews</p>
            </div>
            <div className="bg-slate-900 rounded-lg p-4">
              <p className="text-2xl font-bold text-white">
                {user._count.patterns}
              </p>
              <p className="text-slate-400 text-sm">Patterns Tracked</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
