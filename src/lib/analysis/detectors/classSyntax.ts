// =============================================
// Class Syntax Detectors
// Detects: declaration, methods, inheritance, getters/setters,
//          private fields, properties
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
// class-declaration
// =============================================

function detectClassDeclaration(ast: File): Detection[] {
  const detections: Detection[] = [];
  let found = false;

  traverse(ast, (node) => {
    if (found) return;
    if (isNodeType(node, "ClassDeclaration") || isNodeType(node, "ClassExpression")) {
      found = true;
      const cls = node as { id?: { name?: string } };
      detections.push({
        topicSlug: "class-declaration",
        detected: true,
        isPositive: true,
        isNegative: false,
        isIdiomatic: true,
        location: getNodeLocation(node) ?? undefined,
        details: cls.id?.name
          ? `Class '${cls.id.name}' declared`
          : "Class expression used",
      });
    }
  });

  return detections;
}

// =============================================
// class-methods
// =============================================

function detectClassMethods(ast: File): Detection[] {
  const detections: Detection[] = [];
  let found = false;

  traverse(ast, (node) => {
    if (found) return;
    if (isNodeType<{ kind?: string; key?: { name?: string } }>(node, "ClassMethod")) {
      const method = node as { kind?: string; key?: { name?: string } };
      if (method.kind === "method" || method.kind === "constructor") {
        found = true;
        detections.push({
          topicSlug: "class-methods",
          detected: true,
          isPositive: true,
          isNegative: false,
          isIdiomatic: true,
          location: getNodeLocation(node) ?? undefined,
          details: method.kind === "constructor"
            ? "Class constructor defined"
            : `Class method '${method.key?.name}' defined`,
        });
      }
    }
  });

  return detections;
}

// =============================================
// class-inheritance: extends
// =============================================

function detectClassInheritance(ast: File): Detection[] {
  const detections: Detection[] = [];
  let found = false;

  traverse(ast, (node) => {
    if (found) return;
    if (isNodeType(node, "ClassDeclaration") || isNodeType(node, "ClassExpression")) {
      const cls = node as { superClass?: { name?: string; type?: string } };
      if (cls.superClass) {
        found = true;
        detections.push({
          topicSlug: "class-inheritance",
          detected: true,
          isPositive: true,
          isNegative: false,
          isIdiomatic: true,
          location: getNodeLocation(node) ?? undefined,
          details: `Class extends ${cls.superClass.name ?? "parent class"}`,
        });
      }
    }
  });

  return detections;
}

// =============================================
// class-getters-setters
// =============================================

function detectClassGettersSetters(ast: File): Detection[] {
  const detections: Detection[] = [];
  let found = false;

  traverse(ast, (node) => {
    if (found) return;
    if (isNodeType<{ kind?: string; key?: { name?: string } }>(node, "ClassMethod")) {
      const method = node as { kind?: string; key?: { name?: string } };
      if (method.kind === "get" || method.kind === "set") {
        found = true;
        detections.push({
          topicSlug: "class-getters-setters",
          detected: true,
          isPositive: true,
          isNegative: false,
          isIdiomatic: true,
          location: getNodeLocation(node) ?? undefined,
          details: `Class ${method.kind}ter '${method.key?.name}' defined`,
        });
      }
    }
  });

  return detections;
}

// =============================================
// class-private-fields: #privateField
// =============================================

function detectClassPrivateFields(ast: File): Detection[] {
  const detections: Detection[] = [];
  let found = false;

  traverse(ast, (node) => {
    if (found) return;

    // ClassPrivateProperty or ClassPrivateMethod
    if (
      isNodeType(node, "ClassPrivateProperty") ||
      isNodeType(node, "ClassPrivateMethod")
    ) {
      found = true;
      detections.push({
        topicSlug: "class-private-fields",
        detected: true,
        isPositive: true,
        isNegative: false,
        isIdiomatic: true,
        location: getNodeLocation(node) ?? undefined,
        details: "Private class member (#) used",
      });
    }

    // Also check ClassProperty with key.type === "PrivateName"
    if (isNodeType<{ key?: { type?: string } }>(node, "ClassProperty")) {
      const prop = node as { key?: { type?: string } };
      if (prop.key?.type === "PrivateName") {
        found = true;
        detections.push({
          topicSlug: "class-private-fields",
          detected: true,
          isPositive: true,
          isNegative: false,
          isIdiomatic: true,
          location: getNodeLocation(node) ?? undefined,
          details: "Private class field (#) used",
        });
      }
    }
  });

  return detections;
}

// =============================================
// class-properties: Public class fields
// =============================================

function detectClassProperties(ast: File): Detection[] {
  const detections: Detection[] = [];
  let found = false;

  traverse(ast, (node) => {
    if (found) return;
    if (isNodeType<{ key?: { type?: string; name?: string } }>(node, "ClassProperty")) {
      const prop = node as { key?: { type?: string; name?: string } };
      if (prop.key?.type !== "PrivateName") {
        found = true;
        detections.push({
          topicSlug: "class-properties",
          detected: true,
          isPositive: true,
          isNegative: false,
          isIdiomatic: true,
          location: getNodeLocation(node) ?? undefined,
          details: `Class property '${prop.key?.name}' declared`,
        });
      }
    }
  });

  return detections;
}

// =============================================
// Main Detector Function
// =============================================

export function detectClassSyntax(ast: File): Detection[] {
  return [
    ...detectClassDeclaration(ast),
    ...detectClassMethods(ast),
    ...detectClassInheritance(ast),
    ...detectClassGettersSetters(ast),
    ...detectClassPrivateFields(ast),
    ...detectClassProperties(ast),
  ];
}
