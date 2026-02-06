// =============================================
// JSON Operations Detectors
// Detects: JSON.parse (with/without error handling), JSON.stringify
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
    property?: { name: string };
    object?: { type?: string; name?: string };
  };
  arguments: unknown[];
}

// =============================================
// JSON.parse
// =============================================

function detectJsonParse(ast: File): Detection[] {
  const detections: Detection[] = [];
  let found = false;

  // First, find all TryStatement locations
  const tryRanges: Array<{ start: number; end: number }> = [];
  traverse(ast, (node) => {
    if (isNodeType(node, "TryStatement")) {
      const loc = node as { start?: number; end?: number };
      if (loc.start !== undefined && loc.end !== undefined) {
        tryRanges.push({ start: loc.start, end: loc.end });
      }
    }
  });

  traverse(ast, (node) => {
    if (found) return;
    if (!isNodeType<CallExpr>(node, "CallExpression")) return;
    if (node.callee.type !== "MemberExpression") return;

    if (node.callee.object?.name === "JSON" && node.callee.property?.name === "parse") {
      found = true;

      // Check if inside a try block
      const nodePos = (node as { start?: number }).start ?? 0;
      const insideTry = tryRanges.some((r) => nodePos >= r.start && nodePos <= r.end);

      detections.push({
        topicSlug: "json-parse",
        detected: true,
        isPositive: insideTry,
        isNegative: !insideTry,
        isIdiomatic: insideTry,
        location: getNodeLocation(node) ?? undefined,
        details: insideTry
          ? "JSON.parse() with error handling"
          : "JSON.parse() without try-catch — may throw on invalid JSON",
      });
    }
  });

  return detections;
}

// =============================================
// JSON.stringify
// =============================================

function detectJsonStringify(ast: File): Detection[] {
  const detections: Detection[] = [];
  let found = false;

  traverse(ast, (node) => {
    if (found) return;
    if (!isNodeType<CallExpr>(node, "CallExpression")) return;
    if (node.callee.type !== "MemberExpression") return;

    if (node.callee.object?.name === "JSON" && node.callee.property?.name === "stringify") {
      found = true;
      detections.push({
        topicSlug: "json-stringify",
        detected: true,
        isPositive: true,
        isNegative: false,
        isIdiomatic: true,
        location: getNodeLocation(node) ?? undefined,
        details: "JSON.stringify() used for serialization",
      });
    }
  });

  return detections;
}

// =============================================
// Main Detector Function
// =============================================

export function detectJsonOperations(ast: File): Detection[] {
  return [...detectJsonParse(ast), ...detectJsonStringify(ast)];
}
