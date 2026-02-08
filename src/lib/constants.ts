// =============================================
// Cortext Coding Coach - Configuration Constants
// From CLAUDE.md specification
// =============================================

// =============================================
// Glicko-2 Parameters
// =============================================
export const GLICKO2 = {
  INITIAL_RATING: 1500,
  INITIAL_RD: 350,
  INITIAL_VOLATILITY: 0.06,
  MIN_RATING: 1200,
  MAX_RATING: 1800,
  MIN_RD: 50,
  MAX_RD: 350,
  TAU: 0.5, // System constant - constrains volatility change
  DECAY_CONSTANT: 0.5, // RD increase per day of inactivity
  CONVERGENCE_TOLERANCE: 0.000001, // For iterative algorithms
} as const;

// =============================================
// Display Thresholds - Rating to Stars
// =============================================
export const RATING_THRESHOLDS = {
  NOVICE_CEILING: 1400, // Below = Novice (1 star)
  BASIC_CEILING: 1500, // Below = Basic (2 stars)
  COMPETENT_CEILING: 1650, // Below = Competent (3 stars)
  PROFICIENT_CEILING: 1750, // Below = Proficient (4 stars)
  // Above 1750 = Expert (5 stars)
} as const;

export const RATING_LEVELS = {
  NOVICE: { min: 1200, max: 1400, stars: 1, label: "Novice" },
  BASIC: { min: 1400, max: 1500, stars: 2, label: "Basic" },
  COMPETENT: { min: 1500, max: 1650, stars: 3, label: "Competent" },
  PROFICIENT: { min: 1650, max: 1750, stars: 4, label: "Proficient" },
  EXPERT: { min: 1750, max: 1800, stars: 5, label: "Expert" },
} as const;

// =============================================
// Confidence (RD) to Display Dots
// =============================================
export const RD_THRESHOLDS = {
  HIGH_CONFIDENCE_RD: 80, // Below = High confidence (●●●)
  MEDIUM_CONFIDENCE_RD: 150, // Below = Medium confidence (●●○)
  // Above 150 = Low confidence (●○○)
} as const;

export const CONFIDENCE_LEVELS = {
  HIGH: { maxRd: 80, dots: 3, label: "High confidence" },
  MEDIUM: { maxRd: 150, dots: 2, label: "Medium confidence" },
  LOW: { maxRd: 350, dots: 1, label: "Low confidence" },
} as const;

// =============================================
// Error Classification Thresholds
// =============================================
export const ERROR_CLASSIFICATION = {
  // SLIP: High skill user makes trivial error (careless mistake)
  SLIP: {
    minRating: 1650, // Must be proficient+
    cleanHistoryRequired: 2, // Last 2 attempts must be clean
    description: "Careless mistake by proficient user",
  },

  // MISCONCEPTION: Persistent fundamental misunderstanding
  MISCONCEPTION: {
    maxRating: 1450, // User is struggling
    minEncounters: 3, // Has seen topic multiple times
    minVolatility: 0.12, // Performance is inconsistent
    description: "Fundamental misunderstanding requiring targeted intervention",
  },

  // MISTAKE: Default classification (learning error)
  MISTAKE: {
    description: "Standard learning error",
  },
} as const;

export type ErrorType = "SLIP" | "MISTAKE" | "MISCONCEPTION";

// =============================================
// Stuck Detection Thresholds (ALL must be true)
// =============================================
export const STUCK_THRESHOLDS = {
  MAX_RATING: 1450, // Rating below this
  MIN_ENCOUNTERS: 4, // Topic encountered at least this many times
  MIN_RD: 180, // RD above this (uncertain)
  MIN_VOLATILITY: 0.12, // Volatility above this (inconsistent)
} as const;

// =============================================
// Progression Gate Criteria
// =============================================
export const PROGRESSION = {
  INTERMEDIATE: {
    coveragePercent: 90, // % of fundamentals topics attempted
    minAvgRating: 1650,
    maxAvgRd: 100,
    minSubmissions: 10,
    maxDaysSinceReview: 30,
  },
  PATTERNS: {
    coveragePercent: 90, // % of intermediate topics attempted
    minAvgRating: 1700,
    maxAvgRd: 80,
    minSubmissions: 20,
    maxDaysSinceReview: 30,
  },
} as const;

export type Layer = "FUNDAMENTALS" | "INTERMEDIATE" | "PATTERNS";

// =============================================
// Performance Scores (0.0 - 1.0)
// =============================================
export const PERFORMANCE_SCORES = {
  PERFECT: 1.0, // Clean + idiomatic
  CLEAN: 0.8, // Clean but not idiomatic
  SLIP: 0.6, // Careless mistake by proficient user
  MISTAKE: 0.3, // Standard learning error
  MISCONCEPTION: 0.0, // Fundamental misunderstanding
} as const;

// =============================================
// Scaffolding Levels (based on rating)
// =============================================
export const SCAFFOLDING = {
  HIGH: {
    maxRating: 1400,
    approach: "Supportive, break into steps, almost give answers",
    promptStyle: "detailed_guidance",
  },
  MEDIUM: {
    minRating: 1400,
    maxRating: 1600,
    approach: "Explain reasoning, synthesis questions",
    promptStyle: "guided_discovery",
  },
  LOW: {
    minRating: 1600,
    approach: "Minimal hints, architectural questions",
    promptStyle: "socratic",
  },
} as const;

export type ScaffoldingLevel = "HIGH" | "MEDIUM" | "LOW";

// =============================================
// Framework Affinity
// =============================================
export const FRAMEWORK_AFFINITY = {
  JS_PURE: "js-pure",
  REACT_SPECIFIC: "react-specific",
  SHARED: "shared",
} as const;

export type FrameworkAffinity = "js-pure" | "react-specific" | "shared";

// =============================================
// Topic Criticality
// =============================================
export const CRITICALITY = {
  CRITICAL: "critical",
  HIGH: "high",
  MEDIUM: "medium",
  LOW: "low",
} as const;

export type Criticality = "critical" | "high" | "medium" | "low";

// =============================================
// Subscription Tiers
// =============================================
export const SUBSCRIPTION = {
  FREE: {
    tier: "free",
    monthlyReviews: 10,
    features: ["AI code coaching", "Skill tracking"],
  },
  PRO: {
    tier: "pro",
    monthlyReviews: Infinity,
    features: [
      "Unlimited coaching sessions",
      "Advanced analytics",
      "Priority support",
      "Misconception tracking",
    ],
  },
} as const;

export type SubscriptionTier = "free" | "pro";

// =============================================
// Known Misconception Patterns
// =============================================
export const MISCONCEPTION_PATTERNS = [
  {
    pattern: "setState is synchronous",
    relatedTopics: ["usestate-basics", "usestate-functional-updates", "controlled-components"],
    description:
      "Believes state updates happen immediately, leading to stale state issues",
  },
  {
    pattern: "useEffect runs before render",
    relatedTopics: ["useeffect-basics", "useeffect-dependencies", "useref-dom"],
    description:
      "Misunderstands useEffect timing, expecting it to run before DOM updates",
  },
  {
    pattern: "Props are mutable",
    relatedTopics: ["props-basics", "state-immutability"],
    description: "Attempts to directly modify props instead of using state",
  },
  {
    pattern: "Array index as key is fine",
    relatedTopics: ["jsx-keys", "jsx-list-rendering"],
    description:
      "Uses array index as key without understanding reconciliation issues",
  },
  {
    pattern: "Missing dependency is just a warning",
    relatedTopics: [
      "useeffect-dependencies",
      "useeffect-infinite-loop",
      "closure-basics",
    ],
    description:
      "Ignores exhaustive-deps warnings, leading to stale closures",
  },
] as const;

// =============================================
// API Configuration
// =============================================
export const API_CONFIG = {
  GROK_MODEL: "grok-4-latest",
  MAX_CODE_LENGTH: 50000,
  MAX_FEEDBACK_TOKENS: 4096,
} as const;

// =============================================
// Display Configuration
// =============================================
export const DISPLAY = {
  DEFAULT_FRAMEWORKS: ["js", "react"] as string[],
  MAX_ISSUES_PER_REVIEW: 3,
  TOPICS_PER_PAGE: 20,
} as const;
