"use server";

// =============================================
// User Data Server Actions
// =============================================

import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { formatRatingDisplay } from "@/lib/glicko2";
import { getStuckSummary } from "@/lib/stuckDetection";
import { getProgressionStatus, getLayerStats } from "@/lib/progression";
import type { Layer } from "@/lib/constants";

// =============================================
// Types
// =============================================

export interface SkillMatrixEntry {
  topicId: number;
  topicSlug: string;
  topicName: string;
  layer: string;
  category: string;
  frameworkAffinity: string;
  rating: number;
  rd: number;
  stars: number;
  starsDisplay: string;
  confidence: number;
  confidenceDisplay: string;
  level: string;
  timesEncountered: number;
  lastPracticed: Date | null;
  isStuck: boolean;
}

export interface UserDashboardData {
  user: {
    id: string;
    email: string;
    name: string | null;
    subscriptionTier: string;
    monthlyReviewsUsed: number;
    reviewsRemaining: number;
    displayFrameworks: string[];
  };
  progress: {
    fundamentals: LayerData;
    intermediate: LayerData;
    patterns: LayerData;
    currentLayer: string;
    nextUnlock: string | null;
    totalReviews: number;
    estimatedLevel: string;
  };
  stuckSummary: {
    stuckCount: number;
    atRiskCount: number;
    mostUrgent: { slug: string; name: string } | null;
  };
}

export interface LayerData {
  isUnlocked: boolean;
  unlockedAt: Date | null;
  totalTopics: number;
  attemptedTopics: number;
  masteredTopics: number;
  stuckTopics: number;
  averageRating: number;
  averageRd: number;
  overallProgress: number;
  stars: number;
  starsDisplay: string;
  confidence: number;
  confidenceDisplay: string;
}

// =============================================
// Get Skill Matrix
// =============================================

export async function getSkillMatrix(
  frameworks?: string[]
): Promise<{ success: boolean; data?: SkillMatrixEntry[]; error?: string }> {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, error: "Not authenticated" };
    }
    const userId = session.user.id;

    // Get user's framework preferences if not provided
    let displayFrameworks = frameworks;
    if (!displayFrameworks) {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { displayFrameworks: true },
      });
      displayFrameworks = user?.displayFrameworks ?? ["js", "react"];
    }

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

    // Build skill matrix
    const matrix: SkillMatrixEntry[] = topics.map((topic) => {
      const skill = skillMap.get(topic.id);
      const rating = skill?.rating ?? 1500;
      const rd = skill?.rd ?? 350;
      const display = formatRatingDisplay(rating, rd);

      return {
        topicId: topic.id,
        topicSlug: topic.slug,
        topicName: topic.name,
        layer: topic.layer,
        category: topic.category,
        frameworkAffinity: topic.frameworkAffinity,
        rating: Math.round(rating),
        rd: Math.round(rd),
        stars: display.stars,
        starsDisplay: display.starsDisplay,
        confidence: display.confidence,
        confidenceDisplay: display.confidenceDisplay,
        level: display.level,
        timesEncountered: skill?.timesEncountered ?? 0,
        lastPracticed: skill?.lastPracticed ?? null,
        isStuck: skill?.isStuck ?? false,
      };
    });

    return { success: true, data: matrix };
  } catch (error) {
    console.error("Get skill matrix error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to get skill matrix",
    };
  }
}

// =============================================
// Get Dashboard Data
// =============================================

export async function getDashboardData(): Promise<{
  success: boolean;
  data?: UserDashboardData;
  error?: string;
}> {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, error: "Not authenticated" };
    }
    const userId = session.user.id;

    // Get user data
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        subscriptionTier: true,
        monthlyReviewsUsed: true,
        displayFrameworks: true,
      },
    });

    if (!user) {
      return { success: false, error: "User not found" };
    }

    const reviewLimit = user.subscriptionTier === "pro" ? Infinity : 10;

    // Get progression status
    const progression = await getProgressionStatus(userId);

    // Get layer stats
    const [fundamentalsStats, intermediateStats, patternsStats] = await Promise.all([
      getLayerStats(userId, "FUNDAMENTALS"),
      getLayerStats(userId, "INTERMEDIATE"),
      getLayerStats(userId, "PATTERNS"),
    ]);

    // Get stuck summary
    const stuckSummary = await getStuckSummary(userId);

    // Get user progress
    const userProgress = await prisma.userProgress.findUnique({
      where: { userId },
    });

    // Build layer data
    const buildLayerData = (
      layer: "FUNDAMENTALS" | "INTERMEDIATE" | "PATTERNS",
      stats: typeof fundamentalsStats,
      progressData: typeof progression.fundamentals
    ): LayerData => {
      const rating =
        layer === "FUNDAMENTALS"
          ? userProgress?.fundamentalsRating ?? 1500
          : layer === "INTERMEDIATE"
            ? userProgress?.intermediateRating ?? 1500
            : userProgress?.patternsRating ?? 1500;

      const rd =
        layer === "FUNDAMENTALS"
          ? userProgress?.fundamentalsRd ?? 350
          : layer === "INTERMEDIATE"
            ? userProgress?.intermediateRd ?? 350
            : userProgress?.patternsRd ?? 350;

      const display = formatRatingDisplay(rating, rd);

      return {
        isUnlocked: progressData.isUnlocked,
        unlockedAt: progressData.unlockedAt,
        totalTopics: stats.totalTopics,
        attemptedTopics: stats.attemptedTopics,
        masteredTopics: stats.masteredTopics,
        stuckTopics: stats.stuckTopics,
        averageRating: stats.averageRating,
        averageRd: stats.averageRd,
        overallProgress: progressData.overallProgress,
        stars: display.stars,
        starsDisplay: display.starsDisplay,
        confidence: display.confidence,
        confidenceDisplay: display.confidenceDisplay,
      };
    };

    const dashboardData: UserDashboardData = {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        subscriptionTier: user.subscriptionTier,
        monthlyReviewsUsed: user.monthlyReviewsUsed,
        reviewsRemaining: Math.max(0, reviewLimit - user.monthlyReviewsUsed),
        displayFrameworks: user.displayFrameworks,
      },
      progress: {
        fundamentals: buildLayerData("FUNDAMENTALS", fundamentalsStats, progression.fundamentals),
        intermediate: buildLayerData("INTERMEDIATE", intermediateStats, progression.intermediate),
        patterns: buildLayerData("PATTERNS", patternsStats, progression.patterns),
        currentLayer: progression.currentLayer,
        nextUnlock: progression.nextUnlock,
        totalReviews: userProgress?.totalReviews ?? 0,
        estimatedLevel: userProgress?.estimatedLevel ?? "beginner",
      },
      stuckSummary: {
        stuckCount: stuckSummary.stuckCount,
        atRiskCount: stuckSummary.atRiskCount,
        mostUrgent: stuckSummary.mostUrgent
          ? {
              slug: stuckSummary.mostUrgent.topic.slug,
              name: stuckSummary.mostUrgent.topic.name,
            }
          : null,
      },
    };

    return { success: true, data: dashboardData };
  } catch (error) {
    console.error("Get dashboard data error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to get dashboard data",
    };
  }
}

// =============================================
// Update Framework Preferences
// =============================================

export async function updateFrameworkPreferences(
  frameworks: string[]
): Promise<{ success: boolean; error?: string }> {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, error: "Not authenticated" };
    }

    // Validate frameworks
    const validFrameworks = ["js", "react"];
    const filteredFrameworks = frameworks.filter((f) => validFrameworks.includes(f));

    if (filteredFrameworks.length === 0) {
      return { success: false, error: "At least one framework must be selected" };
    }

    await prisma.user.update({
      where: { id: session.user.id },
      data: { displayFrameworks: filteredFrameworks },
    });

    return { success: true };
  } catch (error) {
    console.error("Update framework preferences error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to update preferences",
    };
  }
}

// =============================================
// Get Topic Details
// =============================================

export async function getTopicDetails(slug: string): Promise<{
  success: boolean;
  data?: {
    topic: {
      id: number;
      slug: string;
      name: string;
      layer: string;
      category: string;
      frameworkAffinity: string;
      criticality: string;
      prerequisites: number[];
    };
    skill: SkillMatrixEntry | null;
    recentHistory: Array<{
      date: Date;
      performanceScore: number;
      errorType: string | null;
      ratingChange: number;
    }>;
    prerequisiteTopics: Array<{
      slug: string;
      name: string;
      rating: number;
      isWeak: boolean;
    }>;
  };
  error?: string;
}> {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, error: "Not authenticated" };
    }
    const userId = session.user.id;

    // Get topic
    const topic = await prisma.topic.findUnique({
      where: { slug },
    });

    if (!topic) {
      return { success: false, error: "Topic not found" };
    }

    // Get user skill
    const skill = await prisma.userSkillMatrix.findUnique({
      where: {
        userId_topicId: { userId, topicId: topic.id },
      },
    });

    let skillEntry: SkillMatrixEntry | null = null;
    if (skill) {
      const display = formatRatingDisplay(skill.rating, skill.rd);
      skillEntry = {
        topicId: topic.id,
        topicSlug: topic.slug,
        topicName: topic.name,
        layer: topic.layer,
        category: topic.category,
        frameworkAffinity: topic.frameworkAffinity,
        rating: Math.round(skill.rating),
        rd: Math.round(skill.rd),
        stars: display.stars,
        starsDisplay: display.starsDisplay,
        confidence: display.confidence,
        confidenceDisplay: display.confidenceDisplay,
        level: display.level,
        timesEncountered: skill.timesEncountered,
        lastPracticed: skill.lastPracticed,
        isStuck: skill.isStuck,
      };
    }

    // Get recent history
    const history = await prisma.performanceHistory.findMany({
      where: { userId, topicId: topic.id },
      orderBy: { createdAt: "desc" },
      take: 10,
      select: {
        createdAt: true,
        performanceScore: true,
        errorType: true,
        ratingBefore: true,
        ratingAfter: true,
      },
    });

    const recentHistory = history.map((h) => ({
      date: h.createdAt,
      performanceScore: h.performanceScore,
      errorType: h.errorType,
      ratingChange: Math.round(h.ratingAfter - h.ratingBefore),
    }));

    // Get prerequisite topics
    const prereqTopics = await prisma.topic.findMany({
      where: { id: { in: topic.prerequisites } },
      select: { id: true, slug: true, name: true },
    });

    const prereqSkills = await prisma.userSkillMatrix.findMany({
      where: {
        userId,
        topicId: { in: topic.prerequisites },
      },
    });
    const prereqSkillMap = new Map(prereqSkills.map((s) => [s.topicId, s]));

    const prerequisiteTopics = prereqTopics.map((pt) => {
      const pSkill = prereqSkillMap.get(pt.id);
      return {
        slug: pt.slug,
        name: pt.name,
        rating: Math.round(pSkill?.rating ?? 1500),
        isWeak: !pSkill || pSkill.rating < 1400,
      };
    });

    return {
      success: true,
      data: {
        topic: {
          id: topic.id,
          slug: topic.slug,
          name: topic.name,
          layer: topic.layer,
          category: topic.category,
          frameworkAffinity: topic.frameworkAffinity,
          criticality: topic.criticality,
          prerequisites: topic.prerequisites,
        },
        skill: skillEntry,
        recentHistory,
        prerequisiteTopics,
      },
    };
  } catch (error) {
    console.error("Get topic details error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to get topic details",
    };
  }
}

// =============================================
// Get Stuck Topics
// =============================================

export async function getUserStuckTopics(): Promise<{
  success: boolean;
  data?: Array<{
    slug: string;
    name: string;
    layer: string;
    rating: number;
    timesEncountered: number;
    daysSinceStuck: number;
    intervention: {
      strategy: string;
      description: string;
      suggestedAction: string;
    };
  }>;
  error?: string;
}> {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, error: "Not authenticated" };
    }

    const stuckTopics = await getStuckSummary(session.user.id);

    const data = stuckTopics.stuckTopics.map((st) => {
      const daysSinceStuck = st.stuckSince
        ? Math.floor((Date.now() - st.stuckSince.getTime()) / (1000 * 60 * 60 * 24))
        : 0;

      // Simple intervention based on the stuck data
      let strategy = "practice_basics";
      let description = "More focused practice needed";
      let suggestedAction = "Practice with targeted exercises";

      if (st.volatility > 0.15) {
        strategy = "prerequisite_focus";
        description = "Performance is inconsistent, suggesting gaps in foundational knowledge";
        suggestedAction = "Review prerequisite topics before continuing";
      } else if (st.rating < 1350) {
        strategy = "simpler_examples";
        description = "Skill level suggests need for more basic explanations";
        suggestedAction = "Start with simpler examples and build up gradually";
      } else if (st.timesEncountered > 6) {
        strategy = "alternative_explanation";
        description = "Multiple attempts without improvement";
        suggestedAction = "Try a different teaching approach or analogy";
      }

      return {
        slug: st.topic.slug,
        name: st.topic.name,
        layer: st.topic.layer,
        rating: Math.round(st.rating),
        timesEncountered: st.timesEncountered,
        daysSinceStuck,
        intervention: {
          strategy,
          description,
          suggestedAction,
        },
      };
    });

    return { success: true, data };
  } catch (error) {
    console.error("Get stuck topics error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to get stuck topics",
    };
  }
}
