// =============================================
// Stuck Detection System
// Detects when users are stuck on topics and need intervention
// =============================================

import { STUCK_THRESHOLDS } from "./constants";
import { prisma } from "./prisma";

// =============================================
// Types
// =============================================

export interface SkillData {
  userId: string;
  topicId: number;
  rating: number;
  rd: number;
  volatility: number;
  timesEncountered: number;
  lastPracticed: Date | null;
  isStuck: boolean;
  stuckSince: Date | null;
}

export interface StuckTopic extends SkillData {
  topic: {
    slug: string;
    name: string;
    layer: string;
    category: string;
  };
  daysSinceLastPractice: number;
}

// =============================================
// Stuck Detection Logic
// =============================================

/**
 * Check if a user is stuck on a topic
 *
 * From CLAUDE.md - ALL criteria must be true:
 * - rating < 1450
 * - times_encountered >= 4
 * - rd > 180
 * - volatility > 0.12
 */
export function isUserStuck(skill: SkillData): boolean {
  // Rating must be low (struggling)
  if (skill.rating >= STUCK_THRESHOLDS.MAX_RATING) {
    return false;
  }

  // Must have encountered topic multiple times
  if (skill.timesEncountered < STUCK_THRESHOLDS.MIN_ENCOUNTERS) {
    return false;
  }

  // RD must be high (uncertain about skill)
  if (skill.rd <= STUCK_THRESHOLDS.MIN_RD) {
    return false;
  }

  // Volatility must be high (inconsistent performance)
  if (skill.volatility <= STUCK_THRESHOLDS.MIN_VOLATILITY) {
    return false;
  }

  return true;
}

/**
 * Get detailed stuck status with breakdown
 */
export function getStuckStatus(skill: SkillData): {
  isStuck: boolean;
  criteria: {
    lowRating: boolean;
    manyEncounters: boolean;
    highRd: boolean;
    highVolatility: boolean;
  };
  met: number;
  total: number;
} {
  const criteria = {
    lowRating: skill.rating < STUCK_THRESHOLDS.MAX_RATING,
    manyEncounters: skill.timesEncountered >= STUCK_THRESHOLDS.MIN_ENCOUNTERS,
    highRd: skill.rd > STUCK_THRESHOLDS.MIN_RD,
    highVolatility: skill.volatility > STUCK_THRESHOLDS.MIN_VOLATILITY,
  };

  const met = Object.values(criteria).filter(Boolean).length;

  return {
    isStuck: met === 4,
    criteria,
    met,
    total: 4,
  };
}

// =============================================
// Database Operations
// =============================================

/**
 * Get all stuck topics for a user
 */
export async function getStuckTopics(userId: string): Promise<StuckTopic[]> {
  const skills = await prisma.userSkillMatrix.findMany({
    where: {
      userId,
      isStuck: true,
    },
    include: {
      topic: {
        select: {
          slug: true,
          name: true,
          layer: true,
          category: true,
        },
      },
    },
  });

  const now = new Date();
  return skills.map((skill) => ({
    ...skill,
    daysSinceLastPractice: skill.lastPracticed
      ? Math.floor((now.getTime() - skill.lastPracticed.getTime()) / (1000 * 60 * 60 * 24))
      : 0,
  }));
}

/**
 * Update stuck status for a skill (after performance update)
 */
export async function updateStuckStatus(
  userId: string,
  topicId: number,
  skill: SkillData
): Promise<boolean> {
  const wasStuck = skill.isStuck;
  const nowStuck = isUserStuck(skill);

  // No change needed
  if (wasStuck === nowStuck) {
    return nowStuck;
  }

  // Status changed - update database
  await prisma.userSkillMatrix.update({
    where: {
      userId_topicId: { userId, topicId },
    },
    data: {
      isStuck: nowStuck,
      stuckSince: nowStuck ? (skill.stuckSince ?? new Date()) : null,
    },
  });

  return nowStuck;
}

/**
 * Clear stuck status when user improves
 */
export async function clearStuckStatus(
  userId: string,
  topicId: number
): Promise<void> {
  await prisma.userSkillMatrix.update({
    where: {
      userId_topicId: { userId, topicId },
    },
    data: {
      isStuck: false,
      stuckSince: null,
    },
  });
}

/**
 * Check and update stuck status after a performance record
 */
export async function checkAndUpdateStuckStatus(
  userId: string,
  topicId: number
): Promise<{
  isStuck: boolean;
  wasStuck: boolean;
  statusChanged: boolean;
}> {
  const skill = await prisma.userSkillMatrix.findUnique({
    where: {
      userId_topicId: { userId, topicId },
    },
  });

  if (!skill) {
    return { isStuck: false, wasStuck: false, statusChanged: false };
  }

  const wasStuck = skill.isStuck;
  const nowStuck = isUserStuck(skill as SkillData);

  if (wasStuck !== nowStuck) {
    await prisma.userSkillMatrix.update({
      where: {
        userId_topicId: { userId, topicId },
      },
      data: {
        isStuck: nowStuck,
        stuckSince: nowStuck ? new Date() : null,
      },
    });
  }

  return {
    isStuck: nowStuck,
    wasStuck,
    statusChanged: wasStuck !== nowStuck,
  };
}

// =============================================
// Stuck Analysis
// =============================================

/**
 * Get topics that are "at risk" of becoming stuck
 * (meeting 3 out of 4 criteria)
 */
export async function getAtRiskTopics(userId: string): Promise<StuckTopic[]> {
  const skills = await prisma.userSkillMatrix.findMany({
    where: {
      userId,
      isStuck: false,
      timesEncountered: { gte: 2 }, // At least some engagement
    },
    include: {
      topic: {
        select: {
          slug: true,
          name: true,
          layer: true,
          category: true,
        },
      },
    },
  });

  const now = new Date();
  const atRisk: StuckTopic[] = [];

  for (const skill of skills) {
    const status = getStuckStatus(skill as SkillData);
    // At risk if meeting 3/4 criteria
    if (status.met >= 3) {
      atRisk.push({
        ...skill,
        daysSinceLastPractice: skill.lastPracticed
          ? Math.floor((now.getTime() - skill.lastPracticed.getTime()) / (1000 * 60 * 60 * 24))
          : 0,
      });
    }
  }

  return atRisk;
}

/**
 * Get stuck summary for user
 */
export async function getStuckSummary(userId: string): Promise<{
  stuckCount: number;
  atRiskCount: number;
  stuckTopics: StuckTopic[];
  atRiskTopics: StuckTopic[];
  mostUrgent: StuckTopic | null;
}> {
  const [stuckTopics, atRiskTopics] = await Promise.all([
    getStuckTopics(userId),
    getAtRiskTopics(userId),
  ]);

  // Most urgent = stuck longest or highest encounter count
  const mostUrgent = stuckTopics.sort((a, b) => {
    // Prioritize by days stuck, then by encounters
    const aStuckDays = a.stuckSince
      ? Math.floor((Date.now() - a.stuckSince.getTime()) / (1000 * 60 * 60 * 24))
      : 0;
    const bStuckDays = b.stuckSince
      ? Math.floor((Date.now() - b.stuckSince.getTime()) / (1000 * 60 * 60 * 24))
      : 0;

    if (aStuckDays !== bStuckDays) {
      return bStuckDays - aStuckDays;
    }
    return b.timesEncountered - a.timesEncountered;
  })[0] || null;

  return {
    stuckCount: stuckTopics.length,
    atRiskCount: atRiskTopics.length,
    stuckTopics,
    atRiskTopics,
    mostUrgent,
  };
}

// =============================================
// Intervention Helpers
// =============================================

/**
 * Get intervention strategy for a stuck topic
 */
export function getInterventionStrategy(skill: SkillData): {
  strategy: "prerequisite_focus" | "alternative_explanation" | "simpler_examples" | "practice_basics";
  description: string;
  suggestedAction: string;
} {
  // High volatility = inconsistent, might need prerequisites
  if (skill.volatility > 0.15) {
    return {
      strategy: "prerequisite_focus",
      description: "Performance is highly inconsistent, suggesting gaps in foundational knowledge",
      suggestedAction: "Review prerequisite topics before continuing with this one",
    };
  }

  // Very low rating = need simpler approach
  if (skill.rating < 1350) {
    return {
      strategy: "simpler_examples",
      description: "Skill level suggests need for more basic explanations",
      suggestedAction: "Start with simpler examples and build up gradually",
    };
  }

  // Many encounters with little progress = need different angle
  if (skill.timesEncountered > 6) {
    return {
      strategy: "alternative_explanation",
      description: "Multiple attempts without improvement suggests current approach isn't working",
      suggestedAction: "Try a different teaching approach or analogy",
    };
  }

  // Default
  return {
    strategy: "practice_basics",
    description: "More focused practice on fundamentals needed",
    suggestedAction: "Practice with targeted exercises on this specific topic",
  };
}
