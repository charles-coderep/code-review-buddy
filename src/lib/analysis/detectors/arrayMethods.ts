// =============================================
// Array Methods Detectors
// Detects: map, filter, reduce, find, some/every, forEach, chaining
// =============================================

import type { File } from "@babel/types";
import { traverse, getNodeLocation, isNodeType } from "../parser";

export interface ArrayMethodDetection {
  topicSlug: string;
  detected: boolean;
  isPositive: boolean;
  isNegative: boolean;
  isIdiomatic: boolean;
  isTrivial?: boolean;
  location?: { line: number; column: number };
  details?: string;
}

interface CallExpression {
  type: "CallExpression";
  callee: {
    type: string;
    property?: { name: string; type: string };
    object?: unknown;
  };
  arguments: unknown[];
  loc?: { start: { line: number; column: number } };
}

// =============================================
// Individual Detectors
// =============================================

/**
 * Detect array.map() usage
 * Checks: callback exists, is a function, and returns a value
 */
export function detectArrayMap(ast: File): ArrayMethodDetection[] {
  const detections: ArrayMethodDetection[] = [];

  traverse(ast, (node) => {
    if (!isNodeType<CallExpression>(node, "CallExpression")) return;

    const callee = node.callee;
    if (
      callee.type === "MemberExpression" &&
      callee.property?.name === "map"
    ) {
      const hasCallback = node.arguments.length > 0;
      const firstArg = node.arguments[0] as {
        type?: string;
        body?: { type?: string; body?: unknown[] };
        expression?: boolean;
      } | undefined;
      const isArrowOrFunction =
        firstArg?.type === "ArrowFunctionExpression" ||
        firstArg?.type === "FunctionExpression";

      let hasReturn = true;
      let details: string | undefined;

      if (isArrowOrFunction && firstArg) {
        if (firstArg.type === "ArrowFunctionExpression" && firstArg.body?.type !== "BlockStatement") {
          hasReturn = true;
          details = "map() with implicit return";
        } else if (firstArg.body?.type === "BlockStatement") {
          hasReturn = hasReturnStatement(firstArg.body);
          if (!hasReturn) {
            details = "map() callback has no return statement — will produce array of undefined";
          } else {
            details = "map() with callback";
          }
        }
      } else if (!hasCallback) {
        details = "map() called without callback";
      }

      const isCorrectUsage = hasCallback && isArrowOrFunction && hasReturn;

      detections.push({
        topicSlug: "array-map",
        detected: true,
        isPositive: isCorrectUsage,
        isNegative: !hasCallback || (isArrowOrFunction && !hasReturn),
        isIdiomatic: isCorrectUsage,
        details,
        location: getNodeLocation(node) ?? undefined,
      });
    }
  });

  return detections;
}

/**
 * Check if a function body has an explicit return statement
 */
function hasReturnStatement(node: unknown): boolean {
  if (!node || typeof node !== "object") return false;
  const n = node as Record<string, unknown>;
  if (n.type === "ReturnStatement") return true;
  // Check if/else branches, blocks, etc.
  for (const value of Object.values(n)) {
    if (Array.isArray(value)) {
      for (const item of value) {
        if (hasReturnStatement(item)) return true;
      }
    } else if (value && typeof value === "object") {
      if (hasReturnStatement(value)) return true;
    }
  }
  return false;
}

/**
 * Detect array.filter() usage
 * Checks: callback exists, is a function, and returns a value
 */
export function detectArrayFilter(ast: File): ArrayMethodDetection[] {
  const detections: ArrayMethodDetection[] = [];

  traverse(ast, (node) => {
    if (!isNodeType<CallExpression>(node, "CallExpression")) return;

    const callee = node.callee;
    if (
      callee.type === "MemberExpression" &&
      callee.property?.name === "filter"
    ) {
      const hasCallback = node.arguments.length > 0;
      const firstArg = node.arguments[0] as {
        type?: string;
        body?: { type?: string; body?: unknown[] };
        expression?: boolean;
      } | undefined;
      const isArrowOrFunction =
        firstArg?.type === "ArrowFunctionExpression" ||
        firstArg?.type === "FunctionExpression";

      // Check if callback actually returns a value
      let hasReturn = true; // assume true for non-block arrows (implicit return)
      let details: string | undefined;

      if (isArrowOrFunction && firstArg) {
        if (firstArg.type === "ArrowFunctionExpression" && firstArg.body?.type !== "BlockStatement") {
          // Arrow with expression body (implicit return) — always returns
          hasReturn = true;
          details = "filter() with implicit return";
        } else if (firstArg.body?.type === "BlockStatement") {
          // Block body — check for explicit return
          hasReturn = hasReturnStatement(firstArg.body);
          if (!hasReturn) {
            details = "filter() callback has no return statement — will always return undefined (falsy)";
          } else {
            details = "filter() with callback";
          }
        }
      }

      const isCorrectUsage = hasCallback && isArrowOrFunction && hasReturn;

      detections.push({
        topicSlug: "array-filter",
        detected: true,
        isPositive: isCorrectUsage,
        isNegative: !hasCallback || (isArrowOrFunction && !hasReturn),
        isIdiomatic: isCorrectUsage,
        details,
        location: getNodeLocation(node) ?? undefined,
      });
    }
  });

  return detections;
}

/**
 * Detect array.reduce() usage
 */
export function detectArrayReduce(ast: File): ArrayMethodDetection[] {
  const detections: ArrayMethodDetection[] = [];

  traverse(ast, (node) => {
    if (!isNodeType<CallExpression>(node, "CallExpression")) return;

    const callee = node.callee;
    if (
      callee.type === "MemberExpression" &&
      callee.property?.name === "reduce"
    ) {
      const hasCallback = node.arguments.length > 0;
      const hasInitialValue = node.arguments.length >= 2;
      const firstArg = node.arguments[0] as { type?: string; params?: unknown[] } | undefined;

      // Check if callback has accumulator and current value params
      const hasCorrectParams =
        firstArg?.type === "ArrowFunctionExpression" &&
        Array.isArray(firstArg.params) &&
        firstArg.params.length >= 2;

      detections.push({
        topicSlug: "array-reduce",
        detected: true,
        isPositive: hasCallback && hasInitialValue && hasCorrectParams,
        isNegative: !hasCallback || !hasInitialValue,
        isIdiomatic: hasCorrectParams && hasInitialValue,
        location: getNodeLocation(node) ?? undefined,
        details: !hasInitialValue
          ? "reduce() without initial value can cause errors on empty arrays"
          : undefined,
      });
    }
  });

  return detections;
}

/**
 * Detect array.find() usage
 */
export function detectArrayFind(ast: File): ArrayMethodDetection[] {
  const detections: ArrayMethodDetection[] = [];

  traverse(ast, (node) => {
    if (!isNodeType<CallExpression>(node, "CallExpression")) return;

    const callee = node.callee;
    if (
      callee.type === "MemberExpression" &&
      callee.property?.name === "find"
    ) {
      const hasCallback = node.arguments.length > 0;

      detections.push({
        topicSlug: "array-find",
        detected: true,
        isPositive: hasCallback,
        isNegative: !hasCallback,
        isIdiomatic: hasCallback,
        location: getNodeLocation(node) ?? undefined,
      });
    }
  });

  return detections;
}

/**
 * Detect array.some() and array.every() usage
 */
export function detectArraySomeEvery(ast: File): ArrayMethodDetection[] {
  const detections: ArrayMethodDetection[] = [];

  traverse(ast, (node) => {
    if (!isNodeType<CallExpression>(node, "CallExpression")) return;

    const callee = node.callee;
    if (
      callee.type === "MemberExpression" &&
      (callee.property?.name === "some" || callee.property?.name === "every")
    ) {
      const hasCallback = node.arguments.length > 0;

      detections.push({
        topicSlug: "array-some-every",
        detected: true,
        isPositive: hasCallback,
        isNegative: !hasCallback,
        isIdiomatic: hasCallback,
        location: getNodeLocation(node) ?? undefined,
        details: `${callee.property?.name}() ${hasCallback ? "used correctly" : "missing predicate"}`,
      });
    }
  });

  return detections;
}

/**
 * Detect array.forEach() usage
 */
export function detectArrayForEach(ast: File): ArrayMethodDetection[] {
  const detections: ArrayMethodDetection[] = [];

  traverse(ast, (node) => {
    if (!isNodeType<CallExpression>(node, "CallExpression")) return;

    const callee = node.callee;
    if (
      callee.type === "MemberExpression" &&
      callee.property?.name === "forEach"
    ) {
      const hasCallback = node.arguments.length > 0;

      // forEach is detected but not always idiomatic (map/filter often better)
      detections.push({
        topicSlug: "array-foreach",
        detected: true,
        isPositive: hasCallback,
        isNegative: !hasCallback,
        isIdiomatic: false, // forEach is less idiomatic than map/filter for transforms
        isTrivial: true,
        location: getNodeLocation(node) ?? undefined,
        details: "Consider if map/filter would be more appropriate",
      });
    }
  });

  return detections;
}

/**
 * Detect method chaining on arrays
 */
export function detectArrayChaining(ast: File): ArrayMethodDetection[] {
  const detections: ArrayMethodDetection[] = [];
  const chainMethods = ["map", "filter", "reduce", "find", "some", "every", "flatMap", "flat"];

  traverse(ast, (node) => {
    if (!isNodeType<CallExpression>(node, "CallExpression")) return;

    const callee = node.callee;
    if (callee.type !== "MemberExpression") return;

    // Check if the object is also a call expression with an array method
    const obj = callee.object as { type?: string; callee?: { type?: string; property?: { name?: string } } };
    if (
      obj?.type === "CallExpression" &&
      obj.callee?.type === "MemberExpression" &&
      chainMethods.includes(obj.callee.property?.name ?? "")
    ) {
      const currentMethod = callee.property?.name;
      if (chainMethods.includes(currentMethod ?? "")) {
        detections.push({
          topicSlug: "array-method-chaining",
          detected: true,
          isPositive: true,
          isNegative: false,
          isIdiomatic: true,
          location: getNodeLocation(node) ?? undefined,
          details: `Chained array methods detected`,
        });
      }
    }
  });

  return detections;
}

// =============================================
// Main Detector Function
// =============================================

/**
 * Run all array method detectors
 */
export function detectArrayMethods(ast: File): ArrayMethodDetection[] {
  return [
    ...detectArrayMap(ast),
    ...detectArrayFilter(ast),
    ...detectArrayReduce(ast),
    ...detectArrayFind(ast),
    ...detectArraySomeEvery(ast),
    ...detectArrayForEach(ast),
    ...detectArrayChaining(ast),
  ];
}
