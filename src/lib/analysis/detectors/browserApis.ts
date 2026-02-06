// =============================================
// Browser APIs Detectors
// Detects: localStorage, URL API, FormData, History API
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
// localStorage-usage
// =============================================

function detectLocalStorage(ast: File): Detection[] {
  const detections: Detection[] = [];
  let found = false;
  const storageMethods = ["getItem", "setItem", "removeItem", "clear"];

  traverse(ast, (node) => {
    if (found) return;
    if (!isNodeType<CallExpr>(node, "CallExpression")) return;
    if (node.callee.type !== "MemberExpression") return;

    const obj = node.callee.object;
    const prop = node.callee.property?.name;

    if (
      (obj?.name === "localStorage" || obj?.name === "sessionStorage") &&
      prop &&
      storageMethods.includes(prop)
    ) {
      found = true;
      detections.push({
        topicSlug: "localStorage-usage",
        detected: true,
        isPositive: true,
        isNegative: false,
        isIdiomatic: true,
        location: getNodeLocation(node) ?? undefined,
        details: `${obj.name}.${prop}() used for client-side storage`,
      });
    }
  });

  return detections;
}

// =============================================
// url-api: new URL(), URLSearchParams
// =============================================

function detectUrlApi(ast: File): Detection[] {
  const detections: Detection[] = [];
  let found = false;

  traverse(ast, (node) => {
    if (found) return;

    if (isNodeType<{ callee?: { name?: string } }>(node, "NewExpression")) {
      const name = (node as { callee?: { name?: string } }).callee?.name;
      if (name === "URL" || name === "URLSearchParams") {
        found = true;
        detections.push({
          topicSlug: "url-api",
          detected: true,
          isPositive: true,
          isNegative: false,
          isIdiomatic: true,
          location: getNodeLocation(node) ?? undefined,
          details: `${name} API used for URL handling`,
        });
      }
    }
  });

  return detections;
}

// =============================================
// formdata-api: new FormData()
// =============================================

function detectFormDataApi(ast: File): Detection[] {
  const detections: Detection[] = [];
  let found = false;

  traverse(ast, (node) => {
    if (found) return;

    if (isNodeType<{ callee?: { name?: string } }>(node, "NewExpression")) {
      if ((node as { callee?: { name?: string } }).callee?.name === "FormData") {
        found = true;
        detections.push({
          topicSlug: "formdata-api",
          detected: true,
          isPositive: true,
          isNegative: false,
          isIdiomatic: true,
          location: getNodeLocation(node) ?? undefined,
          details: "FormData API used for form data handling",
        });
      }
    }
  });

  return detections;
}

// =============================================
// history-api: history.pushState, history.replaceState, history.back
// =============================================

function detectHistoryApi(ast: File): Detection[] {
  const detections: Detection[] = [];
  let found = false;

  traverse(ast, (node) => {
    if (found) return;
    if (!isNodeType<CallExpr>(node, "CallExpression")) return;
    if (node.callee.type !== "MemberExpression") return;

    const obj = node.callee.object;
    const prop = node.callee.property?.name;

    if (
      obj?.name === "history" &&
      prop &&
      ["pushState", "replaceState", "back", "forward", "go"].includes(prop)
    ) {
      found = true;
      detections.push({
        topicSlug: "history-api",
        detected: true,
        isPositive: true,
        isNegative: false,
        isIdiomatic: true,
        location: getNodeLocation(node) ?? undefined,
        details: `history.${prop}() used for navigation`,
      });
    }
  });

  return detections;
}

// =============================================
// Main Detector Function
// =============================================

export function detectBrowserApis(ast: File): Detection[] {
  return [
    ...detectLocalStorage(ast),
    ...detectUrlApi(ast),
    ...detectFormDataApi(ast),
    ...detectHistoryApi(ast),
  ];
}
