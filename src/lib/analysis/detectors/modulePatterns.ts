// =============================================
// Module Patterns Detectors
// Detects: import/export (default, named, namespace, dynamic)
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
// import-export-named
// =============================================

function detectNamedImportExport(ast: File): Detection[] {
  const detections: Detection[] = [];
  let foundImport = false;
  let foundExport = false;

  traverse(ast, (node) => {
    // Named imports: import { x } from 'y'
    if (!foundImport && isNodeType<{ specifiers?: Array<{ type?: string }> }>(node, "ImportDeclaration")) {
      const decl = node as { specifiers?: Array<{ type?: string }> };
      const hasNamed = decl.specifiers?.some((s) => s.type === "ImportSpecifier");
      if (hasNamed) {
        foundImport = true;
        detections.push({
          topicSlug: "import-export-named",
          detected: true,
          isPositive: true,
          isNegative: false,
          isIdiomatic: true,
          location: getNodeLocation(node) ?? undefined,
          details: "Named import used",
        });
      }
    }

    // Named exports: export { x } or export const x = ...
    if (!foundExport && isNodeType(node, "ExportNamedDeclaration")) {
      foundExport = true;
      detections.push({
        topicSlug: "import-export-named",
        detected: true,
        isPositive: true,
        isNegative: false,
        isIdiomatic: true,
        location: getNodeLocation(node) ?? undefined,
        details: "Named export used",
      });
    }
  });

  return detections;
}

// =============================================
// import-export-default
// =============================================

function detectDefaultImportExport(ast: File): Detection[] {
  const detections: Detection[] = [];
  let foundImport = false;
  let foundExport = false;

  traverse(ast, (node) => {
    // Default imports: import x from 'y'
    if (!foundImport && isNodeType<{ specifiers?: Array<{ type?: string }> }>(node, "ImportDeclaration")) {
      const decl = node as { specifiers?: Array<{ type?: string }> };
      const hasDefault = decl.specifiers?.some((s) => s.type === "ImportDefaultSpecifier");
      if (hasDefault) {
        foundImport = true;
        detections.push({
          topicSlug: "import-export-default",
          detected: true,
          isPositive: true,
          isNegative: false,
          isIdiomatic: true,
          location: getNodeLocation(node) ?? undefined,
          details: "Default import used",
        });
      }
    }

    // Default exports: export default ...
    if (!foundExport && isNodeType(node, "ExportDefaultDeclaration")) {
      foundExport = true;
      detections.push({
        topicSlug: "import-export-default",
        detected: true,
        isPositive: true,
        isNegative: false,
        isIdiomatic: true,
        location: getNodeLocation(node) ?? undefined,
        details: "Default export used",
      });
    }
  });

  return detections;
}

// =============================================
// import-dynamic: import('...')
// =============================================

function detectDynamicImport(ast: File): Detection[] {
  const detections: Detection[] = [];
  let found = false;

  traverse(ast, (node) => {
    if (found) return;
    // Babel parses dynamic import() as CallExpression with callee type "Import"
    // or as an ImportExpression node
    if (isNodeType(node, "ImportExpression") || isNodeType(node, "Import")) {
      found = true;
      detections.push({
        topicSlug: "import-dynamic",
        detected: true,
        isPositive: true,
        isNegative: false,
        isIdiomatic: true,
        location: getNodeLocation(node) ?? undefined,
        details: "Dynamic import() used for code splitting",
      });
    }

    // Also check for CallExpression with callee type "Import"
    if (!found && isNodeType<{ callee?: { type?: string } }>(node, "CallExpression")) {
      const call = node as { callee?: { type?: string } };
      if (call.callee?.type === "Import") {
        found = true;
        detections.push({
          topicSlug: "import-dynamic",
          detected: true,
          isPositive: true,
          isNegative: false,
          isIdiomatic: true,
          location: getNodeLocation(node) ?? undefined,
          details: "Dynamic import() used for code splitting",
        });
      }
    }
  });

  return detections;
}

// =============================================
// import-namespace: import * as x from 'y'
// =============================================

function detectNamespaceImport(ast: File): Detection[] {
  const detections: Detection[] = [];
  let found = false;

  traverse(ast, (node) => {
    if (found) return;
    if (isNodeType<{ specifiers?: Array<{ type?: string }> }>(node, "ImportDeclaration")) {
      const decl = node as { specifiers?: Array<{ type?: string }> };
      const hasNamespace = decl.specifiers?.some((s) => s.type === "ImportNamespaceSpecifier");
      if (hasNamespace) {
        found = true;
        detections.push({
          topicSlug: "import-namespace",
          detected: true,
          isPositive: true,
          isNegative: false,
          isIdiomatic: true,
          location: getNodeLocation(node) ?? undefined,
          details: "Namespace import (import * as ...) used",
        });
      }
    }
  });

  return detections;
}

// =============================================
// Main Detector Function
// =============================================

export function detectModulePatterns(ast: File): Detection[] {
  return [
    ...detectNamedImportExport(ast),
    ...detectDefaultImportExport(ast),
    ...detectDynamicImport(ast),
    ...detectNamespaceImport(ast),
  ];
}
