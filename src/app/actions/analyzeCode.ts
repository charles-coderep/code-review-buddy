"use server";

import * as parser from "@babel/parser";
import traverse from "@babel/traverse";
import type { ASTPatterns } from "@/types";
import {
  FUNDAMENTALS,
  INTERMEDIATE,
  PATTERNS,
  type CurriculumTopic,
  type PatternTopic,
  type LayerType,
} from "@/lib/curriculum";

// =============================================================================
// Types for Three-Layer Analysis
// =============================================================================

export interface DetectedIssue {
  slug: string;
  name: string;
  category: string;
  description: string;
  layer: LayerType;
  code?: string; // Optional code snippet that triggered detection
}

export interface ThreeLayerAnalysis {
  fundamentals: {
    issues: DetectedIssue[];
    count: number;
  };
  intermediate: {
    issues: DetectedIssue[];
    count: number;
  };
  patterns: {
    issues: DetectedIssue[];
    count: number;
  };
  // Flat list for backwards compatibility
  allDetected: string[];
}

// =============================================================================
// Main Three-Layer Analysis Function
// =============================================================================

/**
 * Analyze code holistically across all three learning layers.
 * This is the core analysis function that respects the pedagogical model.
 */
export async function analyzeCodeHolistically(code: string): Promise<ThreeLayerAnalysis> {
  // Run both detection methods
  const astPatterns = await detectPatterns(code);
  const rulePatterns = detectRulePatterns(code);

  // Combine all detected patterns
  const allDetected = [...rulePatterns];

  // Map detections to curriculum topics
  const fundamentalIssues: DetectedIssue[] = [];
  const intermediateIssues: DetectedIssue[] = [];
  const patternIssues: DetectedIssue[] = [];

  // Check fundamentals
  for (const topic of FUNDAMENTALS) {
    if (isTopicDetected(topic, rulePatterns, astPatterns)) {
      fundamentalIssues.push({
        slug: topic.slug,
        name: topic.name,
        category: topic.category,
        description: topic.description,
        layer: "fundamental",
      });
    }
  }

  // Check intermediate
  for (const topic of INTERMEDIATE) {
    if (isTopicDetected(topic, rulePatterns, astPatterns)) {
      intermediateIssues.push({
        slug: topic.slug,
        name: topic.name,
        category: topic.category,
        description: topic.description,
        layer: "intermediate",
      });
    }
  }

  // Check patterns
  for (const topic of PATTERNS) {
    if (isTopicDetected(topic, rulePatterns, astPatterns)) {
      patternIssues.push({
        slug: topic.slug,
        name: topic.name,
        category: topic.category,
        description: topic.description,
        layer: "pattern",
      });
    }
  }

  return {
    fundamentals: {
      issues: fundamentalIssues,
      count: fundamentalIssues.length,
    },
    intermediate: {
      issues: intermediateIssues,
      count: intermediateIssues.length,
    },
    patterns: {
      issues: patternIssues,
      count: patternIssues.length,
    },
    allDetected,
  };
}

/**
 * Check if a curriculum topic was detected in the code
 */
function isTopicDetected(
  topic: CurriculumTopic | PatternTopic,
  rulePatterns: string[],
  astPatterns: ASTPatterns
): boolean {
  // Check if any of the topic's detection patterns were found
  if (topic.detectionPatterns) {
    for (const pattern of topic.detectionPatterns) {
      if (rulePatterns.includes(pattern)) {
        return true;
      }
    }
  }

  // Special AST-based checks for specific topics
  switch (topic.slug) {
    case "closures":
      return astPatterns.hasClosures;
    case "async-await-basics":
      return astPatterns.hasAsyncAwait;
    case "useeffect-dependencies":
      return astPatterns.hasEffectWithoutDependencies;
    case "conditional-rendering":
      return astPatterns.hasConditionalHooks;
    default:
      return false;
  }
}

// =============================================================================
// Prioritization Logic
// =============================================================================

export type UserLevel = "beginner" | "intermediate" | "advanced";

/**
 * Prioritize issues based on user level and the three-layer model.
 *
 * Key principle: Fundamentals ALWAYS come first. A beginner never sees pattern
 * feedback if they have fundamental issues.
 */
export function prioritizeIssues(
  analysis: ThreeLayerAnalysis,
  userLevel: UserLevel
): DetectedIssue[] {
  const prioritized: DetectedIssue[] = [];

  // ALWAYS include fundamentals first (highest priority)
  if (analysis.fundamentals.count > 0) {
    prioritized.push(...analysis.fundamentals.issues);
  }

  // Only add intermediate if:
  // 1. User is NOT beginner
  // 2. No fundamental issues exist
  if (
    userLevel !== "beginner" &&
    analysis.fundamentals.count === 0 &&
    analysis.intermediate.count > 0
  ) {
    prioritized.push(...analysis.intermediate.issues);
  }

  // Only add patterns if:
  // 1. No fundamental issues
  // 2. User is intermediate or advanced
  // 3. Patterns were detected
  if (
    analysis.fundamentals.count === 0 &&
    (userLevel === "intermediate" || userLevel === "advanced") &&
    analysis.patterns.count > 0
  ) {
    prioritized.push(...analysis.patterns.issues);
  }

  // Return top 3-5 issues to focus feedback
  return prioritized.slice(0, 5);
}

// =============================================================================
// Original Detection Functions (kept for backwards compatibility)
// =============================================================================

/**
 * Detect code patterns using Babel AST parser.
 * This runs server-side to avoid shipping Babel to the client.
 */
export async function detectPatterns(code: string): Promise<ASTPatterns> {
  const patterns: ASTPatterns = {
    hasAsyncAwait: false,
    hasPromises: false,
    hasClosures: false,
    hasMutations: false,
    hasUnhandledPromiseRejections: false,
    hasEffectWithoutDependencies: false,
    hasStateInReducer: false,
    hasUseEffectCleanup: false,
    hasConditionalHooks: false,
  };

  try {
    const ast = parser.parse(code, {
      sourceType: "module",
      plugins: ["jsx", "typescript"],
      errorRecovery: true,
    });

    let insideConditional = false;
    let hasUseEffectReturn = false;

    traverse(ast, {
      // Detect async/await
      AwaitExpression() {
        patterns.hasAsyncAwait = true;
      },
      AsyncFunctionDeclaration() {
        patterns.hasAsyncAwait = true;
      },
      AsyncArrowFunctionExpression() {
        patterns.hasAsyncAwait = true;
      },

      // Detect promises (.then calls)
      CallExpression(path) {
        const callee = path.node.callee;
        if (
          callee.type === "MemberExpression" &&
          callee.property.type === "Identifier"
        ) {
          const methodName = callee.property.name;

          if (methodName === "then") {
            patterns.hasPromises = true;
          }

          if (["push", "pop", "shift", "unshift", "splice"].includes(methodName)) {
            patterns.hasMutations = true;
          }

          if (callee.object.type === "Identifier") {
            const hookName = callee.object.name;
            if (hookName.startsWith("use") && insideConditional) {
              patterns.hasConditionalHooks = true;
            }
          }
        }

        if (
          callee.type === "Identifier" &&
          callee.name.startsWith("use")
        ) {
          if (callee.name === "useEffect") {
            const args = path.node.arguments;
            if (args.length === 1) {
              patterns.hasEffectWithoutDependencies = true;
            }
            if (args[0] && args[0].type === "ArrowFunctionExpression") {
              const body = args[0].body;
              if (body.type === "BlockStatement") {
                const hasReturn = body.body.some(
                  (stmt) => stmt.type === "ReturnStatement" && stmt.argument
                );
                if (hasReturn) {
                  hasUseEffectReturn = true;
                }
              }
            }
          }

          if (insideConditional) {
            patterns.hasConditionalHooks = true;
          }
        }
      },

      // Detect closures
      FunctionDeclaration(path) {
        if (path.findParent((p) => p.isFunctionDeclaration() || p.isFunctionExpression())) {
          patterns.hasClosures = true;
        }
      },
      FunctionExpression(path) {
        if (path.findParent((p) => p.isFunctionDeclaration() || p.isFunctionExpression())) {
          patterns.hasClosures = true;
        }
      },
      ArrowFunctionExpression(path) {
        if (
          path.findParent(
            (p) =>
              p.isArrowFunctionExpression() ||
              p.isFunctionDeclaration() ||
              p.isFunctionExpression()
          )
        ) {
          patterns.hasClosures = true;
        }
      },

      // Track conditional blocks
      IfStatement: {
        enter() {
          insideConditional = true;
        },
        exit() {
          insideConditional = false;
        },
      },
      ConditionalExpression: {
        enter() {
          insideConditional = true;
        },
        exit() {
          insideConditional = false;
        },
      },

      TryStatement(path) {
        path.traverse({
          AwaitExpression() {
            // Await inside try/catch is handled
          },
        });
      },
    });

    patterns.hasUseEffectCleanup = hasUseEffectReturn;
  } catch (error) {
    console.error("AST parsing error:", error);
  }

  return patterns;
}

/**
 * Rule-based pattern detection for common issues.
 * Returns pattern slugs that match curriculum topics.
 */
export function detectRulePatterns(code: string): string[] {
  const patterns: string[] = [];

  // ===================
  // FUNDAMENTALS
  // ===================

  // var usage (should use const/let)
  if (code.match(/\bvar\s+/)) {
    patterns.push("var-usage");
  }

  // == instead of ===
  if (code.match(/[^=!]==[^=]/)) {
    patterns.push("loose-equality");
  }

  // Missing error handling in async
  if (code.includes("async") && !code.includes("catch") && !code.includes("try")) {
    patterns.push("missing-error-handling");
  }

  // State mutation with useState (push, splice, etc.)
  if (
    (code.includes(".push(") || code.includes(".splice(") ||
     code.includes(".sort(") || code.includes("[") && code.includes("] =")) &&
    code.includes("useState")
  ) {
    patterns.push("state-mutation");
  }

  // Missing key prop in map
  if (code.includes(".map(") && !code.includes("key=") && !code.includes("key:")) {
    patterns.push("missing-key");
  }

  // Index as key
  if (code.match(/key=\{(index|i|idx)\}/)) {
    patterns.push("index-as-key");
  }

  // Implicit global (assignment without declaration)
  // This is a simple heuristic - AST would be more accurate
  const lines = code.split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (
      /^[a-zA-Z_$][\w$]*\s*=/.test(trimmed) &&
      !/^(const|let|var|function|class|export|import|return|if|else|for|while)/.test(trimmed) &&
      !trimmed.includes('.')
    ) {
      patterns.push("implicit-global");
      break;
    }
  }

  // ===================
  // INTERMEDIATE
  // ===================

  // useEffect without dependency array
  if (code.includes("useEffect(") && code.match(/useEffect\([^,]+\)[;\s]*$/m)) {
    patterns.push("missing-effect-dependency");
  }

  // Promise chaining (more than 2 .then calls)
  const thenMatches = code.match(/\.then\s*\(/g);
  if (thenMatches && thenMatches.length > 2) {
    patterns.push("promise-chaining");
  }

  // Callback hell (deeply nested callbacks)
  const callbackNesting = code.match(/=>\s*{[^}]*=>\s*{[^}]*=>\s*{/);
  if (callbackNesting) {
    patterns.push("callback-hell");
  }

  // Fetch without error handling
  if (code.includes("fetch(") && !code.includes(".catch(") && !code.includes("try")) {
    patterns.push("fetch-no-error-handling");
  }

  // Loop with var (closure issue)
  if (code.match(/for\s*\([^)]*var[^)]*\)\s*\{[^}]*function/)) {
    patterns.push("loop-closure");
  }

  // ===================
  // PATTERNS (Advanced)
  // ===================

  // Direct DOM manipulation in React
  if (
    code.includes("document.") &&
    (code.includes("useState") || code.includes("useEffect"))
  ) {
    patterns.push("direct-dom-manipulation");
  }

  // Inline function in JSX props (potential performance issue)
  if (code.match(/onClick=\{[^}]*=>/)) {
    patterns.push("inline-function-jsx");
  }

  // console.log left in code
  if (code.includes("console.log")) {
    patterns.push("console-log-remaining");
  }

  // Too many useState calls (might need useReducer)
  const useStateMatches = code.match(/useState\(/g);
  if (useStateMatches && useStateMatches.length > 5) {
    patterns.push("complex-state-logic");
  }

  return patterns;
}

/**
 * Calculate complexity score based on detected patterns.
 * Returns 1-5 scale.
 */
export function calculateComplexity(
  astPatterns: ASTPatterns,
  rulePatterns: string[]
): number {
  let score = 1;

  if (astPatterns.hasAsyncAwait) score += 1;
  if (astPatterns.hasPromises) score += 0.5;
  if (astPatterns.hasClosures) score += 0.5;
  if (astPatterns.hasEffectWithoutDependencies) score += 0.5;

  if (rulePatterns.includes("promise-chaining")) score += 0.5;
  if (rulePatterns.includes("callback-hell")) score += 1;

  return Math.min(5, Math.round(score));
}
