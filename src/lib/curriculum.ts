/**
 * Curriculum: Three-Layer Learning Model
 *
 * This is the pedagogical foundation of Code Review Buddy.
 * Topics are organized into three layers that reflect how developers actually learn.
 *
 * Key Principle: Patterns are NOT the foundation—they're tools that become useful
 * once fundamentals and intermediate concepts are solid.
 */

export type TopicCriticality = "critical" | "high" | "medium" | "low";
export type LayerType = "fundamental" | "intermediate" | "pattern";
export type UserLevel = "beginner" | "intermediate" | "advanced";

export interface CurriculumTopic {
  slug: string;
  name: string;
  category: string;
  description: string;
  criticality: TopicCriticality;
  prerequisites?: string[];
  detectionPatterns?: string[]; // Patterns to detect in code
  resources?: {
    title: string;
    url: string;
  }[];
}

export interface PatternTopic extends CurriculumTopic {
  difficulty: 1 | 2 | 3 | 4 | 5;
}

// =============================================================================
// LAYER 1: FUNDAMENTALS (40-50% of learning focus)
// These are ALWAYS prioritized first. A beginner never skips these.
// =============================================================================

export const FUNDAMENTALS: CurriculumTopic[] = [
  {
    slug: "var-usage",
    name: "Var vs Const/Let",
    category: "syntax",
    criticality: "critical",
    description: "Using var instead of const/let causes scoping issues and hoisting bugs",
    detectionPatterns: ["var-usage"],
    resources: [
      { title: "MDN: let", url: "https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/let" },
      { title: "MDN: const", url: "https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/const" },
    ],
  },
  {
    slug: "loose-equality",
    name: "Strict Equality (===)",
    category: "syntax",
    criticality: "critical",
    description: "Using == causes type coercion bugs; === is always safer",
    detectionPatterns: ["loose-equality"],
    resources: [
      { title: "MDN: Equality comparisons", url: "https://developer.mozilla.org/en-US/docs/Web/JavaScript/Equality_comparisons_and_sameness" },
    ],
  },
  {
    slug: "implicit-globals",
    name: "Implicit Global Variables",
    category: "scope",
    criticality: "high",
    description: "Assigning to undeclared variables leaks them into global scope",
    detectionPatterns: ["implicit-global"],
    resources: [
      { title: "MDN: Variable scope", url: "https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Grammar_and_types#variable_scope" },
    ],
  },
  {
    slug: "error-handling-basics",
    name: "Error Handling Basics",
    category: "async",
    criticality: "critical",
    description: "Async code without try/catch or .catch() will fail silently",
    detectionPatterns: ["missing-error-handling"],
    resources: [
      { title: "MDN: try...catch", url: "https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/try...catch" },
    ],
  },
  {
    slug: "async-await-basics",
    name: "Async/Await Fundamentals",
    category: "async",
    criticality: "high",
    description: "Basic async operations and Promise handling",
    detectionPatterns: ["async-await"],
    resources: [
      { title: "MDN: async function", url: "https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/async_function" },
    ],
  },
  {
    slug: "state-basics",
    name: "React State (useState)",
    category: "react-state",
    criticality: "critical",
    description: "Understanding how useState works and why immutability matters",
    detectionPatterns: ["state-mutation"],
    resources: [
      { title: "React: useState", url: "https://react.dev/reference/react/useState" },
    ],
  },
  {
    slug: "jsx-fundamentals",
    name: "JSX Fundamentals",
    category: "react-jsx",
    criticality: "critical",
    description: "JSX syntax, expressions, and rendering basics",
    detectionPatterns: ["jsx-expression"],
    resources: [
      { title: "React: Writing Markup with JSX", url: "https://react.dev/learn/writing-markup-with-jsx" },
    ],
  },
  {
    slug: "key-prop",
    name: "List Keys in React",
    category: "react-jsx",
    criticality: "high",
    description: "Missing or incorrect key props cause rendering bugs",
    detectionPatterns: ["missing-key", "index-as-key"],
    resources: [
      { title: "React: Rendering Lists", url: "https://react.dev/learn/rendering-lists#keeping-list-items-in-order-with-key" },
    ],
  },
  {
    slug: "props-basics",
    name: "Props and Data Flow",
    category: "react-props",
    criticality: "high",
    description: "Understanding one-way data flow and prop passing",
    detectionPatterns: ["prop-drilling"],
    resources: [
      { title: "React: Passing Props", url: "https://react.dev/learn/passing-props-to-a-component" },
    ],
  },
  {
    slug: "array-methods",
    name: "Array Methods (map, filter, reduce)",
    category: "syntax",
    criticality: "high",
    description: "Using the right array method for the job",
    detectionPatterns: ["foreach-return", "wrong-array-method"],
    resources: [
      { title: "MDN: Array methods", url: "https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array" },
    ],
  },
];

// =============================================================================
// LAYER 2: INTERMEDIATE (30% of learning focus)
// Only shown when fundamentals are solid (level >= 3)
// =============================================================================

export const INTERMEDIATE: CurriculumTopic[] = [
  {
    slug: "closures",
    name: "Closures",
    category: "scope",
    criticality: "high",
    description: "Functions capturing outer scope variables",
    prerequisites: ["var-usage", "implicit-globals"],
    detectionPatterns: ["closure-issue", "loop-closure"],
    resources: [
      { title: "MDN: Closures", url: "https://developer.mozilla.org/en-US/docs/Web/JavaScript/Closures" },
    ],
  },
  {
    slug: "useeffect-dependencies",
    name: "useEffect Dependencies",
    category: "react-hooks",
    criticality: "critical",
    description: "Dependency arrays control when effects re-run",
    prerequisites: ["state-basics", "async-await-basics"],
    detectionPatterns: ["missing-effect-dependency", "empty-deps-with-state"],
    resources: [
      { title: "React: useEffect", url: "https://react.dev/reference/react/useEffect" },
      { title: "React: Removing Effect Dependencies", url: "https://react.dev/learn/removing-effect-dependencies" },
    ],
  },
  {
    slug: "async-patterns",
    name: "Async Patterns",
    category: "async",
    criticality: "high",
    description: "Promises vs async/await, error handling strategies",
    prerequisites: ["async-await-basics", "error-handling-basics"],
    detectionPatterns: ["promise-chaining", "callback-hell"],
    resources: [
      { title: "MDN: Using Promises", url: "https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Using_promises" },
    ],
  },
  {
    slug: "module-pattern",
    name: "Module Pattern",
    category: "architecture",
    criticality: "medium",
    description: "import/export and code organization",
    prerequisites: ["var-usage"],
    detectionPatterns: ["too-many-globals", "mixed-exports"],
    resources: [
      { title: "MDN: Modules", url: "https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Modules" },
    ],
  },
  {
    slug: "api-calls",
    name: "API Calls",
    category: "async",
    criticality: "high",
    description: "Fetching data with proper error handling and loading states",
    prerequisites: ["async-await-basics", "error-handling-basics"],
    detectionPatterns: ["fetch-no-error-handling", "no-loading-state"],
    resources: [
      { title: "MDN: Fetch API", url: "https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API" },
    ],
  },
  {
    slug: "component-composition",
    name: "Component Composition",
    category: "react-architecture",
    criticality: "high",
    description: "Lifting state, composition patterns, avoiding prop drilling",
    prerequisites: ["state-basics", "props-basics"],
    detectionPatterns: ["prop-drilling", "god-component"],
    resources: [
      { title: "React: Sharing State", url: "https://react.dev/learn/sharing-state-between-components" },
    ],
  },
  {
    slug: "conditional-rendering",
    name: "Conditional Rendering",
    category: "react-jsx",
    criticality: "medium",
    description: "Patterns for conditionally showing UI",
    prerequisites: ["jsx-fundamentals"],
    detectionPatterns: ["ternary-hell", "conditional-hook"],
    resources: [
      { title: "React: Conditional Rendering", url: "https://react.dev/learn/conditional-rendering" },
    ],
  },
  {
    slug: "event-handling",
    name: "Event Handling",
    category: "react-events",
    criticality: "high",
    description: "Proper event handler patterns in React",
    prerequisites: ["jsx-fundamentals", "state-basics"],
    detectionPatterns: ["inline-function-jsx", "missing-event-handler"],
    resources: [
      { title: "React: Responding to Events", url: "https://react.dev/learn/responding-to-events" },
    ],
  },
];

// =============================================================================
// LAYER 3: PATTERNS (20% of learning focus)
// Only shown when intermediate concepts are solid (level >= 3)
// These are TOOLS, not foundations.
// =============================================================================

export const PATTERNS: PatternTopic[] = [
  {
    slug: "custom-hooks",
    name: "Custom Hooks Pattern",
    category: "react-patterns",
    criticality: "medium",
    difficulty: 3,
    description: "Extracting stateful logic into reusable hooks",
    prerequisites: ["useeffect-dependencies", "closures"],
    detectionPatterns: ["duplicated-hook-logic"],
    resources: [
      { title: "React: Reusing Logic with Custom Hooks", url: "https://react.dev/learn/reusing-logic-with-custom-hooks" },
    ],
  },
  {
    slug: "memoization",
    name: "Memoization (useMemo/useCallback)",
    category: "react-patterns",
    criticality: "medium",
    difficulty: 3,
    description: "Optimizing renders with memoization",
    prerequisites: ["useeffect-dependencies", "component-composition"],
    detectionPatterns: ["missing-memo", "unnecessary-memo"],
    resources: [
      { title: "React: useMemo", url: "https://react.dev/reference/react/useMemo" },
      { title: "React: useCallback", url: "https://react.dev/reference/react/useCallback" },
    ],
  },
  {
    slug: "context-pattern",
    name: "Context API Pattern",
    category: "react-patterns",
    criticality: "medium",
    difficulty: 3,
    description: "State management with Context for avoiding prop drilling",
    prerequisites: ["component-composition", "custom-hooks"],
    detectionPatterns: ["context-overuse", "missing-provider"],
    resources: [
      { title: "React: useContext", url: "https://react.dev/reference/react/useContext" },
    ],
  },
  {
    slug: "reducer-pattern",
    name: "Reducer Pattern (useReducer)",
    category: "react-patterns",
    criticality: "low",
    difficulty: 4,
    description: "Managing complex state with reducers",
    prerequisites: ["state-basics", "custom-hooks"],
    detectionPatterns: ["complex-state-logic"],
    resources: [
      { title: "React: useReducer", url: "https://react.dev/reference/react/useReducer" },
    ],
  },
  {
    slug: "render-props",
    name: "Render Props Pattern",
    category: "react-patterns",
    criticality: "low",
    difficulty: 4,
    description: "Sharing code between components using a prop whose value is a function",
    prerequisites: ["component-composition", "closures"],
    detectionPatterns: ["render-prop-opportunity"],
    resources: [
      { title: "React: Render Props", url: "https://legacy.reactjs.org/docs/render-props.html" },
    ],
  },
  {
    slug: "compound-components",
    name: "Compound Components",
    category: "react-patterns",
    criticality: "low",
    difficulty: 5,
    description: "Components that work together to form a complete UI",
    prerequisites: ["context-pattern", "component-composition"],
    detectionPatterns: ["compound-opportunity"],
    resources: [
      { title: "Kent C. Dodds: Compound Components", url: "https://kentcdodds.com/blog/compound-components-with-react-hooks" },
    ],
  },
  {
    slug: "error-boundaries",
    name: "Error Boundaries",
    category: "react-patterns",
    criticality: "medium",
    difficulty: 3,
    description: "Catching and handling errors in React component trees",
    prerequisites: ["error-handling-basics", "component-composition"],
    detectionPatterns: ["missing-error-boundary"],
    resources: [
      { title: "React: Error Boundaries", url: "https://react.dev/reference/react/Component#catching-rendering-errors-with-an-error-boundary" },
    ],
  },
];

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Get all topics from a specific layer
 */
export function getTopicsByLayer(layer: LayerType): CurriculumTopic[] {
  switch (layer) {
    case "fundamental":
      return FUNDAMENTALS;
    case "intermediate":
      return INTERMEDIATE;
    case "pattern":
      return PATTERNS;
  }
}

/**
 * Find a topic by slug across all layers
 */
export function findTopicBySlug(slug: string): { topic: CurriculumTopic | PatternTopic; layer: LayerType } | null {
  const fundamental = FUNDAMENTALS.find(t => t.slug === slug);
  if (fundamental) return { topic: fundamental, layer: "fundamental" };

  const intermediate = INTERMEDIATE.find(t => t.slug === slug);
  if (intermediate) return { topic: intermediate, layer: "intermediate" };

  const pattern = PATTERNS.find(t => t.slug === slug);
  if (pattern) return { topic: pattern, layer: "pattern" };

  return null;
}

/**
 * Get topics that match detected patterns
 */
export function getTopicsForDetectedPatterns(detectedPatterns: string[]): {
  fundamentals: CurriculumTopic[];
  intermediate: CurriculumTopic[];
  patterns: PatternTopic[];
} {
  const matchingFundamentals = FUNDAMENTALS.filter(topic =>
    topic.detectionPatterns?.some(p => detectedPatterns.includes(p))
  );

  const matchingIntermediate = INTERMEDIATE.filter(topic =>
    topic.detectionPatterns?.some(p => detectedPatterns.includes(p))
  );

  const matchingPatterns = PATTERNS.filter(topic =>
    topic.detectionPatterns?.some(p => detectedPatterns.includes(p))
  );

  return {
    fundamentals: matchingFundamentals,
    intermediate: matchingIntermediate,
    patterns: matchingPatterns,
  };
}

/**
 * Estimate user level based on layer mastery
 */
export function estimateUserLevel(
  fundamentalsLevel: number,
  intermediateLevel: number,
  _patternsLevel: number
): UserLevel {
  // Must have solid fundamentals before anything else
  if (fundamentalsLevel < 3) return "beginner";

  // Must have solid intermediate before advanced
  if (fundamentalsLevel >= 3 && intermediateLevel < 3) return "intermediate";

  // Advanced if solid on both fundamentals and intermediate
  if (fundamentalsLevel >= 4 && intermediateLevel >= 3) return "advanced";

  return "intermediate";
}

/**
 * Determine which layers should be shown to user
 */
export function getVisibleLayers(userLevel: UserLevel): LayerType[] {
  switch (userLevel) {
    case "beginner":
      return ["fundamental"];
    case "intermediate":
      return ["fundamental", "intermediate"];
    case "advanced":
      return ["fundamental", "intermediate", "pattern"];
  }
}

/**
 * Get layer display info
 */
export function getLayerInfo(layer: LayerType): {
  name: string;
  shortName: string;
  color: string;
  bgColor: string;
  priority: string;
  description: string;
} {
  switch (layer) {
    case "fundamental":
      return {
        name: "Fundamentals",
        shortName: "Foundation",
        color: "text-red-700",
        bgColor: "bg-red-100",
        priority: "40-50%",
        description: "Master these first. Everything else builds on them.",
      };
    case "intermediate":
      return {
        name: "Intermediate",
        shortName: "Next Level",
        color: "text-yellow-700",
        bgColor: "bg-yellow-100",
        priority: "30%",
        description: "Build on your fundamentals with deeper concepts.",
      };
    case "pattern":
      return {
        name: "Patterns",
        shortName: "Design Patterns",
        color: "text-blue-700",
        bgColor: "bg-blue-100",
        priority: "20%",
        description: "Advanced techniques for maintainable code.",
      };
  }
}

// Category groupings for display
export const CATEGORIES = {
  fundamental: ["syntax", "scope", "async", "react-state", "react-jsx", "react-props"],
  intermediate: ["scope", "react-hooks", "async", "architecture", "react-architecture", "react-jsx", "react-events"],
  pattern: ["react-patterns"],
};
