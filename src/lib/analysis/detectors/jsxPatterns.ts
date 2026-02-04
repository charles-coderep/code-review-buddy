// =============================================
// JSX Pattern Detectors
// Detects: JSX syntax, expressions, conditional rendering, lists, keys
// =============================================

import type { File } from "@babel/types";
import { traverse, getNodeLocation, isNodeType } from "../parser";

export interface JSXDetection {
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
// JSX Basic Detectors
// =============================================

/**
 * Detect JSX syntax usage
 */
export function detectJSXSyntax(ast: File): JSXDetection[] {
  const detections: JSXDetection[] = [];
  let hasJSX = false;

  traverse(ast, (node) => {
    if (isNodeType(node, "JSXElement") || isNodeType(node, "JSXFragment")) {
      if (!hasJSX) {
        hasJSX = true;
        detections.push({
          topicSlug: "jsx-syntax",
          detected: true,
          isPositive: true,
          isNegative: false,
          isIdiomatic: true,
          location: getNodeLocation(node) ?? undefined,
          details: "JSX syntax used",
        });
      }
    }
  });

  return detections;
}

/**
 * Detect JSX expressions (curly braces)
 */
export function detectJSXExpressions(ast: File): JSXDetection[] {
  const detections: JSXDetection[] = [];

  traverse(ast, (node) => {
    if (isNodeType(node, "JSXExpressionContainer")) {
      detections.push({
        topicSlug: "jsx-expressions",
        detected: true,
        isPositive: true,
        isNegative: false,
        isIdiomatic: true,
        location: getNodeLocation(node) ?? undefined,
        details: "JSX expression container used",
      });
    }
  });

  // Deduplicate - just report once if found
  if (detections.length > 0) {
    return [detections[0]];
  }

  return detections;
}

/**
 * Detect conditional rendering patterns
 */
export function detectJSXConditionalRendering(ast: File): JSXDetection[] {
  const detections: JSXDetection[] = [];

  traverse(ast, (node, parent) => {
    // Check for && pattern in JSX
    if (isNodeType<{ operator?: string }>(node, "LogicalExpression")) {
      const logicalNode = node as { operator?: string };
      const parentTyped = parent as { type?: string };

      if (
        logicalNode.operator === "&&" &&
        parentTyped?.type === "JSXExpressionContainer"
      ) {
        detections.push({
          topicSlug: "jsx-conditional-rendering",
          detected: true,
          isPositive: true,
          isNegative: false,
          isIdiomatic: true,
          location: getNodeLocation(node) ?? undefined,
          details: "&& operator for conditional rendering",
        });
      }
    }

    // Check for ternary in JSX
    if (isNodeType(node, "ConditionalExpression")) {
      const parentTyped = parent as { type?: string };
      if (parentTyped?.type === "JSXExpressionContainer") {
        detections.push({
          topicSlug: "jsx-conditional-rendering",
          detected: true,
          isPositive: true,
          isNegative: false,
          isIdiomatic: true,
          location: getNodeLocation(node) ?? undefined,
          details: "Ternary operator for conditional rendering",
        });
      }
    }
  });

  return detections;
}

// =============================================
// JSX List Rendering and Keys
// =============================================

/**
 * Detect JSX list rendering with .map()
 */
export function detectJSXListRendering(ast: File): JSXDetection[] {
  const detections: JSXDetection[] = [];

  traverse(ast, (node) => {
    if (!isNodeType<{
      callee?: { type?: string; property?: { name?: string } };
      arguments?: Array<{ body?: unknown }>;
    }>(node, "CallExpression")) return;

    const callNode = node as {
      callee?: { type?: string; property?: { name?: string } };
      arguments?: Array<{ body?: unknown }>;
    };

    // Check for .map() call
    if (
      callNode.callee?.type === "MemberExpression" &&
      callNode.callee.property?.name === "map"
    ) {
      // Check if callback returns JSX
      const callback = callNode.arguments?.[0];
      const hasJSXReturn = checkForJSXInNode(callback);

      if (hasJSXReturn) {
        detections.push({
          topicSlug: "jsx-list-rendering",
          detected: true,
          isPositive: true,
          isNegative: false,
          isIdiomatic: true,
          location: getNodeLocation(node) ?? undefined,
          details: ".map() returning JSX for list rendering",
        });
      }
    }
  });

  return detections;
}

/**
 * Helper to check if a node contains JSX
 */
function checkForJSXInNode(node: unknown): boolean {
  if (!node) return false;

  let hasJSX = false;

  const check = (n: unknown): void => {
    if (!n || typeof n !== "object") return;

    const typed = n as { type?: string };
    if (typed.type === "JSXElement" || typed.type === "JSXFragment") {
      hasJSX = true;
      return;
    }

    for (const key of Object.keys(n as object)) {
      const value = (n as Record<string, unknown>)[key];
      if (Array.isArray(value)) {
        value.forEach(check);
      } else if (value && typeof value === "object") {
        check(value);
      }
    }
  };

  check(node);
  return hasJSX;
}

/**
 * Detect JSX keys in list rendering
 */
export function detectJSXKeys(ast: File): JSXDetection[] {
  const detections: JSXDetection[] = [];

  // Track map callbacks to find JSX without keys
  traverse(ast, (node) => {
    if (!isNodeType<{
      callee?: { type?: string; property?: { name?: string } };
      arguments?: unknown[];
    }>(node, "CallExpression")) return;

    const callNode = node as {
      callee?: { type?: string; property?: { name?: string } };
      arguments?: unknown[];
    };

    // Check for .map() call
    if (
      callNode.callee?.type === "MemberExpression" &&
      callNode.callee.property?.name === "map"
    ) {
      const callback = callNode.arguments?.[0] as { body?: unknown; params?: Array<{ name?: string }> };
      if (!callback) return;

      // Find JSX elements in the callback
      const jsxElements: Array<{
        hasKey: boolean;
        keyType: "index" | "id" | "other" | "none";
        location: { line: number; column: number } | null;
      }> = [];

      const findJSXElements = (n: unknown, indexParam?: string): void => {
        if (!n || typeof n !== "object") return;

        const typed = n as {
          type?: string;
          openingElement?: {
            attributes?: Array<{
              type?: string;
              name?: { name?: string };
              value?: { type?: string; expression?: { name?: string } };
            }>;
          };
        };

        if (typed.type === "JSXElement" && typed.openingElement?.attributes) {
          const keyAttr = typed.openingElement.attributes.find(
            (attr) =>
              attr.type === "JSXAttribute" && attr.name?.name === "key"
          );

          if (keyAttr) {
            // Check key value type
            const keyValue = keyAttr.value;
            let keyType: "index" | "id" | "other" = "other";

            if (keyValue?.type === "JSXExpressionContainer") {
              const expr = keyValue.expression;
              // Check if using index as key
              if (expr?.name === indexParam || expr?.name === "index" || expr?.name === "i") {
                keyType = "index";
              } else if (
                expr &&
                typeof expr === "object" &&
                "property" in expr &&
                (expr as { property?: { name?: string } }).property?.name === "id"
              ) {
                keyType = "id";
              }
            }

            jsxElements.push({
              hasKey: true,
              keyType,
              location: getNodeLocation(n),
            });
          } else {
            jsxElements.push({
              hasKey: false,
              keyType: "none",
              location: getNodeLocation(n),
            });
          }
        }

        for (const key of Object.keys(n as object)) {
          const value = (n as Record<string, unknown>)[key];
          if (Array.isArray(value)) {
            value.forEach((v) => findJSXElements(v, indexParam));
          } else if (value && typeof value === "object") {
            findJSXElements(value, indexParam);
          }
        }
      };

      // Get index parameter name if exists
      const indexParam = callback.params?.[1]?.name;
      findJSXElements(callback.body, indexParam);

      // Report findings
      for (const elem of jsxElements) {
        if (!elem.hasKey) {
          detections.push({
            topicSlug: "jsx-keys",
            detected: true,
            isPositive: false,
            isNegative: true,
            isIdiomatic: false,
            location: elem.location ?? undefined,
            details: "Missing key prop in list-rendered JSX",
          });
        } else if (elem.keyType === "index") {
          detections.push({
            topicSlug: "jsx-keys",
            detected: true,
            isPositive: false,
            isNegative: true,
            isIdiomatic: false,
            isTrivial: true,
            location: elem.location ?? undefined,
            details: "Using array index as key - can cause issues with reordering",
          });
        } else if (elem.keyType === "id") {
          detections.push({
            topicSlug: "jsx-keys",
            detected: true,
            isPositive: true,
            isNegative: false,
            isIdiomatic: true,
            location: elem.location ?? undefined,
            details: "Using unique id as key - good practice",
          });
        } else {
          detections.push({
            topicSlug: "jsx-keys",
            detected: true,
            isPositive: true,
            isNegative: false,
            isIdiomatic: true,
            location: elem.location ?? undefined,
            details: "Key prop present",
          });
        }
      }
    }
  });

  return detections;
}

// =============================================
// Props and Component Detectors
// =============================================

/**
 * Detect props usage
 */
export function detectPropsBasics(ast: File): JSXDetection[] {
  const detections: JSXDetection[] = [];
  let hasProps = false;

  traverse(ast, (node) => {
    // Check for JSX attributes (passing props)
    if (isNodeType<{ name?: { name?: string } }>(node, "JSXAttribute")) {
      const attrNode = node as { name?: { name?: string } };
      // Skip common non-prop attributes
      if (
        attrNode.name?.name &&
        !["className", "style", "key", "ref"].includes(attrNode.name.name)
      ) {
        if (!hasProps) {
          hasProps = true;
          detections.push({
            topicSlug: "props-basics",
            detected: true,
            isPositive: true,
            isNegative: false,
            isIdiomatic: true,
            location: getNodeLocation(node) ?? undefined,
            details: "Props passed to components",
          });
        }
      }
    }
  });

  return detections;
}

/**
 * Detect children prop usage
 */
export function detectChildrenProp(ast: File): JSXDetection[] {
  const detections: JSXDetection[] = [];

  traverse(ast, (node) => {
    // Check for props.children or children in destructuring
    if (isNodeType<{ property?: { name?: string } }>(node, "MemberExpression")) {
      const memberNode = node as { property?: { name?: string } };
      if (memberNode.property?.name === "children") {
        detections.push({
          topicSlug: "children-prop",
          detected: true,
          isPositive: true,
          isNegative: false,
          isIdiomatic: true,
          location: getNodeLocation(node) ?? undefined,
          details: "children prop accessed",
        });
      }
    }

    // Check for children in object destructuring
    if (isNodeType<{ properties?: Array<{ key?: { name?: string } }> }>(node, "ObjectPattern")) {
      const patternNode = node as { properties?: Array<{ key?: { name?: string } }> };
      const hasChildren = patternNode.properties?.some(
        (prop) => prop.key?.name === "children"
      );
      if (hasChildren) {
        detections.push({
          topicSlug: "children-prop",
          detected: true,
          isPositive: true,
          isNegative: false,
          isIdiomatic: true,
          location: getNodeLocation(node) ?? undefined,
          details: "children destructured from props",
        });
      }
    }
  });

  return detections;
}

/**
 * Detect event handlers
 */
export function detectEventHandlers(ast: File): JSXDetection[] {
  const detections: JSXDetection[] = [];
  const eventAttrs = new Set<string>();

  traverse(ast, (node) => {
    if (isNodeType<{ name?: { name?: string } }>(node, "JSXAttribute")) {
      const attrNode = node as { name?: { name?: string } };
      const name = attrNode.name?.name;
      // Check for on* handlers
      if (name && /^on[A-Z]/.test(name) && !eventAttrs.has(name)) {
        eventAttrs.add(name);
        detections.push({
          topicSlug: "event-handlers",
          detected: true,
          isPositive: true,
          isNegative: false,
          isIdiomatic: true,
          location: getNodeLocation(node) ?? undefined,
          details: `${name} event handler`,
        });
      }
    }
  });

  return detections;
}

/**
 * Detect controlled components
 */
export function detectControlledComponents(ast: File): JSXDetection[] {
  const detections: JSXDetection[] = [];

  traverse(ast, (node) => {
    if (!isNodeType<{
      openingElement?: {
        name?: { name?: string };
        attributes?: Array<{ type?: string; name?: { name?: string } }>;
      };
    }>(node, "JSXElement")) return;

    const jsxNode = node as {
      openingElement?: {
        name?: { name?: string };
        attributes?: Array<{ type?: string; name?: { name?: string } }>;
      };
    };

    const tagName = jsxNode.openingElement?.name?.name;
    if (tagName === "input" || tagName === "textarea" || tagName === "select") {
      const attrs = jsxNode.openingElement?.attributes ?? [];
      const hasValue = attrs.some(
        (a) => a.type === "JSXAttribute" && a.name?.name === "value"
      );
      const hasOnChange = attrs.some(
        (a) => a.type === "JSXAttribute" && a.name?.name === "onChange"
      );

      if (hasValue && hasOnChange) {
        detections.push({
          topicSlug: "controlled-components",
          detected: true,
          isPositive: true,
          isNegative: false,
          isIdiomatic: true,
          location: getNodeLocation(node) ?? undefined,
          details: "Controlled component with value and onChange",
        });
      } else if (hasValue && !hasOnChange) {
        detections.push({
          topicSlug: "controlled-components",
          detected: true,
          isPositive: false,
          isNegative: true,
          isIdiomatic: false,
          location: getNodeLocation(node) ?? undefined,
          details: "Controlled component missing onChange handler",
        });
      }
    }
  });

  return detections;
}

// =============================================
// Main Detector Function
// =============================================

/**
 * Run all JSX pattern detectors
 */
export function detectJSXPatterns(ast: File): JSXDetection[] {
  return [
    ...detectJSXSyntax(ast),
    ...detectJSXExpressions(ast),
    ...detectJSXConditionalRendering(ast),
    ...detectJSXListRendering(ast),
    ...detectJSXKeys(ast),
    ...detectPropsBasics(ast),
    ...detectChildrenProp(ast),
    ...detectEventHandlers(ast),
    ...detectControlledComponents(ast),
  ];
}
