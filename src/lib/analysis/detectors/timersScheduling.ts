// =============================================
// Timers & Scheduling Detectors
// Detects: setTimeout, setInterval, requestAnimationFrame, debounce/throttle
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

interface CallExpr {
  type: "CallExpression";
  callee: {
    type: string;
    name?: string;
    property?: { name: string };
    object?: { type?: string; name?: string };
  };
  arguments: unknown[];
}

// =============================================
// setTimeout-usage
// =============================================

function detectSetTimeout(ast: File): Detection[] {
  const detections: Detection[] = [];
  let found = false;

  traverse(ast, (node) => {
    if (found) return;
    if (!isNodeType<CallExpr>(node, "CallExpression")) return;

    if (node.callee.name === "setTimeout" || node.callee.property?.name === "setTimeout") {
      found = true;
      const hasCallback = node.arguments.length >= 1;
      const hasDelay = node.arguments.length >= 2;
      detections.push({
        topicSlug: "setTimeout-usage",
        detected: true,
        isPositive: hasCallback && hasDelay,
        isNegative: !hasCallback,
        isIdiomatic: hasCallback && hasDelay,
        location: getNodeLocation(node) ?? undefined,
        details: hasDelay
          ? "setTimeout() used with callback and delay"
          : "setTimeout() used",
      });
    }
  });

  return detections;
}

// =============================================
// setInterval-usage
// =============================================

function detectSetInterval(ast: File): Detection[] {
  const detections: Detection[] = [];
  let foundInterval = false;
  let foundClear = false;

  traverse(ast, (node) => {
    if (!isNodeType<CallExpr>(node, "CallExpression")) return;

    const name = node.callee.name ?? node.callee.property?.name;

    if (name === "setInterval" && !foundInterval) {
      foundInterval = true;
    }
    if (name === "clearInterval") {
      foundClear = true;
    }
  });

  if (foundInterval) {
    detections.push({
      topicSlug: "setInterval-usage",
      detected: true,
      isPositive: foundClear,
      isNegative: !foundClear,
      isIdiomatic: foundClear,
      isTrivial: !foundClear,
      location: undefined,
      details: foundClear
        ? "setInterval() with clearInterval() cleanup"
        : "setInterval() without clearInterval() — potential memory leak",
    });
  }

  return detections;
}

// =============================================
// requestAnimationFrame-usage
// =============================================

function detectRequestAnimationFrame(ast: File): Detection[] {
  const detections: Detection[] = [];
  let found = false;

  traverse(ast, (node) => {
    if (found) return;
    if (!isNodeType<CallExpr>(node, "CallExpression")) return;

    const name = node.callee.name ?? node.callee.property?.name;
    if (name === "requestAnimationFrame") {
      found = true;
      detections.push({
        topicSlug: "requestAnimationFrame-usage",
        detected: true,
        isPositive: true,
        isNegative: false,
        isIdiomatic: true,
        location: getNodeLocation(node) ?? undefined,
        details: "requestAnimationFrame() used for animation scheduling",
      });
    }
  });

  return detections;
}

// =============================================
// debounce-throttle: Detect debounce/throttle patterns
// =============================================

function detectDebounceThrottle(ast: File): Detection[] {
  const detections: Detection[] = [];
  let found = false;

  traverse(ast, (node) => {
    if (found) return;
    if (!isNodeType<CallExpr>(node, "CallExpression")) return;

    const name = node.callee.name ?? node.callee.property?.name;

    // Direct function call: debounce(...) or throttle(...)
    if (name === "debounce" || name === "throttle") {
      found = true;
      detections.push({
        topicSlug: "debounce-throttle",
        detected: true,
        isPositive: true,
        isNegative: false,
        isIdiomatic: true,
        location: getNodeLocation(node) ?? undefined,
        details: `${name}() used for rate limiting`,
      });
    }
  });

  // Also detect custom debounce pattern: setTimeout inside a function with clearTimeout
  if (!found) {
    let hasSetTimeout = false;
    let hasClearTimeout = false;

    traverse(ast, (node) => {
      if (!isNodeType<CallExpr>(node, "CallExpression")) return;
      const name = node.callee.name ?? node.callee.property?.name;
      if (name === "setTimeout") hasSetTimeout = true;
      if (name === "clearTimeout") hasClearTimeout = true;
    });

    if (hasSetTimeout && hasClearTimeout) {
      detections.push({
        topicSlug: "debounce-throttle",
        detected: true,
        isPositive: true,
        isNegative: false,
        isIdiomatic: true,
        location: undefined,
        details: "Custom debounce pattern detected (setTimeout + clearTimeout)",
      });
    }
  }

  return detections;
}

// =============================================
// Main Detector Function
// =============================================

export function detectTimersScheduling(ast: File): Detection[] {
  return [
    ...detectSetTimeout(ast),
    ...detectSetInterval(ast),
    ...detectRequestAnimationFrame(ast),
    ...detectDebounceThrottle(ast),
  ];
}
