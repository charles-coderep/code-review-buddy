// =============================================
// State Pattern Detectors
// Detects: state-immutability, lifting-state, loading-states,
//          error-state-handling, reducer-patterns, complex-state,
//          state-normalization
// =============================================

import type { File } from "@babel/types";
import { traverse, getNodeLocation, isNodeType } from "../parser";

export interface StateDetection {
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
// state-immutability: Detect direct mutation of state
// =============================================

export function detectStateImmutability(ast: File): StateDetection[] {
  const detections: StateDetection[] = [];

  // Track state variables from useState
  const stateVars = new Set<string>();

  traverse(ast, (node, parent) => {
    if (!isNodeType<{
      callee?: { type?: string; name?: string };
    }>(node, "CallExpression")) return;

    const call = node as { callee?: { type?: string; name?: string } };
    if (call.callee?.type === "Identifier" && call.callee.name === "useState") {
      const parentTyped = parent as {
        type?: string;
        id?: { type?: string; elements?: Array<{ name?: string }> };
      };
      if (
        parentTyped?.type === "VariableDeclarator" &&
        parentTyped.id?.type === "ArrayPattern" &&
        parentTyped.id.elements?.[0]?.name
      ) {
        stateVars.add(parentTyped.id.elements[0].name);
      }
    }
  });

  // Check for direct mutations of state variables
  traverse(ast, (node) => {
    // state.push(), state.splice(), etc.
    if (isNodeType<{
      callee?: {
        type?: string;
        object?: { name?: string; type?: string };
        property?: { name?: string };
      };
    }>(node, "CallExpression")) {
      const call = node as {
        callee?: {
          type?: string;
          object?: { name?: string; type?: string };
          property?: { name?: string };
        };
      };

      const mutatingMethods = ["push", "pop", "shift", "unshift", "splice", "sort", "reverse"];
      if (
        call.callee?.type === "MemberExpression" &&
        call.callee.object?.type === "Identifier" &&
        stateVars.has(call.callee.object.name ?? "") &&
        mutatingMethods.includes(call.callee.property?.name ?? "")
      ) {
        detections.push({
          topicSlug: "state-immutability",
          detected: true,
          isPositive: false,
          isNegative: true,
          isIdiomatic: false,
          location: getNodeLocation(node) ?? undefined,
          details: `Direct mutation of state with .${call.callee.property?.name}() - use immutable update instead`,
        });
      }
    }

    // state[index] = value or state.prop = value
    if (isNodeType<{
      left?: {
        type?: string;
        object?: { name?: string; type?: string };
      };
    }>(node, "AssignmentExpression")) {
      const assign = node as {
        left?: {
          type?: string;
          object?: { name?: string; type?: string };
        };
      };

      if (
        assign.left?.type === "MemberExpression" &&
        assign.left.object?.type === "Identifier" &&
        stateVars.has(assign.left.object.name ?? "")
      ) {
        detections.push({
          topicSlug: "state-immutability",
          detected: true,
          isPositive: false,
          isNegative: true,
          isIdiomatic: false,
          location: getNodeLocation(node) ?? undefined,
          details: "Direct property assignment on state - use immutable update with spread/map",
        });
      }
    }
  });

  // If state vars exist but no mutations found, that's positive
  if (stateVars.size > 0 && detections.length === 0) {
    detections.push({
      topicSlug: "state-immutability",
      detected: true,
      isPositive: true,
      isNegative: false,
      isIdiomatic: true,
      details: "State updates appear to follow immutability patterns",
    });
  }

  return detections;
}

// =============================================
// lifting-state: State passed down as props with setters
// =============================================

export function detectLiftingState(ast: File): StateDetection[] {
  const detections: StateDetection[] = [];

  // Track setter functions from useState
  const setterNames = new Set<string>();

  traverse(ast, (node, parent) => {
    if (!isNodeType<{ callee?: { type?: string; name?: string } }>(node, "CallExpression")) return;
    const call = node as { callee?: { type?: string; name?: string } };
    if (call.callee?.type === "Identifier" && call.callee.name === "useState") {
      const parentTyped = parent as {
        type?: string;
        id?: { type?: string; elements?: Array<{ name?: string }> };
      };
      if (
        parentTyped?.type === "VariableDeclarator" &&
        parentTyped.id?.type === "ArrayPattern" &&
        parentTyped.id.elements?.[1]?.name
      ) {
        setterNames.add(parentTyped.id.elements[1].name);
      }
    }
  });

  // Check if setters are passed as JSX props
  let found = false;
  traverse(ast, (node) => {
    if (found) return;

    if (!isNodeType<{
      name?: { name?: string };
      value?: { type?: string; expression?: { name?: string; type?: string } };
    }>(node, "JSXAttribute")) return;

    const attr = node as {
      name?: { name?: string };
      value?: { type?: string; expression?: { name?: string; type?: string } };
    };

    if (
      attr.value?.type === "JSXExpressionContainer" &&
      attr.value.expression?.type === "Identifier" &&
      setterNames.has(attr.value.expression.name ?? "")
    ) {
      found = true;
      detections.push({
        topicSlug: "lifting-state",
        detected: true,
        isPositive: true,
        isNegative: false,
        isIdiomatic: true,
        location: getNodeLocation(node) ?? undefined,
        details: "State setter passed as prop - lifted state pattern",
      });
    }
  });

  return detections;
}

// =============================================
// loading-states: Detect loading state patterns
// =============================================

export function detectLoadingStates(ast: File): StateDetection[] {
  const detections: StateDetection[] = [];
  let found = false;

  traverse(ast, (node, parent) => {
    if (found) return;

    if (!isNodeType<{ callee?: { type?: string; name?: string } }>(node, "CallExpression")) return;
    const call = node as {
      callee?: { type?: string; name?: string };
      arguments?: Array<{ value?: boolean; type?: string }>;
    };

    if (call.callee?.type !== "Identifier" || call.callee.name !== "useState") return;

    const parentTyped = parent as {
      type?: string;
      id?: { type?: string; elements?: Array<{ name?: string }> };
    };

    if (parentTyped?.type !== "VariableDeclarator" || parentTyped.id?.type !== "ArrayPattern") return;

    const stateName = parentTyped.id.elements?.[0]?.name ?? "";
    const loadingNames = ["loading", "isLoading", "isFetching", "pending", "isPending"];

    if (loadingNames.includes(stateName)) {
      found = true;
      detections.push({
        topicSlug: "loading-states",
        detected: true,
        isPositive: true,
        isNegative: false,
        isIdiomatic: true,
        location: getNodeLocation(node) ?? undefined,
        details: `Loading state '${stateName}' tracked with useState`,
      });
    }
  });

  return detections;
}

// =============================================
// error-state-handling: Detect error state patterns
// =============================================

export function detectErrorStateHandling(ast: File): StateDetection[] {
  const detections: StateDetection[] = [];
  let found = false;

  traverse(ast, (node, parent) => {
    if (found) return;

    if (!isNodeType<{ callee?: { type?: string; name?: string } }>(node, "CallExpression")) return;
    const call = node as { callee?: { type?: string; name?: string } };

    if (call.callee?.type !== "Identifier" || call.callee.name !== "useState") return;

    const parentTyped = parent as {
      type?: string;
      id?: { type?: string; elements?: Array<{ name?: string }> };
    };

    if (parentTyped?.type !== "VariableDeclarator" || parentTyped.id?.type !== "ArrayPattern") return;

    const stateName = parentTyped.id.elements?.[0]?.name ?? "";
    const errorNames = ["error", "isError", "hasError", "errorMessage", "err"];

    if (errorNames.includes(stateName)) {
      found = true;
      detections.push({
        topicSlug: "error-state-handling",
        detected: true,
        isPositive: true,
        isNegative: false,
        isIdiomatic: true,
        location: getNodeLocation(node) ?? undefined,
        details: `Error state '${stateName}' tracked with useState`,
      });
    }
  });

  return detections;
}

// =============================================
// reducer-patterns: Detect switch/case in reducer functions
// =============================================

export function detectReducerPatterns(ast: File): StateDetection[] {
  const detections: StateDetection[] = [];

  traverse(ast, (node) => {
    // Look for functions that contain switch statements with action.type
    const isFn =
      isNodeType(node, "FunctionDeclaration") ||
      isNodeType(node, "FunctionExpression") ||
      isNodeType(node, "ArrowFunctionExpression");

    if (!isFn) return;

    const fn = node as {
      id?: { name?: string };
      params?: Array<{ name?: string; type?: string }>;
      body?: { type?: string; body?: unknown[] };
    };

    // Heuristic: function named *reducer* or *Reducer, or has (state, action) params
    const name = fn.id?.name ?? "";
    const isReducerName = /reducer/i.test(name);
    const hasReducerParams =
      fn.params?.length === 2 &&
      (fn.params[0]?.name === "state" || fn.params[1]?.name === "action");

    if (!isReducerName && !hasReducerParams) return;

    // Check for switch statement
    let hasSwitch = false;
    const checkForSwitch = (n: unknown): void => {
      if (!n || typeof n !== "object") return;
      const typed = n as Record<string, unknown>;
      if (typed.type === "SwitchStatement") {
        hasSwitch = true;
        return;
      }
      for (const key of Object.keys(typed)) {
        if (key === "loc" || key === "start" || key === "end") continue;
        const value = typed[key];
        if (Array.isArray(value)) value.forEach(checkForSwitch);
        else if (value && typeof value === "object") checkForSwitch(value);
      }
    };

    checkForSwitch(fn.body);

    if (hasSwitch) {
      detections.push({
        topicSlug: "reducer-patterns",
        detected: true,
        isPositive: true,
        isNegative: false,
        isIdiomatic: true,
        location: getNodeLocation(node) ?? undefined,
        details: "Reducer with switch/case action handling pattern",
      });
    }
  });

  return detections;
}

// =============================================
// complex-state: Detect useReducer with complex state objects
// =============================================

export function detectComplexState(ast: File): StateDetection[] {
  const detections: StateDetection[] = [];
  let found = false;

  traverse(ast, (node) => {
    if (found) return;

    if (!isNodeType<{
      callee?: { type?: string; name?: string };
      arguments?: Array<{ type?: string; properties?: unknown[] }>;
    }>(node, "CallExpression")) return;

    const call = node as {
      callee?: { type?: string; name?: string };
      arguments?: Array<{ type?: string; properties?: unknown[] }>;
    };

    if (call.callee?.type !== "Identifier" || call.callee.name !== "useReducer") return;

    // Check if initial state (2nd arg) is a complex object
    const initialState = call.arguments?.[1];
    if (
      initialState?.type === "ObjectExpression" &&
      (initialState.properties?.length ?? 0) >= 3
    ) {
      found = true;
      detections.push({
        topicSlug: "complex-state",
        detected: true,
        isPositive: true,
        isNegative: false,
        isIdiomatic: true,
        location: getNodeLocation(node) ?? undefined,
        details: "useReducer managing complex state object",
      });
    }
  });

  return detections;
}

// =============================================
// state-normalization: Detect normalized state structures (byId pattern)
// =============================================

export function detectStateNormalization(ast: File): StateDetection[] {
  const detections: StateDetection[] = [];
  let found = false;

  traverse(ast, (node) => {
    if (found) return;

    // Look for byId, allIds patterns in state/objects
    if (isNodeType<{
      properties?: Array<{ key?: { name?: string; type?: string } }>;
    }>(node, "ObjectExpression")) {
      const obj = node as {
        properties?: Array<{ key?: { name?: string; type?: string } }>;
      };

      const propNames = obj.properties
        ?.filter((p) => p.key?.type === "Identifier")
        .map((p) => p.key?.name ?? "")
        ?? [];

      const hasById = propNames.some((n) => /byId/i.test(n) || /ById/i.test(n));
      const hasAllIds = propNames.some((n) => /allIds/i.test(n) || /AllIds/i.test(n));
      const hasEntities = propNames.some((n) => /entities/i.test(n));

      if ((hasById && hasAllIds) || hasEntities) {
        found = true;
        detections.push({
          topicSlug: "state-normalization",
          detected: true,
          isPositive: true,
          isNegative: false,
          isIdiomatic: true,
          location: getNodeLocation(node) ?? undefined,
          details: "Normalized state structure detected (byId/allIds or entities pattern)",
        });
      }
    }
  });

  return detections;
}

// =============================================
// Main Detector Function
// =============================================

export function detectStatePatterns(ast: File): StateDetection[] {
  return [
    ...detectStateImmutability(ast),
    ...detectLiftingState(ast),
    ...detectLoadingStates(ast),
    ...detectErrorStateHandling(ast),
    ...detectReducerPatterns(ast),
    ...detectComplexState(ast),
    ...detectStateNormalization(ast),
  ];
}
