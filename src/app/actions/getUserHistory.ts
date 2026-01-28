"use server";

import { prisma } from "@/lib/prisma";
import type { UserPatternMastery } from "@/types";

/**
 * Fetch user's mastery history for specific patterns.
 */
export async function getUserPatterns(
  userId: string,
  patterns: string[]
): Promise<UserPatternMastery[]> {
  if (!patterns.length) return [];

  const userPatterns = await prisma.userPattern.findMany({
    where: {
      userId,
      patternName: { in: patterns },
    },
    select: {
      patternName: true,
      masteryLevel: true,
      timesSeen: true,
      timesHelpful: true,
      lastReviewed: true,
    },
  });

  return userPatterns.map((p) => ({
    patternName: p.patternName,
    masteryLevel: p.masteryLevel,
    timesSeen: p.timesSeen,
    timesHelpful: p.timesHelpful,
    lastReviewed: p.lastReviewed,
  }));
}

/**
 * Get user's overall progress summary.
 */
export async function getUserProgress(userId: string) {
  const [patterns, submissions] = await Promise.all([
    prisma.userPattern.findMany({
      where: { userId },
      select: {
        patternName: true,
        masteryLevel: true,
        timesSeen: true,
      },
    }),
    prisma.submission.count({
      where: { userId },
    }),
  ]);

  const patternsMastered = patterns
    .filter((p) => p.masteryLevel >= 4)
    .map((p) => p.patternName);

  const patternsPracticing = patterns
    .filter((p) => p.masteryLevel >= 1 && p.masteryLevel < 4)
    .map((p) => p.patternName);

  const patternsNew = patterns
    .filter((p) => p.masteryLevel === 0)
    .map((p) => p.patternName);

  // Calculate weekly progress (last 7 days)
  const weekAgo = new Date();
  weekAgo.setDate(weekAgo.getDate() - 7);

  const weeklySubmissions = await prisma.submission.count({
    where: {
      userId,
      createdAt: { gte: weekAgo },
    },
  });

  return {
    totalReviews: submissions,
    patternsMastered,
    patternsPracticing,
    patternsNew,
    weeklyProgress: {
      reviewsCompleted: weeklySubmissions,
      improvementScore: patternsMastered.length / (patterns.length || 1),
    },
  };
}

/**
 * Get all patterns for the pattern library.
 */
export async function getAllPatterns() {
  return prisma.pattern.findMany({
    orderBy: [{ category: "asc" }, { difficulty: "asc" }],
  });
}
