import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

// Seed data for patterns (will be moved to DB seed later)
const DEFAULT_PATTERNS = [
  {
    name: "State Mutation",
    slug: "state-mutation",
    category: "react-basics",
    difficulty: 2,
    description: "Directly mutating state instead of using setState or spread operators",
  },
  {
    name: "Promise Chaining",
    slug: "promise-chaining",
    category: "async-patterns",
    difficulty: 2,
    description: "Multiple .then() calls that could be simplified with async/await",
  },
  {
    name: "Missing Effect Dependencies",
    slug: "missing-effect-dependency",
    category: "react-hooks",
    difficulty: 3,
    description: "useEffect without proper dependency array",
  },
  {
    name: "Closures",
    slug: "closures",
    category: "javascript-fundamentals",
    difficulty: 3,
    description: "Functions that capture variables from outer scope",
  },
  {
    name: "Callback Hell",
    slug: "callback-hell",
    category: "async-patterns",
    difficulty: 2,
    description: "Deeply nested callbacks making code hard to read",
  },
  {
    name: "Missing Error Handling",
    slug: "missing-error-handling",
    category: "error-handling",
    difficulty: 2,
    description: "Async operations without try/catch or .catch()",
  },
  {
    name: "Var Usage",
    slug: "var-usage",
    category: "javascript-fundamentals",
    difficulty: 1,
    description: "Using var instead of const/let",
  },
  {
    name: "Loose Equality",
    slug: "loose-equality",
    category: "javascript-fundamentals",
    difficulty: 1,
    description: "Using == instead of === for comparisons",
  },
];

export default async function PatternLibraryPage() {
  const session = await auth();
  if (!session?.user?.id) return null;

  // Get user's mastery for each pattern
  const userPatterns = await prisma.userPattern.findMany({
    where: { userId: session.user.id },
  });

  const masteryMap = new Map(
    userPatterns.map((p) => [p.patternName, p.masteryLevel])
  );

  // Group patterns by category
  const groupedPatterns = DEFAULT_PATTERNS.reduce((acc, pattern) => {
    if (!acc[pattern.category]) {
      acc[pattern.category] = [];
    }
    acc[pattern.category].push({
      ...pattern,
      userMastery: masteryMap.get(pattern.slug) || 0,
    });
    return acc;
  }, {} as Record<string, (typeof DEFAULT_PATTERNS[0] & { userMastery: number })[]>);

  const categoryNames: Record<string, string> = {
    "javascript-fundamentals": "JavaScript Fundamentals",
    "async-patterns": "Async Patterns",
    "react-basics": "React Basics",
    "react-hooks": "React Hooks",
    "error-handling": "Error Handling",
  };

  return (
    <div className="max-w-4xl mx-auto">
      <h1 className="text-3xl font-bold text-white mb-2">Pattern Library</h1>
      <p className="text-slate-400 mb-8">
        Track your progress on common JavaScript and React patterns
      </p>

      <div className="space-y-8">
        {Object.entries(groupedPatterns).map(([category, patterns]) => (
          <div key={category}>
            <h2 className="text-xl font-semibold text-white mb-4">
              {categoryNames[category] || category}
            </h2>
            <div className="grid gap-4">
              {patterns.map((pattern) => (
                <div
                  key={pattern.slug}
                  className="bg-slate-800 rounded-xl border border-slate-700 p-5"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3">
                        <h3 className="text-lg font-medium text-white">
                          {pattern.name}
                        </h3>
                        <span
                          className={`px-2 py-0.5 text-xs rounded ${
                            pattern.difficulty === 1
                              ? "bg-green-600/20 text-green-400"
                              : pattern.difficulty === 2
                              ? "bg-yellow-600/20 text-yellow-400"
                              : "bg-red-600/20 text-red-400"
                          }`}
                        >
                          {pattern.difficulty === 1
                            ? "Beginner"
                            : pattern.difficulty === 2
                            ? "Intermediate"
                            : "Advanced"}
                        </span>
                      </div>
                      <p className="text-slate-400 text-sm mt-2">
                        {pattern.description}
                      </p>
                    </div>
                    <div className="text-right ml-4">
                      <p className="text-sm text-slate-500">Your mastery</p>
                      <div className="flex items-center gap-1 mt-1">
                        {[1, 2, 3, 4, 5].map((level) => (
                          <div
                            key={level}
                            className={`w-3 h-3 rounded-full ${
                              level <= pattern.userMastery
                                ? "bg-blue-500"
                                : "bg-slate-700"
                            }`}
                          />
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
