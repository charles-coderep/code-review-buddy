// =============================================
// Map & Set Collection Detectors
// Detects: Map, Set, iteration, WeakMap/WeakRef
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
// map-basics: new Map()
// =============================================

function detectMapBasics(ast: File): Detection[] {
  const detections: Detection[] = [];
  let found = false;

  traverse(ast, (node) => {
    if (found) return;
    if (isNodeType<{ callee?: { name?: string } }>(node, "NewExpression")) {
      if ((node as { callee?: { name?: string } }).callee?.name === "Map") {
        found = true;
        detections.push({
          topicSlug: "map-basics",
          detected: true,
          isPositive: true,
          isNegative: false,
          isIdiomatic: true,
          location: getNodeLocation(node) ?? undefined,
          details: "Map collection used",
        });
      }
    }

    // Also detect Map methods: .get(), .set(), .has(), .delete() on known Maps
    if (!found && isNodeType<{ callee?: { type?: string; property?: { name?: string } } }>(node, "CallExpression")) {
      const call = node as { callee?: { type?: string; property?: { name?: string } } };
      if (call.callee?.type === "MemberExpression") {
        const prop = call.callee.property?.name;
        if (prop === "get" || prop === "set" || prop === "has" || prop === "delete") {
          // These are generic — only detect if we also see new Map() elsewhere
          // Skip for now to avoid false positives
        }
      }
    }
  });

  return detections;
}

// =============================================
// set-basics: new Set()
// =============================================

function detectSetBasics(ast: File): Detection[] {
  const detections: Detection[] = [];
  let found = false;

  traverse(ast, (node) => {
    if (found) return;
    if (isNodeType<{ callee?: { name?: string } }>(node, "NewExpression")) {
      if ((node as { callee?: { name?: string } }).callee?.name === "Set") {
        found = true;
        detections.push({
          topicSlug: "set-basics",
          detected: true,
          isPositive: true,
          isNegative: false,
          isIdiomatic: true,
          location: getNodeLocation(node) ?? undefined,
          details: "Set collection used",
        });
      }
    }
  });

  return detections;
}

// =============================================
// map-set-iteration: for...of on Map/Set, .forEach on Map/Set
// =============================================

function detectMapSetIteration(ast: File): Detection[] {
  const detections: Detection[] = [];
  let found = false;

  // Check for .entries(), .keys(), .values() on Map/Set instances
  traverse(ast, (node) => {
    if (found) return;
    if (!isNodeType<{ callee?: { type?: string; property?: { name?: string } } }>(node, "CallExpression")) return;

    const call = node as { callee?: { type?: string; property?: { name?: string } } };
    if (call.callee?.type !== "MemberExpression") return;

    const prop = call.callee.property?.name;
    if (prop === "entries" || prop === "keys" || prop === "values" || prop === "forEach") {
      // This is generic, but we'll report it since Map/Set iteration uses these
      found = true;
      detections.push({
        topicSlug: "map-set-iteration",
        detected: true,
        isPositive: true,
        isNegative: false,
        isIdiomatic: true,
        location: getNodeLocation(node) ?? undefined,
        details: `.${prop}() used for collection iteration`,
      });
    }
  });

  return detections;
}

// =============================================
// weakmap-weakref: WeakMap, WeakSet, WeakRef
// =============================================

function detectWeakMapWeakRef(ast: File): Detection[] {
  const detections: Detection[] = [];
  let found = false;

  traverse(ast, (node) => {
    if (found) return;
    if (isNodeType<{ callee?: { name?: string } }>(node, "NewExpression")) {
      const name = (node as { callee?: { name?: string } }).callee?.name;
      if (name === "WeakMap" || name === "WeakSet" || name === "WeakRef") {
        found = true;
        detections.push({
          topicSlug: "weakmap-weakref",
          detected: true,
          isPositive: true,
          isNegative: false,
          isIdiomatic: true,
          location: getNodeLocation(node) ?? undefined,
          details: `${name} used for weak references`,
        });
      }
    }
  });

  return detections;
}

// =============================================
// Main Detector Function
// =============================================

export function detectMapSetCollections(ast: File): Detection[] {
  // Only report iteration if Map or Set was detected
  const mapDetections = detectMapBasics(ast);
  const setDetections = detectSetBasics(ast);
  const hasMapOrSet = mapDetections.length > 0 || setDetections.length > 0;

  return [
    ...mapDetections,
    ...setDetections,
    ...(hasMapOrSet ? detectMapSetIteration(ast) : []),
    ...detectWeakMapWeakRef(ast),
  ];
}
