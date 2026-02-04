// =============================================
// Error Classification System
// Classifies errors as SLIP, MISTAKE, or MISCONCEPTION
// =============================================

import {
  ERROR_CLASSIFICATION,
  PERFORMANCE_SCORES,
  type ErrorType,
} from "./constants";

// =============================================
// Types
// =============================================

export interface UserSkillSnapshot {
  rating: number;
  rd: number;
  volatility: number;
  timesEncountered: number;
}

export interface PerformanceRecord {
  score: number;
  errorType: ErrorType | null;
  createdAt: Date;
}

export interface ClassificationResult {
  errorType: ErrorType;
  performanceScore: number;
  reasoning: string;
}

// =============================================
// Error Classification
// =============================================

/**
 * Classify an error based on user skill, error type, and recent history
 *
 * From CLAUDE.md:
 * - SLIP: rating > 1650, last 2 clean, trivial error
 * - MISCONCEPTION: rating < 1450, encounters >= 3, volatility > 0.12
 * - MISTAKE: Everything else (default)
 */
export function classifyError(
  userSkill: UserSkillSnapshot,
  isTrivialError: boolean,
  recentHistory: PerformanceRecord[]
): ClassificationResult {
  // Check for SLIP first
  // High-rated user making a careless mistake
  if (isSlip(userSkill, isTrivialError, recentHistory)) {
    return {
      errorType: "SLIP",
      performanceScore: PERFORMANCE_SCORES.SLIP,
      reasoning: `Classified as SLIP: High skill user (rating ${Math.round(userSkill.rating)}) with clean recent history made a trivial error`,
    };
  }

  // Check for MISCONCEPTION
  // Persistent struggle indicating fundamental misunderstanding
  if (isMisconception(userSkill)) {
    return {
      errorType: "MISCONCEPTION",
      performanceScore: PERFORMANCE_SCORES.MISCONCEPTION,
      reasoning: `Classified as MISCONCEPTION: User struggles (rating ${Math.round(userSkill.rating)}) despite ${userSkill.timesEncountered} encounters, with high volatility (${userSkill.volatility.toFixed(2)})`,
    };
  }

  // Default: MISTAKE
  // Normal learning error
  return {
    errorType: "MISTAKE",
    performanceScore: PERFORMANCE_SCORES.MISTAKE,
    reasoning: `Classified as MISTAKE: Standard learning error`,
  };
}

/**
 * Check if error qualifies as a SLIP
 */
function isSlip(
  userSkill: UserSkillSnapshot,
  isTrivialError: boolean,
  recentHistory: PerformanceRecord[]
): boolean {
  // Must be proficient+
  if (userSkill.rating < ERROR_CLASSIFICATION.SLIP.minRating) {
    return false;
  }

  // Must be a trivial error type
  if (!isTrivialError) {
    return false;
  }

  // Last N performances must be clean
  const recentCleanCount = ERROR_CLASSIFICATION.SLIP.cleanHistoryRequired;
  const recentPerformances = recentHistory.slice(-recentCleanCount);

  // If not enough history, can't be a slip
  if (recentPerformances.length < recentCleanCount) {
    return false;
  }

  // All recent performances must have been clean (score >= 0.8)
  const allClean = recentPerformances.every((p) => p.score >= PERFORMANCE_SCORES.CLEAN);
  return allClean;
}

/**
 * Check if error qualifies as a MISCONCEPTION
 */
function isMisconception(userSkill: UserSkillSnapshot): boolean {
  const criteria = ERROR_CLASSIFICATION.MISCONCEPTION;

  // Rating must be low (struggling)
  if (userSkill.rating > criteria.maxRating) {
    return false;
  }

  // Must have encountered topic multiple times
  if (userSkill.timesEncountered < criteria.minEncounters) {
    return false;
  }

  // Must have high volatility (inconsistent performance)
  if (userSkill.volatility < criteria.minVolatility) {
    return false;
  }

  return true;
}

// =============================================
// Performance Score Calculation
// =============================================

/**
 * Calculate performance score for an outcome
 *
 * From CLAUDE.md:
 * - Perfect (clean + idiomatic): 1.0
 * - Clean only: 0.8
 * - Slip: 0.6
 * - Mistake: 0.3
 * - Misconception: 0.0
 */
export function calculatePerformanceScore(
  outcome: "perfect" | "clean" | "error",
  isIdiomatic: boolean = false,
  errorClassification?: ErrorType
): number {
  // Perfect: clean code with idiomatic patterns
  if (outcome === "perfect" || (outcome === "clean" && isIdiomatic)) {
    return PERFORMANCE_SCORES.PERFECT;
  }

  // Clean: code works but not idiomatic
  if (outcome === "clean") {
    return PERFORMANCE_SCORES.CLEAN;
  }

  // Error outcomes - use classification
  if (outcome === "error" && errorClassification) {
    switch (errorClassification) {
      case "SLIP":
        return PERFORMANCE_SCORES.SLIP;
      case "MISCONCEPTION":
        return PERFORMANCE_SCORES.MISCONCEPTION;
      case "MISTAKE":
      default:
        return PERFORMANCE_SCORES.MISTAKE;
    }
  }

  // Default error score
  return PERFORMANCE_SCORES.MISTAKE;
}

// =============================================
// Detection Outcome Types
// =============================================

export interface DetectionOutcome {
  topicSlug: string;
  detected: boolean;
  isPositive: boolean; // Good usage detected
  isNegative: boolean; // Issue/problem detected
  isIdiomatic: boolean; // Best practice used
  isTrivial?: boolean; // Minor/trivial issue
  location?: { line: number; column: number };
}

/**
 * Determine outcome from detection result
 */
export function determineOutcome(detection: DetectionOutcome): "perfect" | "clean" | "error" {
  if (!detection.detected) {
    // Topic not detected in code - no score change
    return "clean";
  }

  if (detection.isNegative) {
    return "error";
  }

  if (detection.isPositive && detection.isIdiomatic) {
    return "perfect";
  }

  if (detection.isPositive) {
    return "clean";
  }

  return "clean";
}

/**
 * Process a detection result and get full performance info
 */
export function processDetection(
  detection: DetectionOutcome,
  userSkill: UserSkillSnapshot,
  recentHistory: PerformanceRecord[]
): {
  performanceScore: number;
  errorType: ErrorType | null;
  classification: ClassificationResult | null;
} {
  const outcome = determineOutcome(detection);

  // If no error, return score without classification
  if (outcome !== "error") {
    return {
      performanceScore: calculatePerformanceScore(outcome, detection.isIdiomatic),
      errorType: null,
      classification: null,
    };
  }

  // Error detected - classify it
  const classification = classifyError(
    userSkill,
    detection.isTrivial ?? false,
    recentHistory
  );

  return {
    performanceScore: classification.performanceScore,
    errorType: classification.errorType,
    classification,
  };
}

// =============================================
// Utility Functions
// =============================================

/**
 * Get human-readable description of error type
 */
export function getErrorTypeDescription(errorType: ErrorType): string {
  switch (errorType) {
    case "SLIP":
      return "This appears to be a careless mistake. You know this material well - just a momentary lapse!";
    case "MISCONCEPTION":
      return "This suggests a fundamental misunderstanding that we should address directly.";
    case "MISTAKE":
      return "This is a normal learning error - perfect opportunity to deepen your understanding.";
  }
}

/**
 * Get color/style class for error type
 */
export function getErrorTypeColor(errorType: ErrorType): string {
  switch (errorType) {
    case "SLIP":
      return "text-yellow-500"; // Warning/attention
    case "MISCONCEPTION":
      return "text-red-500"; // Needs intervention
    case "MISTAKE":
      return "text-blue-500"; // Learning opportunity
  }
}

/**
 * Get badge variant for error type
 */
export function getErrorTypeBadgeVariant(
  errorType: ErrorType
): "default" | "secondary" | "destructive" | "outline" {
  switch (errorType) {
    case "SLIP":
      return "secondary";
    case "MISCONCEPTION":
      return "destructive";
    case "MISTAKE":
      return "default";
  }
}
