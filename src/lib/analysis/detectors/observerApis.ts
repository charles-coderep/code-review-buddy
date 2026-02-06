// =============================================
// Observer APIs Detectors
// Detects: IntersectionObserver, MutationObserver, ResizeObserver
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
// intersection-observer
// =============================================

function detectIntersectionObserver(ast: File): Detection[] {
  const detections: Detection[] = [];
  let found = false;

  traverse(ast, (node) => {
    if (found) return;
    if (isNodeType<{ callee?: { name?: string } }>(node, "NewExpression")) {
      if ((node as { callee?: { name?: string } }).callee?.name === "IntersectionObserver") {
        found = true;
        detections.push({
          topicSlug: "intersection-observer",
          detected: true,
          isPositive: true,
          isNegative: false,
          isIdiomatic: true,
          location: getNodeLocation(node) ?? undefined,
          details: "IntersectionObserver used for visibility detection",
        });
      }
    }
  });

  return detections;
}

// =============================================
// mutation-observer
// =============================================

function detectMutationObserver(ast: File): Detection[] {
  const detections: Detection[] = [];
  let found = false;

  traverse(ast, (node) => {
    if (found) return;
    if (isNodeType<{ callee?: { name?: string } }>(node, "NewExpression")) {
      if ((node as { callee?: { name?: string } }).callee?.name === "MutationObserver") {
        found = true;
        detections.push({
          topicSlug: "mutation-observer",
          detected: true,
          isPositive: true,
          isNegative: false,
          isIdiomatic: true,
          location: getNodeLocation(node) ?? undefined,
          details: "MutationObserver used for DOM change detection",
        });
      }
    }
  });

  return detections;
}

// =============================================
// resize-observer
// =============================================

function detectResizeObserver(ast: File): Detection[] {
  const detections: Detection[] = [];
  let found = false;

  traverse(ast, (node) => {
    if (found) return;
    if (isNodeType<{ callee?: { name?: string } }>(node, "NewExpression")) {
      if ((node as { callee?: { name?: string } }).callee?.name === "ResizeObserver") {
        found = true;
        detections.push({
          topicSlug: "resize-observer",
          detected: true,
          isPositive: true,
          isNegative: false,
          isIdiomatic: true,
          location: getNodeLocation(node) ?? undefined,
          details: "ResizeObserver used for element size monitoring",
        });
      }
    }
  });

  return detections;
}

// =============================================
// Main Detector Function
// =============================================

export function detectObserverApis(ast: File): Detection[] {
  return [
    ...detectIntersectionObserver(ast),
    ...detectMutationObserver(ast),
    ...detectResizeObserver(ast),
  ];
}
