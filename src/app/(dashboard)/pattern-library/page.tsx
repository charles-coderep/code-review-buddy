import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { formatRatingDisplay } from "@/lib/glicko2";

export default async function PatternLibraryPage() {
  const session = await auth();
  if (!session?.user?.id) return null;

  const userId = session.user.id;

  // Get user's framework preferences
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { displayFrameworks: true },
  });

  const displayFrameworks = user?.displayFrameworks ?? ["js", "react"];

  // Map framework preferences to affinity filter
  const affinityFilter: string[] = [];
  if (displayFrameworks.includes("js")) {
    affinityFilter.push("js-pure", "shared");
  }
  if (displayFrameworks.includes("react")) {
    affinityFilter.push("react-specific", "shared");
  }

  // Get all topics matching framework filter
  const topics = await prisma.topic.findMany({
    where: {
      frameworkAffinity: { in: [...new Set(affinityFilter)] },
    },
    orderBy: [{ layer: "asc" }, { category: "asc" }, { name: "asc" }],
  });

  // Get user skills
  const skills = await prisma.userSkillMatrix.findMany({
    where: { userId },
  });
  const skillMap = new Map(skills.map((s) => [s.topicId, s]));

  // Group topics by layer and category
  const grouped: Record<
    string,
    Record<
      string,
      Array<{
        slug: string;
        name: string;
        layer: string;
        category: string;
        frameworkAffinity: string;
        criticality: string;
        rating: number;
        rd: number;
        stars: number;
        starsDisplay: string;
        confidence: number;
        confidenceDisplay: string;
        level: string;
        timesEncountered: number;
        isStuck: boolean;
      }>
    >
  > = {};

  for (const topic of topics) {
    const skill = skillMap.get(topic.id);
    const rating = skill?.rating ?? 1500;
    const rd = skill?.rd ?? 350;
    const display = formatRatingDisplay(rating, rd);

    if (!grouped[topic.layer]) {
      grouped[topic.layer] = {};
    }
    if (!grouped[topic.layer][topic.category]) {
      grouped[topic.layer][topic.category] = [];
    }

    grouped[topic.layer][topic.category].push({
      slug: topic.slug,
      name: topic.name,
      layer: topic.layer,
      category: topic.category,
      frameworkAffinity: topic.frameworkAffinity,
      criticality: topic.criticality,
      rating: Math.round(rating),
      rd: Math.round(rd),
      stars: display.stars,
      starsDisplay: display.starsDisplay,
      confidence: display.confidence,
      confidenceDisplay: display.confidenceDisplay,
      level: display.level,
      timesEncountered: skill?.timesEncountered ?? 0,
      isStuck: skill?.isStuck ?? false,
    });
  }

  const layerOrder = ["FUNDAMENTALS", "INTERMEDIATE", "PATTERNS"];
  const layerLabels: Record<string, string> = {
    FUNDAMENTALS: "Fundamentals",
    INTERMEDIATE: "Intermediate",
    PATTERNS: "Patterns",
  };

  const affinityBadge = (affinity: string) => {
    switch (affinity) {
      case "js-pure":
        return "bg-yellow-600/20 text-yellow-400";
      case "react-specific":
        return "bg-cyan-600/20 text-cyan-400";
      case "shared":
        return "bg-purple-600/20 text-purple-400";
      default:
        return "bg-slate-600/20 text-slate-400";
    }
  };

  const criticalityColor = (criticality: string) => {
    switch (criticality) {
      case "critical":
        return "text-red-400";
      case "high":
        return "text-orange-400";
      case "medium":
        return "text-yellow-400";
      case "low":
        return "text-green-400";
      default:
        return "text-slate-400";
    }
  };

  return (
    <div className="p-6 lg:p-8 max-w-6xl">
    <div className="max-w-4xl mx-auto">
      <h1 className="text-3xl font-bold text-white mb-2">Topic Library</h1>
      <p className="text-slate-400 mb-8">
        All {topics.length} skill markers across JavaScript and React — track
        your mastery with Glicko-2 ratings.
      </p>

      <div className="space-y-10">
        {layerOrder
          .filter((layer) => grouped[layer])
          .map((layer) => (
            <div key={layer}>
              <h2 className="text-2xl font-semibold text-white mb-1">
                {layerLabels[layer]}
              </h2>
              <p className="text-slate-500 text-sm mb-4">
                {Object.values(grouped[layer]).flat().length} topics
              </p>

              <div className="space-y-6">
                {Object.entries(grouped[layer]).map(
                  ([category, categoryTopics]) => (
                    <div key={category}>
                      <h3 className="text-lg font-medium text-slate-300 mb-3">
                        {category}
                      </h3>
                      <div className="grid gap-3">
                        {categoryTopics.map((topic) => (
                          <div
                            key={topic.slug}
                            className={`bg-slate-800 rounded-xl border p-4 ${
                              topic.isStuck
                                ? "border-red-500/50"
                                : "border-slate-700"
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex-1">
                                <div className="flex items-center gap-3">
                                  <h4 className="text-base font-medium text-white">
                                    {topic.name}
                                  </h4>
                                  <span
                                    className={`px-2 py-0.5 text-xs rounded ${affinityBadge(topic.frameworkAffinity)}`}
                                  >
                                    {topic.frameworkAffinity}
                                  </span>
                                  <span
                                    className={`text-xs ${criticalityColor(topic.criticality)}`}
                                  >
                                    {topic.criticality}
                                  </span>
                                  {topic.isStuck && (
                                    <span className="px-2 py-0.5 text-xs rounded bg-red-600/20 text-red-400">
                                      stuck
                                    </span>
                                  )}
                                </div>
                                <p className="text-slate-500 text-xs mt-1">
                                  {topic.timesEncountered > 0
                                    ? `Encountered ${topic.timesEncountered} time${topic.timesEncountered !== 1 ? "s" : ""}`
                                    : "Not yet encountered"}
                                </p>
                              </div>
                              <div className="text-right ml-4">
                                <p className="text-sm text-slate-400">
                                  {topic.level}
                                </p>
                                <p className="text-base tracking-wider">
                                  {topic.starsDisplay}
                                </p>
                                <p className="text-xs text-slate-500">
                                  {topic.confidenceDisplay}
                                </p>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ),
                )}
              </div>
            </div>
          ))}
      </div>
    </div>
    </div>
  );
}
