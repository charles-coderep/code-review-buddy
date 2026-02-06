// =============================================
// Regex Detectors
// Detects: regex literals, methods, flags, groups
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
// regex-literal: /pattern/ or new RegExp()
// =============================================

function detectRegexLiteral(ast: File): Detection[] {
  const detections: Detection[] = [];
  let found = false;

  traverse(ast, (node) => {
    if (found) return;

    // Regex literal: /pattern/flags
    if (isNodeType(node, "RegExpLiteral")) {
      found = true;
      detections.push({
        topicSlug: "regex-literal",
        detected: true,
        isPositive: true,
        isNegative: false,
        isIdiomatic: true,
        location: getNodeLocation(node) ?? undefined,
        details: "Regular expression literal used",
      });
    }

    // new RegExp('pattern')
    if (
      !found &&
      isNodeType<{ callee?: { name?: string } }>(node, "NewExpression")
    ) {
      if ((node as { callee?: { name?: string } }).callee?.name === "RegExp") {
        found = true;
        detections.push({
          topicSlug: "regex-literal",
          detected: true,
          isPositive: true,
          isNegative: false,
          isIdiomatic: true,
          location: getNodeLocation(node) ?? undefined,
          details: "RegExp constructor used",
        });
      }
    }
  });

  return detections;
}

// =============================================
// regex-methods: test, exec, match, matchAll, replace, search
// =============================================

function detectRegexMethods(ast: File): Detection[] {
  const detections: Detection[] = [];
  let found = false;
  const regexMethods = ["test", "exec"];

  traverse(ast, (node) => {
    if (found) return;
    if (!isNodeType<{ callee?: { type?: string; property?: { name?: string } } }>(node, "CallExpression")) return;

    const call = node as { callee?: { type?: string; property?: { name?: string } } };
    if (call.callee?.type !== "MemberExpression") return;

    const prop = call.callee.property?.name;
    if (prop && regexMethods.includes(prop)) {
      found = true;
      detections.push({
        topicSlug: "regex-methods",
        detected: true,
        isPositive: true,
        isNegative: false,
        isIdiomatic: true,
        location: getNodeLocation(node) ?? undefined,
        details: `.${prop}() regex method used`,
      });
    }
  });

  return detections;
}

// =============================================
// regex-flags: g, i, m, s, u, y
// =============================================

function detectRegexFlags(ast: File): Detection[] {
  const detections: Detection[] = [];
  let found = false;

  traverse(ast, (node) => {
    if (found) return;

    if (isNodeType<{ flags?: string }>(node, "RegExpLiteral")) {
      const regex = node as { flags?: string };
      if (regex.flags && regex.flags.length > 0) {
        found = true;
        detections.push({
          topicSlug: "regex-flags",
          detected: true,
          isPositive: true,
          isNegative: false,
          isIdiomatic: true,
          location: getNodeLocation(node) ?? undefined,
          details: `Regex flags used: ${regex.flags}`,
        });
      }
    }
  });

  return detections;
}

// =============================================
// regex-groups: capturing groups (...), named groups (?<name>...)
// =============================================

function detectRegexGroups(ast: File): Detection[] {
  const detections: Detection[] = [];
  let found = false;

  traverse(ast, (node) => {
    if (found) return;

    if (isNodeType<{ pattern?: string }>(node, "RegExpLiteral")) {
      const regex = node as { pattern?: string };
      if (regex.pattern) {
        // Check for capturing groups (but not non-capturing (?:...))
        const hasCapture = /\((?!\?)/.test(regex.pattern);
        const hasNamed = /\(\?<\w+>/.test(regex.pattern);

        if (hasCapture || hasNamed) {
          found = true;
          detections.push({
            topicSlug: "regex-groups",
            detected: true,
            isPositive: true,
            isNegative: false,
            isIdiomatic: hasNamed,
            location: getNodeLocation(node) ?? undefined,
            details: hasNamed
              ? "Named capture groups used in regex"
              : "Capture groups used in regex",
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

export function detectRegexPatterns(ast: File): Detection[] {
  return [
    ...detectRegexLiteral(ast),
    ...detectRegexMethods(ast),
    ...detectRegexFlags(ast),
    ...detectRegexGroups(ast),
  ];
}
