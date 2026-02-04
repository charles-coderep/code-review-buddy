"use server";

import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/auth";

export async function signUp(input: {
  email: string;
  password: string;
  name?: string;
}): Promise<{ success: boolean; error?: string }> {
  try {
    const { email, password, name } = input;

    if (!email || !password) {
      return { success: false, error: "Email and password are required" };
    }

    if (password.length < 8) {
      return {
        success: false,
        error: "Password must be at least 8 characters",
      };
    }

    // Check if user exists
    const existing = await prisma.user.findUnique({
      where: { email },
      select: { id: true },
    });

    if (existing) {
      return { success: false, error: "An account with this email already exists" };
    }

    // Hash password and create user
    const passwordHash = await hashPassword(password);

    const user = await prisma.user.create({
      data: {
        email,
        passwordHash,
        name: name || null,
      },
    });

    // Create initial progress record
    await prisma.userProgress.create({
      data: {
        userId: user.id,
      },
    });

    return { success: true };
  } catch (error) {
    console.error("Signup error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to create account",
    };
  }
}
