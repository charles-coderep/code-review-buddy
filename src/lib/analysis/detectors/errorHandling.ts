// =============================================
// Error Handling Detectors
// Detects: try/catch, throw, fetch error checking
// =============================================

import type { File } from "@babel/types";
import { traverse, getNodeLocation, isNodeType } from "../parser";

export interface ErrorHandlingDetection {
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
// Try/Catch Detectors
// =============================================

/**
 * Detect try-catch blocks
 */
export function detectTryCatch(ast: File): ErrorHandlingDetection[] {
  const detections: ErrorHandlingDetection[] = [];

  traverse(ast, (node) => {
    if (isNodeType<{ handler?: unknown; finalizer?: unknown }>(node, "TryStatement")) {
      const tryNode = node as { handler?: unknown; finalizer?: unknown };
      const hasCatch = !!tryNode.handler;
      const hasFinally = !!tryNode.finalizer;

      detections.push({
        topicSlug: "try-catch",
        detected: true,
        isPositive: hasCatch,
        isNegative: !hasCatch && !hasFinally,
        isIdiomatic: hasCatch,
        location: getNodeLocation(node) ?? undefined,
        details: hasCatch
          ? hasFinally
            ? "try-catch-finally block"
            : "try-catch block"
          : "try without catch handler",
      });
    }
  });

  return detections;
}

/**
 * Detect error throwing
 */
export function detectErrorThrowing(ast: File): ErrorHandlingDetection[] {
  const detections: ErrorHandlingDetection[] = [];

  traverse(ast, (node) => {
    if (isNodeType<{ argument?: { type?: string; callee?: { name?: string } } }>(
      node,
      "ThrowStatement"
    )) {
      const throwNode = node as { argument?: { type?: string; callee?: { name?: string } } };
      const argument = throwNode.argument;

      // Check if throwing a proper Error object
      const isErrorObject =
        argument?.type === "NewExpression" &&
        (argument.callee?.name === "Error" ||
          argument.callee?.name === "TypeError" ||
          argument.callee?.name === "RangeError" ||
          argument.callee?.name === "SyntaxError");

      detections.push({
        topicSlug: "error-throwing",
        detected: true,
        isPositive: isErrorObject,
        isNegative: !isErrorObject,
        isIdiomatic: isErrorObject,
        isTrivial: !isErrorObject,
        location: getNodeLocation(node) ?? undefined,
        details: isErrorObject
          ? "Throwing proper Error object"
          : "Consider throwing an Error object instead of primitives",
      });
    }
  });

  return detections;
}

/**
 * Detect Error construction with meaningful messages
 */
export function detectErrorMessages(ast: File): ErrorHandlingDetection[] {
  const detections: ErrorHandlingDetection[] = [];

  traverse(ast, (node) => {
    if (!isNodeType<{ callee?: { name?: string }; arguments?: unknown[] }>(
      node,
      "NewExpression"
    )) return;

    const newNode = node as { callee?: { name?: string }; arguments?: unknown[] };
    const errorTypes = ["Error", "TypeError", "RangeError", "SyntaxError", "ReferenceError"];

    if (newNode.callee?.name && errorTypes.includes(newNode.callee.name)) {
      const hasMessage = (newNode.arguments?.length ?? 0) > 0;
      const firstArg = newNode.arguments?.[0] as { type?: string; value?: string };
      const hasGoodMessage =
        hasMessage &&
        firstArg?.type === "StringLiteral" &&
        (firstArg.value?.length ?? 0) > 10;

      detections.push({
        topicSlug: "error-messages",
        detected: true,
        isPositive: hasGoodMessage,
        isNegative: !hasMessage,
        isIdiomatic: hasGoodMessage,
        isTrivial: hasMessage && !hasGoodMessage,
        location: getNodeLocation(node) ?? undefined,
        details: hasGoodMessage
          ? "Error with descriptive message"
          : hasMessage
            ? "Error message could be more descriptive"
            : "Error constructed without message",
      });
    }
  });

  return detections;
}

// =============================================
// Fetch Error Checking
// =============================================

/**
 * Detect fetch calls and check for proper error handling
 */
export function detectFetchErrorChecking(ast: File): ErrorHandlingDetection[] {
  const detections: ErrorHandlingDetection[] = [];

  // Track fetch calls and whether they check response.ok
  const fetchCalls: Array<{ location: { line: number; column: number } | null; hasOkCheck: boolean }> =
    [];

  // First pass: find fetch calls
  traverse(ast, (node) => {
    if (!isNodeType<{ callee?: { name?: string } }>(node, "CallExpression")) return;

    const callNode = node as { callee?: { name?: string } };
    if (callNode.callee?.name === "fetch") {
      fetchCalls.push({
        location: getNodeLocation(node),
        hasOkCheck: false,
      });
    }
  });

  // Look for response.ok checks
  let hasOkCheck = false;
  traverse(ast, (node) => {
    if (isNodeType<{ object?: { name?: string }; property?: { name?: string } }>(
      node,
      "MemberExpression"
    )) {
      const memberNode = node as { object?: { name?: string }; property?: { name?: string } };
      if (memberNode.property?.name === "ok") {
        hasOkCheck = true;
      }
    }

    // Also check for response.status checks
    if (isNodeType<{ object?: { name?: string }; property?: { name?: string } }>(
      node,
      "MemberExpression"
    )) {
      const memberNode = node as { object?: { name?: string }; property?: { name?: string } };
      if (memberNode.property?.name === "status") {
        hasOkCheck = true;
      }
    }
  });

  // Report fetch error handling
  for (const fetch of fetchCalls) {
    detections.push({
      topicSlug: "fetch-error-checking",
      detected: true,
      isPositive: hasOkCheck,
      isNegative: !hasOkCheck,
      isIdiomatic: hasOkCheck,
      location: fetch.location ?? undefined,
      details: hasOkCheck
        ? "fetch with response status checking"
        : "fetch without checking response.ok or response.status",
    });
  }

  return detections;
}

/**
 * Detect fetch basics
 */
export function detectFetchBasics(ast: File): ErrorHandlingDetection[] {
  const detections: ErrorHandlingDetection[] = [];

  traverse(ast, (node) => {
    if (!isNodeType<{ callee?: { name?: string }; arguments?: unknown[] }>(
      node,
      "CallExpression"
    )) return;

    const callNode = node as { callee?: { name?: string }; arguments?: unknown[] };
    if (callNode.callee?.name === "fetch") {
      detections.push({
        topicSlug: "fetch-basics",
        detected: true,
        isPositive: true,
        isNegative: false,
        isIdiomatic: true,
        location: getNodeLocation(node) ?? undefined,
        details: "fetch API used",
      });
    }
  });

  return detections;
}

/**
 * Detect fetch with options (POST, headers, etc.)
 */
export function detectFetchWithOptions(ast: File): ErrorHandlingDetection[] {
  const detections: ErrorHandlingDetection[] = [];

  traverse(ast, (node) => {
    if (!isNodeType<{ callee?: { name?: string }; arguments?: unknown[] }>(
      node,
      "CallExpression"
    )) return;

    const callNode = node as { callee?: { name?: string }; arguments?: Array<{ type?: string }> };
    if (callNode.callee?.name === "fetch") {
      const hasOptions =
        (callNode.arguments?.length ?? 0) >= 2 &&
        callNode.arguments?.[1]?.type === "ObjectExpression";

      if (hasOptions) {
        detections.push({
          topicSlug: "fetch-with-options",
          detected: true,
          isPositive: true,
          isNegative: false,
          isIdiomatic: true,
          location: getNodeLocation(node) ?? undefined,
          details: "fetch with request options",
        });
      }
    }
  });

  return detections;
}

// =============================================
// Variable and Scope Detectors
// =============================================

/**
 * Detect let/const vs var usage
 */
export function detectLetConstUsage(ast: File): ErrorHandlingDetection[] {
  const detections: ErrorHandlingDetection[] = [];
  let hasVar = false;
  let hasLetConst = false;

  traverse(ast, (node) => {
    if (isNodeType<{ kind?: string }>(node, "VariableDeclaration")) {
      const varNode = node as { kind?: string };

      if (varNode.kind === "var") {
        hasVar = true;
        detections.push({
          topicSlug: "let-const-usage",
          detected: true,
          isPositive: false,
          isNegative: true,
          isIdiomatic: false,
          isTrivial: true,
          location: getNodeLocation(node) ?? undefined,
          details: "var used instead of let/const",
        });
      } else if (varNode.kind === "let" || varNode.kind === "const") {
        hasLetConst = true;
      }
    }
  });

  if (hasLetConst && !hasVar) {
    detections.push({
      topicSlug: "let-const-usage",
      detected: true,
      isPositive: true,
      isNegative: false,
      isIdiomatic: true,
      details: "Using let/const instead of var",
    });
  }

  return detections;
}

/**
 * Detect destructuring patterns
 */
export function detectDestructuring(ast: File): ErrorHandlingDetection[] {
  const detections: ErrorHandlingDetection[] = [];

  traverse(ast, (node) => {
    if (isNodeType(node, "ObjectPattern")) {
      detections.push({
        topicSlug: "object-destructuring",
        detected: true,
        isPositive: true,
        isNegative: false,
        isIdiomatic: true,
        location: getNodeLocation(node) ?? undefined,
        details: "Object destructuring used",
      });
    }

    if (isNodeType(node, "ArrayPattern")) {
      detections.push({
        topicSlug: "array-destructuring",
        detected: true,
        isPositive: true,
        isNegative: false,
        isIdiomatic: true,
        location: getNodeLocation(node) ?? undefined,
        details: "Array destructuring used",
      });
    }
  });

  // Deduplicate
  const seen = new Set<string>();
  return detections.filter((d) => {
    if (seen.has(d.topicSlug)) return false;
    seen.add(d.topicSlug);
    return true;
  });
}

/**
 * Detect spread operator usage
 */
export function detectSpreadOperator(ast: File): ErrorHandlingDetection[] {
  const detections: ErrorHandlingDetection[] = [];
  let hasSpread = false;

  traverse(ast, (node) => {
    if (isNodeType(node, "SpreadElement") && !hasSpread) {
      hasSpread = true;
      detections.push({
        topicSlug: "spread-operator",
        detected: true,
        isPositive: true,
        isNegative: false,
        isIdiomatic: true,
        location: getNodeLocation(node) ?? undefined,
        details: "Spread operator used",
      });
    }
  });

  return detections;
}

/**
 * Detect arrow functions
 */
export function detectArrowFunctions(ast: File): ErrorHandlingDetection[] {
  const detections: ErrorHandlingDetection[] = [];
  let hasArrow = false;

  traverse(ast, (node) => {
    if (isNodeType(node, "ArrowFunctionExpression") && !hasArrow) {
      hasArrow = true;
      detections.push({
        topicSlug: "arrow-functions",
        detected: true,
        isPositive: true,
        isNegative: false,
        isIdiomatic: true,
        location: getNodeLocation(node) ?? undefined,
        details: "Arrow function syntax used",
      });
    }
  });

  return detections;
}

// =============================================
// Main Detector Function
// =============================================

/**
 * Run all error handling and general detectors
 */
export function detectErrorHandlingPatterns(ast: File): ErrorHandlingDetection[] {
  return [
    ...detectTryCatch(ast),
    ...detectErrorThrowing(ast),
    ...detectErrorMessages(ast),
    ...detectFetchBasics(ast),
    ...detectFetchWithOptions(ast),
    ...detectFetchErrorChecking(ast),
    ...detectLetConstUsage(ast),
    ...detectDestructuring(ast),
    ...detectSpreadOperator(ast),
    ...detectArrowFunctions(ast),
  ];
}
