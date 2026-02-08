// =============================================
// Data Flow Detector Module
// Catches semantic patterns through AST analysis + type inference
// 12 topics that Babel syntax detectors and ESLint rules miss
// =============================================

import type { File } from "@babel/types";
import { traverse, isNodeType, getNodeLocation } from "./parser";
import { buildTypeMap, buildAliasMap, type InferredType } from "./typeInference";
import type { Detection } from "./index";

// =============================================
// Main Entry Point
// =============================================

export function analyzeDataFlow(ast: File, isReact: boolean): Detection[] {
  const typeMap = buildTypeMap(ast);
  const aliasMap = buildAliasMap(ast, typeMap);

  const detections: Detection[] = [];

  // Always run JS detectors
  detections.push(...detectObjectReferenceSharing(ast, aliasMap));
  detections.push(...detectNestedTernary(ast));
  detections.push(...detectDeepNesting(ast));
  detections.push(...detectLongParameterList(ast));
  detections.push(...detectObjectSpreadMissing(ast, typeMap));
  detections.push(...detectArrayMethodNoReturn(ast));
  detections.push(...detectVarUsedBeforeInit(ast));
  detections.push(...detectArrayAsObject(ast, typeMap));
  detections.push(...detectLoopBoundsOffByOne(ast, typeMap));
  detections.push(...detectStringArithmeticCoercion(ast, typeMap));
  detections.push(...detectShallowCopyNestedMutation(ast, typeMap));
  detections.push(...detectArraySelfMutationInIteration(ast));

  // React-only detectors
  if (isReact) {
    detections.push(...detectStateMutationReact(ast));
    detections.push(...detectMissingCleanupEffect(ast));
  }

  // Tag all detections with source
  for (const d of detections) {
    d.source = "dataflow";
  }

  return detections;
}

// =============================================
// 1. object-reference-sharing
// Detect when same object is assigned to multiple variables/properties,
// then mutated through one — affecting all references
// =============================================

function detectObjectReferenceSharing(
  ast: File,
  aliasMap: ReturnType<typeof buildAliasMap>
): Detection[] {
  const detections: Detection[] = [];

  for (const [source, mutationList] of aliasMap.mutations) {
    const aliases = aliasMap.aliasesFor.get(source);
    if (!aliases || aliases.size < 2) continue;

    const aliasNames = [...aliases].filter((a) => a !== source);

    for (const mutation of mutationList) {
      detections.push({
        topicSlug: "object-reference-sharing",
        detected: true,
        isPositive: false,
        isNegative: true,
        isIdiomatic: false,
        location: { line: mutation.line, column: mutation.column },
        details: `Mutating shared object '${source}' via '${mutation.path}' — also referenced by ${aliasNames.join(", ")}. Use spread/Object.assign to create a copy first.`,
      });
    }
  }

  return detections;
}

// =============================================
// 2. nested-ternary
// Ternary operators nested more than one level deep
// =============================================

function detectNestedTernary(ast: File): Detection[] {
  const detections: Detection[] = [];

  traverse(ast, (node) => {
    if (!isNodeType<{
      consequent?: { type?: string };
      alternate?: { type?: string };
      loc?: { start: { line: number; column: number } };
    }>(node, "ConditionalExpression")) return;

    const ternary = node as {
      consequent?: { type?: string; consequent?: { type?: string } };
      alternate?: { type?: string; alternate?: { type?: string } };
      loc?: { start: { line: number; column: number } };
    };

    // Check if either branch contains another ternary
    const nestedInConsequent = ternary.consequent?.type === "ConditionalExpression";
    const nestedInAlternate = ternary.alternate?.type === "ConditionalExpression";

    // Only flag the OUTER ternary (avoid duplicate detections for inner ones)
    if (nestedInConsequent || nestedInAlternate) {
      const loc = getNodeLocation(node);
      detections.push({
        topicSlug: "nested-ternary",
        detected: true,
        isPositive: false,
        isNegative: true,
        isIdiomatic: false,
        location: loc ?? undefined,
        details: "Nested ternary operator — hard to read. Consider using if/else or early returns instead.",
      });
    }
  });

  return detections;
}

// =============================================
// 3. deep-nesting
// Block statements nested more than 4 levels
// =============================================

function detectDeepNesting(ast: File): Detection[] {
  const detections: Detection[] = [];
  const MAX_DEPTH = 4;
  const flaggedLines = new Set<number>();

  function walkNesting(node: unknown, depth: number): void {
    if (!node || typeof node !== "object") return;
    const n = node as Record<string, unknown>;

    const isBlock =
      n.type === "BlockStatement" ||
      n.type === "IfStatement" ||
      n.type === "ForStatement" ||
      n.type === "ForInStatement" ||
      n.type === "ForOfStatement" ||
      n.type === "WhileStatement" ||
      n.type === "DoWhileStatement" ||
      n.type === "SwitchStatement" ||
      n.type === "TryStatement";

    const newDepth = isBlock ? depth + 1 : depth;

    if (newDepth > MAX_DEPTH && isBlock) {
      const loc = getNodeLocation(node);
      if (loc && !flaggedLines.has(loc.line)) {
        flaggedLines.add(loc.line);
        detections.push({
          topicSlug: "deep-nesting",
          detected: true,
          isPositive: false,
          isNegative: true,
          isIdiomatic: false,
          location: loc,
          details: `Code nested ${newDepth} levels deep — consider extracting into helper functions or using early returns.`,
        });
      }
    }

    for (const key of Object.keys(n)) {
      if (key === "loc" || key === "start" || key === "end") continue;
      const value = n[key];
      if (Array.isArray(value)) {
        value.forEach((child) => walkNesting(child, newDepth));
      } else if (value && typeof value === "object") {
        walkNesting(value, newDepth);
      }
    }
  }

  // Start at depth 0 from program body
  const program = (ast as { program?: { body?: unknown[] } }).program;
  if (program?.body) {
    for (const stmt of program.body) {
      walkNesting(stmt, 0);
    }
  }

  return detections;
}

// =============================================
// 4. long-parameter-list
// Functions with more than 4 parameters
// =============================================

function detectLongParameterList(ast: File): Detection[] {
  const detections: Detection[] = [];
  const MAX_PARAMS = 4;

  traverse(ast, (node) => {
    const n = node as {
      type?: string;
      params?: unknown[];
      id?: { name?: string };
      key?: { name?: string };
      loc?: { start: { line: number; column: number } };
    };

    if (
      n.type !== "FunctionDeclaration" &&
      n.type !== "FunctionExpression" &&
      n.type !== "ArrowFunctionExpression" &&
      n.type !== "ObjectMethod" &&
      n.type !== "ClassMethod"
    ) return;

    if (!n.params || n.params.length <= MAX_PARAMS) return;

    const name = n.id?.name ?? n.key?.name ?? "anonymous";
    const loc = getNodeLocation(node);

    detections.push({
      topicSlug: "long-parameter-list",
      detected: true,
      isPositive: false,
      isNegative: true,
      isIdiomatic: false,
      location: loc ?? undefined,
      details: `Function '${name}' has ${n.params.length} parameters — consider using an options object instead.`,
    });
  });

  return detections;
}

// =============================================
// 5. state-mutation-react
// Direct mutation of useState variables
// =============================================

function detectStateMutationReact(ast: File): Detection[] {
  const detections: Detection[] = [];
  const stateVars = new Set<string>();

  // Pass 1: Find all state variables from useState
  traverse(ast, (node) => {
    if (!isNodeType<{
      id?: { type?: string; elements?: Array<{ type?: string; name?: string }> };
      init?: { type?: string; callee?: { type?: string; name?: string } };
    }>(node, "VariableDeclarator")) return;

    const decl = node as {
      id?: { type?: string; elements?: Array<{ type?: string; name?: string } | null> };
      init?: { type?: string; callee?: { type?: string; name?: string } };
    };

    if (
      decl.init?.type === "CallExpression" &&
      decl.init.callee?.type === "Identifier" &&
      decl.init.callee.name === "useState" &&
      decl.id?.type === "ArrayPattern" &&
      decl.id.elements
    ) {
      const stateVar = decl.id.elements[0];
      if (stateVar?.type === "Identifier" && stateVar.name) {
        stateVars.add(stateVar.name);
      }
    }
  });

  if (stateVars.size === 0) return detections;

  // Pass 2: Find direct mutations of state variables
  traverse(ast, (node) => {
    if (!isNodeType<{
      operator?: string;
      left?: {
        type?: string;
        object?: { type?: string; name?: string };
        property?: { name?: string };
      };
      loc?: { start: { line: number; column: number } };
    }>(node, "AssignmentExpression")) return;

    const assign = node as {
      left?: {
        type?: string;
        object?: { type?: string; name?: string };
        property?: { name?: string };
      };
      loc?: { start: { line: number; column: number } };
    };

    if (assign.left?.type !== "MemberExpression") return;

    const objName = assign.left.object?.name;
    if (!objName || !stateVars.has(objName)) return;

    const propName = assign.left.property?.name ?? "?";
    const loc = assign.loc?.start;

    detections.push({
      topicSlug: "state-mutation-react",
      detected: true,
      isPositive: false,
      isNegative: true,
      isIdiomatic: false,
      location: loc ? { line: loc.line, column: loc.column } : undefined,
      details: `Direct mutation of state variable '${objName}.${propName}' — use the setter function with a new object/array instead.`,
    });
  });

  // Also check for array mutations on state: state.push(), state.splice(), etc.
  const mutatingMethods = new Set(["push", "pop", "shift", "unshift", "splice", "sort", "reverse", "fill"]);

  traverse(ast, (node) => {
    if (!isNodeType<{
      callee?: {
        type?: string;
        object?: { type?: string; name?: string };
        property?: { name?: string };
      };
      loc?: { start: { line: number; column: number } };
    }>(node, "CallExpression")) return;

    const call = node as {
      callee?: {
        type?: string;
        object?: { type?: string; name?: string };
        property?: { name?: string };
      };
      loc?: { start: { line: number; column: number } };
    };

    if (call.callee?.type !== "MemberExpression") return;

    const objName = call.callee.object?.name;
    const methodName = call.callee.property?.name;
    if (!objName || !methodName) return;
    if (!stateVars.has(objName) || !mutatingMethods.has(methodName)) return;

    const loc = call.loc?.start;

    detections.push({
      topicSlug: "state-mutation-react",
      detected: true,
      isPositive: false,
      isNegative: true,
      isIdiomatic: false,
      location: loc ? { line: loc.line, column: loc.column } : undefined,
      details: `Calling '${objName}.${methodName}()' mutates state directly — use the setter with a new array (e.g., [...${objName}, newItem]).`,
    });
  });

  return detections;
}

// =============================================
// 6. missing-cleanup-effect
// useEffect with subscriptions/intervals/listeners but no cleanup
// =============================================

function detectMissingCleanupEffect(ast: File): Detection[] {
  const detections: Detection[] = [];
  const subscriptionMethods = new Set([
    "addEventListener", "setInterval", "setTimeout",
    "subscribe", "observe", "on",
  ]);

  traverse(ast, (node) => {
    if (!isNodeType<{
      callee?: { type?: string; name?: string };
      arguments?: unknown[];
      loc?: { start: { line: number; column: number } };
    }>(node, "CallExpression")) return;

    const call = node as {
      callee?: { type?: string; name?: string };
      arguments?: unknown[];
      loc?: { start: { line: number; column: number } };
    };

    // Only match useEffect calls
    if (call.callee?.type !== "Identifier" || call.callee.name !== "useEffect") return;

    const callback = call.arguments?.[0] as {
      type?: string;
      body?: { type?: string; body?: unknown[] };
    } | undefined;

    if (!callback) return;
    if (callback.type !== "ArrowFunctionExpression" && callback.type !== "FunctionExpression") return;

    // Check if the callback body contains subscription calls
    let hasSubscription = false;
    let subscriptionName = "";

    function findSubscriptions(n: unknown): void {
      if (!n || typeof n !== "object") return;
      const node = n as Record<string, unknown>;

      if (node.type === "CallExpression") {
        const callee = node.callee as { type?: string; property?: { name?: string }; name?: string } | undefined;
        let methodName: string | undefined;

        if (callee?.type === "MemberExpression" && callee.property?.name) {
          methodName = callee.property.name;
        } else if (callee?.type === "Identifier" && callee.name) {
          methodName = callee.name;
        }

        if (methodName && subscriptionMethods.has(methodName)) {
          hasSubscription = true;
          subscriptionName = methodName;
        }
      }

      for (const key of Object.keys(node)) {
        if (key === "loc" || key === "start" || key === "end") continue;
        const value = node[key];
        if (Array.isArray(value)) {
          value.forEach(findSubscriptions);
        } else if (value && typeof value === "object") {
          findSubscriptions(value);
        }
      }
    }

    findSubscriptions(callback.body);

    if (!hasSubscription) return;

    // Check if the callback returns a cleanup function
    let hasCleanupReturn = false;

    if (callback.body?.type === "BlockStatement" && callback.body.body) {
      for (const stmt of callback.body.body as Array<{ type?: string; argument?: { type?: string } }>) {
        if (
          stmt.type === "ReturnStatement" &&
          stmt.argument &&
          (stmt.argument.type === "ArrowFunctionExpression" ||
           stmt.argument.type === "FunctionExpression")
        ) {
          hasCleanupReturn = true;
          break;
        }
      }
    }

    if (!hasCleanupReturn) {
      const loc = call.loc?.start;
      detections.push({
        topicSlug: "missing-cleanup-effect",
        detected: true,
        isPositive: false,
        isNegative: true,
        isIdiomatic: false,
        location: loc ? { line: loc.line, column: loc.column } : undefined,
        details: `useEffect uses '${subscriptionName}' but has no cleanup return — may cause memory leaks. Return a cleanup function.`,
      });
    }
  });

  return detections;
}

// =============================================
// 7. object-spread-missing
// Object/array assigned by reference where copy would be safer
// Detects: passing mutable object to multiple setState calls,
// or assigning same object to multiple properties without spread
// =============================================

function detectObjectSpreadMissing(
  ast: File,
  typeMap: Map<string, InferredType>
): Detection[] {
  const detections: Detection[] = [];

  // Track how many times each object variable is used as a value
  // in assignments/property values (not as callee, not as member access base)
  const objectVarRefs = new Map<string, Array<{ line: number; column: number; context: string }>>();

  traverse(ast, (node) => {
    // Track: { prop: objVar } in object literals
    if (isNodeType<{
      key?: { name?: string; value?: string };
      value?: { type?: string; name?: string };
      loc?: { start: { line: number; column: number } };
    }>(node, "ObjectProperty")) {
      const prop = node as {
        key?: { name?: string; value?: string };
        value?: { type?: string; name?: string };
        loc?: { start: { line: number; column: number } };
      };

      if (prop.value?.type === "Identifier" && prop.value.name) {
        const varType = typeMap.get(prop.value.name);
        if (varType === "object" || varType === "array") {
          const key = prop.key?.name ?? prop.key?.value ?? "?";
          if (!objectVarRefs.has(prop.value.name)) {
            objectVarRefs.set(prop.value.name, []);
          }
          objectVarRefs.get(prop.value.name)!.push({
            line: prop.loc?.start.line ?? 0,
            column: prop.loc?.start.column ?? 0,
            context: `property '${key}'`,
          });
        }
      }
    }
  });

  // Flag objects assigned to multiple properties without spread
  for (const [varName, refs] of objectVarRefs) {
    if (refs.length < 2) continue;

    detections.push({
      topicSlug: "object-spread-missing",
      detected: true,
      isPositive: false,
      isNegative: true,
      isIdiomatic: false,
      location: refs[1], // Flag at the second usage
      details: `Object '${varName}' assigned by reference to ${refs.length} properties — mutating one affects all. Use spread ({...${varName}}) to create independent copies.`,
    });
  }

  return detections;
}

// =============================================
// 8. array-method-no-return
// Smarter than ESLint: tracks specific methods (.map, .filter, .flatMap)
// and checks block-body callbacks for guaranteed missing return paths
// =============================================

function detectArrayMethodNoReturn(ast: File): Detection[] {
  const detections: Detection[] = [];
  const requiresReturn = new Set(["map", "filter", "find", "findIndex", "some", "every", "flatMap", "reduce"]);

  traverse(ast, (node) => {
    if (!isNodeType<{
      callee?: {
        type?: string;
        property?: { name?: string };
      };
      arguments?: unknown[];
      loc?: { start: { line: number; column: number } };
    }>(node, "CallExpression")) return;

    const call = node as {
      callee?: {
        type?: string;
        property?: { name?: string };
      };
      arguments?: unknown[];
      loc?: { start: { line: number; column: number } };
    };

    if (call.callee?.type !== "MemberExpression") return;
    const methodName = call.callee.property?.name;
    if (!methodName || !requiresReturn.has(methodName)) return;

    const callback = call.arguments?.[0] as {
      type?: string;
      body?: { type?: string; body?: unknown[] };
    } | undefined;

    if (!callback) return;
    if (callback.type !== "ArrowFunctionExpression" && callback.type !== "FunctionExpression") return;

    // Implicit return (expression body arrow) is fine
    if (callback.body?.type !== "BlockStatement") return;

    // Check for missing return: function body has statements but no return
    if (!callback.body.body || callback.body.body.length === 0) {
      const loc = call.loc?.start;
      detections.push({
        topicSlug: "array-method-no-return",
        detected: true,
        isPositive: false,
        isNegative: true,
        isIdiomatic: false,
        location: loc ? { line: loc.line, column: loc.column } : undefined,
        details: `${methodName}() callback has empty body — will always return undefined.`,
      });
      return;
    }

    // Check if there are code paths without return
    const analysis = analyzeReturnPaths(callback.body.body);

    if (!analysis.hasReturn) {
      const loc = call.loc?.start;
      detections.push({
        topicSlug: "array-method-no-return",
        detected: true,
        isPositive: false,
        isNegative: true,
        isIdiomatic: false,
        location: loc ? { line: loc.line, column: loc.column } : undefined,
        details: `${methodName}() callback has no return statement — will produce undefined values.`,
      });
    } else if (analysis.hasConditionalReturn && !analysis.hasUnconditionalReturn) {
      const loc = call.loc?.start;
      detections.push({
        topicSlug: "array-method-no-return",
        detected: true,
        isPositive: false,
        isNegative: true,
        isIdiomatic: false,
        isTrivial: true,
        location: loc ? { line: loc.line, column: loc.column } : undefined,
        details: `${methodName}() callback only returns in some branches — some elements will be undefined.`,
      });
    }
  });

  return detections;
}

// =============================================
// 9. var-used-before-init
// Detects reads of var-declared variables before their initializer line.
// var is hoisted but only the declaration, not the initialization —
// the variable is undefined until the assignment executes.
// =============================================

function detectVarUsedBeforeInit(ast: File): Detection[] {
  const detections: Detection[] = [];

  // Map: variable name → declaration line (only var with initializers)
  const varDeclLines = new Map<string, number>();
  // Set of variable names declared via function declaration (fully hoisted, skip these)
  const funcDeclNames = new Set<string>();

  const program = (ast as { program?: { body?: unknown[] } }).program;
  if (!program?.body) return detections;

  // Pass 1: collect var declarations with initializers and function declarations
  // at the top level of the program body
  for (const stmt of program.body as Array<Record<string, unknown>>) {
    if (stmt.type === "VariableDeclaration" && stmt.kind === "var") {
      const declarations = stmt.declarations as Array<{
        type?: string;
        id?: { type?: string; name?: string };
        init?: unknown;
        loc?: { start: { line: number } };
      }>;
      for (const decl of declarations) {
        if (decl.id?.type === "Identifier" && decl.id.name && decl.init) {
          const line = (stmt as { loc?: { start: { line: number } } }).loc?.start.line ?? decl.loc?.start.line;
          if (line) {
            varDeclLines.set(decl.id.name, line);
          }
        }
      }
    }

    // Function declarations are fully hoisted — not a problem
    if (stmt.type === "FunctionDeclaration") {
      const funcDecl = stmt as { id?: { name?: string } };
      if (funcDecl.id?.name) {
        funcDeclNames.add(funcDecl.id.name);
      }
    }
  }

  if (varDeclLines.size === 0) return detections;

  // Pass 2: find identifier references at the top level that occur before the var declaration line
  // We walk top-level statements and their immediate expressions (not into function bodies)
  const flagged = new Set<string>();

  function scanForRefsInTopLevel(node: unknown, depth: number): void {
    if (!node || typeof node !== "object" || depth > 15) return;
    const n = node as Record<string, unknown>;

    // Stop recursion into function bodies — those execute when called, not in declaration order
    if (
      n.type === "FunctionDeclaration" ||
      n.type === "FunctionExpression" ||
      n.type === "ArrowFunctionExpression"
    ) return;

    // Check identifier references
    if (n.type === "Identifier" && typeof n.name === "string") {
      const declLine = varDeclLines.get(n.name);
      if (declLine && !funcDeclNames.has(n.name)) {
        const refLoc = n.loc as { start: { line: number; column: number } } | undefined;
        const refLine = refLoc?.start.line;
        if (refLine && refLine < declLine && !flagged.has(n.name)) {
          flagged.add(n.name);
          detections.push({
            topicSlug: "var-used-before-init",
            detected: true,
            isPositive: false,
            isNegative: true,
            isIdiomatic: false,
            location: { line: refLine, column: refLoc.start.column },
            details: `Variable '${n.name}' is used on line ${refLine} but not initialized until line ${declLine} — it will be undefined due to var hoisting.`,
          });
        }
      }
    }

    for (const key of Object.keys(n)) {
      if (key === "loc" || key === "start" || key === "end" || key === "leadingComments" || key === "trailingComments") continue;
      const value = n[key];
      if (Array.isArray(value)) {
        value.forEach((child) => scanForRefsInTopLevel(child, depth + 1));
      } else if (value && typeof value === "object") {
        scanForRefsInTopLevel(value, depth + 1);
      }
    }
  }

  for (const stmt of program.body as Array<Record<string, unknown>>) {
    // Only scan statements that appear before any var declaration in the map
    const stmtLine = (stmt as { loc?: { start: { line: number } } }).loc?.start.line;
    if (!stmtLine) continue;

    // Skip the var declarations themselves
    if (stmt.type === "VariableDeclaration" && stmt.kind === "var") continue;

    scanForRefsInTopLevel(stmt, 0);
  }

  return detections;
}

// =============================================
// 10. array-as-object
// Detects when an array is used with string keys (treating [] as an object).
// This causes .length to be wrong, numeric indexing to miss entries,
// and iteration with for/forEach to skip string-keyed properties.
// =============================================

function detectArrayAsObject(
  ast: File,
  typeMap: Map<string, InferredType>
): Detection[] {
  const detections: Detection[] = [];
  const flaggedVars = new Set<string>();

  traverse(ast, (node) => {
    // Look for assignments like: arr[stringLiteral] = ..., arr[stringVar] = ...,
    // or arr[param] = { ... } (object value assigned to array with variable key)
    if (!isNodeType<{
      operator?: string;
      left?: {
        type?: string;
        computed?: boolean;
        object?: { type?: string; name?: string };
        property?: { type?: string; value?: unknown; name?: string };
      };
      right?: { type?: string };
      loc?: { start: { line: number; column: number } };
    }>(node, "AssignmentExpression")) return;

    const assign = node as {
      left?: {
        type?: string;
        computed?: boolean;
        object?: { type?: string; name?: string };
        property?: { type?: string; value?: unknown; name?: string };
      };
      right?: { type?: string };
      loc?: { start: { line: number; column: number } };
    };

    if (assign.left?.type !== "MemberExpression") return;
    if (!assign.left.computed) return; // dot notation on arrays is fine (e.g. arr.length)

    const objName = assign.left.object?.name;
    if (!objName) return;
    if (typeMap.get(objName) !== "array") return;
    if (flaggedVars.has(objName)) return; // only flag once per variable

    const prop = assign.left.property;
    if (!prop) return;

    // Check if the key is provably or likely a string (not a numeric index)
    let isDictUsage = false;
    let keyDesc = "";

    if (prop.type === "StringLiteral" && typeof prop.value === "string") {
      // arr["name"] = ... — definitely string key
      isDictUsage = true;
      keyDesc = `"${prop.value}"`;
    } else if (prop.type === "Identifier" && prop.name) {
      const varType = typeMap.get(prop.name);
      if (varType === "string") {
        // arr[knownStringVar] = ... — known string type
        isDictUsage = true;
        keyDesc = prop.name;
      } else if (varType === "number") {
        // arr[numVar] = ... — numeric index, valid array usage
        isDictUsage = false;
      } else if (assign.right?.type === "ObjectExpression") {
        // arr[unknownVar] = { ... } — assigning an object value with variable key
        // is a strong signal of dictionary usage (e.g. items[name] = { count: 0 })
        isDictUsage = true;
        keyDesc = prop.name;
      }
    }

    if (!isDictUsage) return;

    flaggedVars.add(objName);
    const loc = assign.loc?.start;

    detections.push({
      topicSlug: "array-as-object",
      detected: true,
      isPositive: false,
      isNegative: true,
      isIdiomatic: false,
      location: loc ? { line: loc.line, column: loc.column } : undefined,
      details: `Array '${objName}' is used with string key ${keyDesc} — this creates object properties that .length, indexing, and iteration will miss. Use an object {} or Map instead.`,
    });
  });

  return detections;
}

// =============================================
// 11. loop-bounds-off-by-one
// Detects for loops where i <= arr.length causes one extra iteration,
// accessing arr[arr.length] which is undefined (out of bounds).
// Only flags when: init starts at 0, test uses <= with .length,
// and the .length object is a known array.
// Does NOT flag: i <= arr.length - 1 (correct equivalent of < .length)
// =============================================

function detectLoopBoundsOffByOne(
  ast: File,
  typeMap: Map<string, InferredType>
): Detection[] {
  const detections: Detection[] = [];

  traverse(ast, (node) => {
    if (!isNodeType<{
      init?: unknown;
      test?: unknown;
      update?: unknown;
      body?: unknown;
      loc?: { start: { line: number; column: number } };
    }>(node, "ForStatement")) return;

    const forStmt = node as {
      init?: {
        type?: string;
        declarations?: Array<{
          id?: { type?: string; name?: string };
          init?: { type?: string; value?: number };
        }>;
      };
      test?: {
        type?: string;
        operator?: string;
        left?: { type?: string; name?: string };
        right?: {
          type?: string;
          operator?: string;
          object?: { type?: string; name?: string };
          property?: { type?: string; name?: string };
          left?: {
            type?: string;
            object?: { type?: string; name?: string };
            property?: { type?: string; name?: string };
          };
          right?: { type?: string; value?: number };
        };
      };
      update?: {
        type?: string;
        operator?: string;
        argument?: { type?: string; name?: string };
      };
      loc?: { start: { line: number; column: number } };
    };

    // --- Check init: must be `let/var i = 0` ---
    if (!forStmt.init || forStmt.init.type !== "VariableDeclaration") return;
    const declarations = forStmt.init.declarations;
    if (!declarations || declarations.length !== 1) return;
    const decl = declarations[0];
    if (decl.id?.type !== "Identifier" || !decl.id.name) return;
    if (!decl.init || decl.init.type !== "NumericLiteral" || decl.init.value !== 0) return;
    const loopVar = decl.id.name;

    // --- Check test: must be `i <= arr.length` ---
    if (!forStmt.test || forStmt.test.type !== "BinaryExpression") return;
    if (forStmt.test.operator !== "<=") return;

    // Left side must be the loop variable
    if (forStmt.test.left?.type !== "Identifier" || forStmt.test.left.name !== loopVar) return;

    const right = forStmt.test.right;
    if (!right) return;

    // Exclude `i <= arr.length - 1` — this is correct (equivalent to `i < arr.length`)
    if (
      right.type === "BinaryExpression" &&
      right.operator === "-" &&
      right.right?.type === "NumericLiteral" &&
      right.right.value === 1 &&
      right.left?.type === "MemberExpression" &&
      right.left.property?.name === "length"
    ) {
      return;
    }

    // Right side must be `arr.length` (MemberExpression with property "length")
    if (right.type !== "MemberExpression") return;
    if (right.property?.type !== "Identifier" || right.property.name !== "length") return;
    if (right.object?.type !== "Identifier" || !right.object.name) return;

    const arrayName = right.object.name;

    // --- Verify the .length object is a known array ---
    const varType = typeMap.get(arrayName);
    if (varType !== "array") return;

    // --- Check update: must be i++ ---
    if (!forStmt.update) return;
    if (forStmt.update.type === "UpdateExpression") {
      if (forStmt.update.operator !== "++" || forStmt.update.argument?.name !== loopVar) return;
    } else {
      return;
    }

    const loc = getNodeLocation(node);
    detections.push({
      topicSlug: "loop-bounds-off-by-one",
      detected: true,
      isPositive: false,
      isNegative: true,
      isIdiomatic: false,
      location: loc ?? undefined,
      details: `Loop uses 'i <= ${arrayName}.length' — this iterates one time too many. When i === ${arrayName}.length, ${arrayName}[i] is undefined (out of bounds). Use 'i < ${arrayName}.length' instead.`,
    });
  });

  return detections;
}

// =============================================
// 12. string-arithmetic-coercion
// Detects arithmetic operations (*, -, /, %) where one operand is
// a known string type or a string literal. JavaScript silently
// coerces the string to a number, producing NaN if it's not numeric.
// Does NOT flag + (string concatenation is a separate, valid operation).
// =============================================

function detectStringArithmeticCoercion(
  ast: File,
  typeMap: Map<string, InferredType>
): Detection[] {
  const detections: Detection[] = [];
  const arithmeticOps = new Set(["*", "-", "/", "%", "**"]);
  let found = false;

  traverse(ast, (node) => {
    if (found) return;

    if (!isNodeType<{
      operator?: string;
      left?: { type?: string; name?: string; value?: unknown };
      right?: { type?: string; name?: string; value?: unknown };
      loc?: { start: { line: number; column: number } };
    }>(node, "BinaryExpression")) return;

    const bin = node as {
      operator?: string;
      left?: { type?: string; name?: string; value?: unknown };
      right?: { type?: string; name?: string; value?: unknown };
      loc?: { start: { line: number; column: number } };
    };

    if (!bin.operator || !arithmeticOps.has(bin.operator)) return;

    // Check if either operand is a known string
    let stringOperand = "";

    // Left operand
    if (bin.left?.type === "StringLiteral") {
      stringOperand = `"${bin.left.value}"`;
    } else if (bin.left?.type === "Identifier" && bin.left.name) {
      if (typeMap.get(bin.left.name) === "string") {
        stringOperand = bin.left.name;
      }
    }

    // Right operand (if left wasn't string)
    if (!stringOperand) {
      if (bin.right?.type === "StringLiteral") {
        stringOperand = `"${bin.right.value}"`;
      } else if (bin.right?.type === "Identifier" && bin.right.name) {
        if (typeMap.get(bin.right.name) === "string") {
          stringOperand = bin.right.name;
        }
      }
    }

    if (!stringOperand) return;

    found = true;
    const loc = getNodeLocation(node);
    detections.push({
      topicSlug: "string-arithmetic-coercion",
      detected: true,
      isPositive: false,
      isNegative: true,
      isIdiomatic: false,
      location: loc ?? undefined,
      details: `Arithmetic operator '${bin.operator}' used with string ${stringOperand} — JavaScript silently coerces strings to numbers, producing NaN for non-numeric strings. Use Number() or parseInt() for explicit conversion.`,
    });
  });

  return detections;
}

// =============================================
// 13. shallow-copy-nested-mutation
// Detects when {...obj} or Object.assign({}, obj) creates a shallow copy
// and then nested properties are mutated through the copy, affecting the original.
// Pattern: const copy = {...original}; copy.nested.prop = val;
// =============================================

function detectShallowCopyNestedMutation(
  ast: File,
  typeMap: Map<string, InferredType>
): Detection[] {
  const detections: Detection[] = [];

  // Pass 1: Track shallow copies — map from copy variable name to original variable name
  // Covers: const copy = {...obj}, const copy = Object.assign({}, obj)
  const shallowCopies = new Map<string, { original: string; line: number }>();

  traverse(ast, (node) => {
    if (!isNodeType<{
      id?: { type?: string; name?: string };
      init?: Record<string, unknown>;
      loc?: { start: { line: number; column: number } };
    }>(node, "VariableDeclarator")) return;

    const decl = node as {
      id?: { type?: string; name?: string };
      init?: Record<string, unknown>;
      loc?: { start: { line: number; column: number } };
    };

    if (!decl.id?.name || !decl.init) return;
    const copyName = decl.id.name;

    // Case 1: const copy = { ...original } or { ...original, extra: val }
    if (decl.init.type === "ObjectExpression") {
      const properties = decl.init.properties as Array<{
        type?: string;
        argument?: { type?: string; name?: string };
      }> | undefined;

      if (properties) {
        for (const prop of properties) {
          if (
            prop.type === "SpreadElement" &&
            prop.argument?.type === "Identifier" &&
            prop.argument.name
          ) {
            const origType = typeMap.get(prop.argument.name);
            if (origType === "object" || !origType) {
              shallowCopies.set(copyName, {
                original: prop.argument.name,
                line: decl.loc?.start.line ?? 0,
              });
            }
            break; // only track the first spread source
          }
        }
      }
    }

    // Case 2: const copy = Object.assign({}, original)
    if (decl.init.type === "CallExpression") {
      const callee = decl.init.callee as {
        type?: string;
        object?: { type?: string; name?: string };
        property?: { type?: string; name?: string };
      } | undefined;

      if (
        callee?.type === "MemberExpression" &&
        callee.object?.name === "Object" &&
        callee.property?.name === "assign"
      ) {
        const args = decl.init.arguments as Array<{
          type?: string;
          name?: string;
          properties?: unknown[];
        }> | undefined;

        // Object.assign({}, original) — first arg is empty object, second is the source
        if (
          args &&
          args.length >= 2 &&
          args[0]?.type === "ObjectExpression" &&
          (!args[0].properties || (args[0].properties as unknown[]).length === 0) &&
          args[1]?.type === "Identifier" &&
          args[1].name
        ) {
          shallowCopies.set(copyName, {
            original: args[1].name,
            line: decl.loc?.start.line ?? 0,
          });
        }
      }
    }

    // Case 3: const copy = [...original] (array shallow copy)
    if (decl.init.type === "ArrayExpression") {
      const elements = decl.init.elements as Array<{
        type?: string;
        argument?: { type?: string; name?: string };
      }> | undefined;

      if (
        elements &&
        elements.length === 1 &&
        elements[0]?.type === "SpreadElement" &&
        elements[0].argument?.type === "Identifier" &&
        elements[0].argument.name
      ) {
        const origType = typeMap.get(elements[0].argument.name);
        if (origType === "array" || !origType) {
          shallowCopies.set(copyName, {
            original: elements[0].argument.name,
            line: decl.loc?.start.line ?? 0,
          });
        }
      }
    }
  });

  if (shallowCopies.size === 0) return detections;

  // Pass 2: Find nested mutations through shallow copies
  // Patterns: copy.nested.prop = val (AssignmentExpression, depth >= 2)
  //           copy.nested.push(...) (CallExpression on mutating method, depth >= 2)
  const flagged = new Set<string>();
  const mutatingMethods = new Set([
    "push", "pop", "shift", "unshift", "splice",
    "sort", "reverse", "fill",
  ]);

  // Helper: resolve the root object name and depth from a MemberExpression chain
  function resolveMemberChain(node: Record<string, unknown>): { root: string; depth: number; path: string } | null {
    let depth = 0;
    let current = node;
    const parts: string[] = [];

    while (current.type === "MemberExpression") {
      depth++;
      const prop = current.property as { name?: string; value?: string } | undefined;
      if (prop?.name) parts.unshift(prop.name);
      else if (prop?.value) parts.unshift(String(prop.value));
      else parts.unshift("?");
      current = current.object as Record<string, unknown>;
      if (!current) return null;
    }

    if (current.type === "Identifier" && typeof current.name === "string") {
      return { root: current.name, depth, path: parts.join(".") };
    }
    return null;
  }

  // Check assignments: copy.nested.prop = val
  traverse(ast, (node) => {
    if (!isNodeType<{
      operator?: string;
      left?: Record<string, unknown>;
      loc?: { start: { line: number; column: number } };
    }>(node, "AssignmentExpression")) return;

    const assign = node as {
      left?: Record<string, unknown>;
      loc?: { start: { line: number; column: number } };
    };

    if (assign.left?.type !== "MemberExpression") return;

    const chain = resolveMemberChain(assign.left);
    if (!chain || chain.depth < 2) return;

    const copyInfo = shallowCopies.get(chain.root);
    if (!copyInfo || flagged.has(chain.root)) return;

    flagged.add(chain.root);
    const loc = assign.loc?.start;

    detections.push({
      topicSlug: "shallow-copy-nested-mutation",
      detected: true,
      isPositive: false,
      isNegative: true,
      isIdiomatic: false,
      location: loc ? { line: loc.line, column: loc.column } : undefined,
      details: `Shallow copy '${chain.root}' (from '${copyInfo.original}') has nested property '${chain.path}' mutated — this modifies the original '${copyInfo.original}' too. Spread/Object.assign only copies the top level. Use structuredClone() or deep-clone nested objects.`,
    });
  });

  // Check method calls: copy.nested.push(...), copy.nested.sort()
  traverse(ast, (node) => {
    if (!isNodeType<{
      callee?: Record<string, unknown>;
      loc?: { start: { line: number; column: number } };
    }>(node, "CallExpression")) return;

    const call = node as {
      callee?: Record<string, unknown>;
      loc?: { start: { line: number; column: number } };
    };

    if (call.callee?.type !== "MemberExpression") return;

    const chain = resolveMemberChain(call.callee);
    if (!chain || chain.depth < 2) return;

    // Check if the leaf method is a mutating method
    const parts = chain.path.split(".");
    const methodName = parts[parts.length - 1];
    if (!mutatingMethods.has(methodName)) return;

    const copyInfo = shallowCopies.get(chain.root);
    if (!copyInfo || flagged.has(chain.root)) return;

    flagged.add(chain.root);
    const loc = call.loc?.start;

    detections.push({
      topicSlug: "shallow-copy-nested-mutation",
      detected: true,
      isPositive: false,
      isNegative: true,
      isIdiomatic: false,
      location: loc ? { line: loc.line, column: loc.column } : undefined,
      details: `Shallow copy '${chain.root}' (from '${copyInfo.original}') calls '${chain.path}()' — this mutates a nested reference shared with the original '${copyInfo.original}'. Spread only copies the top level.`,
    });
  });

  return detections;
}

// =============================================
// 14. array-self-mutation-in-iteration
// Detects when an array is mutated (push, pop, splice, etc.)
// inside its own iteration callback (map, forEach, filter, etc.).
// Mutating the source array during iteration leads to unpredictable
// results — skipped elements, infinite loops, or wrong output.
// =============================================

function detectArraySelfMutationInIteration(ast: File): Detection[] {
  const detections: Detection[] = [];
  const iterationMethods = new Set([
    "map", "forEach", "filter", "find", "findIndex",
    "some", "every", "flatMap", "reduce",
  ]);
  const mutatingMethods = new Set([
    "push", "pop", "shift", "unshift", "splice",
    "sort", "reverse", "fill",
  ]);
  const flagged = new Set<string>();

  traverse(ast, (node) => {
    if (!isNodeType<{
      callee?: {
        type?: string;
        object?: { type?: string; name?: string };
        property?: { type?: string; name?: string };
      };
      arguments?: unknown[];
      loc?: { start: { line: number; column: number } };
    }>(node, "CallExpression")) return;

    const call = node as {
      callee?: {
        type?: string;
        object?: { type?: string; name?: string };
        property?: { type?: string; name?: string };
      };
      arguments?: unknown[];
      loc?: { start: { line: number; column: number } };
    };

    if (call.callee?.type !== "MemberExpression") return;

    const iterMethod = call.callee.property?.name;
    const arrayName = call.callee.object?.name;
    if (!iterMethod || !arrayName || !iterationMethods.has(iterMethod)) return;
    if (flagged.has(arrayName)) return;

    // Get the callback argument
    const callback = call.arguments?.[0] as Record<string, unknown> | undefined;
    if (!callback) return;
    if (
      callback.type !== "ArrowFunctionExpression" &&
      callback.type !== "FunctionExpression"
    ) return;

    // Walk the callback body looking for mutations on the same array
    const mutations: Array<{ method: string; line: number; column: number }> = [];

    function findSelfMutations(n: unknown): void {
      if (!n || typeof n !== "object" || mutations.length > 0) return;
      const node = n as Record<string, unknown>;

      // Check for arr.push(), arr.splice(), etc.
      if (node.type === "CallExpression") {
        const callee = node.callee as {
          type?: string;
          object?: { type?: string; name?: string };
          property?: { type?: string; name?: string };
        } | undefined;

        if (
          callee?.type === "MemberExpression" &&
          callee.object?.type === "Identifier" &&
          callee.object.name === arrayName &&
          callee.property?.name &&
          mutatingMethods.has(callee.property.name)
        ) {
          const loc = (node as { loc?: { start: { line: number; column: number } } }).loc?.start;
          mutations.push({
            method: callee.property.name,
            line: loc?.line ?? 0,
            column: loc?.column ?? 0,
          });
          return;
        }
      }

      // Check for arr[i] = val (direct index assignment on the same array)
      if (node.type === "AssignmentExpression") {
        const left = node.left as {
          type?: string;
          computed?: boolean;
          object?: { type?: string; name?: string };
        } | undefined;

        if (
          left?.type === "MemberExpression" &&
          left.computed &&
          left.object?.type === "Identifier" &&
          left.object.name === arrayName
        ) {
          const loc = (node as { loc?: { start: { line: number; column: number } } }).loc?.start;
          mutations.push({
            method: "index assignment",
            line: loc?.line ?? 0,
            column: loc?.column ?? 0,
          });
          return;
        }
      }

      // Don't recurse into nested function bodies (they may execute later, not during iteration)
      if (
        node.type === "FunctionDeclaration" ||
        node.type === "FunctionExpression" ||
        node.type === "ArrowFunctionExpression"
      ) {
        return;
      }

      for (const key of Object.keys(node)) {
        if (key === "loc" || key === "start" || key === "end") continue;
        const value = node[key];
        if (Array.isArray(value)) {
          value.forEach(findSelfMutations);
        } else if (value && typeof value === "object") {
          findSelfMutations(value);
        }
      }
    }

    // Walk the callback body (not the callback node itself, to avoid skipping due to the function type check)
    const body = callback.body as Record<string, unknown> | undefined;
    if (body?.type === "BlockStatement") {
      const statements = body.body as unknown[] | undefined;
      if (statements) {
        for (const stmt of statements) {
          findSelfMutations(stmt);
          if (mutations.length > 0) break;
        }
      }
    } else if (body) {
      // Expression body (arrow with implicit return) — walk the expression
      findSelfMutations(body);
    }

    if (mutations.length > 0) {
      const m = mutations[0];
      flagged.add(arrayName);
      detections.push({
        topicSlug: "array-self-mutation-in-iteration",
        detected: true,
        isPositive: false,
        isNegative: true,
        isIdiomatic: false,
        location: { line: m.line, column: m.column },
        details: `Array '${arrayName}' is mutated via .${m.method}() inside its own .${iterMethod}() callback — this changes the array while iterating over it, leading to unpredictable results. Collect changes separately and apply after iteration.`,
      });
    }
  });

  return detections;
}

/**
 * Analyze return paths in a function body
 */
function analyzeReturnPaths(body: unknown[]): {
  hasReturn: boolean;
  hasConditionalReturn: boolean;
  hasUnconditionalReturn: boolean;
} {
  let hasReturn = false;
  let hasConditionalReturn = false;
  let hasUnconditionalReturn = false;

  for (const stmt of body as Array<Record<string, unknown>>) {
    if (stmt.type === "ReturnStatement") {
      hasReturn = true;
      hasUnconditionalReturn = true;
    }

    if (stmt.type === "IfStatement") {
      // Check if return is inside if/else
      const ifStmt = stmt as {
        consequent?: { body?: unknown[] };
        alternate?: { body?: unknown[] } | null;
      };

      const consequentHasReturn = ifStmt.consequent?.body
        ? analyzeReturnPaths(ifStmt.consequent.body).hasReturn
        : false;

      const alternateHasReturn = ifStmt.alternate
        ? (ifStmt.alternate as { body?: unknown[] }).body
          ? analyzeReturnPaths((ifStmt.alternate as { body: unknown[] }).body).hasReturn
          : (ifStmt.alternate as { type?: string }).type === "ReturnStatement"
        : false;

      if (consequentHasReturn || alternateHasReturn) {
        hasReturn = true;
        hasConditionalReturn = true;
      }

      if (consequentHasReturn && alternateHasReturn) {
        hasUnconditionalReturn = true;
      }
    }
  }

  return { hasReturn, hasConditionalReturn, hasUnconditionalReturn };
}
