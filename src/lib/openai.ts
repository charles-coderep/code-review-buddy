import OpenAI from "openai";

// xAI's Grok API is compatible with OpenAI's SDK
// Just need to change the base URL
if (!process.env.XAI_API_KEY) {
  console.warn("Missing XAI_API_KEY environment variable - LLM features will not work");
}

export const xai = new OpenAI({
  apiKey: process.env.XAI_API_KEY || "",
  baseURL: "https://api.x.ai/v1",
});

// Token pricing for cost tracking (Grok pricing - adjust as needed)
// Grok is generally cheaper than GPT-4
export const TOKEN_COST_PER_1K = 0.005; // Approximate £0.005 per 1K tokens

export function calculateCost(tokensUsed: number): number {
  return (tokensUsed / 1000) * TOKEN_COST_PER_1K;
}

// Model to use - Grok's latest model
export const LLM_MODEL = "grok-beta"; // or "grok-2" when available

// Export as 'openai' for compatibility with existing code
export const openai = xai;
