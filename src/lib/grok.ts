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
    source?: "babel" | "eslint" | "dataflow";
    details?: string;
    isPositive?: boolean;
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
9. Keep responses concise and actionable
10. Prioritize issues by severity when choosing your 2-3 key points:
    - CRITICAL (address first): Runtime errors — TypeError, ReferenceError, code that crashes or produces wrong results
    - HIGH: Logic bugs — incorrect behavior, wrong output, misuse of language features (e.g., arrow function this binding)
    - MEDIUM: Performance issues, missing error handling, potential bugs in edge cases
    - LOW: Style issues, naming conventions, code organization
    Never lead with style feedback when runtime errors or logic bugs are present.
11. Console statements (console.log, console.warn, etc.) are ENCOURAGED as pedagogical tools for learning and debugging. Do NOT flag them as issues or suggest removing them.`;

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
  { "slug": "let-const-usage", "score": 1.0, "reason": "correctly using const for array" },
  { "slug": "eslint-array-callback-return", "score": 0.0, "reason": "map callback missing return in else branch" },
  { "slug": "eslint-no-else-return", "score": 0.6, "reason": "inferred correct — trivial avoidance" },
  { "slug": "shallow-copy-nested-mutation", "score": 0.0, "reason": "spread copy has nested mutation affecting original" }
]
\`\`\`

You MUST include entries for every slug from ALL sections (AST topics, ESLint violations, ESLint correct usage, Data Flow issues, Data Flow correct usage). Use the exact slug strings provided.

SCORE GUIDE — be strict, not generous:
- 1.0 = perfect, idiomatic usage with no issues
- 0.8 = correct and working but not idiomatic (e.g., arrow function works but could use implicit return)
- 0.6 = minor issue that doesn't break functionality (e.g., unnecessary else after return)
- 0.3 = significant mistake that causes bugs or misuse (e.g., using an array with string keys, calling a function before it's assigned)
- 0.0 = fundamental misunderstanding or code that crashes/produces wrong results (e.g., filter callback with no return, reading a variable before its initializer runs)

CRITICAL SCORING RULES:
1. Score based on ACTUAL CORRECTNESS, not intent. If the code would crash or produce wrong results at runtime, score 0.0-0.3 even if the user "knows" the concept.
2. If your coaching text identifies a problem with a topic, the score MUST reflect that problem. Do NOT give 0.8 to a topic you just criticized.
3. "Demonstrates awareness of a concept" is NOT correct usage. Using var and relying on hoisting to access undefined values is a 0.0, not a 0.8.
4. Type confusion is a significant mistake (0.3 or lower). Example: declaring [] then using string keys makes .length wrong and numeric indexing fail.
5. Code that throws a runtime error (TypeError, ReferenceError) for a topic earns 0.0 for that topic.
6. When in doubt, score LOWER. Generous scores inflate ratings and hide real skill gaps.
7. TRACE DATA FLOW, not just syntax. For every detected topic, follow how the produced value is used downstream:
   - object-destructuring / spread-operator: If a property is extracted via destructuring, check whether it is used later or silently discarded. If a spread merges objects but a destructured-out property is missing from the result, the destructuring CAUSED a bug — score 0.3 or lower. Example: \`const { theme, ...rest } = settings; const final = { ...defaults, ...rest };\` loses the user's theme override.
   - array-foreach: forEach always returns undefined. If the return value is assigned to a variable (e.g., \`let x = arr.forEach(...)\`), score 0.0 — the user confused forEach with map/filter.
   - array-map / array-filter: If the returned array is never assigned or used, score 0.3 — the user likely wanted forEach for side effects.
   - Shallow copy via spread: If \`{...obj}\` is used to "copy" an object but nested properties are later mutated through the copy (affecting the original), score spread-operator 0.3.
   - General principle: Correct syntax with incorrect data flow = incorrect usage. Always check what happens to the VALUE produced by a pattern, not just whether the pattern appears.
8. EVALUATE INTERACTIONS BETWEEN TOPICS. A single bug can affect multiple topic scores. If destructuring removes a key that a later spread needed, BOTH object-destructuring AND spread-operator should score low. Do not score topics in isolation — trace the full chain.
9. INFERRED POSITIVE DETECTIONS. When scoring topics marked as "Correct usage inferred", consider the complexity and meaningfulness of the pattern avoided. Score trivial avoidances conservatively (0.5-0.7) — for example, not using the Function constructor or not creating useless returns requires no real skill demonstration. Score complex pattern avoidances higher (0.8-0.9) — for example, correctly avoiding mutation during iteration, not awaiting inside loops, or properly handling race conditions with shared async state shows genuine understanding. Never score inferred positives at 1.0 — that is reserved for directly observed idiomatic usage.
10. TRIVIAL CODE USAGE. Evaluate whether a topic was exercised meaningfully or just appeared minimally. A single \`const myName = 'Peter'\` does not demonstrate mastery of let-const-usage — score 0.4-0.6. A file that consistently uses const/let across multiple declarations with appropriate mutability choices (const for values that don't change, let only when reassigned) demonstrates real understanding — score 0.8-1.0. Apply this principle to all topics: one trivial use of a pattern is weak evidence, repeated and purposeful use is strong evidence. The more complex and deliberate the usage, the higher the score.`;

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

  const astTopics = detectedTopics.filter((t) => t.source !== "eslint" && t.source !== "dataflow");
  const eslintViolations = detectedTopics.filter((t) => t.source === "eslint" && !t.isPositive);
  const eslintPositives = detectedTopics.filter((t) => t.source === "eslint" && t.isPositive);
  const dataflowViolations = detectedTopics.filter((t) => t.source === "dataflow" && !t.isPositive);
  const dataflowPositives = detectedTopics.filter((t) => t.source === "dataflow" && t.isPositive);

  let prompt = `## Code to Review (${language}${userContext.isReact ? "/React" : ""})

\`\`\`${language}
${code.slice(0, API_CONFIG.MAX_CODE_LENGTH)}
\`\`\`

## Detected Topics (AST)
The following topics were found in the code by Babel AST analysis. Evaluate each for correctness:
${astTopics.map((t) => `- ${t.slug}${t.location ? ` (line ${t.location.line})` : ""}`).join("\n")}
${eslintViolations.length > 0 ? `
## ESLint Violations
The following issues were flagged by ESLint static analysis:
${eslintViolations.map((t) => `- ${t.slug}: ${t.details || "violation detected"}${t.location ? ` (line ${t.location.line})` : ""}`).join("\n")}
` : ""}${eslintPositives.length > 0 ? `
## ESLint Correct Usage (Inferred)
The following ESLint patterns were used correctly (prerequisite patterns present, no violations fired):
${eslintPositives.map((t) => `- ${t.slug}: ${t.details || "correct usage"}`).join("\n")}
` : ""}${dataflowViolations.length > 0 ? `
## Data Flow Issues
The following semantic issues were detected by data flow analysis:
${dataflowViolations.map((t) => `- ${t.slug}: ${t.details || "issue detected"}${t.location ? ` (line ${t.location.line})` : ""}`).join("\n")}
` : ""}${dataflowPositives.length > 0 ? `
## Data Flow Correct Usage (Inferred)
The following data flow patterns were handled correctly (prerequisite patterns present, no issues detected):
${dataflowPositives.map((t) => `- ${t.slug}: ${t.details || "correct usage"}`).join("\n")}
` : ""}
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

  // Build explicit list of ALL slugs that need scoring
  const allSlugs = detectedTopics.map((t) => t.slug);

  prompt += `
## Your Task
Provide pedagogical feedback on this code. Remember:
1. Focus on at most 2-3 key points
2. Use your scaffolding level to adjust how much help you give
3. Ask guiding questions rather than giving answers
4. Acknowledge what they did well
5. Be encouraging but honest
6. After your coaching text, include the TOPIC_SCORES block scoring EVERY topic from ALL sections above (AST, ESLint, Data Flow — both violations and correct usage). You MUST score all ${allSlugs.length} topics.

COMPLETE LIST OF SLUGS TO SCORE (do not skip any):
${allSlugs.map((s) => `- ${s}`).join("\n")}

Format your response in markdown with clear sections.`;

  return prompt;
}

// =============================================
// Score Parsing
// =============================================

/**
 * Validate and filter parsed score entries
 */
function filterValidScores(parsed: unknown[]): TopicScore[] {
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
}

/**
 * Try to parse a JSON string as a TopicScore array
 */
function tryParseScoresArray(jsonStr: string): TopicScore[] {
  try {
    const parsed = JSON.parse(jsonStr);
    if (!Array.isArray(parsed)) return [];
    return filterValidScores(parsed);
  } catch {
    return [];
  }
}

/**
 * Attempt to repair truncated TOPIC_SCORES JSON (response cut off mid-array).
 * Finds the last complete JSON object entry and closes the array.
 */
function repairTruncatedScoresJson(raw: string): string | null {
  const arrayStart = raw.indexOf("[");
  if (arrayStart === -1) return null;

  const jsonStr = raw.substring(arrayStart);

  // Find last complete JSON object entry (closing brace)
  const lastBrace = jsonStr.lastIndexOf("}");
  if (lastBrace === -1) return null;

  // Trim to last complete entry, remove trailing comma, close array
  return jsonStr.substring(0, lastBrace + 1).replace(/,\s*$/, "") + "]";
}

/**
 * Extract TOPIC_SCORES JSON block from AI response text.
 * Handles complete blocks, and recovers partial scores from truncated responses.
 */
export function parseTopicScores(text: string): TopicScore[] {
  // Try fenced format first: ```TOPIC_SCORES\n[...]\n```
  const fencedMatch = text.match(/```\s*TOPIC_SCORES\s*\r?\n([\s\S]*?)```/);
  // Fallback: unfenced TOPIC_SCORES [...] (AI sometimes omits backticks)
  const unfencedMatch = text.match(/TOPIC_SCORES\s*(\[[\s\S]*?\])\s*$/m);
  const jsonStr = fencedMatch?.[1] ?? unfencedMatch?.[1];

  if (jsonStr) {
    const scores = tryParseScoresArray(jsonStr);
    if (scores.length > 0) return scores;
  }

  // Try to recover from truncated response (no closing ``` or ])
  const truncatedMatch = text.match(/(?:```\s*TOPIC_SCORES|TOPIC_SCORES)\s*\r?\n?([\s\S]+)$/);
  if (truncatedMatch?.[1]) {
    const repaired = repairTruncatedScoresJson(truncatedMatch[1]);
    if (repaired) {
      const scores = tryParseScoresArray(repaired);
      if (scores.length > 0) {
        console.warn(`Recovered ${scores.length} topic scores from truncated AI response`);
        return scores;
      }
    }
  }

  return [];
}

/**
 * Remove the TOPIC_SCORES block from text so it isn't shown to the user
 */
export function stripScoresBlock(text: string): string {
  return text
    // Fenced: ```TOPIC_SCORES ... ```
    .replace(/\n*```\s*TOPIC_SCORES\s*\r?\n[\s\S]*?```\n*/g, "")
    // Unfenced: TOPIC_SCORES [...] at end of text
    .replace(/\n*TOPIC_SCORES\s*\[[\s\S]*\]\s*$/g, "")
    // Truncated: TOPIC_SCORES block started but response cut off (no closing ``` or ])
    .replace(/\n*(?:```\s*TOPIC_SCORES|TOPIC_SCORES)\s*\r?\n?[\s\S]*$/g, "")
    .trimEnd();
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
