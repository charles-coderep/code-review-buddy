// =============================================
// Variable & Object Pattern Detectors
// Detects: var-hoisting, temporal-dead-zone, block-vs-function-scope, object-shorthand
// =============================================

import type { File } from "@babel/types";
import { traverse, getNodeLocation, isNodeType } from "../parser";

export interface VariableDetection {
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
// var-hoisting: Detect var declarations that could cause hoisting issues
// =============================================

export function detectVarHoisting(ast: File): VariableDetection[] {
  const detections: VariableDetection[] = [];

  // Track var declarations inside functions/blocks
  traverse(ast, (node) => {
    if (!isNodeType<{ kind?: string; declarations?: Array<{ id?: { name?: string } }> }>(
      node,
      "VariableDeclaration"
    )) return;

    const varNode = node as {
      kind?: string;
      declarations?: Array<{ id?: { name?: string } }>;
    };

    if (varNode.kind === "var") {
      detections.push({
        topicSlug: "var-hoisting",
        detected: true,
        isPositive: false,
        isNegative: true,
        isIdiomatic: false,
        isTrivial: true,
        location: getNodeLocation(node) ?? undefined,
        details: "var declaration is hoisted to function scope - prefer let/const",
      });
    }
  });

  return detections;
}

// =============================================
// temporal-dead-zone: Detect potential TDZ issues with let/const
// =============================================

export function detectTemporalDeadZone(ast: File): VariableDetection[] {
  const detections: VariableDetection[] = [];

  // Look for let/const declarations that have references before them in the same scope
  const visit = (node: unknown, scopeVars: Map<string, number>): void => {
    if (!node || typeof node !== "object") return;
    const n = node as Record<string, unknown>;

    // Track variable declarations with their line numbers
    if (n.type === "VariableDeclaration") {
      const varNode = n as {
        kind?: string;
        declarations?: Array<{
          id?: { name?: string };
          loc?: { start: { line: number } };
        }>;
      };

      if (varNode.kind === "let" || varNode.kind === "const") {
        for (const decl of varNode.declarations ?? []) {
          if (decl.id?.name && decl.loc?.start) {
            scopeVars.set(decl.id.name, decl.loc.start.line);
          }
        }
      }
    }

    // Check identifier references against known declarations
    if (n.type === "Identifier" && n.name && typeof n.name === "string") {
      const loc = getNodeLocation(node);
      const declLine = scopeVars.get(n.name as string);
      if (loc && declLine && loc.line < declLine) {
        detections.push({
          topicSlug: "temporal-dead-zone",
          detected: true,
          isPositive: false,
          isNegative: true,
          isIdiomatic: false,
          location: loc,
          details: `Variable '${n.name}' referenced before declaration (temporal dead zone)`,
        });
      }
    }

    // New scope for functions - create fresh scope
    if (
      n.type === "FunctionDeclaration" ||
      n.type === "FunctionExpression" ||
      n.type === "ArrowFunctionExpression"
    ) {
      const innerScope = new Map<string, number>();
      for (const key of Object.keys(n)) {
        if (key === "loc" || key === "start" || key === "end") continue;
        const value = n[key];
        if (Array.isArray(value)) {
          value.forEach((child) => visit(child, innerScope));
        } else if (value && typeof value === "object") {
          visit(value, innerScope);
        }
      }
      return;
    }

    for (const key of Object.keys(n)) {
      if (key === "loc" || key === "start" || key === "end") continue;
      const value = n[key];
      if (Array.isArray(value)) {
        value.forEach((child) => visit(child, scopeVars));
      } else if (value && typeof value === "object") {
        visit(value, scopeVars);
      }
    }
  };

  visit(ast.program, new Map());

  return detections;
}

// =============================================
// block-vs-function-scope: Detect var in block scope vs let/const
// =============================================

export function detectBlockVsFunctionScope(ast: File): VariableDetection[] {
  const detections: VariableDetection[] = [];
  const blockTypes = ["IfStatement", "ForStatement", "ForInStatement", "ForOfStatement", "WhileStatement", "DoWhileStatement", "SwitchCase"];

  const visit = (node: unknown, insideBlock: boolean): void => {
    if (!node || typeof node !== "object") return;
    const n = node as Record<string, unknown>;

    const isBlockNode = blockTypes.includes(n.type as string);
    const nowInsideBlock = insideBlock || isBlockNode;

    if (n.type === "VariableDeclaration") {
      const varNode = n as { kind?: string };
      if (varNode.kind === "var" && nowInsideBlock) {
        detections.push({
          topicSlug: "block-vs-function-scope",
          detected: true,
          isPositive: false,
          isNegative: true,
          isIdiomatic: false,
          location: getNodeLocation(node) ?? undefined,
          details: "var inside block - leaks to function scope. Use let/const for block scoping",
        });
      } else if ((varNode.kind === "let" || varNode.kind === "const") && nowInsideBlock) {
        detections.push({
          topicSlug: "block-vs-function-scope",
          detected: true,
          isPositive: true,
          isNegative: false,
          isIdiomatic: true,
          location: getNodeLocation(node) ?? undefined,
          details: "Block-scoped variable declaration with let/const",
        });
      }
    }

    for (const key of Object.keys(n)) {
      if (key === "loc" || key === "start" || key === "end") continue;
      const value = n[key];
      if (Array.isArray(value)) {
        value.forEach((child) => visit(child, nowInsideBlock));
      } else if (value && typeof value === "object") {
        visit(value, nowInsideBlock);
      }
    }
  };

  visit(ast.program, false);

  // Deduplicate - report at most one positive and one negative
  const hasNegative = detections.some((d) => d.isNegative);
  const hasPositive = detections.some((d) => d.isPositive);
  const result: VariableDetection[] = [];
  if (hasNegative) {
    result.push(detections.find((d) => d.isNegative)!);
  }
  if (hasPositive && !hasNegative) {
    result.push(detections.find((d) => d.isPositive)!);
  }
  return result;
}

// =============================================
// object-shorthand: Detect {key: key} that could be {key}
// =============================================

export function detectObjectShorthand(ast: File): VariableDetection[] {
  const detections: VariableDetection[] = [];
  let hasShorthand = false;
  let hasLonghand = false;

  traverse(ast, (node) => {
    if (!isNodeType<{
      shorthand?: boolean;
      key?: { name?: string };
      value?: { name?: string; type?: string };
      computed?: boolean;
      method?: boolean;
    }>(node, "ObjectProperty")) return;

    const prop = node as {
      shorthand?: boolean;
      key?: { name?: string; type?: string };
      value?: { name?: string; type?: string };
      computed?: boolean;
      method?: boolean;
    };

    // Only check identifier properties (not computed, not methods)
    if (prop.computed || prop.method) return;
    if (prop.key?.type !== "Identifier") return;

    if (prop.shorthand) {
      if (!hasShorthand) {
        hasShorthand = true;
        detections.push({
          topicSlug: "object-shorthand",
          detected: true,
          isPositive: true,
          isNegative: false,
          isIdiomatic: true,
          location: getNodeLocation(node) ?? undefined,
          details: "Object shorthand property used",
        });
      }
    } else if (
      prop.value?.type === "Identifier" &&
      prop.key?.name === prop.value?.name
    ) {
      if (!hasLonghand) {
        hasLonghand = true;
        detections.push({
          topicSlug: "object-shorthand",
          detected: true,
          isPositive: false,
          isNegative: true,
          isIdiomatic: false,
          isTrivial: true,
          location: getNodeLocation(node) ?? undefined,
          details: `{${prop.key.name}: ${prop.key.name}} can be shortened to {${prop.key.name}}`,
        });
      }
    }
  });

  return detections;
}

// =============================================
// Main Detector Function
// =============================================

export function detectVariablePatterns(ast: File): VariableDetection[] {
  return [
    ...detectVarHoisting(ast),
    ...detectTemporalDeadZone(ast),
    ...detectBlockVsFunctionScope(ast),
    ...detectObjectShorthand(ast),
  ];
}
