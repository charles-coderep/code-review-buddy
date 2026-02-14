"use server";

import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

// =============================================
// Types
// =============================================

export interface SnippetListItem {
  id: string;
  title: string;
  language: string;
  updatedAt: Date;
}

export interface SnippetFull {
  id: string;
  title: string;
  code: string;
  language: string;
  cachedCoaching: unknown | null;
  createdAt: Date;
  updatedAt: Date;
}

// =============================================
// Snippet CRUD Actions
// =============================================

export async function getUserSnippets(): Promise<{
  success: boolean;
  data?: SnippetListItem[];
  error?: string;
}> {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, error: "Not authenticated" };
    }

    const snippets = await prisma.snippet.findMany({
      where: { userId: session.user.id },
      orderBy: { updatedAt: "desc" },
      select: { id: true, title: true, language: true, updatedAt: true },
    });

    return { success: true, data: snippets };
  } catch (error) {
    console.error("Get snippets error:", error);
    return { success: false, error: "Failed to load snippets" };
  }
}

export async function getSnippet(id: string): Promise<{
  success: boolean;
  data?: SnippetFull;
  error?: string;
}> {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, error: "Not authenticated" };
    }

    const snippet = await prisma.snippet.findFirst({
      where: { id, userId: session.user.id },
      select: {
        id: true,
        title: true,
        code: true,
        language: true,
        cachedCoaching: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!snippet) {
      return { success: false, error: "Snippet not found" };
    }

    return { success: true, data: snippet };
  } catch (error) {
    console.error("Get snippet error:", error);
    return { success: false, error: "Failed to load snippet" };
  }
}

export async function createSnippet(data?: {
  title?: string;
  code?: string;
  language?: string;
}): Promise<{
  success: boolean;
  data?: SnippetFull;
  error?: string;
}> {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, error: "Not authenticated" };
    }

    const snippet = await prisma.snippet.create({
      data: {
        userId: session.user.id,
        title: data?.title || "Untitled",
        code: data?.code || "",
        language: data?.language || "javascript",
      },
      select: {
        id: true,
        title: true,
        code: true,
        language: true,
        cachedCoaching: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return { success: true, data: snippet };
  } catch (error) {
    console.error("Create snippet error:", error);
    return { success: false, error: "Failed to create snippet" };
  }
}

export async function updateSnippet(
  id: string,
  data: { title?: string; code?: string; language?: string }
): Promise<{
  success: boolean;
  data?: SnippetFull;
  error?: string;
}> {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, error: "Not authenticated" };
    }

    // Verify ownership
    const existing = await prisma.snippet.findFirst({
      where: { id, userId: session.user.id },
      select: { id: true },
    });

    if (!existing) {
      return { success: false, error: "Snippet not found" };
    }

    const snippet = await prisma.snippet.update({
      where: { id },
      data: {
        ...(data.title !== undefined && { title: data.title }),
        ...(data.code !== undefined && { code: data.code }),
        ...(data.language !== undefined && { language: data.language }),
      },
      select: {
        id: true,
        title: true,
        code: true,
        language: true,
        cachedCoaching: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return { success: true, data: snippet };
  } catch (error) {
    console.error("Update snippet error:", error);
    return { success: false, error: "Failed to update snippet" };
  }
}

export async function deleteSnippet(id: string): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, error: "Not authenticated" };
    }

    // Verify ownership
    const existing = await prisma.snippet.findFirst({
      where: { id, userId: session.user.id },
      select: { id: true },
    });

    if (!existing) {
      return { success: false, error: "Snippet not found" };
    }

    await prisma.snippet.delete({ where: { id } });

    return { success: true };
  } catch (error) {
    console.error("Delete snippet error:", error);
    return { success: false, error: "Failed to delete snippet" };
  }
}

// =============================================
// Coaching Cache Actions
// =============================================

export async function updateSnippetCoaching(
  snippetId: string,
  coaching: unknown
): Promise<{ success: boolean; error?: string }> {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, error: "Not authenticated" };
    }

    const existing = await prisma.snippet.findFirst({
      where: { id: snippetId, userId: session.user.id },
      select: { id: true },
    });

    if (!existing) {
      return { success: false, error: "Snippet not found" };
    }

    await prisma.snippet.update({
      where: { id: snippetId },
      data: { cachedCoaching: coaching as Prisma.InputJsonValue },
    });

    return { success: true };
  } catch (error) {
    console.error("Update snippet coaching error:", error);
    return { success: false, error: "Failed to save coaching" };
  }
}

export async function clearSnippetCoaching(
  snippetId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, error: "Not authenticated" };
    }

    await prisma.snippet.update({
      where: { id: snippetId },
      data: { cachedCoaching: Prisma.JsonNull },
    });

    return { success: true };
  } catch (error) {
    console.error("Clear snippet coaching error:", error);
    return { success: false, error: "Failed to clear coaching" };
  }
}
