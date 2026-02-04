// =============================================
// Function & Closure Pattern Detectors
// Detects: default-parameters, rest-parameters, pure-functions,
//          callback-functions, higher-order-functions,
//          closure-basics, closure-in-loops, closure-state
// =============================================

import type { File } from "@babel/types";
import { traverse, getNodeLocation, isNodeType } from "../parser";

export interface FunctionDetection {
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
// default-parameters
// =============================================

export function detectDefaultParameters(ast: File): FunctionDetection[] {
  const detections: FunctionDetection[] = [];
  let found = false;

  traverse(ast, (node) => {
    if (found) return;

    const isFn =
      isNodeType(node, "FunctionDeclaration") ||
      isNodeType(node, "FunctionExpression") ||
      isNodeType(node, "ArrowFunctionExpression");

    if (!isFn) return;

    const fn = node as { params?: Array<{ type?: string }> };
    const hasDefaults = fn.params?.some((p) => p.type === "AssignmentPattern");

    if (hasDefaults) {
      found = true;
      detections.push({
        topicSlug: "default-parameters",
        detected: true,
        isPositive: true,
        isNegative: false,
        isIdiomatic: true,
        location: getNodeLocation(node) ?? undefined,
        details: "Default parameter values used",
      });
    }
  });

  return detections;
}

// =============================================
// rest-parameters
// =============================================

export function detectRestParameters(ast: File): FunctionDetection[] {
  const detections: FunctionDetection[] = [];
  let found = false;

  traverse(ast, (node) => {
    if (found) return;

    const isFn =
      isNodeType(node, "FunctionDeclaration") ||
      isNodeType(node, "FunctionExpression") ||
      isNodeType(node, "ArrowFunctionExpression");

    if (!isFn) return;

    const fn = node as { params?: Array<{ type?: string }> };
    const hasRest = fn.params?.some((p) => p.type === "RestElement");

    if (hasRest) {
      found = true;
      detections.push({
        topicSlug: "rest-parameters",
        detected: true,
        isPositive: true,
        isNegative: false,
        isIdiomatic: true,
        location: getNodeLocation(node) ?? undefined,
        details: "Rest parameters (...args) used",
      });
    }
  });

  return detections;
}

// =============================================
// pure-functions: Heuristic detection of functions that don't modify external state
// =============================================

export function detectPureFunctions(ast: File): FunctionDetection[] {
  const detections: FunctionDetection[] = [];

  // Track named function declarations and check for external mutations
  traverse(ast, (node) => {
    if (!isNodeType<{
      id?: { name?: string };
      body?: { body?: unknown[] };
      params?: Array<{ name?: string; type?: string }>;
    }>(node, "FunctionDeclaration")) return;

    const fn = node as {
      id?: { name?: string };
      body?: { body?: unknown[] };
      params?: Array<{ name?: string; type?: string }>;
    };

    if (!fn.id?.name || !fn.body?.body) return;

    // Collect parameter names
    const paramNames = new Set<string>();
    for (const param of fn.params ?? []) {
      if (param.type === "Identifier" && param.name) {
        paramNames.add(param.name);
      }
    }

    // Check for side effects: assignments to non-local variables, console, DOM access
    let hasSideEffects = false;
    let hasReturn = false;

    const checkForSideEffects = (n: unknown): void => {
      if (!n || typeof n !== "object") return;
      const typed = n as Record<string, unknown>;

      // Assignment to external variable
      if (typed.type === "AssignmentExpression") {
        const left = typed.left as { type?: string; name?: string; object?: { type?: string } };
        if (left?.type === "Identifier" && !paramNames.has(left.name ?? "")) {
          hasSideEffects = true;
        }
        if (left?.type === "MemberExpression") {
          hasSideEffects = true;
        }
      }

      // console.log, document, window access
      if (typed.type === "MemberExpression") {
        const obj = typed.object as { name?: string };
        if (["console", "document", "window"].includes(obj?.name ?? "")) {
          hasSideEffects = true;
        }
      }

      if (typed.type === "ReturnStatement") {
        hasReturn = true;
      }

      for (const key of Object.keys(typed)) {
        if (key === "loc" || key === "start" || key === "end") continue;
        const value = typed[key];
        if (Array.isArray(value)) {
          value.forEach(checkForSideEffects);
        } else if (value && typeof value === "object") {
          checkForSideEffects(value);
        }
      }
    };

    checkForSideEffects(fn.body);

    if (!hasSideEffects && hasReturn) {
      detections.push({
        topicSlug: "pure-functions",
        detected: true,
        isPositive: true,
        isNegative: false,
        isIdiomatic: true,
        location: getNodeLocation(node) ?? undefined,
        details: `Function '${fn.id.name}' appears to be a pure function`,
      });
    }
  });

  return detections;
}

// =============================================
// callback-functions: Functions passed as arguments
// =============================================

export function detectCallbackFunctions(ast: File): FunctionDetection[] {
  const detections: FunctionDetection[] = [];
  let found = false;

  traverse(ast, (node) => {
    if (found) return;

    if (!isNodeType<{
      arguments?: Array<{ type?: string }>;
      callee?: { type?: string; name?: string; property?: { name?: string } };
    }>(node, "CallExpression")) return;

    const call = node as {
      arguments?: Array<{ type?: string }>;
      callee?: { type?: string; name?: string; property?: { name?: string } };
    };

    // Skip hook calls and common built-in callbacks
    const calleeName = call.callee?.name ?? call.callee?.property?.name ?? "";
    if (/^use[A-Z]/.test(calleeName)) return;

    const hasCallbackArg = call.arguments?.some(
      (arg) =>
        arg.type === "ArrowFunctionExpression" ||
        arg.type === "FunctionExpression" ||
        arg.type === "Identifier"
    );

    if (hasCallbackArg) {
      found = true;
      detections.push({
        topicSlug: "callback-functions",
        detected: true,
        isPositive: true,
        isNegative: false,
        isIdiomatic: true,
        location: getNodeLocation(node) ?? undefined,
        details: "Function passed as callback argument",
      });
    }
  });

  return detections;
}

// =============================================
// higher-order-functions: Functions that take/return functions
// =============================================

export function detectHigherOrderFunctions(ast: File): FunctionDetection[] {
  const detections: FunctionDetection[] = [];

  traverse(ast, (node) => {
    const isFn =
      isNodeType(node, "FunctionDeclaration") ||
      isNodeType(node, "FunctionExpression") ||
      isNodeType(node, "ArrowFunctionExpression");

    if (!isFn) return;

    const fn = node as {
      id?: { name?: string };
      body?: { body?: Array<{ type?: string; argument?: { type?: string } }> };
      params?: Array<{ type?: string }>;
    };

    // Check if function returns a function
    let returnsFn = false;
    const checkReturns = (n: unknown): void => {
      if (!n || typeof n !== "object") return;
      const typed = n as Record<string, unknown>;

      if (typed.type === "ReturnStatement") {
        const arg = typed.argument as { type?: string };
        if (
          arg?.type === "ArrowFunctionExpression" ||
          arg?.type === "FunctionExpression"
        ) {
          returnsFn = true;
        }
      }

      // Don't recurse into nested functions
      if (
        typed.type === "FunctionDeclaration" ||
        typed.type === "FunctionExpression" ||
        typed.type === "ArrowFunctionExpression"
      ) {
        if (typed !== (node as unknown)) return;
      }

      for (const key of Object.keys(typed)) {
        if (key === "loc" || key === "start" || key === "end") continue;
        const value = typed[key];
        if (Array.isArray(value)) {
          value.forEach(checkReturns);
        } else if (value && typeof value === "object") {
          checkReturns(value);
        }
      }
    };

    // Arrow with expression body that is a function
    const arrowBody = (node as { body?: { type?: string } }).body;
    if (
      arrowBody?.type === "ArrowFunctionExpression" ||
      arrowBody?.type === "FunctionExpression"
    ) {
      returnsFn = true;
    }

    if (!returnsFn) {
      checkReturns(fn.body);
    }

    if (returnsFn) {
      detections.push({
        topicSlug: "higher-order-functions",
        detected: true,
        isPositive: true,
        isNegative: false,
        isIdiomatic: true,
        location: getNodeLocation(node) ?? undefined,
        details: "Higher-order function that returns a function",
      });
    }
  });

  return detections;
}

// =============================================
// closure-basics: Inner functions accessing outer scope
// =============================================

export function detectClosureBasics(ast: File): FunctionDetection[] {
  const detections: FunctionDetection[] = [];

  const visit = (node: unknown, outerVars: Set<string>, depth: number): void => {
    if (!node || typeof node !== "object") return;
    const n = node as Record<string, unknown>;

    const isFn =
      n.type === "FunctionDeclaration" ||
      n.type === "FunctionExpression" ||
      n.type === "ArrowFunctionExpression";

    if (isFn && depth > 0) {
      // Inner function - check if it references outer variables
      const fn = n as { params?: Array<{ name?: string; type?: string }> };
      const localVars = new Set<string>();

      // Collect local params
      for (const param of fn.params ?? []) {
        if (param.type === "Identifier" && param.name) {
          localVars.add(param.name);
        }
      }

      // Check for references to outer variables
      let usesClosure = false;
      const checkRefs = (inner: unknown): void => {
        if (!inner || typeof inner !== "object") return;
        const typed = inner as Record<string, unknown>;

        if (typed.type === "Identifier" && typeof typed.name === "string") {
          if (outerVars.has(typed.name) && !localVars.has(typed.name)) {
            usesClosure = true;
          }
        }

        // Don't recurse into deeper functions
        if (
          (typed.type === "FunctionDeclaration" ||
            typed.type === "FunctionExpression" ||
            typed.type === "ArrowFunctionExpression") &&
          typed !== n
        ) {
          return;
        }

        for (const key of Object.keys(typed)) {
          if (key === "loc" || key === "start" || key === "end" || key === "params") continue;
          const value = typed[key];
          if (Array.isArray(value)) {
            value.forEach(checkRefs);
          } else if (value && typeof value === "object") {
            checkRefs(value);
          }
        }
      };

      checkRefs(n.body);

      if (usesClosure) {
        detections.push({
          topicSlug: "closure-basics",
          detected: true,
          isPositive: true,
          isNegative: false,
          isIdiomatic: true,
          location: getNodeLocation(node) ?? undefined,
          details: "Closure: inner function accesses outer scope variables",
        });
      }
    }

    // Collect variable declarations in current scope
    const newOuterVars = new Set(outerVars);
    if (n.type === "VariableDeclarator") {
      const decl = n as { id?: { name?: string; type?: string } };
      if (decl.id?.type === "Identifier" && decl.id.name) {
        newOuterVars.add(decl.id.name);
      }
    }
    if (isFn) {
      const fn = n as { params?: Array<{ name?: string; type?: string }> };
      for (const param of fn.params ?? []) {
        if (param.type === "Identifier" && param.name) {
          newOuterVars.add(param.name);
        }
      }
    }

    const newDepth = isFn ? depth + 1 : depth;

    for (const key of Object.keys(n)) {
      if (key === "loc" || key === "start" || key === "end") continue;
      const value = n[key];
      if (Array.isArray(value)) {
        value.forEach((child) => visit(child, newOuterVars, newDepth));
      } else if (value && typeof value === "object") {
        visit(value, newOuterVars, newDepth);
      }
    }
  };

  visit(ast.program, new Set(), 0);

  // Deduplicate - report once
  if (detections.length > 1) {
    return [detections[0]];
  }
  return detections;
}

// =============================================
// closure-in-loops: Closures inside loops (common bug pattern)
// =============================================

export function detectClosureInLoops(ast: File): FunctionDetection[] {
  const detections: FunctionDetection[] = [];
  const loopTypes = ["ForStatement", "ForInStatement", "ForOfStatement", "WhileStatement", "DoWhileStatement"];

  const visit = (node: unknown, insideLoop: boolean): void => {
    if (!node || typeof node !== "object") return;
    const n = node as Record<string, unknown>;

    const isLoop = loopTypes.includes(n.type as string);
    const nowInsideLoop = insideLoop || isLoop;

    // Function inside a loop
    if (
      nowInsideLoop &&
      (n.type === "FunctionExpression" || n.type === "ArrowFunctionExpression")
    ) {
      detections.push({
        topicSlug: "closure-in-loops",
        detected: true,
        isPositive: false,
        isNegative: true,
        isIdiomatic: false,
        location: getNodeLocation(node) ?? undefined,
        details: "Function created inside loop - may capture loop variable by reference",
      });
      return; // Don't recurse into the function body
    }

    for (const key of Object.keys(n)) {
      if (key === "loc" || key === "start" || key === "end") continue;
      const value = n[key];
      if (Array.isArray(value)) {
        value.forEach((child) => visit(child, nowInsideLoop));
      } else if (value && typeof value === "object") {
        visit(value, nowInsideLoop);
      }
    }
  };

  visit(ast.program, false);

  // Report at most one
  if (detections.length > 1) {
    return [detections[0]];
  }
  return detections;
}

// =============================================
// closure-state: Closures used to maintain private state
// =============================================

export function detectClosureState(ast: File): FunctionDetection[] {
  const detections: FunctionDetection[] = [];

  traverse(ast, (node) => {
    // Look for IIFE or factory function patterns
    // Pattern: function that has local variables and returns a function/object
    const isFn =
      isNodeType(node, "FunctionDeclaration") ||
      isNodeType(node, "FunctionExpression") ||
      isNodeType(node, "ArrowFunctionExpression");

    if (!isFn) return;

    const fn = node as {
      body?: {
        type?: string;
        body?: Array<{
          type?: string;
          argument?: { type?: string };
          declarations?: Array<{ init?: { type?: string } }>;
        }>;
      };
    };

    if (fn.body?.type !== "BlockStatement" || !fn.body.body) return;

    let hasLocalVar = false;
    let returnsFunctionOrObject = false;

    for (const stmt of fn.body.body) {
      if (stmt.type === "VariableDeclaration") {
        hasLocalVar = true;
      }
      if (stmt.type === "ReturnStatement") {
        const arg = stmt.argument;
        if (
          arg?.type === "ObjectExpression" ||
          arg?.type === "ArrowFunctionExpression" ||
          arg?.type === "FunctionExpression"
        ) {
          returnsFunctionOrObject = true;
        }
      }
    }

    if (hasLocalVar && returnsFunctionOrObject) {
      detections.push({
        topicSlug: "closure-state",
        detected: true,
        isPositive: true,
        isNegative: false,
        isIdiomatic: true,
        location: getNodeLocation(node) ?? undefined,
        details: "Closure used to encapsulate private state",
      });
    }
  });

  // Report once
  if (detections.length > 1) {
    return [detections[0]];
  }
  return detections;
}

// =============================================
// Main Detector Function
// =============================================

export function detectFunctionPatterns(ast: File): FunctionDetection[] {
  return [
    ...detectDefaultParameters(ast),
    ...detectRestParameters(ast),
    ...detectPureFunctions(ast),
    ...detectCallbackFunctions(ast),
    ...detectHigherOrderFunctions(ast),
    ...detectClosureBasics(ast),
    ...detectClosureInLoops(ast),
    ...detectClosureState(ast),
  ];
}
