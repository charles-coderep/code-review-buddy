// =============================================
// Date Handling Detectors
// Detects: date creation, formatting, methods
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

// =============================================
// date-creation: new Date(), Date.now()
// =============================================

function detectDateCreation(ast: File): Detection[] {
  const detections: Detection[] = [];
  let found = false;

  traverse(ast, (node) => {
    if (found) return;

    // new Date()
    if (isNodeType<{ callee?: { name?: string } }>(node, "NewExpression")) {
      if ((node as { callee?: { name?: string } }).callee?.name === "Date") {
        found = true;
        detections.push({
          topicSlug: "date-creation",
          detected: true,
          isPositive: true,
          isNegative: false,
          isIdiomatic: true,
          location: getNodeLocation(node) ?? undefined,
          details: "new Date() used for date creation",
        });
      }
    }

    // Date.now()
    if (
      !found &&
      isNodeType<{
        callee?: {
          type?: string;
          object?: { name?: string };
          property?: { name?: string };
        };
      }>(node, "CallExpression")
    ) {
      const call = node as {
        callee?: {
          type?: string;
          object?: { name?: string };
          property?: { name?: string };
        };
      };
      if (
        call.callee?.type === "MemberExpression" &&
        call.callee.object?.name === "Date" &&
        call.callee.property?.name === "now"
      ) {
        found = true;
        detections.push({
          topicSlug: "date-creation",
          detected: true,
          isPositive: true,
          isNegative: false,
          isIdiomatic: true,
          location: getNodeLocation(node) ?? undefined,
          details: "Date.now() used for timestamp",
        });
      }
    }
  });

  return detections;
}

// =============================================
// date-formatting: toLocaleDateString, toISOString, Intl.DateTimeFormat
// =============================================

function detectDateFormatting(ast: File): Detection[] {
  const detections: Detection[] = [];
  let found = false;
  const formatMethods = [
    "toLocaleDateString",
    "toLocaleTimeString",
    "toLocaleString",
    "toISOString",
    "toDateString",
    "toTimeString",
    "toUTCString",
  ];

  traverse(ast, (node) => {
    if (found) return;

    if (
      isNodeType<{ callee?: { type?: string; property?: { name?: string } } }>(
        node,
        "CallExpression",
      )
    ) {
      const call = node as {
        callee?: { type?: string; property?: { name?: string } };
      };
      if (call.callee?.type === "MemberExpression") {
        const prop = call.callee.property?.name;
        if (prop && formatMethods.includes(prop)) {
          found = true;
          detections.push({
            topicSlug: "date-formatting",
            detected: true,
            isPositive: true,
            isNegative: false,
            isIdiomatic: prop.startsWith("toLocale") || prop === "toISOString",
            location: getNodeLocation(node) ?? undefined,
            details: `.${prop}() used for date formatting`,
          });
        }
      }
    }

    // Intl.DateTimeFormat
    if (
      !found &&
      isNodeType<{
        callee?: { object?: { name?: string }; property?: { name?: string } };
      }>(node, "NewExpression")
    ) {
      const newExpr = node as {
        callee?: { object?: { name?: string }; property?: { name?: string } };
      };
      if (
        newExpr.callee?.object?.name === "Intl" &&
        newExpr.callee?.property?.name === "DateTimeFormat"
      ) {
        found = true;
        detections.push({
          topicSlug: "date-formatting",
          detected: true,
          isPositive: true,
          isNegative: false,
          isIdiomatic: true,
          location: getNodeLocation(node) ?? undefined,
          details: "Intl.DateTimeFormat used for locale-aware date formatting",
        });
      }
    }
  });

  return detections;
}

// =============================================
// date-methods: getTime, getFullYear, setDate, etc.
// =============================================

function detectDateMethods(ast: File): Detection[] {
  const detections: Detection[] = [];
  let found = false;
  const dateMethods = [
    "getTime",
    "getFullYear",
    "getMonth",
    "getDate",
    "getDay",
    "getHours",
    "getMinutes",
    "getSeconds",
    "getMilliseconds",
    "setFullYear",
    "setMonth",
    "setDate",
    "setHours",
    "setMinutes",
  ];

  traverse(ast, (node) => {
    if (found) return;
    if (
      isNodeType<{ callee?: { type?: string; property?: { name?: string } } }>(
        node,
        "CallExpression",
      )
    ) {
      const call = node as {
        callee?: { type?: string; property?: { name?: string } };
      };
      if (call.callee?.type === "MemberExpression") {
        const prop = call.callee.property?.name;
        if (prop && dateMethods.includes(prop)) {
          found = true;
          detections.push({
            topicSlug: "date-methods",
            detected: true,
            isPositive: true,
            isNegative: false,
            isIdiomatic: true,
            location: getNodeLocation(node) ?? undefined,
            details: `.${prop}() Date method used`,
          });
        }
      }
    }
  });

  return detections;
}

// =============================================
// Main Detector Function
// =============================================

export function detectDateHandling(ast: File): Detection[] {
  return [
    ...detectDateCreation(ast),
    ...detectDateFormatting(ast),
    ...detectDateMethods(ast),
  ];
}
