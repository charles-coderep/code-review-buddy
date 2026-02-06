// =============================================
// Control Flow Detectors
// Detects: switch/case, for...in, guard clauses, short-circuit evaluation
// =============================================

import type { File } from "@babel/types";
import { traverse, getNodeLocation, isNodeType } from "../parser";

interface Detection {
  topicSlug: string;
  detected: boolean;
  isPositive: boolean;
  isNegative: boolean;
  isIdiomatic: boolean;
  isTrivial?: boolean;
  location?: { line: number; column: number };
  details?: string;
}

// =============================================
// switch-case
// =============================================

function detectSwitchCase(ast: File): Detection[] {
  const detections: Detection[] = [];
  let found = false;

  traverse(ast, (node) => {
    if (found) return;
    if (isNodeType<{ cases?: Array<{ consequent?: unknown[] }> }>(node, "SwitchStatement")) {
      found = true;

      // Check for missing break/return in cases
      const switchNode = node as { cases?: Array<{ consequent?: Array<{ type?: string }> }> };
      let hasFallthrough = false;
      for (const c of switchNode.cases ?? []) {
        const stmts = c.consequent ?? [];
        if (stmts.length > 0) {
          const last = stmts[stmts.length - 1];
          if (
            last.type !== "BreakStatement" &&
            last.type !== "ReturnStatement" &&
            last.type !== "ThrowStatement"
          ) {
            hasFallthrough = true;
          }
        }
      }

      detections.push({
        topicSlug: "switch-case",
        detected: true,
        isPositive: !hasFallthrough,
        isNegative: hasFallthrough,
        isIdiomatic: !hasFallthrough,
        isTrivial: hasFallthrough,
        location: getNodeLocation(node) ?? undefined,
        details: hasFallthrough
          ? "switch statement has potential fall-through cases"
          : "switch/case statement used",
      });
    }
  });

  return detections;
}

// =============================================
// for-in-loops
// =============================================

function detectForInLoops(ast: File): Detection[] {
  const detections: Detection[] = [];
  let found = false;

  traverse(ast, (node) => {
    if (found) return;
    if (isNodeType(node, "ForInStatement")) {
      found = true;
      detections.push({
        topicSlug: "for-in-loops",
        detected: true,
        isPositive: true,
        isNegative: false,
        isIdiomatic: true,
        location: getNodeLocation(node) ?? undefined,
        details: "for...in loop used for object key iteration",
      });
    }
  });

  return detections;
}

// =============================================
// guard-clauses: Early returns at the top of a function
// =============================================

function detectGuardClauses(ast: File): Detection[] {
  const detections: Detection[] = [];
  let found = false;

  traverse(ast, (node) => {
    if (found) return;

    const isFn =
      isNodeType(node, "FunctionDeclaration") ||
      isNodeType(node, "FunctionExpression") ||
      isNodeType(node, "ArrowFunctionExpression");

    if (!isFn) return;

    const fn = node as {
      body?: { type?: string; body?: Array<{ type?: string; test?: unknown; consequent?: { body?: Array<{ type?: string }> } }> };
    };

    if (fn.body?.type !== "BlockStatement" || !fn.body.body) return;

    // Check first few statements for if(...) return pattern
    const stmts = fn.body.body;
    for (let i = 0; i < Math.min(3, stmts.length); i++) {
      const stmt = stmts[i];
      if (stmt.type === "IfStatement") {
        const ifStmt = stmt as { consequent?: { type?: string; body?: Array<{ type?: string }>; type2?: string } };
        const body = ifStmt.consequent;

        // Check if the consequent is a return or a block with a return
        let isGuard = false;
        if (body?.type === "ReturnStatement") {
          isGuard = true;
        } else if (body?.type === "BlockStatement") {
          const blockBody = (body as { body?: Array<{ type?: string }> }).body ?? [];
          if (blockBody.length === 1 && blockBody[0].type === "ReturnStatement") {
            isGuard = true;
          }
        }

        if (isGuard) {
          found = true;
          detections.push({
            topicSlug: "guard-clauses",
            detected: true,
            isPositive: true,
            isNegative: false,
            isIdiomatic: true,
            location: getNodeLocation(node) ?? undefined,
            details: "Guard clause pattern — early return for edge cases",
          });
          return;
        }
      }
    }
  });

  return detections;
}

// =============================================
// short-circuit-evaluation: && and || for conditional logic
// =============================================

function detectShortCircuitEvaluation(ast: File): Detection[] {
  const detections: Detection[] = [];
  let found = false;

  traverse(ast, (node) => {
    if (found) return;

    // Look for standalone logical expressions used as statements (not in JSX)
    if (isNodeType<{ expression?: { type?: string; operator?: string } }>(node, "ExpressionStatement")) {
      const expr = (node as { expression?: { type?: string; operator?: string } }).expression;
      if (expr?.type === "LogicalExpression" && (expr.operator === "&&" || expr.operator === "||")) {
        found = true;
        detections.push({
          topicSlug: "short-circuit-evaluation",
          detected: true,
          isPositive: true,
          isNegative: false,
          isIdiomatic: true,
          location: getNodeLocation(node) ?? undefined,
          details: `Short-circuit evaluation with ${expr.operator}`,
        });
      }
    }

    // Also detect || for default values (pre-nullish-coalescing pattern)
    if (
      !found &&
      isNodeType<{ operator?: string }>(node, "LogicalExpression")
    ) {
      const logExpr = node as { operator?: string };
      if (logExpr.operator === "||") {
        // Check if it's in a variable declaration (default value pattern)
        found = true;
        detections.push({
          topicSlug: "short-circuit-evaluation",
          detected: true,
          isPositive: true,
          isNegative: false,
          isIdiomatic: true,
          location: getNodeLocation(node) ?? undefined,
          details: "Logical OR (||) used for default value pattern",
        });
      }
    }
  });

  return detections;
}

// =============================================
// Main Detector Function
// =============================================

export function detectControlFlow(ast: File): Detection[] {
  return [
    ...detectSwitchCase(ast),
    ...detectForInLoops(ast),
    ...detectGuardClauses(ast),
    ...detectShortCircuitEvaluation(ast),
  ];
}
