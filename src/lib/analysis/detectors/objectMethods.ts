// =============================================
// Object Methods Detectors
// Detects: keys/values/entries, assign/freeze, fromEntries,
//          computed properties, property access, existence checks
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
// Object.keys/values/entries
// =============================================

function detectKeysValuesEntries(ast: File): Detection[] {
  const detections: Detection[] = [];
  const found = new Set<string>();

  traverse(ast, (node) => {
    if (!isNodeType<CallExpr>(node, "CallExpression")) return;
    if (node.callee.type !== "MemberExpression") return;

    const obj = node.callee.object;
    const prop = node.callee.property?.name;
    if (obj?.name !== "Object") return;

    if (prop && ["keys", "values", "entries"].includes(prop) && !found.has(prop)) {
      found.add(prop);
      detections.push({
        topicSlug: "object-keys-values-entries",
        detected: true,
        isPositive: true,
        isNegative: false,
        isIdiomatic: true,
        location: getNodeLocation(node) ?? undefined,
        details: `Object.${prop}() used`,
      });
    }
  });

  return detections;
}

// =============================================
// Object.assign / Object.freeze
// =============================================

function detectAssignFreeze(ast: File): Detection[] {
  const detections: Detection[] = [];
  let foundAssign = false;
  let foundFreeze = false;

  traverse(ast, (node) => {
    if (!isNodeType<CallExpr>(node, "CallExpression")) return;
    if (node.callee.type !== "MemberExpression") return;

    const obj = node.callee.object;
    const prop = node.callee.property?.name;
    if (obj?.name !== "Object") return;

    if (prop === "assign" && !foundAssign) {
      foundAssign = true;
      detections.push({
        topicSlug: "object-assign-freeze",
        detected: true,
        isPositive: true,
        isNegative: false,
        isIdiomatic: true,
        location: getNodeLocation(node) ?? undefined,
        details: "Object.assign() used for object merging",
      });
    }
    if (prop === "freeze" && !foundFreeze) {
      foundFreeze = true;
      detections.push({
        topicSlug: "object-assign-freeze",
        detected: true,
        isPositive: true,
        isNegative: false,
        isIdiomatic: true,
        location: getNodeLocation(node) ?? undefined,
        details: "Object.freeze() used for immutability",
      });
    }
  });

  return detections;
}

// =============================================
// Object.fromEntries
// =============================================

function detectFromEntries(ast: File): Detection[] {
  const detections: Detection[] = [];
  let found = false;

  traverse(ast, (node) => {
    if (found) return;
    if (!isNodeType<CallExpr>(node, "CallExpression")) return;
    if (node.callee.type !== "MemberExpression") return;

    if (node.callee.object?.name === "Object" && node.callee.property?.name === "fromEntries") {
      found = true;
      detections.push({
        topicSlug: "object-fromEntries",
        detected: true,
        isPositive: true,
        isNegative: false,
        isIdiomatic: true,
        location: getNodeLocation(node) ?? undefined,
        details: "Object.fromEntries() used to build object from entries",
      });
    }
  });

  return detections;
}

// =============================================
// Computed property names
// =============================================

function detectComputedPropertyNames(ast: File): Detection[] {
  const detections: Detection[] = [];
  let found = false;

  traverse(ast, (node) => {
    if (found) return;
    if (
      !isNodeType<{ computed?: boolean; key?: { type?: string } }>(node, "ObjectProperty") &&
      !isNodeType<{ computed?: boolean; key?: { type?: string } }>(node, "ObjectMethod")
    )
      return;

    const prop = node as { computed?: boolean; key?: { type?: string } };
    if (prop.computed) {
      found = true;
      detections.push({
        topicSlug: "computed-property-names",
        detected: true,
        isPositive: true,
        isNegative: false,
        isIdiomatic: true,
        location: getNodeLocation(node) ?? undefined,
        details: "Computed property name [expr] used in object",
      });
    }
  });

  return detections;
}

// =============================================
// Property access patterns (dot vs bracket)
// =============================================

function detectPropertyAccessPatterns(ast: File): Detection[] {
  const detections: Detection[] = [];
  let foundDot = false;
  let foundBracketString = false;

  traverse(ast, (node) => {
    if (!isNodeType<{
      computed?: boolean;
      property?: { type?: string; name?: string };
      object?: { type?: string };
    }>(node, "MemberExpression"))
      return;

    const member = node as {
      computed?: boolean;
      property?: { type?: string; name?: string };
      object?: { type?: string };
    };

    if (!member.computed && member.property?.type === "Identifier" && !foundDot) {
      foundDot = true;
      detections.push({
        topicSlug: "property-access-patterns",
        detected: true,
        isPositive: true,
        isNegative: false,
        isIdiomatic: true,
        location: getNodeLocation(node) ?? undefined,
        details: "Dot notation property access",
      });
    }

    if (member.computed && member.property?.type === "StringLiteral" && !foundBracketString) {
      foundBracketString = true;
      detections.push({
        topicSlug: "property-access-patterns",
        detected: true,
        isPositive: true,
        isNegative: false,
        isIdiomatic: false,
        isTrivial: true,
        location: getNodeLocation(node) ?? undefined,
        details: "Bracket notation with string literal — dot notation may be clearer",
      });
    }
  });

  return detections;
}

// =============================================
// Property existence checks (in, hasOwnProperty)
// =============================================

function detectPropertyExistenceCheck(ast: File): Detection[] {
  const detections: Detection[] = [];
  let foundIn = false;
  let foundHasOwn = false;

  traverse(ast, (node) => {
    // 'in' operator
    if (isNodeType<{ operator?: string }>(node, "BinaryExpression") && !foundIn) {
      if ((node as { operator?: string }).operator === "in") {
        foundIn = true;
        detections.push({
          topicSlug: "property-existence-check",
          detected: true,
          isPositive: true,
          isNegative: false,
          isIdiomatic: true,
          location: getNodeLocation(node) ?? undefined,
          details: "'in' operator used for property existence check",
        });
      }
    }

    // hasOwnProperty
    if (!foundHasOwn && isNodeType<CallExpr>(node, "CallExpression")) {
      if (
        node.callee.type === "MemberExpression" &&
        (node.callee.property?.name === "hasOwnProperty" || node.callee.property?.name === "hasOwn")
      ) {
        foundHasOwn = true;
        const name = node.callee.property.name;
        detections.push({
          topicSlug: "property-existence-check",
          detected: true,
          isPositive: true,
          isNegative: false,
          isIdiomatic: name === "hasOwn",
          location: getNodeLocation(node) ?? undefined,
          details: `.${name}() used for property check`,
        });
      }
    }
  });

  return detections;
}

// =============================================
// Main Detector Function
// =============================================

export function detectObjectMethods(ast: File): Detection[] {
  return [
    ...detectKeysValuesEntries(ast),
    ...detectAssignFreeze(ast),
    ...detectFromEntries(ast),
    ...detectComputedPropertyNames(ast),
    ...detectPropertyAccessPatterns(ast),
    ...detectPropertyExistenceCheck(ast),
  ];
}
