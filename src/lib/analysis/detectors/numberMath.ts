// =============================================
// Number & Math Detectors
// Detects: parsing, checking, formatting, Math methods
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
// number-parsing: parseInt, parseFloat, Number(), +str
// =============================================

function detectNumberParsing(ast: File): Detection[] {
  const detections: Detection[] = [];
  let foundExplicit = false;

  traverse(ast, (node) => {
    if (!isNodeType<CallExpr>(node, "CallExpression")) return;

    const name = node.callee.name;
    const objName = node.callee.object?.name;
    const propName = node.callee.property?.name;

    if (name === "parseInt" || name === "parseFloat") {
      foundExplicit = true;
      const hasRadix = name === "parseInt" && node.arguments.length >= 2;
      detections.push({
        topicSlug: "number-parsing",
        detected: true,
        isPositive: true,
        isNegative: name === "parseInt" && !hasRadix,
        isIdiomatic: name !== "parseInt" || hasRadix,
        isTrivial: name === "parseInt" && !hasRadix,
        location: getNodeLocation(node) ?? undefined,
        details:
          name === "parseInt" && !hasRadix
            ? "parseInt() without radix parameter"
            : `${name}() used for number parsing`,
      });
    }

    if (name === "Number" || (objName === "Number" && propName === "parseInt") || (objName === "Number" && propName === "parseFloat")) {
      foundExplicit = true;
      detections.push({
        topicSlug: "number-parsing",
        detected: true,
        isPositive: true,
        isNegative: false,
        isIdiomatic: true,
        location: getNodeLocation(node) ?? undefined,
        details: `${name ?? `Number.${propName}`}() used for number conversion`,
      });
    }
  });

  // Detect unary + for number coercion (only if no explicit parsing found)
  if (!foundExplicit) {
    traverse(ast, (node) => {
      if (isNodeType<{ operator?: string; prefix?: boolean }>(node, "UnaryExpression")) {
        const unary = node as { operator?: string; prefix?: boolean };
        if (unary.operator === "+" && unary.prefix) {
          detections.push({
            topicSlug: "number-parsing",
            detected: true,
            isPositive: true,
            isNegative: false,
            isIdiomatic: false,
            isTrivial: true,
            location: getNodeLocation(node) ?? undefined,
            details: "Unary + used for number coercion — consider Number() for clarity",
          });
        }
      }
    });
  }

  return detections;
}

// =============================================
// number-checking: isNaN, isFinite, Number.isInteger, etc.
// =============================================

function detectNumberChecking(ast: File): Detection[] {
  const detections: Detection[] = [];
  let found = false;

  traverse(ast, (node) => {
    if (found) return;
    if (!isNodeType<CallExpr>(node, "CallExpression")) return;

    const name = node.callee.name;
    const objName = node.callee.object?.name;
    const propName = node.callee.property?.name;

    // Global isNaN (non-idiomatic)
    if (name === "isNaN") {
      found = true;
      detections.push({
        topicSlug: "number-checking",
        detected: true,
        isPositive: true,
        isNegative: true,
        isIdiomatic: false,
        isTrivial: true,
        location: getNodeLocation(node) ?? undefined,
        details: "Global isNaN() — prefer Number.isNaN() for strict checking",
      });
    }

    // Number.isNaN, Number.isFinite, Number.isInteger, Number.isSafeInteger
    if (objName === "Number" && propName && ["isNaN", "isFinite", "isInteger", "isSafeInteger"].includes(propName)) {
      found = true;
      detections.push({
        topicSlug: "number-checking",
        detected: true,
        isPositive: true,
        isNegative: false,
        isIdiomatic: true,
        location: getNodeLocation(node) ?? undefined,
        details: `Number.${propName}() used for number validation`,
      });
    }
  });

  return detections;
}

// =============================================
// number-formatting: toFixed, toLocaleString, Intl.NumberFormat
// =============================================

function detectNumberFormatting(ast: File): Detection[] {
  const detections: Detection[] = [];
  let found = false;

  traverse(ast, (node) => {
    if (found) return;

    if (isNodeType<CallExpr>(node, "CallExpression")) {
      if (node.callee.type === "MemberExpression") {
        const prop = node.callee.property?.name;
        if (prop === "toFixed" || prop === "toPrecision" || prop === "toLocaleString") {
          found = true;
          detections.push({
            topicSlug: "number-formatting",
            detected: true,
            isPositive: true,
            isNegative: false,
            isIdiomatic: true,
            location: getNodeLocation(node) ?? undefined,
            details: `.${prop}() used for number formatting`,
          });
        }
      }
    }

    if (isNodeType<{ callee?: { name?: string } }>(node, "NewExpression")) {
      const newExpr = node as { callee?: { name?: string; object?: { name?: string }; property?: { name?: string } } };
      if (newExpr.callee?.object?.name === "Intl" && newExpr.callee?.property?.name === "NumberFormat") {
        found = true;
        detections.push({
          topicSlug: "number-formatting",
          detected: true,
          isPositive: true,
          isNegative: false,
          isIdiomatic: true,
          location: getNodeLocation(node) ?? undefined,
          details: "Intl.NumberFormat used for locale-aware formatting",
        });
      }
    }
  });

  return detections;
}

// =============================================
// math-methods: Math.floor, Math.ceil, Math.round, Math.max, etc.
// =============================================

function detectMathMethods(ast: File): Detection[] {
  const detections: Detection[] = [];
  let found = false;

  traverse(ast, (node) => {
    if (found) return;
    if (!isNodeType<CallExpr>(node, "CallExpression")) return;
    if (node.callee.type !== "MemberExpression") return;

    if (node.callee.object?.name === "Math") {
      found = true;
      detections.push({
        topicSlug: "math-methods",
        detected: true,
        isPositive: true,
        isNegative: false,
        isIdiomatic: true,
        location: getNodeLocation(node) ?? undefined,
        details: `Math.${node.callee.property?.name}() used`,
      });
    }
  });

  return detections;
}

// =============================================
// Main Detector Function
// =============================================

export function detectNumberMath(ast: File): Detection[] {
  return [
    ...detectNumberParsing(ast),
    ...detectNumberChecking(ast),
    ...detectNumberFormatting(ast),
    ...detectMathMethods(ast),
  ];
}
