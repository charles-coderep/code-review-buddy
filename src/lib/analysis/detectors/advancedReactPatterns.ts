// =============================================
// Advanced React Pattern Detectors
// Detects: context-basics, context-provider, context-performance,
//          react-memo, key-optimization, unnecessary-rerenders
// =============================================

import type { File } from "@babel/types";
import { traverse, getNodeLocation, isNodeType } from "../parser";

export interface AdvancedReactDetection {
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
// context-basics: Detect React.createContext
// =============================================

export function detectContextBasics(ast: File): AdvancedReactDetection[] {
  const detections: AdvancedReactDetection[] = [];
  let found = false;

  traverse(ast, (node) => {
    if (found) return;

    if (!isNodeType<{
      callee?: {
        type?: string;
        name?: string;
        object?: { name?: string };
        property?: { name?: string };
      };
    }>(node, "CallExpression")) return;

    const call = node as {
      callee?: {
        type?: string;
        name?: string;
        object?: { name?: string };
        property?: { name?: string };
      };
    };

    // createContext() or React.createContext()
    const isCreateContext =
      (call.callee?.type === "Identifier" && call.callee.name === "createContext") ||
      (call.callee?.type === "MemberExpression" &&
        call.callee.object?.name === "React" &&
        call.callee.property?.name === "createContext");

    if (isCreateContext) {
      found = true;
      detections.push({
        topicSlug: "context-basics",
        detected: true,
        isPositive: true,
        isNegative: false,
        isIdiomatic: true,
        location: getNodeLocation(node) ?? undefined,
        details: "React Context created with createContext()",
      });
    }
  });

  return detections;
}

// =============================================
// context-provider: Detect Provider components
// =============================================

export function detectContextProvider(ast: File): AdvancedReactDetection[] {
  const detections: AdvancedReactDetection[] = [];
  let found = false;

  traverse(ast, (node) => {
    if (found) return;

    if (!isNodeType<{
      openingElement?: {
        name?: { type?: string; object?: { name?: string }; property?: { name?: string } };
      };
    }>(node, "JSXElement")) return;

    const jsx = node as {
      openingElement?: {
        name?: {
          type?: string;
          name?: string;
          object?: { name?: string };
          property?: { name?: string };
        };
      };
    };

    const elementName = jsx.openingElement?.name;

    // Check for *.Provider pattern
    const isProvider =
      (elementName?.type === "JSXMemberExpression" &&
        elementName.property?.name === "Provider") ||
      (elementName?.type === "JSXIdentifier" &&
        elementName.name &&
        /Provider$/.test(elementName.name));

    if (isProvider) {
      found = true;
      detections.push({
        topicSlug: "context-provider",
        detected: true,
        isPositive: true,
        isNegative: false,
        isIdiomatic: true,
        location: getNodeLocation(node) ?? undefined,
        details: "Context Provider component used",
      });
    }
  });

  return detections;
}

// =============================================
// context-performance: Detect useMemo in context providers
// =============================================

export function detectContextPerformance(ast: File): AdvancedReactDetection[] {
  const detections: AdvancedReactDetection[] = [];

  // Check if there's both a Provider and useMemo for the value prop
  let hasProvider = false;
  let hasMemoizedValue = false;

  traverse(ast, (node) => {
    // Find Provider elements
    if (isNodeType<{
      openingElement?: {
        name?: { type?: string; property?: { name?: string }; name?: string };
        attributes?: Array<{
          type?: string;
          name?: { name?: string };
          value?: { type?: string; expression?: { type?: string; name?: string } };
        }>;
      };
    }>(node, "JSXElement")) {
      const jsx = node as {
        openingElement?: {
          name?: { type?: string; property?: { name?: string }; name?: string };
          attributes?: Array<{
            type?: string;
            name?: { name?: string };
            value?: { type?: string; expression?: { type?: string; name?: string } };
          }>;
        };
      };

      const elementName = jsx.openingElement?.name;
      const isProvider =
        (elementName?.type === "JSXMemberExpression" &&
          elementName.property?.name === "Provider") ||
        (elementName?.type === "JSXIdentifier" &&
          elementName.name &&
          /Provider$/.test(elementName.name));

      if (isProvider) {
        hasProvider = true;
      }
    }

    // Find useMemo calls
    if (isNodeType<{
      callee?: { type?: string; name?: string };
    }>(node, "CallExpression")) {
      const call = node as { callee?: { type?: string; name?: string } };
      if (call.callee?.type === "Identifier" && call.callee.name === "useMemo") {
        hasMemoizedValue = true;
      }
    }
  });

  if (hasProvider && hasMemoizedValue) {
    detections.push({
      topicSlug: "context-performance",
      detected: true,
      isPositive: true,
      isNegative: false,
      isIdiomatic: true,
      details: "Context value memoized with useMemo to prevent unnecessary re-renders",
    });
  } else if (hasProvider && !hasMemoizedValue) {
    detections.push({
      topicSlug: "context-performance",
      detected: true,
      isPositive: false,
      isNegative: true,
      isIdiomatic: false,
      isTrivial: true,
      details: "Context Provider without memoized value - may cause unnecessary re-renders",
    });
  }

  return detections;
}

// =============================================
// react-memo: Detect React.memo usage
// =============================================

export function detectReactMemo(ast: File): AdvancedReactDetection[] {
  const detections: AdvancedReactDetection[] = [];
  let found = false;

  traverse(ast, (node) => {
    if (found) return;

    if (!isNodeType<{
      callee?: {
        type?: string;
        name?: string;
        object?: { name?: string };
        property?: { name?: string };
      };
    }>(node, "CallExpression")) return;

    const call = node as {
      callee?: {
        type?: string;
        name?: string;
        object?: { name?: string };
        property?: { name?: string };
      };
    };

    const isMemo =
      (call.callee?.type === "Identifier" && call.callee.name === "memo") ||
      (call.callee?.type === "MemberExpression" &&
        call.callee.object?.name === "React" &&
        call.callee.property?.name === "memo");

    if (isMemo) {
      found = true;
      detections.push({
        topicSlug: "react-memo",
        detected: true,
        isPositive: true,
        isNegative: false,
        isIdiomatic: true,
        location: getNodeLocation(node) ?? undefined,
        details: "React.memo() used to prevent unnecessary re-renders",
      });
    }
  });

  return detections;
}

// =============================================
// key-optimization: Detect key prop optimization patterns
// =============================================

export function detectKeyOptimization(ast: File): AdvancedReactDetection[] {
  const detections: AdvancedReactDetection[] = [];

  // Look for stable key generation patterns (e.g., using item.id, crypto.randomUUID avoidance)
  traverse(ast, (node) => {
    if (!isNodeType<{
      callee?: { type?: string; property?: { name?: string } };
      arguments?: unknown[];
    }>(node, "CallExpression")) return;

    const call = node as {
      callee?: { type?: string; property?: { name?: string } };
      arguments?: unknown[];
    };

    // Check for .map() calls returning JSX
    if (
      call.callee?.type !== "MemberExpression" ||
      call.callee.property?.name !== "map"
    ) return;

    const callback = call.arguments?.[0];
    if (!callback) return;

    // Look for JSX elements with computed/dynamic keys
    let hasStableKey = false;
    let hasUnstableKey = false;

    const checkKeys = (n: unknown): void => {
      if (!n || typeof n !== "object") return;
      const typed = n as Record<string, unknown>;

      if (typed.type === "JSXAttribute") {
        const attr = typed as {
          name?: { name?: string };
          value?: {
            type?: string;
            expression?: {
              type?: string;
              callee?: { property?: { name?: string }; object?: { name?: string } };
            };
          };
        };

        if (attr.name?.name === "key" && attr.value?.type === "JSXExpressionContainer") {
          const expr = attr.value.expression;
          // Check for Math.random() or Date.now() in keys (unstable)
          if (expr?.type === "CallExpression") {
            const calleeInner = expr.callee as {
              object?: { name?: string };
              property?: { name?: string };
            };
            if (
              (calleeInner?.object?.name === "Math" &&
                calleeInner?.property?.name === "random") ||
              (calleeInner?.object?.name === "Date" &&
                calleeInner?.property?.name === "now")
            ) {
              hasUnstableKey = true;
            }
          } else {
            hasStableKey = true;
          }
        }
      }

      for (const key of Object.keys(typed)) {
        if (key === "loc" || key === "start" || key === "end") continue;
        const value = typed[key];
        if (Array.isArray(value)) value.forEach(checkKeys);
        else if (value && typeof value === "object") checkKeys(value);
      }
    };

    checkKeys(callback);

    if (hasUnstableKey) {
      detections.push({
        topicSlug: "key-optimization",
        detected: true,
        isPositive: false,
        isNegative: true,
        isIdiomatic: false,
        location: getNodeLocation(node) ?? undefined,
        details: "Unstable key (Math.random/Date.now) causes unnecessary re-renders",
      });
    } else if (hasStableKey) {
      detections.push({
        topicSlug: "key-optimization",
        detected: true,
        isPositive: true,
        isNegative: false,
        isIdiomatic: true,
        location: getNodeLocation(node) ?? undefined,
        details: "Stable key prop used for optimized reconciliation",
      });
    }
  });

  // Deduplicate
  if (detections.length > 1) {
    const neg = detections.find((d) => d.isNegative);
    if (neg) return [neg];
    return [detections[0]];
  }
  return detections;
}

// =============================================
// unnecessary-rerenders: Detect potential re-render issues
// =============================================

export function detectUnnecessaryRerenders(ast: File): AdvancedReactDetection[] {
  const detections: AdvancedReactDetection[] = [];

  // Pattern 1: Object/array literals in JSX props (creates new reference each render)
  let foundInlineProp = false;
  traverse(ast, (node) => {
    if (foundInlineProp) return;

    if (!isNodeType<{
      name?: { name?: string };
      value?: { type?: string; expression?: { type?: string } };
    }>(node, "JSXAttribute")) return;

    const attr = node as {
      name?: { name?: string };
      value?: { type?: string; expression?: { type?: string } };
    };

    // Skip className, style (commonly inline)
    const attrName = attr.name?.name ?? "";
    if (["className", "key", "ref"].includes(attrName)) return;

    if (attr.value?.type === "JSXExpressionContainer") {
      const expr = attr.value.expression;
      if (
        expr?.type === "ObjectExpression" ||
        expr?.type === "ArrayExpression"
      ) {
        foundInlineProp = true;
        detections.push({
          topicSlug: "unnecessary-rerenders",
          detected: true,
          isPositive: false,
          isNegative: true,
          isIdiomatic: false,
          isTrivial: true,
          location: getNodeLocation(node) ?? undefined,
          details: `Inline ${expr.type === "ObjectExpression" ? "object" : "array"} in JSX prop creates new reference each render`,
        });
      }
    }
  });

  // Pattern 2: Arrow functions in JSX event handlers (common, but not always a problem)
  // Only flag if React.memo or useCallback is also used (suggests perf awareness)
  // This is intentionally conservative

  return detections;
}

// =============================================
// Main Detector Function
// =============================================

export function detectAdvancedReactPatterns(ast: File): AdvancedReactDetection[] {
  return [
    ...detectContextBasics(ast),
    ...detectContextProvider(ast),
    ...detectContextPerformance(ast),
    ...detectReactMemo(ast),
    ...detectKeyOptimization(ast),
    ...detectUnnecessaryRerenders(ast),
  ];
}
