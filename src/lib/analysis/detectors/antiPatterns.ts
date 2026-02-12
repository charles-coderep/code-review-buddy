// =============================================
// Anti-Pattern Detectors
// Detects: no-var, strict equality, eval, innerHTML,
//          magic numbers, empty catch, implicit type coercion
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
// no-var-usage: Detect var declarations (anti-pattern)
// =============================================

function detectNoVarUsage(ast: File): Detection[] {
  const detections: Detection[] = [];
  let foundVar = false;
  let foundLetConst = false;

  traverse(ast, (node) => {
    if (isNodeType<{ kind?: string }>(node, "VariableDeclaration")) {
      const kind = (node as { kind?: string }).kind;
      if (kind === "var" && !foundVar) {
        foundVar = true;
        detections.push({
          topicSlug: "no-var-usage",
          detected: true,
          isPositive: false,
          isNegative: true,
          isIdiomatic: false,
          isTrivial: true,
          location: getNodeLocation(node) ?? undefined,
          details: "var declaration found — use let or const instead",
        });
      }
      if (kind === "let" || kind === "const") {
        foundLetConst = true;
      }
    }
  });

  // If only let/const used, report positive
  if (!foundVar && foundLetConst) {
    detections.push({
      topicSlug: "no-var-usage",
      detected: true,
      isPositive: true,
      isNegative: false,
      isIdiomatic: true,
      details: "No var declarations — using modern let/const",
    });
  }

  return detections;
}

// =============================================
// strict-equality: == vs ===
// =============================================

function detectStrictEquality(ast: File): Detection[] {
  const detections: Detection[] = [];
  let foundLoose = false;

  traverse(ast, (node) => {
    if (foundLoose) return;
    if (!isNodeType<{ operator?: string; left?: { type?: string }; right?: { type?: string } }>(
      node,
      "BinaryExpression"
    ))
      return;

    const bin = node as {
      operator?: string;
      left?: { type?: string };
      right?: { type?: string };
    };

    if (bin.operator === "==" || bin.operator === "!=") {
      // Acceptable: == null or != null
      const isNullCheck =
        bin.left?.type === "NullLiteral" || bin.right?.type === "NullLiteral";

      if (!isNullCheck) {
        foundLoose = true;
        detections.push({
          topicSlug: "strict-equality",
          detected: true,
          isPositive: false,
          isNegative: true,
          isIdiomatic: false,
          isTrivial: true,
          location: getNodeLocation(node) ?? undefined,
          details: `Loose equality (${bin.operator}) used — prefer strict equality (${bin.operator}=)`,
        });
      }
    }
  });

  return detections;
}

// =============================================
// no-eval: Detect eval() usage
// =============================================

function detectNoEval(ast: File): Detection[] {
  const detections: Detection[] = [];
  let found = false;

  traverse(ast, (node) => {
    if (found) return;
    if (
      isNodeType<{ callee?: { name?: string } }>(node, "CallExpression") &&
      (node as { callee?: { name?: string } }).callee?.name === "eval"
    ) {
      found = true;
      detections.push({
        topicSlug: "no-eval",
        detected: true,
        isPositive: false,
        isNegative: true,
        isIdiomatic: false,
        location: getNodeLocation(node) ?? undefined,
        details: "eval() used — security risk and performance issue",
      });
    }
  });

  return detections;
}

// =============================================
// no-innerHTML: Detect innerHTML assignment (XSS risk)
// =============================================

function detectNoInnerHTML(ast: File): Detection[] {
  const detections: Detection[] = [];
  let found = false;

  traverse(ast, (node) => {
    if (found) return;

    // Assignment to .innerHTML
    if (
      isNodeType<{ left?: { type?: string; property?: { name?: string } } }>(
        node,
        "AssignmentExpression"
      )
    ) {
      const assign = node as { left?: { type?: string; property?: { name?: string } } };
      if (
        assign.left?.type === "MemberExpression" &&
        assign.left.property?.name === "innerHTML"
      ) {
        found = true;
        detections.push({
          topicSlug: "no-innerHTML",
          detected: true,
          isPositive: false,
          isNegative: true,
          isIdiomatic: false,
          location: getNodeLocation(node) ?? undefined,
          details: "innerHTML assignment — XSS risk, use textContent or DOM methods",
        });
      }
    }

    // Also flag dangerouslySetInnerHTML in JSX
    if (
      !found &&
      isNodeType<{ name?: { name?: string } }>(node, "JSXAttribute")
    ) {
      if ((node as { name?: { name?: string } }).name?.name === "dangerouslySetInnerHTML") {
        found = true;
        detections.push({
          topicSlug: "no-innerHTML",
          detected: true,
          isPositive: false,
          isNegative: true,
          isIdiomatic: false,
          location: getNodeLocation(node) ?? undefined,
          details: "dangerouslySetInnerHTML used — ensure input is sanitized",
        });
      }
    }
  });

  return detections;
}

// =============================================
// no-magic-numbers: Detect unexplained numeric literals
// =============================================

function detectNoMagicNumbers(ast: File): Detection[] {
  const detections: Detection[] = [];
  const allowedNumbers = new Set([0, 1, -1, 2, 100]);
  let found = false;

  traverse(ast, (node, parent) => {
    if (found) return;
    if (!isNodeType<{ value?: number }>(node, "NumericLiteral")) return;

    const num = (node as { value?: number }).value;
    if (num === undefined || allowedNumbers.has(num)) return;

    // Skip if it's in a variable declaration (const X = 42 is fine)
    const p = parent as { type?: string } | null;
    if (p?.type === "VariableDeclarator") return;

    // Skip if in an array index
    if (p?.type === "MemberExpression") return;

    // Skip object property values (config objects are fine)
    if (p?.type === "ObjectProperty") return;

    // Skip numbers inside array literals (data, not logic constants)
    if (p?.type === "ArrayExpression") return;

    found = true;
    detections.push({
      topicSlug: "no-magic-numbers",
      detected: true,
      isPositive: false,
      isNegative: true,
      isIdiomatic: false,
      isTrivial: true,
      location: getNodeLocation(node) ?? undefined,
      details: `Magic number ${num} — consider extracting to a named constant`,
    });
  });

  return detections;
}

// =============================================
// empty-catch-blocks: catch(e) {} with empty body
// =============================================

function detectEmptyCatchBlocks(ast: File): Detection[] {
  const detections: Detection[] = [];
  let found = false;

  traverse(ast, (node) => {
    if (found) return;
    if (isNodeType<{ handler?: { body?: { body?: unknown[] } } }>(node, "TryStatement")) {
      const tryNode = node as { handler?: { body?: { body?: unknown[] } } };
      const handler = tryNode.handler;
      if (handler) {
        const catchBody = handler.body?.body ?? [];
        if (catchBody.length === 0) {
          found = true;
          detections.push({
            topicSlug: "empty-catch-blocks",
            detected: true,
            isPositive: false,
            isNegative: true,
            isIdiomatic: false,
            location: getNodeLocation(node) ?? undefined,
            details: "Empty catch block — errors are silently swallowed",
          });
        }
      }
    }
  });

  return detections;
}

// =============================================
// implicit-type-coercion: +str for number, '' + x for string, !!x for boolean
// =============================================

function detectImplicitTypeCoercion(ast: File): Detection[] {
  const detections: Detection[] = [];
  let found = false;

  traverse(ast, (node) => {
    if (found) return;

    // !!x for boolean coercion
    if (isNodeType<{ operator?: string; argument?: { type?: string; operator?: string } }>(node, "UnaryExpression")) {
      const unary = node as {
        operator?: string;
        prefix?: boolean;
        argument?: { type?: string; operator?: string; prefix?: boolean };
      };
      if (
        unary.operator === "!" &&
        unary.argument?.type === "UnaryExpression" &&
        unary.argument.operator === "!"
      ) {
        found = true;
        detections.push({
          topicSlug: "implicit-type-coercion",
          detected: true,
          isPositive: true,
          isNegative: false,
          isIdiomatic: false,
          isTrivial: true,
          location: getNodeLocation(node) ?? undefined,
          details: "Double negation (!!) for boolean coercion — consider Boolean()",
        });
      }
    }

    // '' + x for string coercion
    if (
      !found &&
      isNodeType<{ operator?: string; left?: { type?: string; value?: string } }>(node, "BinaryExpression")
    ) {
      const bin = node as {
        operator?: string;
        left?: { type?: string; value?: string };
        right?: { type?: string; value?: string };
      };
      if (bin.operator === "+") {
        if (
          (bin.left?.type === "StringLiteral" && bin.left.value === "") ||
          (bin.right?.type === "StringLiteral" && bin.right.value === "")
        ) {
          found = true;
          detections.push({
            topicSlug: "implicit-type-coercion",
            detected: true,
            isPositive: false,
            isNegative: true,
            isIdiomatic: false,
            isTrivial: true,
            location: getNodeLocation(node) ?? undefined,
            details: "Empty string concatenation for type coercion — consider String()",
          });
        }
      }
    }
  });

  return detections;
}

// =============================================
// Main Detector Function
// =============================================

export function detectAntiPatterns(ast: File): Detection[] {
  return [
    ...detectNoVarUsage(ast),
    ...detectStrictEquality(ast),
    ...detectNoEval(ast),
    ...detectNoInnerHTML(ast),
    ...detectNoMagicNumbers(ast),
    ...detectEmptyCatchBlocks(ast),
    ...detectImplicitTypeCoercion(ast),
  ];
}
