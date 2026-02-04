// =============================================
// Async Pattern Detectors
// Detects: promises, async/await, error handling
// =============================================

import type { File } from "@babel/types";
import { traverse, getNodeLocation, isNodeType } from "../parser";

export interface AsyncDetection {
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
// Promise Detectors
// =============================================

/**
 * Detect Promise creation and basic usage
 */
export function detectPromiseBasics(ast: File): AsyncDetection[] {
  const detections: AsyncDetection[] = [];

  traverse(ast, (node) => {
    // new Promise()
    if (isNodeType<{ callee?: { name?: string } }>(node, "NewExpression")) {
      if ((node as { callee?: { name?: string } }).callee?.name === "Promise") {
        detections.push({
          topicSlug: "promise-basics",
          detected: true,
          isPositive: true,
          isNegative: false,
          isIdiomatic: true,
          location: getNodeLocation(node) ?? undefined,
          details: "Promise constructor used",
        });
      }
    }

    // .then()
    if (isNodeType<{ callee?: { type?: string; property?: { name?: string } } }>(node, "CallExpression")) {
      const callee = (node as { callee?: { type?: string; property?: { name?: string } } }).callee;
      if (callee?.type === "MemberExpression" && callee.property?.name === "then") {
        detections.push({
          topicSlug: "promise-basics",
          detected: true,
          isPositive: true,
          isNegative: false,
          isIdiomatic: true,
          location: getNodeLocation(node) ?? undefined,
          details: ".then() used",
        });
      }
    }
  });

  return detections;
}

/**
 * Detect promise chaining (.then().then())
 */
export function detectPromiseChaining(ast: File): AsyncDetection[] {
  const detections: AsyncDetection[] = [];

  traverse(ast, (node) => {
    if (!isNodeType<{ callee?: { type?: string; property?: { name?: string }; object?: unknown } }>(
      node,
      "CallExpression"
    )) return;

    const nodeTyped = node as {
      callee?: {
        type?: string;
        property?: { name?: string };
        object?: { type?: string; callee?: { type?: string; property?: { name?: string } } };
      };
    };
    const callee = nodeTyped.callee;

    if (callee?.type === "MemberExpression" && callee.property?.name === "then") {
      // Check if object is also a .then() call
      const obj = callee.object;
      if (
        obj?.type === "CallExpression" &&
        obj.callee?.type === "MemberExpression" &&
        obj.callee.property?.name === "then"
      ) {
        detections.push({
          topicSlug: "promise-chaining",
          detected: true,
          isPositive: true,
          isNegative: false,
          isIdiomatic: true,
          location: getNodeLocation(node) ?? undefined,
          details: "Promise chaining detected",
        });
      }
    }
  });

  return detections;
}

/**
 * Detect .catch() usage
 */
export function detectPromiseCatch(ast: File): AsyncDetection[] {
  const detections: AsyncDetection[] = [];
  let hasPromise = false;
  let hasCatch = false;

  traverse(ast, (node) => {
    if (!isNodeType<{ callee?: { type?: string; property?: { name?: string } } }>(
      node,
      "CallExpression"
    )) return;

    const nodeTyped = node as { callee?: { type?: string; property?: { name?: string } } };
    const callee = nodeTyped.callee;

    if (callee?.type === "MemberExpression") {
      if (callee.property?.name === "then") {
        hasPromise = true;
      }
      if (callee.property?.name === "catch") {
        hasCatch = true;
        detections.push({
          topicSlug: "promise-catch",
          detected: true,
          isPositive: true,
          isNegative: false,
          isIdiomatic: true,
          location: getNodeLocation(node) ?? undefined,
          details: ".catch() error handler present",
        });
      }
    }
  });

  // If promises used but no catch, that's a negative
  if (hasPromise && !hasCatch) {
    detections.push({
      topicSlug: "promise-catch",
      detected: true,
      isPositive: false,
      isNegative: true,
      isIdiomatic: false,
      details: "Promise chain without .catch() error handler",
    });
  }

  return detections;
}

// =============================================
// Async/Await Detectors
// =============================================

/**
 * Detect async/await basics
 */
export function detectAsyncAwaitBasics(ast: File): AsyncDetection[] {
  const detections: AsyncDetection[] = [];

  traverse(ast, (node) => {
    // async function
    if (
      isNodeType<{ async?: boolean }>(node, "FunctionDeclaration") ||
      isNodeType<{ async?: boolean }>(node, "FunctionExpression") ||
      isNodeType<{ async?: boolean }>(node, "ArrowFunctionExpression")
    ) {
      if ((node as { async?: boolean }).async) {
        detections.push({
          topicSlug: "async-await-basics",
          detected: true,
          isPositive: true,
          isNegative: false,
          isIdiomatic: true,
          location: getNodeLocation(node) ?? undefined,
          details: "async function declared",
        });
      }
    }

    // await expression
    if (isNodeType(node, "AwaitExpression")) {
      detections.push({
        topicSlug: "async-await-basics",
        detected: true,
        isPositive: true,
        isNegative: false,
        isIdiomatic: true,
        location: getNodeLocation(node) ?? undefined,
        details: "await expression used",
      });
    }
  });

  return detections;
}

/**
 * Detect async/await error handling
 * Checks if await is inside try-catch
 */
export function detectAsyncAwaitErrorHandling(ast: File): AsyncDetection[] {
  const detections: AsyncDetection[] = [];
  const awaitLocations: Array<{ line: number; column: number; inTry: boolean }> = [];

  // Track whether we're inside a try block
  const tryStack: boolean[] = [];

  const visit = (node: unknown): void => {
    if (!node || typeof node !== "object") return;

    const n = node as Record<string, unknown>;

    if (n.type === "TryStatement") {
      tryStack.push(true);
      // Visit block
      visit(n.block);
      tryStack.pop();
      // Visit handler and finalizer outside try context
      if (n.handler) visit(n.handler);
      if (n.finalizer) visit(n.finalizer);
      return;
    }

    if (n.type === "AwaitExpression") {
      const inTry = tryStack.length > 0;
      const loc = getNodeLocation(node);
      if (loc) {
        awaitLocations.push({ ...loc, inTry });
      }

      if (!inTry) {
        detections.push({
          topicSlug: "async-await-error-handling",
          detected: true,
          isPositive: false,
          isNegative: true,
          isIdiomatic: false,
          location: loc ?? undefined,
          details: "await without try-catch error handling",
        });
      } else {
        detections.push({
          topicSlug: "async-await-error-handling",
          detected: true,
          isPositive: true,
          isNegative: false,
          isIdiomatic: true,
          location: loc ?? undefined,
          details: "await properly wrapped in try-catch",
        });
      }
    }

    // Visit children
    for (const key of Object.keys(n)) {
      if (key === "loc" || key === "start" || key === "end") continue;
      const value = n[key];
      if (Array.isArray(value)) {
        value.forEach(visit);
      } else if (value && typeof value === "object") {
        visit(value);
      }
    }
  };

  visit(ast.program);

  return detections;
}

// =============================================
// Advanced Async Detectors
// =============================================

/**
 * Detect Promise.all usage
 */
export function detectPromiseAll(ast: File): AsyncDetection[] {
  const detections: AsyncDetection[] = [];

  traverse(ast, (node) => {
    if (!isNodeType<{
      callee?: { type?: string; object?: { name?: string }; property?: { name?: string } };
    }>(node, "CallExpression")) return;

    const nodeTyped = node as {
      callee?: { type?: string; object?: { name?: string }; property?: { name?: string } };
    };
    const callee = nodeTyped.callee;

    if (
      callee?.type === "MemberExpression" &&
      callee.object?.name === "Promise" &&
      callee.property?.name === "all"
    ) {
      detections.push({
        topicSlug: "promise-all",
        detected: true,
        isPositive: true,
        isNegative: false,
        isIdiomatic: true,
        location: getNodeLocation(node) ?? undefined,
        details: "Promise.all() for parallel execution",
      });
    }
  });

  return detections;
}

/**
 * Detect Promise.race usage
 */
export function detectPromiseRace(ast: File): AsyncDetection[] {
  const detections: AsyncDetection[] = [];

  traverse(ast, (node) => {
    if (!isNodeType<{
      callee?: { type?: string; object?: { name?: string }; property?: { name?: string } };
    }>(node, "CallExpression")) return;

    const nodeTyped = node as {
      callee?: { type?: string; object?: { name?: string }; property?: { name?: string } };
    };
    const callee = nodeTyped.callee;

    if (
      callee?.type === "MemberExpression" &&
      callee.object?.name === "Promise" &&
      callee.property?.name === "race"
    ) {
      detections.push({
        topicSlug: "promise-race",
        detected: true,
        isPositive: true,
        isNegative: false,
        isIdiomatic: true,
        location: getNodeLocation(node) ?? undefined,
        details: "Promise.race() detected",
      });
    }
  });

  return detections;
}

/**
 * Detect AbortController for request cancellation
 */
export function detectRequestCancellation(ast: File): AsyncDetection[] {
  const detections: AsyncDetection[] = [];

  traverse(ast, (node) => {
    if (!isNodeType<{ callee?: { name?: string } }>(node, "NewExpression")) return;

    const nodeTyped = node as { callee?: { name?: string } };
    if (nodeTyped.callee?.name === "AbortController") {
      detections.push({
        topicSlug: "request-cancellation",
        detected: true,
        isPositive: true,
        isNegative: false,
        isIdiomatic: true,
        location: getNodeLocation(node) ?? undefined,
        details: "AbortController for request cancellation",
      });
    }
  });

  return detections;
}

// =============================================
// Main Detector Function
// =============================================

/**
 * Run all async pattern detectors
 */
export function detectAsyncPatterns(ast: File): AsyncDetection[] {
  return [
    ...detectPromiseBasics(ast),
    ...detectPromiseChaining(ast),
    ...detectPromiseCatch(ast),
    ...detectAsyncAwaitBasics(ast),
    ...detectAsyncAwaitErrorHandling(ast),
    ...detectPromiseAll(ast),
    ...detectPromiseRace(ast),
    ...detectRequestCancellation(ast),
  ];
}
