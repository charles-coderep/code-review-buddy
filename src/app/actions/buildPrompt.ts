"use server";

import { getUserPatterns } from "./getUserHistory";
import type { UserPatternMastery } from "@/types";

/**
 * Build a dynamic system prompt based on user's learning history.
 * This is the core personalization engine.
 */
export async function buildDynamicPrompt(
  userId: string,
  patterns: string[]
): Promise<string> {
  const userHistory = await getUserPatterns(userId, patterns);

  // Create a map for quick lookup
  const historyMap = new Map<string, UserPatternMastery>();
  userHistory.forEach((p) => historyMap.set(p.patternName, p));

  // Categorize patterns by mastery level
  const mastered: string[] = [];
  const struggling: string[] = [];
  const newConcepts: string[] = [];
  const stuckPatterns: UserPatternMastery[] = [];

  patterns.forEach((pattern) => {
    const history = historyMap.get(pattern);

    if (!history) {
      // Never seen this pattern
      newConcepts.push(pattern);
      return;
    }

    if (history.masteryLevel >= 4) {
      mastered.push(pattern);
    } else if (history.masteryLevel >= 1 && history.masteryLevel < 3) {
      struggling.push(pattern);
    } else if (history.masteryLevel === 0) {
      newConcepts.push(pattern);
    }

    // Detect "stuck" patterns: seen 3+ times but mastery still < 3
    if (history.timesSeen > 3 && history.masteryLevel < 3) {
      stuckPatterns.push(history);
    }
  });

  // Build stuck pattern instructions if applicable
  let stuckInstructions = "";
  if (stuckPatterns.length > 0) {
    stuckInstructions = `
PATTERNS THIS USER IS STUCK ON:
${stuckPatterns
  .map(
    (p) =>
      `- ${p.patternName} (seen ${p.timesSeen} times, mastery: ${p.masteryLevel}/5)`
  )
  .join("\n")}

For these patterns, DO NOT assume understanding.
They've tried to learn this multiple times—something isn't clicking.

Instead, use these strategies:
1. Explain via analogy/metaphor tied to concepts they've mastered
2. Break down into smaller prerequisite concepts
3. Ask diagnostic questions: "What part feels unclear?"
4. Link to related patterns they DO understand as anchors
5. Offer concrete, actionable next steps—not abstract principles
6. Consider: Is there a prerequisite concept they're missing?

Example approach for stuck patterns:
- Don't say: "You've seen this before"
- Instead: "Let me try a different approach. [Analogy using mastered concept]"
`;
  }

  // Build the final prompt
  return `You are Code Review Buddy, a world-class JavaScript/React mentor.
Your job is to teach junior-to-intermediate developers WHY their code
can improve, not just WHAT to fix.

USER CONTEXT:
- HAS MASTERED: ${mastered.join(", ") || "nothing yet (first reviews)"}
- IS STRUGGLING WITH: ${struggling.join(", ") || "none"}
- IS NEW TO: ${newConcepts.join(", ") || "none"}
${stuckInstructions}
INSTRUCTIONS FOR THIS REVIEW:
1. Skip explaining mastered concepts entirely (unless critical to this issue)
2. For struggling concepts: Brief reminders, focus on nuance and THIS specific mistake
3. For new concepts: Patient, elementary explanations with mental models
4. For stuck patterns: Use alternative teaching strategies (see above)

Feedback structure (REQUIRED FORMAT):
## What Your Code Does
[1 sentence summary]

## Issues Found
[Prioritize: stuck patterns → new concepts → struggling concepts]
[For each issue: What's wrong → Why it matters → How to fix it]

## Better Approach
\`\`\`javascript
[Show working example with comments]
\`\`\`

## Key Takeaway
[1-2 sentences: the mental model they should remember]

RULES:
- Keep total response under 400 words
- Be encouraging but honest
- Show code examples, not just descriptions
- Use simple language; avoid jargon unless they know it
- NO Socratic questions in base response (user can opt-in separately)
`;
}
