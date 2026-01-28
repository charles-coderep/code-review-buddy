"use server";

import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { revalidatePath } from "next/cache";

/**
 * Record user's feedback rating (helpful/not helpful).
 * Updates pattern mastery based on response.
 */
export async function markFeedbackHelpful(
  feedbackId: string,
  helpful: boolean,
  note?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, error: "Please sign in" };
    }

    const userId = session.user.id;

    // 1. Check if feedback exists and belongs to user
    const feedback = await prisma.feedback.findUnique({
      where: { id: feedbackId },
      select: {
        id: true,
        userId: true,
        patternsTaught: true,
      },
    });

    if (!feedback) {
      return { success: false, error: "Feedback not found" };
    }

    if (feedback.userId !== userId) {
      return { success: false, error: "Unauthorized" };
    }

    // 2. Check if already rated
    const existingRating = await prisma.feedbackRating.findFirst({
      where: { feedbackId, userId },
    });

    if (existingRating) {
      return { success: false, error: "Already rated this feedback" };
    }

    // 3. Save rating
    await prisma.feedbackRating.create({
      data: {
        feedbackId,
        userId,
        helpful,
        note,
      },
    });

    // 4. Update mastery for each pattern
    const patterns = feedback.patternsTaught as string[];

    for (const pattern of patterns) {
      await prisma.userPattern.upsert({
        where: { userId_patternName: { userId, patternName: pattern } },
        create: {
          userId,
          patternName: pattern,
          masteryLevel: helpful ? 1 : 0,
          timesSeen: 1,
          timesHelpful: helpful ? 1 : 0,
          lastReviewed: new Date(),
        },
        update: {
          timesHelpful: helpful ? { increment: 1 } : undefined,
          // Gradually increase mastery if helpful (max 5)
          masteryLevel: helpful
            ? {
                increment: 0.5,
              }
            : undefined,
        },
      });
    }

    // Cap mastery at 5
    await prisma.$executeRaw`
      UPDATE "UserPattern"
      SET "masteryLevel" = 5
      WHERE "userId" = ${userId}
        AND "patternName" = ANY(${patterns}::text[])
        AND "masteryLevel" > 5
    `;

    revalidatePath("/dashboard");
    revalidatePath("/review");

    return { success: true };
  } catch (error) {
    console.error("Feedback rating error:", error);
    return {
      success: false,
      error: "Failed to save rating",
    };
  }
}

/**
 * Get user's recent feedback history.
 */
export async function getRecentFeedback(limit = 10) {
  const session = await auth();
  if (!session?.user?.id) {
    return [];
  }

  return prisma.feedback.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: "desc" },
    take: limit,
    include: {
      submission: {
        select: {
          language: true,
          code: true,
          createdAt: true,
        },
      },
      ratings: {
        select: {
          helpful: true,
        },
      },
    },
  });
}
