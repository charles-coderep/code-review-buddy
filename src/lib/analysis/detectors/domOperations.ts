// =============================================
// DOM Operations Detectors
// Detects: query selectors, manipulation, events, classList, dataset
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

interface CallExpr {
  type: "CallExpression";
  callee: {
    type: string;
    name?: string;
    property?: { name: string };
    object?: { type?: string; name?: string };
  };
  arguments: unknown[];
}

// =============================================
// dom-query-selectors
// =============================================

function detectDomQuerySelectors(ast: File): Detection[] {
  const detections: Detection[] = [];
  let found = false;
  const queryMethods = [
    "querySelector",
    "querySelectorAll",
    "getElementById",
    "getElementsByClassName",
    "getElementsByTagName",
  ];

  traverse(ast, (node) => {
    if (found) return;
    if (!isNodeType<CallExpr>(node, "CallExpression")) return;
    if (node.callee.type !== "MemberExpression") return;

    const prop = node.callee.property?.name;
    if (prop && queryMethods.includes(prop)) {
      found = true;
      const isModern = prop === "querySelector" || prop === "querySelectorAll";
      detections.push({
        topicSlug: "dom-query-selectors",
        detected: true,
        isPositive: true,
        isNegative: false,
        isIdiomatic: isModern,
        isTrivial: !isModern,
        location: getNodeLocation(node) ?? undefined,
        details: isModern
          ? `${prop}() used for DOM querying`
          : `${prop}() used — consider querySelector/querySelectorAll`,
      });
    }
  });

  return detections;
}

// =============================================
// dom-manipulation
// =============================================

function detectDomManipulation(ast: File): Detection[] {
  const detections: Detection[] = [];
  let found = false;
  const manipMethods = [
    "createElement",
    "appendChild",
    "removeChild",
    "replaceChild",
    "insertBefore",
    "append",
    "prepend",
    "remove",
    "cloneNode",
    "setAttribute",
    "removeAttribute",
    "insertAdjacentHTML",
    "insertAdjacentElement",
  ];

  traverse(ast, (node) => {
    if (found) return;
    if (!isNodeType<CallExpr>(node, "CallExpression")) return;
    if (node.callee.type !== "MemberExpression") return;

    const prop = node.callee.property?.name;
    if (prop && manipMethods.includes(prop)) {
      found = true;
      detections.push({
        topicSlug: "dom-manipulation",
        detected: true,
        isPositive: true,
        isNegative: false,
        isIdiomatic: true,
        location: getNodeLocation(node) ?? undefined,
        details: `.${prop}() used for DOM manipulation`,
      });
    }
  });

  // Also detect property assignments like .textContent, .innerHTML (via member + assignment)
  if (!found) {
    traverse(ast, (node) => {
      if (found) return;
      if (isNodeType<{ operator?: string; left?: { type?: string; property?: { name?: string } } }>(
        node,
        "AssignmentExpression"
      )) {
        const assign = node as {
          left?: { type?: string; property?: { name?: string } };
        };
        if (assign.left?.type === "MemberExpression") {
          const prop = assign.left.property?.name;
          if (prop === "textContent" || prop === "innerText") {
            found = true;
            detections.push({
              topicSlug: "dom-manipulation",
              detected: true,
              isPositive: true,
              isNegative: false,
              isIdiomatic: true,
              location: getNodeLocation(node) ?? undefined,
              details: `.${prop} assignment for DOM text manipulation`,
            });
          }
        }
      }
    });
  }

  return detections;
}

// =============================================
// dom-events: addEventListener, removeEventListener
// =============================================

function detectDomEvents(ast: File): Detection[] {
  const detections: Detection[] = [];
  let foundAdd = false;
  let foundRemove = false;

  traverse(ast, (node) => {
    if (!isNodeType<CallExpr>(node, "CallExpression")) return;
    if (node.callee.type !== "MemberExpression") return;

    const prop = node.callee.property?.name;

    if (prop === "addEventListener" && !foundAdd) {
      foundAdd = true;
      detections.push({
        topicSlug: "dom-events",
        detected: true,
        isPositive: true,
        isNegative: false,
        isIdiomatic: true,
        location: getNodeLocation(node) ?? undefined,
        details: "addEventListener() used for DOM event handling",
      });
    }

    if (prop === "removeEventListener") {
      foundRemove = true;
    }
  });

  return detections;
}

// =============================================
// dom-classlist: classList.add, classList.remove, classList.toggle, classList.contains
// =============================================

function detectDomClassList(ast: File): Detection[] {
  const detections: Detection[] = [];
  let found = false;

  traverse(ast, (node) => {
    if (found) return;
    if (!isNodeType<CallExpr>(node, "CallExpression")) return;
    if (node.callee.type !== "MemberExpression") return;

    // Check for .classList.add/remove/toggle/contains pattern
    const obj = node.callee.object as { type?: string; property?: { name?: string } } | undefined;
    if (obj?.type === "MemberExpression" && obj.property?.name === "classList") {
      const method = node.callee.property?.name;
      if (method && ["add", "remove", "toggle", "contains", "replace"].includes(method)) {
        found = true;
        detections.push({
          topicSlug: "dom-classlist",
          detected: true,
          isPositive: true,
          isNegative: false,
          isIdiomatic: true,
          location: getNodeLocation(node) ?? undefined,
          details: `classList.${method}() used for CSS class management`,
        });
      }
    }
  });

  return detections;
}

// =============================================
// dom-dataset: element.dataset.x
// =============================================

function detectDomDataset(ast: File): Detection[] {
  const detections: Detection[] = [];
  let found = false;

  traverse(ast, (node) => {
    if (found) return;
    if (!isNodeType<{ property?: { name?: string }; object?: { type?: string; property?: { name?: string } } }>(
      node,
      "MemberExpression"
    ))
      return;

    const member = node as {
      property?: { name?: string };
      object?: { type?: string; property?: { name?: string } };
    };

    if (member.object?.type === "MemberExpression" && member.object.property?.name === "dataset") {
      found = true;
      detections.push({
        topicSlug: "dom-dataset",
        detected: true,
        isPositive: true,
        isNegative: false,
        isIdiomatic: true,
        location: getNodeLocation(node) ?? undefined,
        details: "element.dataset used for data attribute access",
      });
    }
  });

  return detections;
}

// =============================================
// Main Detector Function
// =============================================

export function detectDomOperations(ast: File): Detection[] {
  return [
    ...detectDomQuerySelectors(ast),
    ...detectDomManipulation(ast),
    ...detectDomEvents(ast),
    ...detectDomClassList(ast),
    ...detectDomDataset(ast),
  ];
}
