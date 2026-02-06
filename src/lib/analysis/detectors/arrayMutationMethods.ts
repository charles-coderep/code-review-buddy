// =============================================
// Array Mutation Methods Detectors
// Detects: push/pop, shift/unshift, splice, indexOf/includes,
//          sort, slice/concat, flat/flatMap, Array.from/isArray,
//          length, bracket notation
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
    object?: { type?: string; name?: string };
  };
  arguments: unknown[];
}

interface MemberExpr {
  type: "MemberExpression";
  object: { type?: string; name?: string };
  property: { type?: string; name?: string; value?: number };
  computed?: boolean;
}

// =============================================
// push/pop, shift/unshift
// =============================================

function detectPushPop(ast: File): Detection[] {
  const detections: Detection[] = [];
  let foundPush = false;
  let foundPop = false;

  traverse(ast, (node) => {
    if (!isNodeType<CallExpr>(node, "CallExpression")) return;
    const callee = node.callee;
    if (callee.type !== "MemberExpression") return;

    if (callee.property?.name === "push" && !foundPush) {
      foundPush = true;
      detections.push({
        topicSlug: "array-push-pop",
        detected: true,
        isPositive: true,
        isNegative: false,
        isIdiomatic: true,
        location: getNodeLocation(node) ?? undefined,
        details: ".push() used to add elements",
      });
    }
    if (callee.property?.name === "pop" && !foundPop) {
      foundPop = true;
      detections.push({
        topicSlug: "array-push-pop",
        detected: true,
        isPositive: true,
        isNegative: false,
        isIdiomatic: true,
        location: getNodeLocation(node) ?? undefined,
        details: ".pop() used to remove last element",
      });
    }
  });

  return detections;
}

function detectShiftUnshift(ast: File): Detection[] {
  const detections: Detection[] = [];
  let found = false;

  traverse(ast, (node) => {
    if (found) return;
    if (!isNodeType<CallExpr>(node, "CallExpression")) return;
    const callee = node.callee;
    if (callee.type !== "MemberExpression") return;

    const name = callee.property?.name;
    if (name === "shift" || name === "unshift") {
      found = true;
      detections.push({
        topicSlug: "array-shift-unshift",
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
// splice
// =============================================

function detectSplice(ast: File): Detection[] {
  const detections: Detection[] = [];
  let found = false;

  traverse(ast, (node) => {
    if (found) return;
    if (!isNodeType<CallExpr>(node, "CallExpression")) return;
    if (node.callee.type === "MemberExpression" && node.callee.property?.name === "splice") {
      found = true;
      detections.push({
        topicSlug: "array-splice",
        detected: true,
        isPositive: true,
        isNegative: false,
        isIdiomatic: true,
        location: getNodeLocation(node) ?? undefined,
        details: ".splice() used for in-place array modification",
      });
    }
  });

  return detections;
}

// =============================================
// indexOf/includes
// =============================================

function detectIndexOfIncludes(ast: File): Detection[] {
  const detections: Detection[] = [];
  let foundIndexOf = false;
  let foundIncludes = false;

  traverse(ast, (node) => {
    if (!isNodeType<CallExpr>(node, "CallExpression")) return;
    if (node.callee.type !== "MemberExpression") return;

    const name = node.callee.property?.name;
    if (name === "indexOf" && !foundIndexOf) {
      foundIndexOf = true;
      detections.push({
        topicSlug: "array-indexOf-includes",
        detected: true,
        isPositive: true,
        isNegative: false,
        isIdiomatic: false,
        isTrivial: true,
        location: getNodeLocation(node) ?? undefined,
        details: ".indexOf() used — consider .includes() for boolean checks",
      });
    }
    if (name === "includes" && !foundIncludes) {
      foundIncludes = true;
      detections.push({
        topicSlug: "array-indexOf-includes",
        detected: true,
        isPositive: true,
        isNegative: false,
        isIdiomatic: true,
        location: getNodeLocation(node) ?? undefined,
        details: ".includes() used for membership check",
      });
    }
  });

  return detections;
}

// =============================================
// sort
// =============================================

function detectSort(ast: File): Detection[] {
  const detections: Detection[] = [];
  let found = false;

  traverse(ast, (node) => {
    if (found) return;
    if (!isNodeType<CallExpr>(node, "CallExpression")) return;
    if (node.callee.type === "MemberExpression" && node.callee.property?.name === "sort") {
      found = true;
      const hasComparator = node.arguments.length > 0;
      detections.push({
        topicSlug: "array-sort",
        detected: true,
        isPositive: hasComparator,
        isNegative: !hasComparator,
        isIdiomatic: hasComparator,
        location: getNodeLocation(node) ?? undefined,
        details: hasComparator
          ? ".sort() with comparator function"
          : ".sort() without comparator — may produce unexpected results for numbers",
      });
    }
  });

  return detections;
}

// =============================================
// slice/concat
// =============================================

function detectSliceConcat(ast: File): Detection[] {
  const detections: Detection[] = [];
  let foundSlice = false;
  let foundConcat = false;

  traverse(ast, (node) => {
    if (!isNodeType<CallExpr>(node, "CallExpression")) return;
    if (node.callee.type !== "MemberExpression") return;

    const name = node.callee.property?.name;
    if (name === "slice" && !foundSlice) {
      foundSlice = true;
      detections.push({
        topicSlug: "array-slice-concat",
        detected: true,
        isPositive: true,
        isNegative: false,
        isIdiomatic: true,
        location: getNodeLocation(node) ?? undefined,
        details: ".slice() used for non-mutating copy/subarray",
      });
    }
    if (name === "concat" && !foundConcat) {
      foundConcat = true;
      detections.push({
        topicSlug: "array-slice-concat",
        detected: true,
        isPositive: true,
        isNegative: false,
        isIdiomatic: true,
        location: getNodeLocation(node) ?? undefined,
        details: ".concat() used for non-mutating merge",
      });
    }
  });

  return detections;
}

// =============================================
// flat/flatMap
// =============================================

function detectFlatFlatMap(ast: File): Detection[] {
  const detections: Detection[] = [];
  let found = false;

  traverse(ast, (node) => {
    if (found) return;
    if (!isNodeType<CallExpr>(node, "CallExpression")) return;
    if (node.callee.type !== "MemberExpression") return;

    const name = node.callee.property?.name;
    if (name === "flat" || name === "flatMap") {
      found = true;
      detections.push({
        topicSlug: "array-flat-flatMap",
        detected: true,
        isPositive: true,
        isNegative: false,
        isIdiomatic: true,
        location: getNodeLocation(node) ?? undefined,
        details: `.${name}() used for array flattening`,
      });
    }
  });

  return detections;
}

// =============================================
// Array.from / Array.isArray
// =============================================

function detectArrayFromIsArray(ast: File): Detection[] {
  const detections: Detection[] = [];
  let foundFrom = false;
  let foundIsArray = false;

  traverse(ast, (node) => {
    if (!isNodeType<CallExpr>(node, "CallExpression")) return;
    if (node.callee.type !== "MemberExpression") return;

    const obj = node.callee.object;
    const prop = node.callee.property?.name;

    if (obj?.name === "Array" && prop === "from" && !foundFrom) {
      foundFrom = true;
      detections.push({
        topicSlug: "array-from-isArray",
        detected: true,
        isPositive: true,
        isNegative: false,
        isIdiomatic: true,
        location: getNodeLocation(node) ?? undefined,
        details: "Array.from() used to create array from iterable",
      });
    }
    if (obj?.name === "Array" && prop === "isArray" && !foundIsArray) {
      foundIsArray = true;
      detections.push({
        topicSlug: "array-from-isArray",
        detected: true,
        isPositive: true,
        isNegative: false,
        isIdiomatic: true,
        location: getNodeLocation(node) ?? undefined,
        details: "Array.isArray() used for type checking",
      });
    }
  });

  return detections;
}

// =============================================
// .length
// =============================================

function detectArrayLength(ast: File): Detection[] {
  const detections: Detection[] = [];
  let found = false;

  traverse(ast, (node) => {
    if (found) return;
    if (!isNodeType<MemberExpr>(node, "MemberExpression")) return;

    if (node.property?.name === "length" && !node.computed) {
      found = true;
      detections.push({
        topicSlug: "array-length",
        detected: true,
        isPositive: true,
        isNegative: false,
        isIdiomatic: true,
        location: getNodeLocation(node) ?? undefined,
        details: ".length property accessed",
      });
    }
  });

  return detections;
}

// =============================================
// bracket notation
// =============================================

function detectBracketNotation(ast: File): Detection[] {
  const detections: Detection[] = [];
  let found = false;

  traverse(ast, (node) => {
    if (found) return;
    if (!isNodeType<MemberExpr>(node, "MemberExpression")) return;

    if (node.computed && node.property?.type === "NumericLiteral") {
      found = true;
      detections.push({
        topicSlug: "bracket-notation",
        detected: true,
        isPositive: true,
        isNegative: false,
        isIdiomatic: true,
        location: getNodeLocation(node) ?? undefined,
        details: "Bracket notation used for indexed access",
      });
    }
  });

  return detections;
}

// =============================================
// Main Detector Function
// =============================================

export function detectArrayMutationMethods(ast: File): Detection[] {
  return [
    ...detectPushPop(ast),
    ...detectShiftUnshift(ast),
    ...detectSplice(ast),
    ...detectIndexOfIncludes(ast),
    ...detectSort(ast),
    ...detectSliceConcat(ast),
    ...detectFlatFlatMap(ast),
    ...detectArrayFromIsArray(ast),
    ...detectArrayLength(ast),
    ...detectBracketNotation(ast),
  ];
}
