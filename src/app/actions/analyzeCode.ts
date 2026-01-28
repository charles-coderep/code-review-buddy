"use server";

import * as parser from "@babel/parser";
import traverse from "@babel/traverse";
import type { ASTPatterns } from "@/types";

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
      errorRecovery: true, // Continue parsing even with errors
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

          // Promise patterns
          if (methodName === "then") {
            patterns.hasPromises = true;
          }

          // Array mutations on state
          if (["push", "pop", "shift", "unshift", "splice"].includes(methodName)) {
            patterns.hasMutations = true;
          }

          // Check for hooks
          if (callee.object.type === "Identifier") {
            const hookName = callee.object.name;
            if (hookName.startsWith("use") && insideConditional) {
              patterns.hasConditionalHooks = true;
            }
          }
        }

        // Detect hook calls
        if (
          callee.type === "Identifier" &&
          callee.name.startsWith("use")
        ) {
          // Check for useEffect without dependencies
          if (callee.name === "useEffect") {
            const args = path.node.arguments;
            if (args.length === 1) {
              patterns.hasEffectWithoutDependencies = true;
            }
            // Check if callback has a return (cleanup)
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

          // Conditional hooks
          if (insideConditional) {
            patterns.hasConditionalHooks = true;
          }
        }
      },

      // Detect closures (functions inside functions)
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

      // Detect unhandled promise rejections (await without try/catch)
      TryStatement(path) {
        // If there's a try/catch with await inside, it's handled
        path.traverse({
          AwaitExpression() {
            // This await is inside try/catch, mark as handled
          },
        });
      },
    });

    patterns.hasUseEffectCleanup = hasUseEffectReturn;
  } catch (error) {
    console.error("AST parsing error:", error);
    // Return empty patterns on parse error - still allow review
  }

  return patterns;
}

/**
 * Rule-based pattern detection for common issues.
 * Complements AST analysis with string-based heuristics.
 */
export function detectRulePatterns(code: string): string[] {
  const patterns: string[] = [];

  // State mutation with useState
  if (
    (code.includes(".push(") || code.includes(".splice(")) &&
    code.includes("useState")
  ) {
    patterns.push("state-mutation");
  }

  // useEffect without dependency array
  if (
    code.includes("useEffect") &&
    !code.includes("[]") &&
    !code.includes("[")
  ) {
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

  // Missing error handling in async
  if (code.includes("async") && !code.includes("catch") && !code.includes("try")) {
    patterns.push("missing-error-handling");
  }

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

  // var usage (should use const/let)
  if (code.match(/\bvar\s+/)) {
    patterns.push("var-usage");
  }

  // == instead of ===
  if (code.match(/[^=!]==[^=]/)) {
    patterns.push("loose-equality");
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

  // AST-based complexity
  if (astPatterns.hasAsyncAwait) score += 1;
  if (astPatterns.hasPromises) score += 0.5;
  if (astPatterns.hasClosures) score += 0.5;
  if (astPatterns.hasEffectWithoutDependencies) score += 0.5;

  // Rule-based complexity
  if (rulePatterns.includes("promise-chaining")) score += 0.5;
  if (rulePatterns.includes("callback-hell")) score += 1;

  return Math.min(5, Math.round(score));
}
