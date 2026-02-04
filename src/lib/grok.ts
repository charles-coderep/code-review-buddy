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
  detectedTopics: Array<{
    slug: string;
    location?: { line: number; column: number };
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

export interface TopicScore {
  slug: string;
  score: number;
  reason: string;
}

export interface GrokResponse {
  feedbackText: string;
  tokensUsed: number;
  cost: number;
  topicScores: TopicScore[];
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
7. Suggest what to practice next based on weak areas
8. Do NOT include a title or top-level heading — just start with the feedback content directly
9. Keep responses concise and actionable`;

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

  const scoringInstruction = `
TOPIC SCORING:
After your coaching feedback, you MUST include a TOPIC_SCORES block with your assessment of each detected topic. Format:

\`\`\`TOPIC_SCORES
[
  { "slug": "array-filter", "score": 0.0, "reason": "callback has no return statement" },
  { "slug": "let-const-usage", "score": 1.0, "reason": "correctly using const for array" }
]
\`\`\`

Score guide: 1.0 = perfect/idiomatic, 0.8 = correct but not idiomatic, 0.6 = minor issue, 0.3 = significant mistake, 0.0 = fundamental misunderstanding or broken`;

  return `${basePrompt}

${scaffoldingInstructions[scaffoldingLevel]}

${scoringInstruction}`;
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
  const { code, language, issues, positiveFindings, detectedTopics, userContext } = request;

  let prompt = `## Code to Review (${language}${userContext.isReact ? "/React" : ""})

\`\`\`${language}
${code.slice(0, API_CONFIG.MAX_CODE_LENGTH)}
\`\`\`

## Detected Topics
The following topics were found in the code by AST analysis. Evaluate each for correctness:
${detectedTopics.map((t) => `- ${t.slug}${t.location ? ` (line ${t.location.line})` : ""}`).join("\n")}

## AST Analysis Context

### Issues Flagged by AST (${issues.length}):
${issues.length > 0 ? issues.map((i) => `- **${i.topicSlug}**: ${i.details}`).join("\n") : "No structural issues flagged"}

### Positive Patterns Flagged by AST (${positiveFindings.length}):
${positiveFindings.length > 0 ? positiveFindings.map((p) => `- **${p.topicSlug}**: ${p.details}`).join("\n") : "Limited positive patterns flagged"}

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
6. After your coaching text, include the TOPIC_SCORES block scoring EVERY detected topic listed above

Format your response in markdown with clear sections.`;

  return prompt;
}

// =============================================
// Score Parsing
// =============================================

/**
 * Extract TOPIC_SCORES JSON block from AI response text
 */
export function parseTopicScores(text: string): TopicScore[] {
  const match = text.match(/```TOPIC_SCORES\n([\s\S]*?)```/);
  if (!match) return [];
  try {
    const parsed = JSON.parse(match[1]);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (item: unknown): item is TopicScore =>
        typeof item === "object" &&
        item !== null &&
        typeof (item as TopicScore).slug === "string" &&
        typeof (item as TopicScore).score === "number" &&
        typeof (item as TopicScore).reason === "string" &&
        (item as TopicScore).score >= 0 &&
        (item as TopicScore).score <= 1
    );
  } catch {
    return [];
  }
}

/**
 * Remove the TOPIC_SCORES block from text so it isn't shown to the user
 */
export function stripScoresBlock(text: string): string {
  return text.replace(/\n*```TOPIC_SCORES\n[\s\S]*?```\n*/g, "").trimEnd();
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

    const rawText = data.choices?.[0]?.message?.content ?? "Unable to generate feedback";
    const tokensUsed = data.usage?.total_tokens ?? 0;

    // Parse topic scores from response and strip the block from display text
    const topicScores = parseTopicScores(rawText);
    const feedbackText = stripScoresBlock(rawText);

    // Estimate cost (Grok pricing - adjust as needed)
    // Assuming ~$0.002 per 1K tokens for estimation
    const cost = (tokensUsed / 1000) * 0.002;

    return {
      feedbackText,
      tokensUsed,
      cost,
      topicScores,
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

  // Generate fallback topic scores from AST detections
  const issueSlugs = new Set(issues.map((i) => i.topicSlug));
  const positiveSlugs = new Set(positiveFindings.map((p) => p.topicSlug));
  const topicScores: TopicScore[] = request.detectedTopics.map((t) => {
    if (issueSlugs.has(t.slug)) {
      return { slug: t.slug, score: 0.3, reason: "AST flagged issue (mock fallback)" };
    }
    if (positiveSlugs.has(t.slug)) {
      return { slug: t.slug, score: 0.8, reason: "AST flagged positive (mock fallback)" };
    }
    return { slug: t.slug, score: 0.5, reason: "Detected but not evaluated (mock fallback)" };
  });

  return {
    feedbackText: feedback,
    tokensUsed: 0,
    cost: 0,
    topicScores,
  };
}
