// =============================================
// Progression Gates System
// Manages unlocking of learning layers
// =============================================

import { prisma } from "./prisma";
import { PROGRESSION, type Layer } from "./constants";
import { calculateWeightedAverageRating } from "./glicko2";

// =============================================
// Types
// =============================================

export interface LayerProgress {
  layer: Layer;
  isUnlocked: boolean;
  unlockedAt: Date | null;
  criteria: {
    coverage: { current: number; required: number; met: boolean };
    avgRating: { current: number; required: number; met: boolean };
    avgRd: { current: number; required: number; met: boolean };
    submissions: { current: number; required: number; met: boolean };
    recency: { daysSince: number; required: number; met: boolean };
  };
  overallProgress: number; // 0-100
  allCriteriaMet: boolean;
}

export interface ProgressionStatus {
  fundamentals: LayerProgress;
  intermediate: LayerProgress;
  patterns: LayerProgress;
  currentLayer: Layer;
  nextUnlock: Layer | null;
}

// =============================================
// Unlock Criteria Checking
// =============================================

/**
 * Check if unlock criteria are met for a layer
 *
 * From CLAUDE.md:
 * Intermediate: coverage >= 90%, avg rating >= 1650, avg RD < 100, submissions >= 10, last review <= 30 days
 * Patterns: coverage >= 90%, avg rating >= 1700, avg RD < 80, submissions >= 20, last review <= 30 days
 */
export async function checkUnlockCriteria(
  userId: string,
  targetLayer: "INTERMEDIATE" | "PATTERNS"
): Promise<LayerProgress> {
  const requirements =
    targetLayer === "INTERMEDIATE" ? PROGRESSION.INTERMEDIATE : PROGRESSION.PATTERNS;
  const prerequisiteLayer = targetLayer === "INTERMEDIATE" ? "FUNDAMENTALS" : "INTERMEDIATE";

  // Get user progress
  const userProgress = await prisma.userProgress.findUnique({
    where: { userId },
  });

  // Get all topics in prerequisite layer
  const layerTopics = await prisma.topic.findMany({
    where: { layer: prerequisiteLayer },
    select: { id: true },
  });
  const topicIds = layerTopics.map((t) => t.id);

  // Get user skills for these topics
  const userSkills = await prisma.userSkillMatrix.findMany({
    where: {
      userId,
      topicId: { in: topicIds },
    },
  });

  // Get total submissions
  const submissionCount = await prisma.submission.count({
    where: { userId },
  });

  // Calculate criteria
  const coveredTopics = userSkills.filter((s) => s.timesEncountered > 0).length;
  const coveragePercent =
    topicIds.length > 0 ? (coveredTopics / topicIds.length) * 100 : 0;

  const { avgRating, avgRd } =
    userSkills.length > 0
      ? calculateWeightedAverageRating(userSkills)
      : { avgRating: 1500, avgRd: 350 };

  const daysSinceLastReview = userProgress?.lastReviewAt
    ? Math.floor(
        (Date.now() - userProgress.lastReviewAt.getTime()) / (1000 * 60 * 60 * 24)
      )
    : Infinity;

  // Build criteria object
  const criteria = {
    coverage: {
      current: Math.round(coveragePercent),
      required: requirements.coveragePercent,
      met: coveragePercent >= requirements.coveragePercent,
    },
    avgRating: {
      current: Math.round(avgRating),
      required: requirements.minAvgRating,
      met: avgRating >= requirements.minAvgRating,
    },
    avgRd: {
      current: Math.round(avgRd),
      required: requirements.maxAvgRd,
      met: avgRd <= requirements.maxAvgRd,
    },
    submissions: {
      current: submissionCount,
      required: requirements.minSubmissions,
      met: submissionCount >= requirements.minSubmissions,
    },
    recency: {
      daysSince: daysSinceLastReview === Infinity ? -1 : daysSinceLastReview,
      required: requirements.maxDaysSinceReview,
      met:
        daysSinceLastReview !== Infinity &&
        daysSinceLastReview <= requirements.maxDaysSinceReview,
    },
  };

  const allCriteriaMet = Object.values(criteria).every((c) => c.met);

  // Calculate overall progress (weighted average)
  const weights = { coverage: 0.25, avgRating: 0.3, avgRd: 0.2, submissions: 0.15, recency: 0.1 };
  let overallProgress = 0;

  overallProgress +=
    weights.coverage * Math.min(100, (criteria.coverage.current / criteria.coverage.required) * 100);
  overallProgress +=
    weights.avgRating *
    Math.min(100, ((criteria.avgRating.current - 1200) / (criteria.avgRating.required - 1200)) * 100);
  overallProgress +=
    weights.avgRd *
    Math.min(100, Math.max(0, ((350 - criteria.avgRd.current) / (350 - criteria.avgRd.required)) * 100));
  overallProgress +=
    weights.submissions *
    Math.min(100, (criteria.submissions.current / criteria.submissions.required) * 100);
  overallProgress += criteria.recency.met ? weights.recency * 100 : 0;

  // Check current unlock status
  const isUnlocked =
    targetLayer === "INTERMEDIATE"
      ? userProgress?.intermediateUnlocked ?? false
      : userProgress?.patternsUnlocked ?? false;

  const unlockedAt =
    targetLayer === "INTERMEDIATE"
      ? userProgress?.intermediateUnlockedAt ?? null
      : userProgress?.patternsUnlockedAt ?? null;

  return {
    layer: targetLayer,
    isUnlocked,
    unlockedAt,
    criteria,
    overallProgress: Math.round(overallProgress),
    allCriteriaMet,
  };
}

/**
 * Unlock a layer for a user
 */
export async function unlockLayer(
  userId: string,
  layer: "INTERMEDIATE" | "PATTERNS"
): Promise<{ success: boolean; message: string }> {
  // Verify criteria are met
  const progress = await checkUnlockCriteria(userId, layer);

  if (!progress.allCriteriaMet) {
    return {
      success: false,
      message: `Not all criteria met for ${layer} unlock`,
    };
  }

  if (progress.isUnlocked) {
    return {
      success: true,
      message: `${layer} layer already unlocked`,
    };
  }

  // Update user progress
  const updateData =
    layer === "INTERMEDIATE"
      ? { intermediateUnlocked: true, intermediateUnlockedAt: new Date() }
      : { patternsUnlocked: true, patternsUnlockedAt: new Date() };

  await prisma.userProgress.upsert({
    where: { userId },
    update: updateData,
    create: {
      userId,
      ...updateData,
    },
  });

  return {
    success: true,
    message: `${layer} layer unlocked!`,
  };
}

/**
 * Check and auto-unlock layers after a submission
 */
export async function checkAndUnlockLayers(userId: string): Promise<{
  intermediateUnlocked: boolean;
  patternsUnlocked: boolean;
  newUnlocks: Layer[];
}> {
  const newUnlocks: Layer[] = [];

  // Check intermediate
  const intermediateProgress = await checkUnlockCriteria(userId, "INTERMEDIATE");
  if (!intermediateProgress.isUnlocked && intermediateProgress.allCriteriaMet) {
    await unlockLayer(userId, "INTERMEDIATE");
    newUnlocks.push("INTERMEDIATE");
  }

  // Check patterns (only if intermediate is unlocked)
  if (intermediateProgress.isUnlocked || newUnlocks.includes("INTERMEDIATE")) {
    const patternsProgress = await checkUnlockCriteria(userId, "PATTERNS");
    if (!patternsProgress.isUnlocked && patternsProgress.allCriteriaMet) {
      await unlockLayer(userId, "PATTERNS");
      newUnlocks.push("PATTERNS");
    }
  }

  return {
    intermediateUnlocked: intermediateProgress.isUnlocked || newUnlocks.includes("INTERMEDIATE"),
    patternsUnlocked:
      (await checkUnlockCriteria(userId, "PATTERNS")).isUnlocked ||
      newUnlocks.includes("PATTERNS"),
    newUnlocks,
  };
}

// =============================================
// Full Progression Status
// =============================================

/**
 * Get complete progression status for a user
 */
export async function getProgressionStatus(userId: string): Promise<ProgressionStatus> {
  const [intermediateProgress, patternsProgress, userProgress] = await Promise.all([
    checkUnlockCriteria(userId, "INTERMEDIATE"),
    checkUnlockCriteria(userId, "PATTERNS"),
    prisma.userProgress.findUnique({ where: { userId } }),
  ]);

  // Fundamentals is always unlocked
  const fundamentalsProgress: LayerProgress = {
    layer: "FUNDAMENTALS",
    isUnlocked: true,
    unlockedAt: userProgress?.intermediateUnlockedAt
      ? new Date(userProgress.intermediateUnlockedAt.getTime() - 1)
      : new Date(),
    criteria: {
      coverage: { current: 100, required: 0, met: true },
      avgRating: { current: 1500, required: 0, met: true },
      avgRd: { current: 350, required: 350, met: true },
      submissions: { current: 0, required: 0, met: true },
      recency: { daysSince: 0, required: 0, met: true },
    },
    overallProgress: 100,
    allCriteriaMet: true,
  };

  // Determine current layer
  let currentLayer: Layer = "FUNDAMENTALS";
  if (patternsProgress.isUnlocked) {
    currentLayer = "PATTERNS";
  } else if (intermediateProgress.isUnlocked) {
    currentLayer = "INTERMEDIATE";
  }

  // Determine next unlock
  let nextUnlock: Layer | null = null;
  if (!intermediateProgress.isUnlocked) {
    nextUnlock = "INTERMEDIATE";
  } else if (!patternsProgress.isUnlocked) {
    nextUnlock = "PATTERNS";
  }

  return {
    fundamentals: fundamentalsProgress,
    intermediate: intermediateProgress,
    patterns: patternsProgress,
    currentLayer,
    nextUnlock,
  };
}

// =============================================
// Layer Statistics
// =============================================

/**
 * Get statistics for a layer
 */
export async function getLayerStats(
  userId: string,
  layer: Layer
): Promise<{
  totalTopics: number;
  attemptedTopics: number;
  masteredTopics: number;
  stuckTopics: number;
  averageRating: number;
  averageRd: number;
}> {
  const layerTopics = await prisma.topic.findMany({
    where: { layer },
    select: { id: true },
  });
  const topicIds = layerTopics.map((t) => t.id);

  const userSkills = await prisma.userSkillMatrix.findMany({
    where: {
      userId,
      topicId: { in: topicIds },
    },
  });

  const attempted = userSkills.filter((s) => s.timesEncountered > 0);
  const mastered = userSkills.filter((s) => s.rating >= 1650 && s.rd < 100);
  const stuck = userSkills.filter((s) => s.isStuck);

  const { avgRating, avgRd } =
    attempted.length > 0
      ? calculateWeightedAverageRating(attempted)
      : { avgRating: 1500, avgRd: 350 };

  return {
    totalTopics: topicIds.length,
    attemptedTopics: attempted.length,
    masteredTopics: mastered.length,
    stuckTopics: stuck.length,
    averageRating: Math.round(avgRating),
    averageRd: Math.round(avgRd),
  };
}

/**
 * Calculate confidence-weighted average rating for skills
 */
export function calculateWeightedAverage(
  skills: Array<{ rating: number; rd: number }>
): { avgRating: number; avgRd: number } {
  return calculateWeightedAverageRating(skills);
}

/**
 * Update layer aggregate ratings in UserProgress
 */
export async function updateLayerRatings(userId: string): Promise<void> {
  const [fundamentals, intermediate, patterns] = await Promise.all([
    getLayerStats(userId, "FUNDAMENTALS"),
    getLayerStats(userId, "INTERMEDIATE"),
    getLayerStats(userId, "PATTERNS"),
  ]);

  await prisma.userProgress.upsert({
    where: { userId },
    update: {
      fundamentalsRating: fundamentals.averageRating,
      fundamentalsRd: fundamentals.averageRd,
      intermediateRating: intermediate.averageRating,
      intermediateRd: intermediate.averageRd,
      patternsRating: patterns.averageRating,
      patternsRd: patterns.averageRd,
    },
    create: {
      userId,
      fundamentalsRating: fundamentals.averageRating,
      fundamentalsRd: fundamentals.averageRd,
      intermediateRating: intermediate.averageRating,
      intermediateRd: intermediate.averageRd,
      patternsRating: patterns.averageRating,
      patternsRd: patterns.averageRd,
    },
  });
}
