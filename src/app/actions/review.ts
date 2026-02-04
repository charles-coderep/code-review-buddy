"use server";

// =============================================
// Review Submission Server Action
// Main entry point for code review submissions
// =============================================

import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { analyzeCode, serializeAnalysis, scoreTopicPerformance, prioritizeIssues, type CodeLanguage } from "@/lib/analysis";
import { updateRating, createInitialRating } from "@/lib/glicko2";
import { classifyError, calculatePerformanceScore, type PerformanceRecord } from "@/lib/errorClassification";
import { checkAndUpdateStuckStatus, getStuckTopics } from "@/lib/stuckDetection";
import { findWeakestPrerequisite } from "@/lib/prerequisites";
import { checkAndUnlockLayers, updateLayerRatings } from "@/lib/progression";
import { generateFeedbackWithFallback, getScaffoldingLevel, type GrokRequest, type TopicScore } from "@/lib/grok";
import { SUBSCRIPTION, DISPLAY } from "@/lib/constants";

// =============================================
// Types
// =============================================

export interface ReviewSubmissionInput {
  code: string;
  language?: CodeLanguage;
  description?: string;
}

export interface ReviewResult {
  success: boolean;
  error?: string;
  feedback?: {
    id: string;
    text: string;
    tokensUsed: number;
  };
  skillChanges?: Array<{
    topicSlug: string;
    topicName: string;
    ratingBefore: number;
    ratingAfter: number;
    change: number;
    errorType: string | null;
  }>;
  progressUpdates?: {
    newUnlocks: string[];
    stuckTopics: Array<{ slug: string; name: string }>;
  };
  analysisPreview?: {
    issuesCount: number;
    positiveCount: number;
    topicsDetected: string[];
  };
  engineDetails?: {
    language: string;
    isReact: boolean;
    parseErrors: number;
    detections: Array<{
      topicSlug: string;
      detected: boolean;
      isPositive: boolean;
      isNegative: boolean;
      isIdiomatic: boolean;
      details?: string;
      location?: { line: number; column: number };
    }>;
    performanceScores: Array<{
      topicSlug: string;
      score: number;
      positiveCount: number;
      negativeCount: number;
      idiomaticCount: number;
    }>;
    aiEvaluations: Array<{
      slug: string;
      score: number;
      reason: string;
    }>;
    scoringSource: "ai" | "ast-fallback";
  };
}

// =============================================
// Main Review Action
// =============================================

export async function submitReview(input: ReviewSubmissionInput): Promise<ReviewResult> {
  try {
    // 1. Auth check
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, error: "Not authenticated" };
    }
    const userId = session.user.id;

    // 2. Rate limiting check
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        subscriptionTier: true,
        monthlyReviewsUsed: true,
      },
    });

    if (!user) {
      return { success: false, error: "User not found" };
    }

    const reviewLimit =
      user.subscriptionTier === "pro"
        ? SUBSCRIPTION.PRO.monthlyReviews
        : SUBSCRIPTION.FREE.monthlyReviews;

    if (user.monthlyReviewsUsed >= reviewLimit) {
      return {
        success: false,
        error: `Monthly review limit reached (${reviewLimit}). Upgrade to Pro for unlimited reviews.`,
      };
    }

    // 3. Parse and analyze code
    const analysis = analyzeCode(input.code, input.language);

    if (analysis.parsed.errors.length > 0 && analysis.detections.length === 0) {
      return {
        success: false,
        error: `Could not parse code: ${analysis.parsed.errors[0].message}`,
      };
    }

    // 4. Create submission record
    const submission = await prisma.submission.create({
      data: {
        userId,
        code: input.code,
        language: analysis.parsed.language,
        description: input.description,
        analysisData: serializeAnalysis(analysis),
      },
    });

    // 5. Prepare AST fallback scores (used if AI scoring unavailable)
    const topicPerformances = scoreTopicPerformance(analysis.detections);
    const skillChanges: ReviewResult["skillChanges"] = [];

    // Build unique detected topics list for Grok
    const detectedTopicSlugs = [...new Set(analysis.detections.map((d) => d.topicSlug))];
    const detectedTopics = detectedTopicSlugs.map((slug) => {
      const detection = analysis.detections.find((d) => d.topicSlug === slug);
      return { slug, location: detection?.location };
    });

    // Get topic slugs to IDs mapping (from all detected topics)
    const topicSlugs = detectedTopicSlugs;
    const topics = await prisma.topic.findMany({
      where: { slug: { in: topicSlugs } },
      select: { id: true, slug: true, name: true },
    });
    const topicMap = new Map(topics.map((t) => [t.slug, t]));

    // 6. Get stuck topics for feedback context
    const stuckTopics = await getStuckTopics(userId);

    // 7. Find weakest prerequisite if there are issues
    let weakPrerequisite = null;
    if (analysis.issuesFound.length > 0) {
      const firstIssueTopic = topicMap.get(analysis.issuesFound[0].topicSlug);
      if (firstIssueTopic) {
        weakPrerequisite = await findWeakestPrerequisite(userId, firstIssueTopic.id);
      }
    }

    // 8. Get user progress for scaffolding
    const userProgress = await prisma.userProgress.findUnique({
      where: { userId },
    });

    const overallRating = userProgress?.fundamentalsRating ?? 1500;
    const scaffoldingLevel = getScaffoldingLevel(overallRating);

    // 9. Generate Grok feedback (moved before rating updates to get AI scores)
    const prioritizedIssues = prioritizeIssues(analysis.detections, DISPLAY.MAX_ISSUES_PER_REVIEW);

    const grokRequest: GrokRequest = {
      code: input.code,
      language: analysis.parsed.language,
      issues: prioritizedIssues.map((i) => ({
        topicSlug: i.topicSlug,
        details: i.details ?? "Issue detected",
      })),
      positiveFindings: analysis.positiveFindings.slice(0, 3).map((p) => ({
        topicSlug: p.topicSlug,
        details: p.details ?? "Good usage",
      })),
      detectedTopics,
      userContext: {
        overallRating,
        scaffoldingLevel,
        stuckTopics,
        weakPrerequisite,
        estimatedLevel: userProgress?.estimatedLevel ?? "beginner",
        isReact: analysis.parsed.isReact,
      },
    };

    const grokResponse = await generateFeedbackWithFallback(grokRequest);

    // 10. Determine scoring source: AI scores (primary) or AST fallback
    const aiScores = grokResponse.topicScores;
    const useAiScoring = aiScores.length > 0;
    const aiScoreMap = new Map(aiScores.map((s) => [s.slug, s]));

    // 11. Update ratings for each detected topic using AI or AST scores
    for (const topicSlug of detectedTopicSlugs) {
      const topic = topicMap.get(topicSlug);
      if (!topic) continue;

      // Get or create user skill
      let skill = await prisma.userSkillMatrix.findUnique({
        where: {
          userId_topicId: { userId, topicId: topic.id },
        },
      });

      if (!skill) {
        const initial = createInitialRating();
        skill = await prisma.userSkillMatrix.create({
          data: {
            userId,
            topicId: topic.id,
            rating: initial.rating,
            rd: initial.rd,
            volatility: initial.volatility,
            timesEncountered: 0,
          },
        });
      }

      // Get recent performance history for error classification
      const recentHistory = await prisma.performanceHistory.findMany({
        where: { userId, topicId: topic.id },
        orderBy: { createdAt: "desc" },
        take: 5,
        select: { performanceScore: true, errorType: true, createdAt: true },
      });

      const historyRecords: PerformanceRecord[] = recentHistory.map((h) => ({
        score: h.performanceScore,
        errorType: h.errorType as "SLIP" | "MISTAKE" | "MISCONCEPTION" | null,
        createdAt: h.createdAt,
      }));

      let errorType: "SLIP" | "MISTAKE" | "MISCONCEPTION" | null = null;
      let performanceScore: number;

      const aiScore = aiScoreMap.get(topicSlug);

      if (useAiScoring && aiScore) {
        // AI-driven scoring: use AI score directly
        performanceScore = aiScore.score;

        // Classify errors for low AI scores
        if (aiScore.score < 0.5) {
          const classification = classifyError(
            {
              rating: skill.rating,
              rd: skill.rd,
              volatility: skill.volatility,
              timesEncountered: skill.timesEncountered,
            },
            aiScore.score >= 0.3, // trivial if score is 0.3 (significant mistake, not fundamental)
            historyRecords
          );
          errorType = classification.errorType;
          performanceScore = classification.performanceScore;
        }
      } else {
        // AST fallback scoring (original behavior)
        const performance = topicPerformances.find((p) => p.topicSlug === topicSlug);
        performanceScore = performance?.score ?? 0.5;

        if (performance && performance.negativeCount > 0) {
          const classification = classifyError(
            {
              rating: skill.rating,
              rd: skill.rd,
              volatility: skill.volatility,
              timesEncountered: skill.timesEncountered,
            },
            performance.negativeCount === 1 && performance.score > 0.5,
            historyRecords
          );
          errorType = classification.errorType;
          performanceScore = classification.performanceScore;
        } else if (performance && performance.positiveCount > 0) {
          performanceScore = calculatePerformanceScore(
            performance.idiomaticCount > 0 ? "perfect" : "clean",
            performance.idiomaticCount > 0
          );
        }
      }

      // Update Glicko-2 rating
      const ratingUpdate = updateRating(
        {
          rating: skill.rating,
          rd: skill.rd,
          volatility: skill.volatility,
        },
        { score: performanceScore }
      );

      // Store skill change for response
      skillChanges.push({
        topicSlug: topic.slug,
        topicName: topic.name,
        ratingBefore: Math.round(skill.rating),
        ratingAfter: Math.round(ratingUpdate.newRating),
        change: Math.round(ratingUpdate.ratingChange),
        errorType,
      });

      // Update skill matrix
      await prisma.userSkillMatrix.update({
        where: { userId_topicId: { userId, topicId: topic.id } },
        data: {
          rating: ratingUpdate.newRating,
          rd: ratingUpdate.newRd,
          volatility: ratingUpdate.newVolatility,
          timesEncountered: { increment: 1 },
          lastPracticed: new Date(),
        },
      });

      // Record performance history
      await prisma.performanceHistory.create({
        data: {
          userId,
          topicId: topic.id,
          submissionId: submission.id,
          performanceScore,
          errorType,
          ratingBefore: skill.rating,
          ratingAfter: ratingUpdate.newRating,
          rdBefore: skill.rd,
          rdAfter: ratingUpdate.newRd,
        },
      });

      // Check stuck status
      await checkAndUpdateStuckStatus(userId, topic.id);
    }

    // 12. Check progression unlocks
    const progressionResult = await checkAndUnlockLayers(userId);
    await updateLayerRatings(userId);

    // 13. Store feedback
    const feedback = await prisma.feedback.create({
      data: {
        submissionId: submission.id,
        userId,
        feedbackText: grokResponse.feedbackText,
        analysisLayers: {
          issues: prioritizedIssues.map((i) => i.topicSlug),
          positives: analysis.positiveFindings.map((p) => p.topicSlug),
        },
        stuckTopics: stuckTopics.map((s) => s.topic.slug),
        tokensUsed: grokResponse.tokensUsed,
        cost: grokResponse.cost,
      },
    });

    // 14. Update user review count
    await prisma.user.update({
      where: { id: userId },
      data: {
        monthlyReviewsUsed: { increment: 1 },
      },
    });

    // Update last review timestamp
    await prisma.userProgress.upsert({
      where: { userId },
      update: { lastReviewAt: new Date(), totalReviews: { increment: 1 } },
      create: {
        userId,
        lastReviewAt: new Date(),
        totalReviews: 1,
      },
    });

    // 15. Return result
    return {
      success: true,
      feedback: {
        id: feedback.id,
        text: grokResponse.feedbackText,
        tokensUsed: grokResponse.tokensUsed,
      },
      skillChanges,
      progressUpdates: {
        newUnlocks: progressionResult.newUnlocks,
        stuckTopics: stuckTopics.map((s) => ({
          slug: s.topic.slug,
          name: s.topic.name,
        })),
      },
      analysisPreview: {
        issuesCount: analysis.issuesFound.length,
        positiveCount: analysis.positiveFindings.length,
        topicsDetected: analysis.topicsDetected,
      },
      engineDetails: {
        language: analysis.parsed.language,
        isReact: analysis.parsed.isReact,
        parseErrors: analysis.parsed.errors.length,
        detections: analysis.detections.map((d) => ({
          topicSlug: d.topicSlug,
          detected: d.detected,
          isPositive: d.isPositive,
          isNegative: d.isNegative,
          isIdiomatic: d.isIdiomatic,
          details: d.details,
          location: d.location,
        })),
        performanceScores: topicPerformances.map((p) => ({
          topicSlug: p.topicSlug,
          score: Math.round(p.score * 100) / 100,
          positiveCount: p.positiveCount,
          negativeCount: p.negativeCount,
          idiomaticCount: p.idiomaticCount,
        })),
        aiEvaluations: aiScores.map((s) => ({
          slug: s.slug,
          score: s.score,
          reason: s.reason,
        })),
        scoringSource: useAiScoring ? "ai" : "ast-fallback",
      },
    };
  } catch (error) {
    console.error("Review submission error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "An unexpected error occurred",
    };
  }
}
