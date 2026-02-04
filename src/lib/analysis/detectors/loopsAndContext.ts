// =============================================
// Loop & This/Context Detectors
// Detects: for-loop-basics, for-of-loops, while-loops,
//          this-binding, bind-call-apply, arrow-vs-regular-this
// =============================================

import type { File } from "@babel/types";
import { traverse, getNodeLocation, isNodeType } from "../parser";

export interface LoopContextDetection {
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
// for-loop-basics
// =============================================

export function detectForLoopBasics(ast: File): LoopContextDetection[] {
  const detections: LoopContextDetection[] = [];
  let found = false;

  traverse(ast, (node) => {
    if (found) return;

    if (isNodeType(node, "ForStatement")) {
      found = true;
      detections.push({
        topicSlug: "for-loop-basics",
        detected: true,
        isPositive: true,
        isNegative: false,
        isIdiomatic: true,
        location: getNodeLocation(node) ?? undefined,
        details: "for loop used",
      });
    }
  });

  return detections;
}

// =============================================
// for-of-loops
// =============================================

export function detectForOfLoops(ast: File): LoopContextDetection[] {
  const detections: LoopContextDetection[] = [];
  let foundForOf = false;
  let foundForIn = false;

  traverse(ast, (node) => {
    if (isNodeType(node, "ForOfStatement") && !foundForOf) {
      foundForOf = true;
      detections.push({
        topicSlug: "for-of-loops",
        detected: true,
        isPositive: true,
        isNegative: false,
        isIdiomatic: true,
        location: getNodeLocation(node) ?? undefined,
        details: "for...of loop used for iteration",
      });
    }

    // Detect for...in on arrays (anti-pattern)
    if (isNodeType<{ right?: { type?: string } }>(node, "ForInStatement") && !foundForIn) {
      foundForIn = true;
      detections.push({
        topicSlug: "for-of-loops",
        detected: true,
        isPositive: false,
        isNegative: true,
        isIdiomatic: false,
        isTrivial: true,
        location: getNodeLocation(node) ?? undefined,
        details: "for...in iterates over keys - consider for...of for values",
      });
    }
  });

  return detections;
}

// =============================================
// while-loops
// =============================================

export function detectWhileLoops(ast: File): LoopContextDetection[] {
  const detections: LoopContextDetection[] = [];
  let found = false;

  traverse(ast, (node) => {
    if (found) return;

    if (isNodeType(node, "WhileStatement") || isNodeType(node, "DoWhileStatement")) {
      found = true;
      detections.push({
        topicSlug: "while-loops",
        detected: true,
        isPositive: true,
        isNegative: false,
        isIdiomatic: true,
        location: getNodeLocation(node) ?? undefined,
        details: "while loop used",
      });
    }
  });

  return detections;
}

// =============================================
// this-binding: Detect 'this' keyword usage
// =============================================

export function detectThisBinding(ast: File): LoopContextDetection[] {
  const detections: LoopContextDetection[] = [];
  let found = false;

  traverse(ast, (node) => {
    if (found) return;

    if (isNodeType(node, "ThisExpression")) {
      found = true;
      detections.push({
        topicSlug: "this-binding",
        detected: true,
        isPositive: true,
        isNegative: false,
        isIdiomatic: true,
        location: getNodeLocation(node) ?? undefined,
        details: "'this' keyword used",
      });
    }
  });

  return detections;
}

// =============================================
// bind-call-apply: Detect .bind(), .call(), .apply()
// =============================================

export function detectBindCallApply(ast: File): LoopContextDetection[] {
  const detections: LoopContextDetection[] = [];
  const methods = new Set<string>();

  traverse(ast, (node) => {
    if (!isNodeType<{
      callee?: { type?: string; property?: { name?: string } };
    }>(node, "CallExpression")) return;

    const call = node as {
      callee?: { type?: string; property?: { name?: string } };
    };

    if (call.callee?.type === "MemberExpression") {
      const methodName = call.callee.property?.name;
      if (
        methodName &&
        ["bind", "call", "apply"].includes(methodName) &&
        !methods.has(methodName)
      ) {
        methods.add(methodName);
        detections.push({
          topicSlug: "bind-call-apply",
          detected: true,
          isPositive: true,
          isNegative: false,
          isIdiomatic: true,
          location: getNodeLocation(node) ?? undefined,
          details: `.${methodName}() used for context binding`,
        });
      }
    }
  });

  return detections;
}

// =============================================
// arrow-vs-regular-this: Detect 'this' in arrow vs regular functions
// =============================================

export function detectArrowVsRegularThis(ast: File): LoopContextDetection[] {
  const detections: LoopContextDetection[] = [];

  const visit = (
    node: unknown,
    inArrow: boolean,
    inRegular: boolean
  ): void => {
    if (!node || typeof node !== "object") return;
    const n = node as Record<string, unknown>;

    if (n.type === "ArrowFunctionExpression") {
      for (const key of Object.keys(n)) {
        if (key === "loc" || key === "start" || key === "end") continue;
        const value = n[key];
        if (Array.isArray(value)) {
          value.forEach((child) => visit(child, true, false));
        } else if (value && typeof value === "object") {
          visit(value, true, false);
        }
      }
      return;
    }

    if (n.type === "FunctionDeclaration" || n.type === "FunctionExpression") {
      for (const key of Object.keys(n)) {
        if (key === "loc" || key === "start" || key === "end") continue;
        const value = n[key];
        if (Array.isArray(value)) {
          value.forEach((child) => visit(child, false, true));
        } else if (value && typeof value === "object") {
          visit(value, false, true);
        }
      }
      return;
    }

    if (n.type === "ThisExpression") {
      if (inArrow) {
        detections.push({
          topicSlug: "arrow-vs-regular-this",
          detected: true,
          isPositive: true,
          isNegative: false,
          isIdiomatic: true,
          location: getNodeLocation(node) ?? undefined,
          details: "'this' in arrow function inherits from enclosing scope (lexical this)",
        });
      } else if (inRegular) {
        detections.push({
          topicSlug: "arrow-vs-regular-this",
          detected: true,
          isPositive: true,
          isNegative: false,
          isIdiomatic: false,
          location: getNodeLocation(node) ?? undefined,
          details: "'this' in regular function depends on call site (dynamic this)",
        });
      }
    }

    for (const key of Object.keys(n)) {
      if (key === "loc" || key === "start" || key === "end") continue;
      const value = n[key];
      if (Array.isArray(value)) {
        value.forEach((child) => visit(child, inArrow, inRegular));
      } else if (value && typeof value === "object") {
        visit(value, inArrow, inRegular);
      }
    }
  };

  visit(ast.program, false, false);

  // Deduplicate - report at most one of each
  const seen = new Set<string>();
  return detections.filter((d) => {
    const key = `${d.topicSlug}-${d.details}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

// =============================================
// Main Detector Function
// =============================================

export function detectLoopsAndContext(ast: File): LoopContextDetection[] {
  return [
    ...detectForLoopBasics(ast),
    ...detectForOfLoops(ast),
    ...detectWhileLoops(ast),
    ...detectThisBinding(ast),
    ...detectBindCallApply(ast),
    ...detectArrowVsRegularThis(ast),
  ];
}
