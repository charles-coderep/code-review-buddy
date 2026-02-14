// =============================================
// Modern Operators & Type Checking Detectors
// Detects: optional chaining, nullish coalescing, logical assignment,
//          typeof, instanceof, equality operators, ternary
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
// optional-chaining: ?.
// =============================================

function detectOptionalChaining(ast: File): Detection[] {
  const detections: Detection[] = [];
  let found = false;

  traverse(ast, (node) => {
    if (found) return;
    if (
      isNodeType<{ optional?: boolean }>(node, "OptionalMemberExpression") ||
      isNodeType<{ optional?: boolean }>(node, "OptionalCallExpression")
    ) {
      found = true;
      detections.push({
        topicSlug: "optional-chaining",
        detected: true,
        isPositive: true,
        isNegative: false,
        isIdiomatic: true,
        location: getNodeLocation(node) ?? undefined,
        details: "Optional chaining (?.) used for safe property access",
      });
    }

    // Also catch MemberExpression with optional: true (Babel representation)
    if (
      isNodeType<{ optional?: boolean }>(node, "MemberExpression") &&
      (node as { optional?: boolean }).optional
    ) {
      if (!found) {
        found = true;
        detections.push({
          topicSlug: "optional-chaining",
          detected: true,
          isPositive: true,
          isNegative: false,
          isIdiomatic: true,
          location: getNodeLocation(node) ?? undefined,
          details: "Optional chaining (?.) used for safe property access",
        });
      }
    }
  });

  return detections;
}

// =============================================
// nullish-coalescing: ??
// =============================================

function detectNullishCoalescing(ast: File): Detection[] {
  const detections: Detection[] = [];
  let found = false;

  traverse(ast, (node) => {
    if (found) return;
    if (isNodeType<{ operator?: string }>(node, "LogicalExpression")) {
      if ((node as { operator?: string }).operator === "??") {
        found = true;
        detections.push({
          topicSlug: "nullish-coalescing",
          detected: true,
          isPositive: true,
          isNegative: false,
          isIdiomatic: true,
          location: getNodeLocation(node) ?? undefined,
          details: "Nullish coalescing (??) used for default values",
        });
      }
    }
  });

  return detections;
}

// =============================================
// logical-assignment: &&=, ||=, ??=
// =============================================

function detectLogicalAssignment(ast: File): Detection[] {
  const detections: Detection[] = [];
  let found = false;

  traverse(ast, (node) => {
    if (found) return;
    if (isNodeType<{ operator?: string }>(node, "AssignmentExpression")) {
      const op = (node as { operator?: string }).operator;
      if (op === "&&=" || op === "||=" || op === "??=") {
        found = true;
        detections.push({
          topicSlug: "logical-assignment",
          detected: true,
          isPositive: true,
          isNegative: false,
          isIdiomatic: true,
          location: getNodeLocation(node) ?? undefined,
          details: `Logical assignment ${op} used`,
        });
      }
    }
  });

  return detections;
}

// =============================================
// typeof-operator
// =============================================

function detectTypeofOperator(ast: File): Detection[] {
  const detections: Detection[] = [];
  let found = false;

  traverse(ast, (node) => {
    if (found) return;
    if (isNodeType<{ operator?: string }>(node, "UnaryExpression")) {
      if ((node as { operator?: string }).operator === "typeof") {
        found = true;
        detections.push({
          topicSlug: "typeof-operator",
          detected: true,
          isPositive: true,
          isNegative: false,
          isIdiomatic: true,
          location: getNodeLocation(node) ?? undefined,
          details: "typeof operator used for type checking",
        });
      }
    }
  });

  return detections;
}

// =============================================
// instanceof-operator
// =============================================

function detectInstanceofOperator(ast: File): Detection[] {
  const detections: Detection[] = [];
  let found = false;

  traverse(ast, (node) => {
    if (found) return;
    if (isNodeType<{ operator?: string }>(node, "BinaryExpression")) {
      if ((node as { operator?: string }).operator === "instanceof") {
        found = true;
        detections.push({
          topicSlug: "instanceof-operator",
          detected: true,
          isPositive: true,
          isNegative: false,
          isIdiomatic: true,
          location: getNodeLocation(node) ?? undefined,
          details: "instanceof operator used for type checking",
        });
      }
    }
  });

  return detections;
}

// =============================================
// equality-operators: === vs ==
// =============================================

function detectEqualityOperators(ast: File): Detection[] {
  const detections: Detection[] = [];
  let foundStrict = false;
  let foundLoose = false;

  traverse(ast, (node) => {
    if (!isNodeType<{ operator?: string }>(node, "BinaryExpression")) return;
    const op = (node as { operator?: string }).operator;

    if ((op === "===" || op === "!==") && !foundStrict) {
      foundStrict = true;
      detections.push({
        topicSlug: "equality-operators",
        detected: true,
        isPositive: true,
        isNegative: false,
        isIdiomatic: true,
        location: getNodeLocation(node) ?? undefined,
        details: `Strict equality (${op}) used`,
      });
    }

    if ((op === "==" || op === "!=") && !foundLoose) {
      foundLoose = true;
      // Check if comparing to null (acceptable pattern)
      const bin = node as { left?: { type?: string }; right?: { type?: string } };
      const isNullCheck =
        bin.left?.type === "NullLiteral" || bin.right?.type === "NullLiteral";

      detections.push({
        topicSlug: "equality-operators",
        detected: true,
        isPositive: isNullCheck,
        isNegative: !isNullCheck,
        isIdiomatic: isNullCheck,
        isTrivial: !isNullCheck,
        location: getNodeLocation(node) ?? undefined,
        details: isNullCheck
          ? `Loose equality (${op}) with null — acceptable pattern`
          : `Loose equality (${op}) — prefer strict equality (${op}=)`,
      });
    }
  });

  return detections;
}

// =============================================
// ternary-operator
// =============================================

function detectTernaryOperator(ast: File): Detection[] {
  const detections: Detection[] = [];

  traverse(ast, (node) => {
    if (isNodeType(node, "ConditionalExpression")) {
      detections.push({
        topicSlug: "ternary-operator",
        detected: true,
        isPositive: true,
        isNegative: false,
        isIdiomatic: true,
        location: getNodeLocation(node) ?? undefined,
        details: "Ternary operator used for conditional expression",
      });
    }
  });

  return detections;
}

// =============================================
// Main Detector Function
// =============================================

export function detectModernOperators(ast: File): Detection[] {
  return [
    ...detectOptionalChaining(ast),
    ...detectNullishCoalescing(ast),
    ...detectLogicalAssignment(ast),
    ...detectTypeofOperator(ast),
    ...detectInstanceofOperator(ast),
    ...detectEqualityOperators(ast),
    ...detectTernaryOperator(ast),
  ];
}
