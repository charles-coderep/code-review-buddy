// =============================================
// Type Inference Utility
// Tracks variable types through the AST for use by detectors
// =============================================

import type { File } from "@babel/types";
import { traverse, isNodeType } from "./parser";

export type InferredType =
  | "array"
  | "object"
  | "string"
  | "number"
  | "boolean"
  | "function"
  | "regexp"
  | "null"
  | "undefined"
  | "map"
  | "set"
  | "date"
  | "promise"
  | "unknown";

/**
 * Build a map of variable name -> inferred type from the AST.
 * Uses initializer expressions to infer types.
 */
export function buildTypeMap(ast: File): Map<string, InferredType> {
  const typeMap = new Map<string, InferredType>();

  traverse(ast, (node) => {
    if (
      !isNodeType<{
        id?: { type?: string; name?: string };
        init?: { type?: string; callee?: { name?: string; object?: { name?: string }; property?: { name?: string } }; value?: unknown };
      }>(node, "VariableDeclarator")
    )
      return;

    const decl = node as {
      id?: { type?: string; name?: string };
      init?: {
        type?: string;
        callee?: { name?: string; object?: { name?: string }; property?: { name?: string } };
        value?: unknown;
        regex?: unknown;
      };
    };

    if (decl.id?.type !== "Identifier" || !decl.id.name) return;
    if (!decl.init) return;

    const inferred = inferTypeFromNode(decl.init);
    if (inferred !== "unknown") {
      typeMap.set(decl.id.name, inferred);
    }
  });

  return typeMap;
}

/**
 * Infer a type from an AST expression node.
 */
export function inferTypeFromNode(node: {
  type?: string;
  callee?: { name?: string; object?: { name?: string }; property?: { name?: string } };
  value?: unknown;
  regex?: unknown;
}): InferredType {
  if (!node || !node.type) return "unknown";

  switch (node.type) {
    case "ArrayExpression":
      return "array";
    case "ObjectExpression":
      return "object";
    case "StringLiteral":
    case "TemplateLiteral":
      return "string";
    case "NumericLiteral":
      return "number";
    case "BooleanLiteral":
      return "boolean";
    case "NullLiteral":
      return "null";
    case "RegExpLiteral":
      return "regexp";
    case "ArrowFunctionExpression":
    case "FunctionExpression":
      return "function";
    case "NewExpression": {
      const calleeName = node.callee?.name;
      if (calleeName === "Map") return "map";
      if (calleeName === "Set") return "set";
      if (calleeName === "Date") return "date";
      if (calleeName === "Promise") return "promise";
      if (calleeName === "Array") return "array";
      if (calleeName === "RegExp") return "regexp";
      return "object";
    }
    case "CallExpression": {
      const callName = node.callee?.name;
      const objName = node.callee?.object?.name;
      const propName = node.callee?.property?.name;
      if (callName === "Array" || (objName === "Array" && propName === "from")) return "array";
      if (callName === "String") return "string";
      if (callName === "Number" || callName === "parseInt" || callName === "parseFloat") return "number";
      if (callName === "Boolean") return "boolean";
      if (objName === "Object" && (propName === "keys" || propName === "values" || propName === "entries")) return "array";
      if (objName === "Object" && (propName === "assign" || propName === "create" || propName === "fromEntries")) return "object";
      if (objName === "JSON" && propName === "stringify") return "string";
      return "unknown";
    }
    case "Identifier": {
      if (node.value === undefined) return "unknown";
      return "unknown";
    }
    default:
      return "unknown";
  }
}

/**
 * Check if a variable is inferred to be a specific type
 */
export function isVariableType(
  typeMap: Map<string, InferredType>,
  varName: string,
  expectedType: InferredType
): boolean {
  return typeMap.get(varName) === expectedType;
}

// =============================================
// Alias Tracking
// Tracks when variables or properties point to the same object
// =============================================

export interface AliasInfo {
  /** The original source variable name */
  source: string;
  /** All variable names / property paths that alias this source */
  aliases: Set<string>;
}

export interface AliasMap {
  /** Map from variable/path → canonical source name */
  aliasOf: Map<string, string>;
  /** Map from source name → all aliases */
  aliasesFor: Map<string, Set<string>>;
  /** Set of source names that were mutated via any alias */
  mutated: Set<string>;
  /** Locations of mutations: source → [{path, line, column}] */
  mutations: Map<string, Array<{ path: string; line: number; column: number }>>;
}

/**
 * Build alias map from the AST.
 * Tracks object/array variables assigned to other variables or properties.
 * Detects when aliased objects are mutated.
 */
export function buildAliasMap(ast: File, typeMap: Map<string, InferredType>): AliasMap {
  const aliasOf = new Map<string, string>();
  const aliasesFor = new Map<string, Set<string>>();
  const mutated = new Set<string>();
  const mutations = new Map<string, Array<{ path: string; line: number; column: number }>>();

  // Helper: register a canonical source
  function ensureSource(name: string) {
    if (!aliasesFor.has(name)) {
      aliasesFor.set(name, new Set([name]));
    }
  }

  // Helper: get canonical source for a name
  function getCanonical(name: string): string {
    return aliasOf.get(name) ?? name;
  }

  // Helper: register an alias
  function addAlias(alias: string, source: string) {
    const canonical = getCanonical(source);
    ensureSource(canonical);
    aliasOf.set(alias, canonical);
    aliasesFor.get(canonical)!.add(alias);
  }

  // Helper: record a mutation
  function recordMutation(path: string, line: number, column: number) {
    // Find the root variable being mutated
    const rootVar = path.split(".")[0];
    const canonical = getCanonical(rootVar);
    if (aliasesFor.has(canonical) && aliasesFor.get(canonical)!.size > 1) {
      mutated.add(canonical);
      if (!mutations.has(canonical)) {
        mutations.set(canonical, []);
      }
      mutations.get(canonical)!.push({ path, line, column });
    }
  }

  // Pass 1: Track object/array variable declarations and assignments
  traverse(ast, (node) => {
    // Track: const b = a (where a is an object/array)
    if (isNodeType<{
      id?: { type?: string; name?: string };
      init?: { type?: string; name?: string };
    }>(node, "VariableDeclarator")) {
      const decl = node as {
        id?: { type?: string; name?: string };
        init?: { type?: string; name?: string };
      };
      if (
        decl.id?.type === "Identifier" &&
        decl.init?.type === "Identifier" &&
        decl.id.name &&
        decl.init.name
      ) {
        const sourceType = typeMap.get(decl.init.name);
        if (sourceType === "object" || sourceType === "array") {
          ensureSource(decl.init.name);
          addAlias(decl.id.name, decl.init.name);
        }
      }

      // Track: const obj = { ..., prop: sharedRef }
      if (
        decl.id?.type === "Identifier" &&
        decl.id.name &&
        decl.init &&
        (decl.init as { type?: string }).type === "ObjectExpression"
      ) {
        const objExpr = decl.init as { properties?: Array<{
          type?: string;
          key?: { name?: string; value?: string };
          value?: { type?: string; name?: string };
        }> };
        if (objExpr.properties) {
          for (const prop of objExpr.properties) {
            if (
              prop.type === "ObjectProperty" &&
              prop.value?.type === "Identifier" &&
              prop.value.name
            ) {
              const refType = typeMap.get(prop.value.name);
              if (refType === "object" || refType === "array") {
                const propPath = `${decl.id.name}.${prop.key?.name ?? prop.key?.value ?? "?"}`;
                ensureSource(prop.value.name);
                addAlias(propPath, prop.value.name);
              }
            }
          }
        }
      }
    }
  });

  // Pass 2: Detect mutations via property assignment
  traverse(ast, (node) => {
    if (!isNodeType<{
      operator?: string;
      left?: {
        type?: string;
        object?: { type?: string; name?: string; object?: { type?: string; name?: string }; property?: { name?: string } };
        property?: { name?: string };
      };
      loc?: { start: { line: number; column: number } };
    }>(node, "AssignmentExpression")) return;

    const assign = node as {
      operator?: string;
      left?: {
        type?: string;
        object?: { type?: string; name?: string; object?: { type?: string; name?: string }; property?: { name?: string } };
        property?: { name?: string };
      };
      loc?: { start: { line: number; column: number } };
    };

    if (assign.left?.type !== "MemberExpression") return;

    const loc = assign.loc?.start ?? { line: 0, column: 0 };

    // Direct: obj.prop = value
    if (assign.left.object?.type === "Identifier" && assign.left.object.name && assign.left.property?.name) {
      const path = `${assign.left.object.name}.${assign.left.property.name}`;
      recordMutation(path, loc.line, loc.column);
    }

    // Nested: obj.nested.prop = value
    if (
      assign.left.object?.type === "MemberExpression" &&
      assign.left.object.object?.type === "Identifier" &&
      assign.left.object.object.name &&
      assign.left.object.property?.name &&
      assign.left.property?.name
    ) {
      const path = `${assign.left.object.object.name}.${assign.left.object.property.name}.${assign.left.property.name}`;
      recordMutation(path, loc.line, loc.column);
    }
  });

  return { aliasOf, aliasesFor, mutated, mutations };
}
