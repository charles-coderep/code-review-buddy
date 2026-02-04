// =============================================
// Grok API Integration
// Handles AI feedback generation using xAI Grok
// =============================================

import { API_CONFIG, SCAFFOLDING, type ScaffoldingLevel } from "./constants";
import type { StuckTopic } from "./stuckDetection";
import type { WeakPrerequisite } from "./prerequisites";

// =============================================
// Types
// =============================================

export interface GrokRequest {
  code: string;
  language: string;
  issues: Array<{
    topicSlug: string;
    details: string;
  }>;
  positiveFindings: Array<{
    topicSlug: string;
    details: string;
  }>;
  userContext: UserContext;
}

export interface UserContext {
  overallRating: number;
  scaffoldingLevel: ScaffoldingLevel;
  stuckTopics: StuckTopic[];
  weakPrerequisite: WeakPrerequisite | null;
  estimatedLevel: string;
  isReact: boolean;
}

export interface GrokResponse {
  feedbackText: string;
  tokensUsed: number;
  cost: number;
}

// =============================================
// Prompt Building
// =============================================

/**
 * Get scaffolding level based on user rating
 */
export function getScaffoldingLevel(rating: number): ScaffoldingLevel {
  if (rating < SCAFFOLDING.HIGH.maxRating) {
    return "HIGH";
  }
  if (rating < (SCAFFOLDING.MEDIUM.maxRating ?? 1600)) {
    return "MEDIUM";
  }
  return "LOW";
}

/**
 * Build the system prompt for Grok
 */
function buildSystemPrompt(scaffoldingLevel: ScaffoldingLevel): string {
  const basePrompt = `You are Cortext, an AI coding coach that helps developers strengthen their JavaScript and React skills. You are not a tutorial — your role is to coach, not lecture. Your goal is to push the learner's existing knowledge forward through their own code.

IMPORTANT RULES:
1. Never give direct answers or complete code solutions
2. Ask questions that guide the learner to discover the solution
3. Connect new concepts to things the learner already knows
4. Be encouraging but honest about issues
5. Focus on the "why" not just the "what"
6. Limit feedback to 2-3 key points to avoid overwhelming
7. Suggest what to practice next based on weak areas`;

  const scaffoldingInstructions = {
    HIGH: `
SCAFFOLDING LEVEL: HIGH (Beginner)
- Be very supportive and patient
- Break concepts into small, manageable steps
- Provide more context and explanation
- Use simple analogies
- Give strong hints that almost reveal the answer
- Ask simple yes/no or multiple choice questions`,

    MEDIUM: `
SCAFFOLDING LEVEL: MEDIUM (Intermediate)
- Explain the reasoning behind best practices
- Ask questions that require synthesis
- Provide moderate hints
- Encourage exploration of documentation
- Connect to related concepts they might know`,

    LOW: `
SCAFFOLDING LEVEL: LOW (Advanced)
- Give minimal hints - they can figure it out
- Ask architectural and design questions
- Challenge them to think about edge cases
- Discuss trade-offs rather than prescribing solutions
- Reference advanced patterns and concepts`,
  };

  return `${basePrompt}

${scaffoldingInstructions[scaffoldingLevel]}`;
}

/**
 * Build stuck topic intervention
 */
function buildStuckIntervention(stuckTopics: StuckTopic[]): string {
  if (stuckTopics.length === 0) return "";

  const topic = stuckTopics[0];
  return `
STUCK TOPIC ALERT: The user has been struggling with "${topic.topic.name}" for ${topic.timesEncountered} attempts.

INTERVENTION STRATEGY:
1. Acknowledge their effort without making them feel bad
2. Ask a diagnostic question to find the exact confusion
3. Connect to something they DO understand
4. Offer a simpler version of the problem
5. DO NOT give the answer - guide discovery`;
}

/**
 * Build prerequisite gap guidance
 */
function buildPrerequisiteGuidance(weakPrereq: WeakPrerequisite | null): string {
  if (!weakPrereq) return "";

  return `
PREREQUISITE GAP DETECTED: "${weakPrereq.topic.name}"
${weakPrereq.reason}

GUIDANCE: ${weakPrereq.suggestedAction}

Consider addressing this foundational gap before diving deep into the current topic.`;
}

/**
 * Build the user prompt for Grok
 */
export function buildUserPrompt(request: GrokRequest): string {
  const { code, language, issues, positiveFindings, userContext } = request;

  let prompt = `## Code to Review (${language}${userContext.isReact ? "/React" : ""})

\`\`\`${language}
${code.slice(0, API_CONFIG.MAX_CODE_LENGTH)}
\`\`\`

## Analysis Results

### Issues Found (${issues.length}):
${issues.length > 0 ? issues.map((i) => `- **${i.topicSlug}**: ${i.details}`).join("\n") : "No significant issues detected"}

### Positive Patterns (${positiveFindings.length}):
${positiveFindings.length > 0 ? positiveFindings.map((p) => `- **${p.topicSlug}**: ${p.details}`).join("\n") : "Limited positive patterns detected"}

## User Context
- Estimated Level: ${userContext.estimatedLevel}
- Overall Rating: ${Math.round(userContext.overallRating)}
- Framework Focus: ${userContext.isReact ? "React" : "JavaScript"}
`;

  // Add stuck intervention if applicable
  const stuckIntervention = buildStuckIntervention(userContext.stuckTopics);
  if (stuckIntervention) {
    prompt += `\n${stuckIntervention}`;
  }

  // Add prerequisite guidance if applicable
  const prereqGuidance = buildPrerequisiteGuidance(userContext.weakPrerequisite);
  if (prereqGuidance) {
    prompt += `\n${prereqGuidance}`;
  }

  prompt += `
## Your Task
Provide pedagogical feedback on this code. Remember:
1. Focus on at most 2-3 key points
2. Use your scaffolding level to adjust how much help you give
3. Ask guiding questions rather than giving answers
4. Acknowledge what they did well
5. Be encouraging but honest

Format your response in markdown with clear sections.`;

  return prompt;
}

// =============================================
// Grok API Call
// =============================================

/**
 * Call Grok API to generate feedback
 */
export async function generateFeedback(request: GrokRequest): Promise<GrokResponse> {
  const apiKey = process.env.XAI_API_KEY;

  if (!apiKey) {
    throw new Error("XAI_API_KEY environment variable not set");
  }

  const systemPrompt = buildSystemPrompt(request.userContext.scaffoldingLevel);
  const userPrompt = buildUserPrompt(request);

  try {
    const response = await fetch("https://api.x.ai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: API_CONFIG.GROK_MODEL,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        max_tokens: API_CONFIG.MAX_FEEDBACK_TOKENS,
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Grok API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();

    const feedbackText = data.choices?.[0]?.message?.content ?? "Unable to generate feedback";
    const tokensUsed = data.usage?.total_tokens ?? 0;

    // Estimate cost (Grok pricing - adjust as needed)
    // Assuming ~$0.002 per 1K tokens for estimation
    const cost = (tokensUsed / 1000) * 0.002;

    return {
      feedbackText,
      tokensUsed,
      cost,
    };
  } catch (error) {
    console.error("Grok API error:", error);
    throw error;
  }
}

/**
 * Generate feedback with fallback for development/testing
 */
export async function generateFeedbackWithFallback(
  request: GrokRequest
): Promise<GrokResponse> {
  // Check if API key is available
  if (!process.env.XAI_API_KEY) {
    // Return mock feedback for development
    return generateMockFeedback(request);
  }

  try {
    return await generateFeedback(request);
  } catch (error) {
    console.error("Falling back to mock feedback due to error:", error);
    return generateMockFeedback(request);
  }
}

/**
 * Generate mock feedback for development/testing
 */
function generateMockFeedback(request: GrokRequest): GrokResponse {
  const { issues, positiveFindings, userContext } = request;

  let feedback = "## Coaching Feedback\n\n";

  // Acknowledge positives
  if (positiveFindings.length > 0) {
    feedback += "### What You Did Well\n\n";
    feedback += positiveFindings
      .slice(0, 2)
      .map((p) => `- Great use of **${p.topicSlug}**! ${p.details}`)
      .join("\n");
    feedback += "\n\n";
  }

  // Address issues
  if (issues.length > 0) {
    feedback += "### Areas for Improvement\n\n";

    for (const issue of issues.slice(0, 2)) {
      feedback += `#### ${issue.topicSlug}\n\n`;
      feedback += `${issue.details}\n\n`;

      // Add scaffolded question based on level
      if (userContext.scaffoldingLevel === "HIGH") {
        feedback += `**Hint:** Think about what might happen if this value changes. What would you expect to see?\n\n`;
      } else if (userContext.scaffoldingLevel === "MEDIUM") {
        feedback += `**Question:** What pattern could help ensure this behavior is consistent?\n\n`;
      } else {
        feedback += `**Consider:** How might this affect performance or maintainability at scale?\n\n`;
      }
    }
  }

  // Stuck topic intervention
  if (userContext.stuckTopics.length > 0) {
    const stuck = userContext.stuckTopics[0];
    feedback += `### Let's Work Through ${stuck.topic.name}\n\n`;
    feedback += `I notice you've been working on this concept for a while. Let's break it down together.\n\n`;
    feedback += `**Starting question:** Can you explain in your own words what you think ${stuck.topic.name} is supposed to do?\n`;
  }

  return {
    feedbackText: feedback,
    tokensUsed: 0,
    cost: 0,
  };
}
