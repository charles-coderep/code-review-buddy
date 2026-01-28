// Pattern detection result from AST analysis
export interface ASTPatterns {
  hasAsyncAwait: boolean;
  hasPromises: boolean;
  hasClosures: boolean;
  hasMutations: boolean;
  hasUnhandledPromiseRejections: boolean;
  hasEffectWithoutDependencies: boolean;
  hasStateInReducer: boolean;
  hasUseEffectCleanup: boolean;
  hasConditionalHooks: boolean;
}

// User's mastery of a pattern
export interface UserPatternMastery {
  patternName: string;
  masteryLevel: number; // 0-5
  timesSeen: number;
  timesHelpful: number;
  lastReviewed: Date | null;
}

// Mastery level descriptions
export const MASTERY_LEVELS = {
  0: "Not Introduced",
  1: "New",
  2: "Practicing",
  3: "Intermediate",
  4: "Advanced",
  5: "Mastered",
} as const;

// Result from code review
export interface ReviewResult {
  success: boolean;
  feedback?: string;
  patterns?: string[];
  feedbackId?: string;
  tokensUsed?: number;
  estimatedCost?: number;
  error?: string;
}

// Feedback rating input
export interface FeedbackRatingInput {
  feedbackId: string;
  helpful: boolean;
  userId: string;
  note?: string;
}

// Pattern category
export type PatternCategory =
  | "javascript-fundamentals"
  | "async-patterns"
  | "react-basics"
  | "react-hooks"
  | "react-patterns"
  | "state-management"
  | "error-handling"
  | "performance";

// Pattern definition
export interface PatternDefinition {
  name: string;
  slug: string;
  category: PatternCategory;
  description: string;
  difficulty: number;
  prerequisites: string[];
  commonMistakes: string;
  learningResources: { title: string; url: string }[];
}

// Review submission input
export interface SubmitReviewInput {
  code: string;
  language: "javascript" | "jsx" | "typescript" | "tsx";
  description?: string;
}

// User progress summary
export interface UserProgress {
  totalReviews: number;
  patternsMastered: string[];
  patternsPracticing: string[];
  patternsNew: string[];
  weeklyProgress: {
    reviewsCompleted: number;
    improvementScore: number;
  };
}

// Subscription tier
export type SubscriptionTier = "free" | "pro";

// Review limits per tier
export const REVIEW_LIMITS: Record<SubscriptionTier, number> = {
  free: 5,
  pro: Infinity,
};
