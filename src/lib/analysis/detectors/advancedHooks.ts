// =============================================
// Advanced React Hooks Detectors
// Detects: useeffect-async, useeffect-infinite-loop, useref-dom,
//          useref-mutable, callback-refs, custom-hook-parameters,
//          custom-hook-return, custom-hook-composition
// =============================================

import type { File } from "@babel/types";
import { traverse, getNodeLocation, isNodeType } from "../parser";

export interface AdvancedHookDetection {
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
  callee: { type: string; name?: string; property?: { name?: string } };
  arguments: unknown[];
  loc?: { start: { line: number; column: number } };
}

// =============================================
// useeffect-async: Detect async callback in useEffect (anti-pattern)
// =============================================

export function detectUseEffectAsync(ast: File): AdvancedHookDetection[] {
  const detections: AdvancedHookDetection[] = [];

  traverse(ast, (node) => {
    if (!isNodeType<CallExpressionNode>(node, "CallExpression")) return;

    const call = node as CallExpressionNode;
    if (call.callee.type !== "Identifier" || call.callee.name !== "useEffect") return;

    const callback = call.arguments[0] as { type?: string; async?: boolean } | undefined;

    if (callback?.async) {
      detections.push({
        topicSlug: "useeffect-async",
        detected: true,
        isPositive: false,
        isNegative: true,
        isIdiomatic: false,
        location: getNodeLocation(node) ?? undefined,
        details: "async function passed directly to useEffect - define async function inside and call it",
      });
    } else if (callback && !callback.async) {
      // Check if callback body contains an async IIFE or defines and calls an async function
      const hasInternalAsync = checkForInternalAsync(callback);
      if (hasInternalAsync) {
        detections.push({
          topicSlug: "useeffect-async",
          detected: true,
          isPositive: true,
          isNegative: false,
          isIdiomatic: true,
          location: getNodeLocation(node) ?? undefined,
          details: "Async logic properly wrapped inside useEffect callback",
        });
      }
    }
  });

  return detections;
}

function checkForInternalAsync(node: unknown): boolean {
  if (!node || typeof node !== "object") return false;
  const n = node as Record<string, unknown>;

  // Look for async function declarations/expressions inside the callback
  if (
    (n.type === "FunctionDeclaration" ||
      n.type === "FunctionExpression" ||
      n.type === "ArrowFunctionExpression") &&
    n.async === true
  ) {
    return true;
  }

  for (const key of Object.keys(n)) {
    if (key === "loc" || key === "start" || key === "end") continue;
    const value = n[key];
    if (Array.isArray(value)) {
      for (const item of value) {
        if (checkForInternalAsync(item)) return true;
      }
    } else if (value && typeof value === "object") {
      if (checkForInternalAsync(value)) return true;
    }
  }

  return false;
}

// =============================================
// useeffect-infinite-loop: Detect potential infinite loop triggers
// =============================================

export function detectUseEffectInfiniteLoop(ast: File): AdvancedHookDetection[] {
  const detections: AdvancedHookDetection[] = [];

  // Track setState calls from useState
  const setStateFunctions = new Set<string>();

  traverse(ast, (node, parent) => {
    if (!isNodeType<CallExpressionNode>(node, "CallExpression")) return;
    const call = node as CallExpressionNode;

    if (call.callee.type === "Identifier" && call.callee.name === "useState") {
      const parentTyped = parent as {
        type?: string;
        id?: { type?: string; elements?: Array<{ name?: string }> };
      };
      if (
        parentTyped?.type === "VariableDeclarator" &&
        parentTyped.id?.type === "ArrayPattern" &&
        parentTyped.id.elements?.[1]?.name
      ) {
        setStateFunctions.add(parentTyped.id.elements[1].name);
      }
    }
  });

  // Now find useEffect calls that set state without proper deps
  traverse(ast, (node) => {
    if (!isNodeType<CallExpressionNode>(node, "CallExpression")) return;
    const call = node as CallExpressionNode;

    if (call.callee.type !== "Identifier" || call.callee.name !== "useEffect") return;

    const callback = call.arguments[0];
    const deps = call.arguments[1] as { type?: string; elements?: unknown[] } | undefined;

    // No dependency array = runs every render
    if (!deps) {
      // Check if callback calls setState
      let callsSetState = false;
      const checkSetState = (n: unknown): void => {
        if (!n || typeof n !== "object") return;
        const typed = n as Record<string, unknown>;
        if (
          typed.type === "CallExpression" &&
          (typed.callee as { name?: string })?.name &&
          setStateFunctions.has((typed.callee as { name?: string }).name!)
        ) {
          callsSetState = true;
        }
        for (const key of Object.keys(typed)) {
          if (key === "loc" || key === "start" || key === "end") continue;
          const value = typed[key];
          if (Array.isArray(value)) value.forEach(checkSetState);
          else if (value && typeof value === "object") checkSetState(value);
        }
      };

      checkSetState(callback);

      if (callsSetState) {
        detections.push({
          topicSlug: "useeffect-infinite-loop",
          detected: true,
          isPositive: false,
          isNegative: true,
          isIdiomatic: false,
          location: getNodeLocation(node) ?? undefined,
          details: "useEffect sets state without dependency array - potential infinite loop",
        });
      }
    }
  });

  return detections;
}

// =============================================
// useref-dom: Detect ref attribute on DOM elements
// =============================================

export function detectUseRefDom(ast: File): AdvancedHookDetection[] {
  const detections: AdvancedHookDetection[] = [];
  let found = false;

  traverse(ast, (node) => {
    if (found) return;

    if (!isNodeType<{
      type: string;
      name?: { name?: string };
      value?: { type?: string };
    }>(node, "JSXAttribute")) return;

    const attr = node as { name?: { name?: string }; value?: { type?: string } };

    if (attr.name?.name === "ref") {
      found = true;
      detections.push({
        topicSlug: "useref-dom",
        detected: true,
        isPositive: true,
        isNegative: false,
        isIdiomatic: true,
        location: getNodeLocation(node) ?? undefined,
        details: "ref attribute used on DOM element",
      });
    }
  });

  return detections;
}

// =============================================
// useref-mutable: Detect .current assignments
// =============================================

export function detectUseRefMutable(ast: File): AdvancedHookDetection[] {
  const detections: AdvancedHookDetection[] = [];
  let found = false;

  traverse(ast, (node) => {
    if (found) return;

    if (!isNodeType<{
      type: string;
      left?: { type?: string; property?: { name?: string } };
    }>(node, "AssignmentExpression")) return;

    const assign = node as {
      left?: { type?: string; property?: { name?: string } };
    };

    if (
      assign.left?.type === "MemberExpression" &&
      assign.left.property?.name === "current"
    ) {
      found = true;
      detections.push({
        topicSlug: "useref-mutable",
        detected: true,
        isPositive: true,
        isNegative: false,
        isIdiomatic: true,
        location: getNodeLocation(node) ?? undefined,
        details: "Mutable ref value updated via .current assignment",
      });
    }
  });

  return detections;
}

// =============================================
// callback-refs: Detect callback-style refs
// =============================================

export function detectCallbackRefs(ast: File): AdvancedHookDetection[] {
  const detections: AdvancedHookDetection[] = [];
  let found = false;

  traverse(ast, (node) => {
    if (found) return;

    if (!isNodeType<{
      type: string;
      name?: { name?: string };
      value?: { type?: string; expression?: { type?: string } };
    }>(node, "JSXAttribute")) return;

    const attr = node as {
      name?: { name?: string };
      value?: { type?: string; expression?: { type?: string } };
    };

    if (attr.name?.name === "ref" && attr.value?.type === "JSXExpressionContainer") {
      const expr = attr.value.expression;
      if (
        expr?.type === "ArrowFunctionExpression" ||
        expr?.type === "FunctionExpression"
      ) {
        found = true;
        detections.push({
          topicSlug: "callback-refs",
          detected: true,
          isPositive: true,
          isNegative: false,
          isIdiomatic: true,
          location: getNodeLocation(node) ?? undefined,
          details: "Callback ref pattern used",
        });
      }
    }
  });

  return detections;
}

// =============================================
// custom-hook-parameters: Custom hooks that accept parameters
// =============================================

export function detectCustomHookParameters(ast: File): AdvancedHookDetection[] {
  const detections: AdvancedHookDetection[] = [];

  traverse(ast, (node) => {
    // Check function declarations with use* name
    if (isNodeType<{
      type: string;
      id?: { name?: string };
      params?: unknown[];
    }>(node, "FunctionDeclaration")) {
      const fn = node as { id?: { name?: string }; params?: unknown[] };
      if (
        fn.id?.name &&
        /^use[A-Z]/.test(fn.id.name) &&
        (fn.params?.length ?? 0) > 0
      ) {
        detections.push({
          topicSlug: "custom-hook-parameters",
          detected: true,
          isPositive: true,
          isNegative: false,
          isIdiomatic: true,
          location: getNodeLocation(node) ?? undefined,
          details: `Custom hook ${fn.id.name} accepts parameters`,
        });
      }
    }

    // Check arrow functions assigned to const with use* name
    if (isNodeType<{
      type: string;
      id?: { name?: string };
      init?: { type?: string; params?: unknown[] };
    }>(node, "VariableDeclarator")) {
      const decl = node as {
        id?: { name?: string };
        init?: { type?: string; params?: unknown[] };
      };
      if (
        decl.id?.name &&
        /^use[A-Z]/.test(decl.id.name) &&
        (decl.init?.type === "ArrowFunctionExpression" ||
          decl.init?.type === "FunctionExpression") &&
        (decl.init.params?.length ?? 0) > 0
      ) {
        detections.push({
          topicSlug: "custom-hook-parameters",
          detected: true,
          isPositive: true,
          isNegative: false,
          isIdiomatic: true,
          location: getNodeLocation(node) ?? undefined,
          details: `Custom hook ${decl.id.name} accepts parameters`,
        });
      }
    }
  });

  return detections;
}

// =============================================
// custom-hook-return: Custom hooks returning values
// =============================================

export function detectCustomHookReturn(ast: File): AdvancedHookDetection[] {
  const detections: AdvancedHookDetection[] = [];

  const checkHookBody = (name: string, body: unknown, loc: { line: number; column: number } | null) => {
    if (!body || typeof body !== "object") return;
    const b = body as { type?: string; body?: Array<{ type?: string; argument?: unknown }> };

    if (b.type !== "BlockStatement" || !b.body) return;

    for (const stmt of b.body) {
      if (stmt.type === "ReturnStatement" && stmt.argument) {
        detections.push({
          topicSlug: "custom-hook-return",
          detected: true,
          isPositive: true,
          isNegative: false,
          isIdiomatic: true,
          location: loc ?? undefined,
          details: `Custom hook ${name} returns values`,
        });
        return;
      }
    }
  };

  traverse(ast, (node) => {
    if (isNodeType<{ type: string; id?: { name?: string }; body?: unknown }>(node, "FunctionDeclaration")) {
      const fn = node as { id?: { name?: string }; body?: unknown };
      if (fn.id?.name && /^use[A-Z]/.test(fn.id.name)) {
        checkHookBody(fn.id.name, fn.body, getNodeLocation(node));
      }
    }

    if (isNodeType<{
      type: string;
      id?: { name?: string };
      init?: { type?: string; body?: unknown };
    }>(node, "VariableDeclarator")) {
      const decl = node as {
        id?: { name?: string };
        init?: { type?: string; body?: unknown };
      };
      if (
        decl.id?.name &&
        /^use[A-Z]/.test(decl.id.name) &&
        (decl.init?.type === "ArrowFunctionExpression" ||
          decl.init?.type === "FunctionExpression")
      ) {
        checkHookBody(decl.id.name, decl.init.body, getNodeLocation(node));
      }
    }
  });

  return detections;
}

// =============================================
// custom-hook-composition: Custom hooks using other hooks
// =============================================

export function detectCustomHookComposition(ast: File): AdvancedHookDetection[] {
  const detections: AdvancedHookDetection[] = [];

  const checkHookBody = (name: string, body: unknown, loc: { line: number; column: number } | null) => {
    if (!body || typeof body !== "object") return;

    let usesHooks = false;
    const check = (n: unknown): void => {
      if (!n || typeof n !== "object") return;
      const typed = n as Record<string, unknown>;

      if (typed.type === "CallExpression") {
        const callee = typed.callee as { type?: string; name?: string };
        if (callee?.type === "Identifier" && callee.name && /^use[A-Z]/.test(callee.name)) {
          usesHooks = true;
        }
      }

      // Don't recurse into nested functions
      if (
        typed.type === "FunctionDeclaration" ||
        typed.type === "FunctionExpression" ||
        typed.type === "ArrowFunctionExpression"
      ) {
        return;
      }

      for (const key of Object.keys(typed)) {
        if (key === "loc" || key === "start" || key === "end") continue;
        const value = typed[key];
        if (Array.isArray(value)) value.forEach(check);
        else if (value && typeof value === "object") check(value);
      }
    };

    check(body);

    if (usesHooks) {
      detections.push({
        topicSlug: "custom-hook-composition",
        detected: true,
        isPositive: true,
        isNegative: false,
        isIdiomatic: true,
        location: loc ?? undefined,
        details: `Custom hook ${name} composes other hooks`,
      });
    }
  };

  traverse(ast, (node) => {
    if (isNodeType<{ type: string; id?: { name?: string }; body?: unknown }>(node, "FunctionDeclaration")) {
      const fn = node as { id?: { name?: string }; body?: unknown };
      if (fn.id?.name && /^use[A-Z]/.test(fn.id.name)) {
        checkHookBody(fn.id.name, fn.body, getNodeLocation(node));
      }
    }

    if (isNodeType<{
      type: string;
      id?: { name?: string };
      init?: { type?: string; body?: unknown };
    }>(node, "VariableDeclarator")) {
      const decl = node as {
        id?: { name?: string };
        init?: { type?: string; body?: unknown };
      };
      if (
        decl.id?.name &&
        /^use[A-Z]/.test(decl.id.name) &&
        (decl.init?.type === "ArrowFunctionExpression" ||
          decl.init?.type === "FunctionExpression")
      ) {
        checkHookBody(decl.id.name, decl.init.body, getNodeLocation(node));
      }
    }
  });

  return detections;
}

// =============================================
// Main Detector Function
// =============================================

export function detectAdvancedHooks(ast: File): AdvancedHookDetection[] {
  return [
    ...detectUseEffectAsync(ast),
    ...detectUseEffectInfiniteLoop(ast),
    ...detectUseRefDom(ast),
    ...detectUseRefMutable(ast),
    ...detectCallbackRefs(ast),
    ...detectCustomHookParameters(ast),
    ...detectCustomHookReturn(ast),
    ...detectCustomHookComposition(ast),
  ];
}
