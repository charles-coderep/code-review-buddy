"use server";

import { prisma } from "@/lib/prisma";
import { hashPassword, signIn } from "@/lib/auth";
import { redirect } from "next/navigation";

export interface SignUpInput {
  email: string;
  password: string;
  name?: string;
}

export interface AuthResult {
  success: boolean;
  error?: string;
}

/**
 * Register a new user.
 */
export async function signUp(input: SignUpInput): Promise<AuthResult> {
  try {
    // Validate input
    if (!input.email || !input.password) {
      return { success: false, error: "Email and password are required" };
    }

    if (input.password.length < 8) {
      return { success: false, error: "Password must be at least 8 characters" };
    }

    // Check if user exists
    const existingUser = await prisma.user.findUnique({
      where: { email: input.email.toLowerCase() },
    });

    if (existingUser) {
      return { success: false, error: "An account with this email already exists" };
    }

    // Hash password and create user
    const passwordHash = await hashPassword(input.password);

    await prisma.user.create({
      data: {
        email: input.email.toLowerCase(),
        passwordHash,
        name: input.name,
      },
    });

    return { success: true };
  } catch (error) {
    console.error("Signup error:", error);
    return { success: false, error: "Failed to create account" };
  }
}

/**
 * Sign in with credentials.
 */
export async function signInWithCredentials(
  email: string,
  password: string
): Promise<AuthResult> {
  try {
    await signIn("credentials", {
      email,
      password,
      redirect: false,
    });

    return { success: true };
  } catch (error) {
    console.error("Sign in error:", error);
    return { success: false, error: "Invalid email or password" };
  }
}

/**
 * Redirect to dashboard after successful auth.
 */
export async function redirectToDashboard() {
  redirect("/dashboard");
}
