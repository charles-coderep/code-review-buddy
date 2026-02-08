// =============================================
// String Methods Detectors
// Detects: template literals, split/join, search methods,
//          transform, slice/substring, pad/repeat
// =============================================

import type { File } from "@babel/types";
import { traverse, getNodeLocation, isNodeType } from "../parser";
import { buildTypeMap } from "../typeInference";

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
    object?: unknown;
  };
  arguments: unknown[];
}

// =============================================
// template-literals
// =============================================

function detectTemplateLiterals(ast: File): Detection[] {
  const detections: Detection[] = [];
  let foundTemplate = false;
  let foundConcat = false;

  traverse(ast, (node) => {
    if (isNodeType(node, "TemplateLiteral") && !foundTemplate) {
      const n = node as { expressions?: unknown[] };
      if (n.expressions && n.expressions.length > 0) {
        foundTemplate = true;
        detections.push({
          topicSlug: "template-literals",
          detected: true,
          isPositive: true,
          isNegative: false,
          isIdiomatic: true,
          location: getNodeLocation(node) ?? undefined,
          details: "Template literal with interpolation",
        });
      }
    }

    // Detect string concatenation with + as non-idiomatic alternative
    if (
      !foundConcat &&
      isNodeType<{ operator?: string; left?: { type?: string }; right?: { type?: string } }>(
        node,
        "BinaryExpression"
      )
    ) {
      const bin = node as {
        operator?: string;
        left?: { type?: string };
        right?: { type?: string };
      };
      if (
        bin.operator === "+" &&
        (bin.left?.type === "StringLiteral" || bin.right?.type === "StringLiteral")
      ) {
        foundConcat = true;
        detections.push({
          topicSlug: "template-literals",
          detected: true,
          isPositive: false,
          isNegative: true,
          isIdiomatic: false,
          isTrivial: true,
          location: getNodeLocation(node) ?? undefined,
          details: "String concatenation with + — consider template literals",
        });
      }
    }
  });

  return detections;
}

// =============================================
// string-split-join
// =============================================

function detectSplitJoin(ast: File): Detection[] {
  const detections: Detection[] = [];
  let foundSplit = false;
  let foundJoin = false;

  traverse(ast, (node) => {
    if (!isNodeType<CallExpr>(node, "CallExpression")) return;
    if (node.callee.type !== "MemberExpression") return;

    const name = node.callee.property?.name;
    if (name === "split" && !foundSplit) {
      foundSplit = true;
      detections.push({
        topicSlug: "string-split-join",
        detected: true,
        isPositive: true,
        isNegative: false,
        isIdiomatic: true,
        location: getNodeLocation(node) ?? undefined,
        details: ".split() used to tokenize string",
      });
    }
    if (name === "join" && !foundJoin) {
      foundJoin = true;
      detections.push({
        topicSlug: "string-split-join",
        detected: true,
        isPositive: true,
        isNegative: false,
        isIdiomatic: true,
        location: getNodeLocation(node) ?? undefined,
        details: ".join() used to combine array into string",
      });
    }
  });

  return detections;
}

// =============================================
// string-search-methods
// =============================================

function detectStringSearchMethods(ast: File): Detection[] {
  const detections: Detection[] = [];
  const searchMethods = ["indexOf", "lastIndexOf", "startsWith", "endsWith", "includes", "search", "match", "matchAll"];
  const found = new Set<string>();

  traverse(ast, (node) => {
    if (!isNodeType<CallExpr>(node, "CallExpression")) return;
    if (node.callee.type !== "MemberExpression") return;

    const name = node.callee.property?.name;
    if (name && searchMethods.includes(name) && !found.has(name)) {
      found.add(name);
      detections.push({
        topicSlug: "string-search-methods",
        detected: true,
        isPositive: true,
        isNegative: false,
        isIdiomatic: true,
        location: getNodeLocation(node) ?? undefined,
        details: `.${name}() used for string searching`,
      });
    }
  });

  // Report at most 2
  return detections.slice(0, 2);
}

// =============================================
// string-transform
// =============================================

function detectStringTransform(ast: File): Detection[] {
  const detections: Detection[] = [];
  const transformMethods = ["toLowerCase", "toUpperCase", "trim", "trimStart", "trimEnd", "replace", "replaceAll"];
  const found = new Set<string>();

  traverse(ast, (node) => {
    if (!isNodeType<CallExpr>(node, "CallExpression")) return;
    if (node.callee.type !== "MemberExpression") return;

    const name = node.callee.property?.name;
    if (name && transformMethods.includes(name) && !found.has(name)) {
      found.add(name);
      detections.push({
        topicSlug: "string-transform",
        detected: true,
        isPositive: true,
        isNegative: false,
        isIdiomatic: true,
        location: getNodeLocation(node) ?? undefined,
        details: `.${name}() used for string transformation`,
      });
    }
  });

  return detections.slice(0, 2);
}

// =============================================
// string-slice-substring
// =============================================

function detectStringSliceSubstring(ast: File): Detection[] {
  const detections: Detection[] = [];
  let found = false;
  const typeMap = buildTypeMap(ast);

  traverse(ast, (node) => {
    if (found) return;
    if (!isNodeType<CallExpr>(node, "CallExpression")) return;
    if (node.callee.type !== "MemberExpression") return;

    const name = node.callee.property?.name;
    if (name === "slice" || name === "substring" || name === "substr") {
      // Skip if called on a known array variable
      const obj = node.callee.object as { type?: string; name?: string } | undefined;
      if (obj?.type === "Identifier" && obj.name && typeMap.get(obj.name) === "array") {
        return;
      }
      // Skip if called on an array literal
      if (obj?.type === "ArrayExpression") {
        return;
      }

      found = true;
      detections.push({
        topicSlug: "string-slice-substring",
        detected: true,
        isPositive: true,
        isNegative: name === "substr",
        isIdiomatic: name === "slice",
        isTrivial: name === "substr",
        location: getNodeLocation(node) ?? undefined,
        details:
          name === "substr"
            ? ".substr() is deprecated — use .slice() instead"
            : `.${name}() used for string extraction`,
      });
    }
  });

  return detections;
}

// =============================================
// string-pad-repeat
// =============================================

function detectStringPadRepeat(ast: File): Detection[] {
  const detections: Detection[] = [];
  let found = false;

  traverse(ast, (node) => {
    if (found) return;
    if (!isNodeType<CallExpr>(node, "CallExpression")) return;
    if (node.callee.type !== "MemberExpression") return;

    const name = node.callee.property?.name;
    if (name === "padStart" || name === "padEnd" || name === "repeat") {
      found = true;
      detections.push({
        topicSlug: "string-pad-repeat",
        detected: true,
        isPositive: true,
        isNegative: false,
        isIdiomatic: true,
        location: getNodeLocation(node) ?? undefined,
        details: `.${name}() used`,
      });
    }
  });

  return detections;
}

// =============================================
// Main Detector Function
// =============================================

export function detectStringMethods(ast: File): Detection[] {
  return [
    ...detectTemplateLiterals(ast),
    ...detectSplitJoin(ast),
    ...detectStringSearchMethods(ast),
    ...detectStringTransform(ast),
    ...detectStringSliceSubstring(ast),
    ...detectStringPadRepeat(ast),
  ];
}
