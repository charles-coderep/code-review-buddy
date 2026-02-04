// =============================================
// React Hooks Detectors
// Detects: useState, useEffect, useRef, useContext, useMemo, useCallback, useReducer
// =============================================

import type { File } from "@babel/types";
import { traverse, getNodeLocation, isNodeType } from "../parser";

export interface ReactHookDetection {
  topicSlug: string;
  detected: boolean;
  isPositive: boolean;
  isNegative: boolean;
  isIdiomatic: boolean;
  isTrivial?: boolean;
  location?: { line: number; column: number };
  details?: string;
}

interface CallExpressionNode {
  type: "CallExpression";
  callee: { type: string; name?: string };
  arguments: unknown[];
  loc?: { start: { line: number; column: number } };
}

// =============================================
// useState Detectors
// =============================================

/**
 * Detect useState usage
 */
export function detectUseStateBasics(ast: File): ReactHookDetection[] {
  const detections: ReactHookDetection[] = [];

  traverse(ast, (node, parent) => {
    if (!isNodeType<CallExpressionNode>(node, "CallExpression")) return;

    const callee = (node as CallExpressionNode).callee;
    if (callee.type === "Identifier" && callee.name === "useState") {
      // Check if it's properly destructured
      const parentTyped = parent as { type?: string; id?: { type?: string; elements?: unknown[] } };
      const isDestructured =
        parentTyped?.type === "VariableDeclarator" &&
        parentTyped.id?.type === "ArrayPattern" &&
        (parentTyped.id.elements?.length ?? 0) >= 2;

      detections.push({
        topicSlug: "usestate-basics",
        detected: true,
        isPositive: true,
        isNegative: !isDestructured,
        isIdiomatic: isDestructured,
        location: getNodeLocation(node) ?? undefined,
        details: isDestructured
          ? "useState with proper array destructuring"
          : "useState should use array destructuring [state, setState]",
      });
    }
  });

  return detections;
}

/**
 * Detect useState functional updates
 */
export function detectUseStateFunctionalUpdates(ast: File): ReactHookDetection[] {
  const detections: ReactHookDetection[] = [];

  // Track setState functions from useState
  const setStateFunctions = new Set<string>();

  traverse(ast, (node, parent) => {
    // Find useState declarations to track setter names
    if (isNodeType<CallExpressionNode>(node, "CallExpression")) {
      const callee = (node as CallExpressionNode).callee;
      if (callee.type === "Identifier" && callee.name === "useState") {
        const parentTyped = parent as {
          type?: string;
          id?: { type?: string; elements?: Array<{ name?: string }> };
        };
        if (
          parentTyped?.type === "VariableDeclarator" &&
          parentTyped.id?.type === "ArrayPattern" &&
          parentTyped.id.elements?.[1]
        ) {
          const setterName = parentTyped.id.elements[1]?.name;
          if (setterName) {
            setStateFunctions.add(setterName);
          }
        }
      }
    }
  });

  // Now find calls to these setters
  traverse(ast, (node) => {
    if (!isNodeType<CallExpressionNode>(node, "CallExpression")) return;

    const callee = (node as CallExpressionNode).callee;
    if (callee.type === "Identifier" && setStateFunctions.has(callee.name ?? "")) {
      const args = (node as CallExpressionNode).arguments;
      const firstArg = args[0] as { type?: string } | undefined;

      // Check if using functional update pattern
      const isFunctionalUpdate =
        firstArg?.type === "ArrowFunctionExpression" ||
        firstArg?.type === "FunctionExpression";

      if (isFunctionalUpdate) {
        detections.push({
          topicSlug: "usestate-functional-updates",
          detected: true,
          isPositive: true,
          isNegative: false,
          isIdiomatic: true,
          location: getNodeLocation(node) ?? undefined,
          details: "Functional update pattern used for setState",
        });
      }
    }
  });

  return detections;
}

// =============================================
// useEffect Detectors
// =============================================

/**
 * Detect useEffect usage
 */
export function detectUseEffectBasics(ast: File): ReactHookDetection[] {
  const detections: ReactHookDetection[] = [];

  traverse(ast, (node) => {
    if (!isNodeType<CallExpressionNode>(node, "CallExpression")) return;

    const callee = (node as CallExpressionNode).callee;
    if (callee.type === "Identifier" && callee.name === "useEffect") {
      const args = (node as CallExpressionNode).arguments;
      const hasCallback = args.length > 0;
      const hasDeps = args.length >= 2;

      detections.push({
        topicSlug: "useeffect-basics",
        detected: true,
        isPositive: hasCallback,
        isNegative: !hasCallback,
        isIdiomatic: hasCallback && hasDeps,
        location: getNodeLocation(node) ?? undefined,
        details: hasDeps ? "useEffect with dependency array" : "useEffect without dependency array",
      });
    }
  });

  return detections;
}

/**
 * Detect useEffect dependencies issues
 */
export function detectUseEffectDependencies(ast: File): ReactHookDetection[] {
  const detections: ReactHookDetection[] = [];

  traverse(ast, (node) => {
    if (!isNodeType<CallExpressionNode>(node, "CallExpression")) return;

    const callee = (node as CallExpressionNode).callee;
    if (callee.type === "Identifier" && callee.name === "useEffect") {
      const args = (node as CallExpressionNode).arguments;

      if (args.length >= 2) {
        const depsArg = args[1] as { type?: string; elements?: unknown[] };

        if (depsArg?.type === "ArrayExpression") {
          const isEmpty = (depsArg.elements?.length ?? 0) === 0;

          detections.push({
            topicSlug: "useeffect-dependencies",
            detected: true,
            isPositive: true,
            isNegative: false,
            isIdiomatic: true,
            location: getNodeLocation(node) ?? undefined,
            details: isEmpty
              ? "Empty dependency array - runs once on mount"
              : `Dependency array with ${depsArg.elements?.length} dependencies`,
          });
        }
      } else if (args.length === 1) {
        // No dependency array - runs on every render
        detections.push({
          topicSlug: "useeffect-dependencies",
          detected: true,
          isPositive: false,
          isNegative: true,
          isIdiomatic: false,
          location: getNodeLocation(node) ?? undefined,
          details: "Missing dependency array - effect runs on every render",
        });
      }
    }
  });

  return detections;
}

/**
 * Detect useEffect cleanup functions
 */
export function detectUseEffectCleanup(ast: File): ReactHookDetection[] {
  const detections: ReactHookDetection[] = [];

  traverse(ast, (node) => {
    if (!isNodeType<CallExpressionNode>(node, "CallExpression")) return;

    const callee = (node as CallExpressionNode).callee;
    if (callee.type === "Identifier" && callee.name === "useEffect") {
      const args = (node as CallExpressionNode).arguments;
      const callback = args[0] as { body?: { body?: Array<{ type?: string }> } };

      // Check if callback returns a function (cleanup)
      let hasCleanup = false;
      if (callback?.body?.body) {
        for (const stmt of callback.body.body) {
          if (stmt.type === "ReturnStatement") {
            hasCleanup = true;
            break;
          }
        }
      }

      if (hasCleanup) {
        detections.push({
          topicSlug: "useeffect-cleanup",
          detected: true,
          isPositive: true,
          isNegative: false,
          isIdiomatic: true,
          location: getNodeLocation(node) ?? undefined,
          details: "useEffect with cleanup function",
        });
      }
    }
  });

  return detections;
}

// =============================================
// useRef Detectors
// =============================================

/**
 * Detect useRef usage
 */
export function detectUseRefBasics(ast: File): ReactHookDetection[] {
  const detections: ReactHookDetection[] = [];

  traverse(ast, (node) => {
    if (!isNodeType<CallExpressionNode>(node, "CallExpression")) return;

    const callee = (node as CallExpressionNode).callee;
    if (callee.type === "Identifier" && callee.name === "useRef") {
      detections.push({
        topicSlug: "useref-basics",
        detected: true,
        isPositive: true,
        isNegative: false,
        isIdiomatic: true,
        location: getNodeLocation(node) ?? undefined,
        details: "useRef hook used",
      });
    }
  });

  return detections;
}

// =============================================
// useMemo/useCallback Detectors
// =============================================

/**
 * Detect useMemo usage
 */
export function detectUseMemoBasics(ast: File): ReactHookDetection[] {
  const detections: ReactHookDetection[] = [];

  traverse(ast, (node) => {
    if (!isNodeType<CallExpressionNode>(node, "CallExpression")) return;

    const callee = (node as CallExpressionNode).callee;
    if (callee.type === "Identifier" && callee.name === "useMemo") {
      const args = (node as CallExpressionNode).arguments;
      const hasDeps = args.length >= 2;

      detections.push({
        topicSlug: "usememo-basics",
        detected: true,
        isPositive: hasDeps,
        isNegative: !hasDeps,
        isIdiomatic: hasDeps,
        location: getNodeLocation(node) ?? undefined,
        details: hasDeps
          ? "useMemo with dependency array"
          : "useMemo missing dependency array",
      });
    }
  });

  return detections;
}

/**
 * Detect useCallback usage
 */
export function detectUseCallbackBasics(ast: File): ReactHookDetection[] {
  const detections: ReactHookDetection[] = [];

  traverse(ast, (node) => {
    if (!isNodeType<CallExpressionNode>(node, "CallExpression")) return;

    const callee = (node as CallExpressionNode).callee;
    if (callee.type === "Identifier" && callee.name === "useCallback") {
      const args = (node as CallExpressionNode).arguments;
      const hasDeps = args.length >= 2;

      detections.push({
        topicSlug: "usecallback-basics",
        detected: true,
        isPositive: hasDeps,
        isNegative: !hasDeps,
        isIdiomatic: hasDeps,
        location: getNodeLocation(node) ?? undefined,
        details: hasDeps
          ? "useCallback with dependency array"
          : "useCallback missing dependency array",
      });
    }
  });

  return detections;
}

// =============================================
// useReducer Detectors
// =============================================

/**
 * Detect useReducer usage
 */
export function detectUseReducerBasics(ast: File): ReactHookDetection[] {
  const detections: ReactHookDetection[] = [];

  traverse(ast, (node) => {
    if (!isNodeType<CallExpressionNode>(node, "CallExpression")) return;

    const callee = (node as CallExpressionNode).callee;
    if (callee.type === "Identifier" && callee.name === "useReducer") {
      const args = (node as CallExpressionNode).arguments;
      const hasReducer = args.length >= 1;
      const hasInitialState = args.length >= 2;

      detections.push({
        topicSlug: "usereducer-basics",
        detected: true,
        isPositive: hasReducer && hasInitialState,
        isNegative: !hasReducer || !hasInitialState,
        isIdiomatic: hasReducer && hasInitialState,
        location: getNodeLocation(node) ?? undefined,
        details: "useReducer for complex state management",
      });
    }
  });

  return detections;
}

// =============================================
// useContext Detectors
// =============================================

/**
 * Detect useContext usage
 */
export function detectUseContextHook(ast: File): ReactHookDetection[] {
  const detections: ReactHookDetection[] = [];

  traverse(ast, (node) => {
    if (!isNodeType<CallExpressionNode>(node, "CallExpression")) return;

    const callee = (node as CallExpressionNode).callee;
    if (callee.type === "Identifier" && callee.name === "useContext") {
      detections.push({
        topicSlug: "usecontext-hook",
        detected: true,
        isPositive: true,
        isNegative: false,
        isIdiomatic: true,
        location: getNodeLocation(node) ?? undefined,
        details: "useContext hook for consuming context",
      });
    }
  });

  return detections;
}

// =============================================
// Custom Hook Detectors
// =============================================

/**
 * Detect custom hook definitions
 */
export function detectCustomHookBasics(ast: File): ReactHookDetection[] {
  const detections: ReactHookDetection[] = [];

  traverse(ast, (node) => {
    const checkFunctionName = (name: string | undefined, loc: { line: number; column: number } | null) => {
      if (name && /^use[A-Z]/.test(name)) {
        detections.push({
          topicSlug: "custom-hook-basics",
          detected: true,
          isPositive: true,
          isNegative: false,
          isIdiomatic: true,
          location: loc ?? undefined,
          details: `Custom hook ${name} defined`,
        });
      }
    };

    if (isNodeType<{ id?: { name?: string } }>(node, "FunctionDeclaration")) {
      checkFunctionName(
        (node as { id?: { name?: string } }).id?.name,
        getNodeLocation(node)
      );
    }

    // Arrow function assigned to const
    if (isNodeType<{ id?: { name?: string }; init?: { type?: string } }>(node, "VariableDeclarator")) {
      const nodeTyped = node as { id?: { name?: string }; init?: { type?: string } };
      if (
        nodeTyped.init?.type === "ArrowFunctionExpression" ||
        nodeTyped.init?.type === "FunctionExpression"
      ) {
        checkFunctionName(nodeTyped.id?.name, getNodeLocation(node));
      }
    }
  });

  return detections;
}

// =============================================
// Main Detector Function
// =============================================

/**
 * Run all React hooks detectors
 */
export function detectReactHooks(ast: File): ReactHookDetection[] {
  return [
    ...detectUseStateBasics(ast),
    ...detectUseStateFunctionalUpdates(ast),
    ...detectUseEffectBasics(ast),
    ...detectUseEffectDependencies(ast),
    ...detectUseEffectCleanup(ast),
    ...detectUseRefBasics(ast),
    ...detectUseMemoBasics(ast),
    ...detectUseCallbackBasics(ast),
    ...detectUseReducerBasics(ast),
    ...detectUseContextHook(ast),
    ...detectCustomHookBasics(ast),
  ];
}
