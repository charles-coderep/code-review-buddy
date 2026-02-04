// =============================================
// Component Pattern Detectors
// Detects: props-destructuring, prop-types-validation, default-props,
//          uncontrolled-components, component-composition,
//          conditional-component-rendering, event-handler-params,
//          prevent-default, event-delegation
// =============================================

import type { File } from "@babel/types";
import { traverse, getNodeLocation, isNodeType } from "../parser";

export interface ComponentDetection {
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
// props-destructuring: Destructuring props in function params
// =============================================

export function detectPropsDestructuring(ast: File): ComponentDetection[] {
  const detections: ComponentDetection[] = [];
  let found = false;

  traverse(ast, (node) => {
    if (found) return;

    // Check for function components with destructured props parameter
    const isFn =
      isNodeType(node, "FunctionDeclaration") ||
      isNodeType(node, "ArrowFunctionExpression") ||
      isNodeType(node, "FunctionExpression");

    if (!isFn) return;

    const fn = node as {
      id?: { name?: string };
      params?: Array<{ type?: string }>;
      body?: unknown;
    };

    // Check if the first param is ObjectPattern (destructured props)
    if (fn.params?.[0]?.type === "ObjectPattern") {
      // Heuristic: function name starts with uppercase = React component
      const name = fn.id?.name;
      const isComponent = name && /^[A-Z]/.test(name);

      // Also check if body contains JSX
      if (isComponent || containsJSX(fn.body)) {
        found = true;
        detections.push({
          topicSlug: "props-destructuring",
          detected: true,
          isPositive: true,
          isNegative: false,
          isIdiomatic: true,
          location: getNodeLocation(node) ?? undefined,
          details: "Props destructured in function parameters",
        });
      }
    }
  });

  return detections;
}

function containsJSX(node: unknown): boolean {
  if (!node || typeof node !== "object") return false;
  const n = node as Record<string, unknown>;
  if (n.type === "JSXElement" || n.type === "JSXFragment") return true;

  for (const key of Object.keys(n)) {
    if (key === "loc" || key === "start" || key === "end") continue;
    const value = n[key];
    if (Array.isArray(value)) {
      for (const item of value) {
        if (containsJSX(item)) return true;
      }
    } else if (value && typeof value === "object") {
      if (containsJSX(value)) return true;
    }
  }
  return false;
}

// =============================================
// prop-types-validation: Detect PropTypes usage
// =============================================

export function detectPropTypesValidation(ast: File): ComponentDetection[] {
  const detections: ComponentDetection[] = [];
  let found = false;

  traverse(ast, (node) => {
    if (found) return;

    // Check for import of PropTypes
    if (isNodeType<{ source?: { value?: string } }>(node, "ImportDeclaration")) {
      const imp = node as { source?: { value?: string } };
      if (imp.source?.value === "prop-types") {
        found = true;
        detections.push({
          topicSlug: "prop-types-validation",
          detected: true,
          isPositive: true,
          isNegative: false,
          isIdiomatic: true,
          location: getNodeLocation(node) ?? undefined,
          details: "PropTypes imported for runtime type checking",
        });
      }
    }

    // Check for Component.propTypes assignment
    if (isNodeType<{
      left?: { type?: string; property?: { name?: string } };
    }>(node, "AssignmentExpression")) {
      const assign = node as {
        left?: { type?: string; property?: { name?: string } };
      };
      if (
        assign.left?.type === "MemberExpression" &&
        assign.left.property?.name === "propTypes"
      ) {
        found = true;
        detections.push({
          topicSlug: "prop-types-validation",
          detected: true,
          isPositive: true,
          isNegative: false,
          isIdiomatic: true,
          location: getNodeLocation(node) ?? undefined,
          details: "PropTypes validation defined",
        });
      }
    }
  });

  return detections;
}

// =============================================
// default-props: Detect defaultProps or default values for props
// =============================================

export function detectDefaultProps(ast: File): ComponentDetection[] {
  const detections: ComponentDetection[] = [];
  let found = false;

  traverse(ast, (node) => {
    if (found) return;

    // Check for Component.defaultProps assignment
    if (isNodeType<{
      left?: { type?: string; property?: { name?: string } };
    }>(node, "AssignmentExpression")) {
      const assign = node as {
        left?: { type?: string; property?: { name?: string } };
      };
      if (
        assign.left?.type === "MemberExpression" &&
        assign.left.property?.name === "defaultProps"
      ) {
        found = true;
        detections.push({
          topicSlug: "default-props",
          detected: true,
          isPositive: true,
          isNegative: false,
          isIdiomatic: false, // defaultProps is legacy pattern
          isTrivial: true,
          location: getNodeLocation(node) ?? undefined,
          details: "defaultProps used - consider default parameter values instead",
        });
      }
    }

    // Check for default values in destructured props
    if (isNodeType<{
      params?: Array<{
        type?: string;
        properties?: Array<{ type?: string; value?: { type?: string } }>;
      }>;
    }>(node, "FunctionDeclaration") ||
      isNodeType(node, "ArrowFunctionExpression")) {
      const fn = node as {
        id?: { name?: string };
        params?: Array<{
          type?: string;
          properties?: Array<{
            type?: string;
            value?: { type?: string };
          }>;
        }>;
        body?: unknown;
      };

      const firstParam = fn.params?.[0];
      if (firstParam?.type === "ObjectPattern" && firstParam.properties) {
        const hasDefaults = firstParam.properties.some(
          (p) => p.type === "ObjectProperty" && p.value?.type === "AssignmentPattern"
        );
        if (hasDefaults && containsJSX(fn.body)) {
          found = true;
          detections.push({
            topicSlug: "default-props",
            detected: true,
            isPositive: true,
            isNegative: false,
            isIdiomatic: true,
            location: getNodeLocation(node) ?? undefined,
            details: "Default prop values via destructuring defaults",
          });
        }
      }
    }
  });

  return detections;
}

// =============================================
// uncontrolled-components: Detect defaultValue/defaultChecked
// =============================================

export function detectUncontrolledComponents(ast: File): ComponentDetection[] {
  const detections: ComponentDetection[] = [];
  let found = false;

  traverse(ast, (node) => {
    if (found) return;

    if (!isNodeType<{
      openingElement?: {
        name?: { name?: string };
        attributes?: Array<{ type?: string; name?: { name?: string } }>;
      };
    }>(node, "JSXElement")) return;

    const jsx = node as {
      openingElement?: {
        name?: { name?: string };
        attributes?: Array<{ type?: string; name?: { name?: string } }>;
      };
    };

    const tagName = jsx.openingElement?.name?.name;
    if (tagName !== "input" && tagName !== "textarea" && tagName !== "select") return;

    const attrs = jsx.openingElement?.attributes ?? [];
    const hasDefaultValue = attrs.some(
      (a) =>
        a.type === "JSXAttribute" &&
        (a.name?.name === "defaultValue" || a.name?.name === "defaultChecked")
    );

    if (hasDefaultValue) {
      found = true;
      detections.push({
        topicSlug: "uncontrolled-components",
        detected: true,
        isPositive: true,
        isNegative: false,
        isIdiomatic: true,
        location: getNodeLocation(node) ?? undefined,
        details: "Uncontrolled component with defaultValue/defaultChecked",
      });
    }
  });

  return detections;
}

// =============================================
// component-composition: Components rendering other components
// =============================================

export function detectComponentComposition(ast: File): ComponentDetection[] {
  const detections: ComponentDetection[] = [];
  let found = false;

  traverse(ast, (node) => {
    if (found) return;

    // JSX element with uppercase name = component usage
    if (!isNodeType<{
      openingElement?: { name?: { type?: string; name?: string } };
      children?: unknown[];
    }>(node, "JSXElement")) return;

    const jsx = node as {
      openingElement?: { name?: { type?: string; name?: string } };
      children?: unknown[];
    };

    const name = jsx.openingElement?.name;
    if (name?.type === "JSXIdentifier" && name.name && /^[A-Z]/.test(name.name)) {
      // Check if this component has children that are also components
      const hasComponentChildren = jsx.children?.some((child) => {
        const c = child as {
          type?: string;
          openingElement?: { name?: { name?: string } };
        };
        if (c.type === "JSXElement") {
          const childName = c.openingElement?.name?.name;
          return childName && /^[A-Z]/.test(childName);
        }
        return false;
      });

      if (hasComponentChildren) {
        found = true;
        detections.push({
          topicSlug: "component-composition",
          detected: true,
          isPositive: true,
          isNegative: false,
          isIdiomatic: true,
          location: getNodeLocation(node) ?? undefined,
          details: "Component composition - components nested within components",
        });
      }
    }
  });

  return detections;
}

// =============================================
// conditional-component-rendering: Conditional rendering of components
// =============================================

export function detectConditionalComponentRendering(ast: File): ComponentDetection[] {
  const detections: ComponentDetection[] = [];
  let found = false;

  traverse(ast, (node) => {
    if (found) return;

    // Ternary with component returns
    if (isNodeType<{
      consequent?: { type?: string; openingElement?: { name?: { name?: string } } };
      alternate?: { type?: string; openingElement?: { name?: { name?: string } } };
    }>(node, "ConditionalExpression")) {
      const cond = node as {
        consequent?: { type?: string; openingElement?: { name?: { name?: string } } };
        alternate?: { type?: string; openingElement?: { name?: { name?: string } } };
      };

      const consequentIsComponent =
        cond.consequent?.type === "JSXElement" &&
        cond.consequent.openingElement?.name?.name &&
        /^[A-Z]/.test(cond.consequent.openingElement.name.name);

      const alternateIsComponent =
        cond.alternate?.type === "JSXElement" &&
        cond.alternate.openingElement?.name?.name &&
        /^[A-Z]/.test(cond.alternate.openingElement.name.name);

      if (consequentIsComponent || alternateIsComponent) {
        found = true;
        detections.push({
          topicSlug: "conditional-component-rendering",
          detected: true,
          isPositive: true,
          isNegative: false,
          isIdiomatic: true,
          location: getNodeLocation(node) ?? undefined,
          details: "Conditional rendering of components",
        });
      }
    }

    // && pattern with component
    if (isNodeType<{
      operator?: string;
      right?: { type?: string; openingElement?: { name?: { name?: string } } };
    }>(node, "LogicalExpression")) {
      const logical = node as {
        operator?: string;
        right?: { type?: string; openingElement?: { name?: { name?: string } } };
      };

      if (
        logical.operator === "&&" &&
        logical.right?.type === "JSXElement" &&
        logical.right.openingElement?.name?.name &&
        /^[A-Z]/.test(logical.right.openingElement.name.name)
      ) {
        found = true;
        detections.push({
          topicSlug: "conditional-component-rendering",
          detected: true,
          isPositive: true,
          isNegative: false,
          isIdiomatic: true,
          location: getNodeLocation(node) ?? undefined,
          details: "Conditional component rendering with && operator",
        });
      }
    }
  });

  return detections;
}

// =============================================
// event-handler-params: Event handlers with event parameter
// =============================================

export function detectEventHandlerParams(ast: File): ComponentDetection[] {
  const detections: ComponentDetection[] = [];
  let found = false;

  traverse(ast, (node) => {
    if (found) return;

    if (!isNodeType<{
      name?: { name?: string };
      value?: {
        type?: string;
        expression?: {
          type?: string;
          params?: Array<{ name?: string; type?: string }>;
        };
      };
    }>(node, "JSXAttribute")) return;

    const attr = node as {
      name?: { name?: string };
      value?: {
        type?: string;
        expression?: {
          type?: string;
          params?: Array<{ name?: string; type?: string }>;
        };
      };
    };

    const name = attr.name?.name;
    if (!name || !/^on[A-Z]/.test(name)) return;

    const expr = attr.value?.expression;
    if (
      expr?.type === "ArrowFunctionExpression" ||
      expr?.type === "FunctionExpression"
    ) {
      const hasEventParam = (expr.params?.length ?? 0) > 0;
      const paramName = expr.params?.[0]?.name;
      const isConventional =
        paramName === "e" ||
        paramName === "event" ||
        paramName === "evt";

      if (hasEventParam) {
        found = true;
        detections.push({
          topicSlug: "event-handler-params",
          detected: true,
          isPositive: true,
          isNegative: false,
          isIdiomatic: isConventional,
          location: getNodeLocation(node) ?? undefined,
          details: isConventional
            ? "Event handler with properly named event parameter"
            : "Event handler accepts event parameter",
        });
      }
    }
  });

  return detections;
}

// =============================================
// prevent-default: Detect e.preventDefault()
// =============================================

export function detectPreventDefault(ast: File): ComponentDetection[] {
  const detections: ComponentDetection[] = [];
  let found = false;

  traverse(ast, (node) => {
    if (found) return;

    if (!isNodeType<{
      callee?: {
        type?: string;
        property?: { name?: string };
      };
    }>(node, "CallExpression")) return;

    const call = node as {
      callee?: {
        type?: string;
        property?: { name?: string };
      };
    };

    if (
      call.callee?.type === "MemberExpression" &&
      call.callee.property?.name === "preventDefault"
    ) {
      found = true;
      detections.push({
        topicSlug: "prevent-default",
        detected: true,
        isPositive: true,
        isNegative: false,
        isIdiomatic: true,
        location: getNodeLocation(node) ?? undefined,
        details: "preventDefault() called to prevent default browser behavior",
      });
    }
  });

  return detections;
}

// =============================================
// event-delegation: Detect event handling on parent elements
// =============================================

export function detectEventDelegation(ast: File): ComponentDetection[] {
  const detections: ComponentDetection[] = [];

  // Look for onClick on container elements (div, ul, table, etc.)
  const containerElements = ["div", "ul", "ol", "table", "tbody", "section", "main", "nav", "form"];

  traverse(ast, (node) => {
    if (!isNodeType<{
      openingElement?: {
        name?: { name?: string };
        attributes?: Array<{ type?: string; name?: { name?: string } }>;
      };
      children?: unknown[];
    }>(node, "JSXElement")) return;

    const jsx = node as {
      openingElement?: {
        name?: { name?: string };
        attributes?: Array<{ type?: string; name?: { name?: string } }>;
      };
      children?: unknown[];
    };

    const tagName = jsx.openingElement?.name?.name;
    if (!tagName || !containerElements.includes(tagName)) return;

    const hasEventHandler = jsx.openingElement?.attributes?.some(
      (a) => a.type === "JSXAttribute" && a.name?.name && /^on[A-Z]/.test(a.name.name)
    );

    // Check if it has child elements (event delegation pattern)
    const hasChildren = (jsx.children?.length ?? 0) > 0;

    if (hasEventHandler && hasChildren) {
      detections.push({
        topicSlug: "event-delegation",
        detected: true,
        isPositive: true,
        isNegative: false,
        isIdiomatic: true,
        location: getNodeLocation(node) ?? undefined,
        details: `Event handler on container <${tagName}> - event delegation pattern`,
      });
    }
  });

  // Deduplicate
  if (detections.length > 1) {
    return [detections[0]];
  }
  return detections;
}

// =============================================
// Main Detector Function
// =============================================

export function detectComponentPatterns(ast: File): ComponentDetection[] {
  return [
    ...detectPropsDestructuring(ast),
    ...detectPropTypesValidation(ast),
    ...detectDefaultProps(ast),
    ...detectUncontrolledComponents(ast),
    ...detectComponentComposition(ast),
    ...detectConditionalComponentRendering(ast),
    ...detectEventHandlerParams(ast),
    ...detectPreventDefault(ast),
    ...detectEventDelegation(ast),
  ];
}
