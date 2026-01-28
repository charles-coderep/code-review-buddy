"use server";

import { prisma } from "@/lib/prisma";
import { openai, calculateCost, LLM_MODEL } from "@/lib/openai";
import { auth } from "@/lib/auth";
import { detectPatterns, detectRulePatterns, calculateComplexity } from "./analyzeCode";
import { buildDynamicPrompt } from "./buildPrompt";
import type { ReviewResult, SubmitReviewInput } from "@/types";
import { REVIEW_LIMITS } from "@/types";

/**
 * Main review submission handler.
 * Orchestrates pattern detection, prompt building, and LLM call.
 */
export async function submitReview(input: SubmitReviewInput): Promise<ReviewResult> {
  try {
    // 1. Verify authentication
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, error: "Please sign in to submit a review" };
    }

    const userId = session.user.id;

    // 2. Check review limits
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        subscriptionTier: true,
        reviewsThisMonth: true,
        lastReviewReset: true,
      },
    });

    if (!user) {
      return { success: false, error: "User not found" };
    }

    // Reset monthly counter if needed
    const now = new Date();
    const lastReset = new Date(user.lastReviewReset);
    if (now.getMonth() !== lastReset.getMonth() || now.getFullYear() !== lastReset.getFullYear()) {
      await prisma.user.update({
        where: { id: userId },
        data: { reviewsThisMonth: 0, lastReviewReset: now },
      });
      user.reviewsThisMonth = 0;
    }

    // Check limit
    const limit = REVIEW_LIMITS[user.subscriptionTier as keyof typeof REVIEW_LIMITS];
    if (user.reviewsThisMonth >= limit) {
      return {
        success: false,
        error: `You've reached your monthly limit of ${limit} reviews. Upgrade to Pro for unlimited reviews.`,
      };
    }

    // 3. Detect patterns
    const astPatterns = await detectPatterns(input.code);
    const rulePatterns = detectRulePatterns(input.code);

    // Convert AST patterns to string array
    const astPatternNames = Object.entries(astPatterns)
      .filter(([, value]) => value === true)
      .map(([key]) => key);

    const allPatterns = [...new Set([...astPatternNames, ...rulePatterns])];

    // 4. Calculate complexity
    const complexityScore = calculateComplexity(astPatterns, rulePatterns);

    // 5. Save submission
    const submission = await prisma.submission.create({
      data: {
        userId,
        code: input.code,
        language: input.language,
        description: input.description,
        patternsDetected: allPatterns,
        complexityScore,
      },
    });

    // 6. Build dynamic prompt
    const systemPrompt = await buildDynamicPrompt(userId, allPatterns);

    // 7. Call OpenAI
    const response = await openai.chat.completions.create({
      model: "gpt-4-turbo",
      temperature: 0.7,
      max_tokens: 800,
      messages: [
        { role: "system", content: systemPrompt },
        {
          role: "user",
          content: `Review this ${input.language} code:\n\n\`\`\`${input.language}\n${input.code}\n\`\`\`${
            input.description ? `\n\nContext: ${input.description}` : ""
          }`,
        },
      ],
    });

    const feedbackText = response.choices[0]?.message?.content || "";
    const tokensUsed = response.usage?.total_tokens || 0;
    const estimatedCost = calculateCost(tokensUsed);

    // 8. Save feedback
    const savedFeedback = await prisma.feedback.create({
      data: {
        submissionId: submission.id,
        userId,
        feedbackText,
        patternsTaught: allPatterns,
        tokensUsed,
        cost: estimatedCost,
      },
    });

    // 9. Increment review count
    await prisma.user.update({
      where: { id: userId },
      data: { reviewsThisMonth: { increment: 1 } },
    });

    // 10. Initialize pattern tracking for new patterns
    for (const pattern of allPatterns) {
      await prisma.userPattern.upsert({
        where: { userId_patternName: { userId, patternName: pattern } },
        create: {
          userId,
          patternName: pattern,
          masteryLevel: 0,
          timesSeen: 1,
          lastReviewed: new Date(),
        },
        update: {
          timesSeen: { increment: 1 },
          lastReviewed: new Date(),
        },
      });
    }

    return {
      success: true,
      feedback: feedbackText,
      patterns: allPatterns,
      feedbackId: savedFeedback.id,
      tokensUsed,
      estimatedCost,
    };
  } catch (error) {
    console.error("Review submission error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to generate review",
    };
  }
}

/**
 * Generate a Socratic follow-up question (optional deep dive).
 */
export async function generateSocraticQuestion(feedbackId: string): Promise<{
  success: boolean;
  question?: string;
  error?: string;
}> {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, error: "Please sign in" };
    }

    const feedback = await prisma.feedback.findUnique({
      where: { id: feedbackId },
      select: { feedbackText: true, userId: true },
    });

    if (!feedback) {
      return { success: false, error: "Feedback not found" };
    }

    if (feedback.userId !== session.user.id) {
      return { success: false, error: "Unauthorized" };
    }

    const response = await openai.chat.completions.create({
      model: "gpt-4-turbo",
      temperature: 0.8,
      max_tokens: 150,
      messages: [
        {
          role: "system",
          content: `You are a Socratic mentor. Based on code review feedback, ask ONE thought-provoking question that helps the developer think deeper about WHY this pattern matters. Don't give the answer—make them reason through it. Keep it to 2-3 sentences.`,
        },
        {
          role: "user",
          content: `Based on this feedback:\n\n"${feedback.feedbackText}"\n\nAsk a Socratic question.`,
        },
      ],
    });

    return {
      success: true,
      question: response.choices[0]?.message?.content || "",
    };
  } catch (error) {
    console.error("Socratic question error:", error);
    return {
      success: false,
      error: "Failed to generate question",
    };
  }
}
