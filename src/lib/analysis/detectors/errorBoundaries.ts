// =============================================
// Error Boundary & Retry Logic Detectors
// Detects: error-boundary-basics, error-boundary-fallback,
//          error-boundary-recovery, retry-logic
// =============================================

import type { File } from "@babel/types";
import { traverse, getNodeLocation, isNodeType } from "../parser";

export interface ErrorBoundaryDetection {
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
// error-boundary-basics: Detect error boundary class components
// =============================================

export function detectErrorBoundaryBasics(ast: File): ErrorBoundaryDetection[] {
  const detections: ErrorBoundaryDetection[] = [];

  traverse(ast, (node) => {
    if (!isNodeType<{
      superClass?: { name?: string; type?: string };
      body?: {
        body?: Array<{
          type?: string;
          key?: { name?: string };
          kind?: string;
        }>;
      };
    }>(node, "ClassDeclaration")) return;

    const cls = node as {
      id?: { name?: string };
      superClass?: { name?: string; type?: string; property?: { name?: string } };
      body?: {
        body?: Array<{
          type?: string;
          key?: { name?: string };
          kind?: string;
        }>;
      };
    };

    // Check if extends React.Component or Component
    const extendsComponent =
      cls.superClass?.name === "Component" ||
      cls.superClass?.name === "PureComponent" ||
      cls.superClass?.property?.name === "Component";

    if (!extendsComponent) return;

    // Check for componentDidCatch or getDerivedStateFromError
    const methods = cls.body?.body ?? [];
    const hasComponentDidCatch = methods.some(
      (m) => m.type === "ClassMethod" && m.key?.name === "componentDidCatch"
    );
    const hasDerivedStateFromError = methods.some(
      (m) =>
        (m.type === "ClassMethod" || m.type === "ClassProperty") &&
        m.key?.name === "getDerivedStateFromError"
    );

    if (hasComponentDidCatch || hasDerivedStateFromError) {
      detections.push({
        topicSlug: "error-boundary-basics",
        detected: true,
        isPositive: true,
        isNegative: false,
        isIdiomatic: true,
        location: getNodeLocation(node) ?? undefined,
        details: `Error boundary class${cls.id?.name ? ` '${cls.id.name}'` : ""} with ${hasComponentDidCatch ? "componentDidCatch" : "getDerivedStateFromError"}`,
      });
    }
  });

  // Also detect common error boundary library patterns
  let foundLibrary = false;
  traverse(ast, (node) => {
    if (foundLibrary) return;

    if (isNodeType<{ source?: { value?: string } }>(node, "ImportDeclaration")) {
      const imp = node as { source?: { value?: string } };
      if (imp.source?.value === "react-error-boundary") {
        foundLibrary = true;
        detections.push({
          topicSlug: "error-boundary-basics",
          detected: true,
          isPositive: true,
          isNegative: false,
          isIdiomatic: true,
          location: getNodeLocation(node) ?? undefined,
          details: "react-error-boundary library used",
        });
      }
    }
  });

  return detections;
}

// =============================================
// error-boundary-fallback: Detect fallback UI in error boundaries
// =============================================

export function detectErrorBoundaryFallback(ast: File): ErrorBoundaryDetection[] {
  const detections: ErrorBoundaryDetection[] = [];
  let found = false;

  traverse(ast, (node) => {
    if (found) return;

    // Check for ErrorBoundary component with fallback prop
    if (isNodeType<{
      openingElement?: {
        name?: { name?: string };
        attributes?: Array<{
          type?: string;
          name?: { name?: string };
        }>;
      };
    }>(node, "JSXElement")) {
      const jsx = node as {
        openingElement?: {
          name?: { name?: string };
          attributes?: Array<{
            type?: string;
            name?: { name?: string };
          }>;
        };
      };

      const name = jsx.openingElement?.name?.name;
      if (name && /ErrorBoundary/i.test(name)) {
        const hasFallback = jsx.openingElement?.attributes?.some(
          (a) =>
            a.type === "JSXAttribute" &&
            (a.name?.name === "fallback" ||
              a.name?.name === "FallbackComponent" ||
              a.name?.name === "fallbackRender")
        );

        if (hasFallback) {
          found = true;
          detections.push({
            topicSlug: "error-boundary-fallback",
            detected: true,
            isPositive: true,
            isNegative: false,
            isIdiomatic: true,
            location: getNodeLocation(node) ?? undefined,
            details: "Error boundary with fallback UI",
          });
        }
      }
    }

    // Check for hasError state in render method (class-based pattern)
    if (isNodeType<{
      test?: {
        type?: string;
        object?: { type?: string; property?: { name?: string }; object?: unknown };
        property?: { name?: string };
      };
    }>(node, "IfStatement")) {
      const ifStmt = node as {
        test?: {
          type?: string;
          object?: unknown;
          property?: { name?: string };
        };
      };

      if (
        ifStmt.test?.type === "MemberExpression" &&
        ifStmt.test.property?.name === "hasError"
      ) {
        found = true;
        detections.push({
          topicSlug: "error-boundary-fallback",
          detected: true,
          isPositive: true,
          isNegative: false,
          isIdiomatic: true,
          location: getNodeLocation(node) ?? undefined,
          details: "Error boundary renders fallback when hasError is true",
        });
      }
    }
  });

  return detections;
}

// =============================================
// error-boundary-recovery: Detect retry/recovery mechanisms
// =============================================

export function detectErrorBoundaryRecovery(ast: File): ErrorBoundaryDetection[] {
  const detections: ErrorBoundaryDetection[] = [];
  let found = false;

  traverse(ast, (node) => {
    if (found) return;

    // Check for resetErrorBoundary or reset props/functions
    if (isNodeType<{
      callee?: { type?: string; name?: string };
    }>(node, "CallExpression")) {
      const call = node as { callee?: { type?: string; name?: string } };
      if (
        call.callee?.type === "Identifier" &&
        (call.callee.name === "resetErrorBoundary" ||
          call.callee.name === "resetError" ||
          call.callee.name === "retry")
      ) {
        found = true;
        detections.push({
          topicSlug: "error-boundary-recovery",
          detected: true,
          isPositive: true,
          isNegative: false,
          isIdiomatic: true,
          location: getNodeLocation(node) ?? undefined,
          details: "Error recovery mechanism with reset/retry function",
        });
      }
    }

    // Check for ErrorBoundary with onReset prop
    if (isNodeType<{
      openingElement?: {
        name?: { name?: string };
        attributes?: Array<{
          type?: string;
          name?: { name?: string };
        }>;
      };
    }>(node, "JSXElement")) {
      const jsx = node as {
        openingElement?: {
          name?: { name?: string };
          attributes?: Array<{
            type?: string;
            name?: { name?: string };
          }>;
        };
      };

      const name = jsx.openingElement?.name?.name;
      if (name && /ErrorBoundary/i.test(name)) {
        const hasReset = jsx.openingElement?.attributes?.some(
          (a) =>
            a.type === "JSXAttribute" &&
            (a.name?.name === "onReset" || a.name?.name === "resetKeys")
        );

        if (hasReset) {
          found = true;
          detections.push({
            topicSlug: "error-boundary-recovery",
            detected: true,
            isPositive: true,
            isNegative: false,
            isIdiomatic: true,
            location: getNodeLocation(node) ?? undefined,
            details: "Error boundary with recovery/reset capability",
          });
        }
      }
    }
  });

  return detections;
}

// =============================================
// retry-logic: Detect retry patterns
// =============================================

export function detectRetryLogic(ast: File): ErrorBoundaryDetection[] {
  const detections: ErrorBoundaryDetection[] = [];
  let found = false;

  traverse(ast, (node) => {
    if (found) return;

    // Look for retry patterns:
    // 1. Functions named retry/retryFetch/fetchWithRetry
    if (isNodeType<{ id?: { name?: string } }>(node, "FunctionDeclaration")) {
      const fn = node as { id?: { name?: string } };
      if (fn.id?.name && /retry/i.test(fn.id.name)) {
        found = true;
        detections.push({
          topicSlug: "retry-logic",
          detected: true,
          isPositive: true,
          isNegative: false,
          isIdiomatic: true,
          location: getNodeLocation(node) ?? undefined,
          details: `Retry logic in function '${fn.id.name}'`,
        });
        return;
      }
    }

    // 2. Variables named with retry
    if (isNodeType<{ id?: { name?: string } }>(node, "VariableDeclarator")) {
      const decl = node as { id?: { name?: string } };
      if (decl.id?.name && /retry/i.test(decl.id.name)) {
        found = true;
        detections.push({
          topicSlug: "retry-logic",
          detected: true,
          isPositive: true,
          isNegative: false,
          isIdiomatic: true,
          location: getNodeLocation(node) ?? undefined,
          details: `Retry logic with '${decl.id.name}'`,
        });
        return;
      }
    }

    // 3. While/for loops with try-catch inside and delay (exponential backoff pattern)
    if (
      isNodeType(node, "WhileStatement") ||
      isNodeType(node, "ForStatement")
    ) {
      let hasTryCatch = false;
      let hasAwait = false;

      const check = (n: unknown): void => {
        if (!n || typeof n !== "object") return;
        const typed = n as Record<string, unknown>;
        if (typed.type === "TryStatement") hasTryCatch = true;
        if (typed.type === "AwaitExpression") hasAwait = true;
        for (const key of Object.keys(typed)) {
          if (key === "loc" || key === "start" || key === "end") continue;
          const value = typed[key];
          if (Array.isArray(value)) value.forEach(check);
          else if (value && typeof value === "object") check(value);
        }
      };

      check(node);

      if (hasTryCatch && hasAwait) {
        found = true;
        detections.push({
          topicSlug: "retry-logic",
          detected: true,
          isPositive: true,
          isNegative: false,
          isIdiomatic: true,
          location: getNodeLocation(node) ?? undefined,
          details: "Retry loop with try-catch and async operations",
        });
      }
    }
  });

  return detections;
}

// =============================================
// Main Detector Function
// =============================================

export function detectErrorBoundaries(ast: File): ErrorBoundaryDetection[] {
  return [
    ...detectErrorBoundaryBasics(ast),
    ...detectErrorBoundaryFallback(ast),
    ...detectErrorBoundaryRecovery(ast),
    ...detectRetryLogic(ast),
  ];
}
