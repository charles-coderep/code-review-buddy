// =============================================
// AST Parser for Code Analysis
// Uses Babel to parse JavaScript/TypeScript/JSX/TSX
// =============================================

import * as parser from "@babel/parser";
import type { ParseResult, ParserPlugin } from "@babel/parser";
import type { File } from "@babel/types";

// =============================================
// Types
// =============================================

export type CodeLanguage = "javascript" | "typescript" | "jsx" | "tsx";

export interface ParsedCode {
  ast: File;
  language: CodeLanguage;
  isReact: boolean;
  hasTypeScript: boolean;
  errors: ParseError[];
}

export interface ParseError {
  message: string;
  line: number;
  column: number;
}

export interface FrameworkContext {
  isReact: boolean;
  hasReactImport: boolean;
  usesHooks: boolean;
  usesJSX: boolean;
  hasTypeScript: boolean;
}

// =============================================
// Parser Configuration
// =============================================

const BASE_PLUGINS: ParserPlugin[] = [
  "jsx",
  "classProperties",
  "classPrivateProperties",
  "classPrivateMethods",
  "optionalChaining",
  "nullishCoalescingOperator",
  "objectRestSpread",
  "asyncGenerators",
  "dynamicImport",
];

const TYPESCRIPT_PLUGINS: ParserPlugin[] = [...BASE_PLUGINS, "typescript"];

function getPlugins(language: CodeLanguage): ParserPlugin[] {
  if (language === "typescript" || language === "tsx") {
    return TYPESCRIPT_PLUGINS;
  }
  return BASE_PLUGINS;
}

// =============================================
// Main Parser Function
// =============================================

/**
 * Parse code into an AST with framework detection
 */
export function parseCode(
  code: string,
  language: CodeLanguage = "javascript"
): ParsedCode {
  const errors: ParseError[] = [];

  try {
    const ast = parser.parse(code, {
      sourceType: "module",
      plugins: getPlugins(language),
      errorRecovery: true,
      attachComment: true,
    });

    // Check for parse errors
    if ((ast as ParseResult<File>).errors?.length) {
      for (const err of (ast as ParseResult<File>).errors!) {
        errors.push({
          message: err.message,
          line: err.loc?.line ?? 0,
          column: err.loc?.column ?? 0,
        });
      }
    }

    // Detect framework context
    const context = detectFrameworkContext(ast);

    return {
      ast,
      language,
      isReact: context.isReact,
      hasTypeScript: language === "typescript" || language === "tsx",
      errors,
    };
  } catch (error) {
    // If parsing fails completely, try with different settings
    const errorMessage = error instanceof Error ? error.message : "Unknown parse error";

    errors.push({
      message: errorMessage,
      line: 0,
      column: 0,
    });

    // Return empty AST with errors
    return {
      ast: {
        type: "File",
        program: {
          type: "Program",
          body: [],
          directives: [],
          sourceType: "module",
        },
        comments: [],
      } as File,
      language,
      isReact: false,
      hasTypeScript: language === "typescript" || language === "tsx",
      errors,
    };
  }
}

/**
 * Try to auto-detect language from code content
 */
export function detectLanguage(code: string): CodeLanguage {
  // Check for TypeScript indicators
  const hasTypeAnnotations =
    /:\s*(string|number|boolean|any|void|never|object)\b/.test(code) ||
    /interface\s+\w+/.test(code) ||
    /type\s+\w+\s*=/.test(code) ||
    /<\w+>/.test(code); // Generic syntax

  // Check for JSX
  const hasJSX =
    /<[A-Z][a-zA-Z0-9]*/.test(code) || // Component tags
    /return\s*\(?\s*</.test(code) || // JSX in return
    /<\/[a-zA-Z]+>/.test(code); // Closing tags

  if (hasTypeAnnotations && hasJSX) {
    return "tsx";
  }
  if (hasTypeAnnotations) {
    return "typescript";
  }
  if (hasJSX) {
    return "jsx";
  }
  return "javascript";
}

// =============================================
// Framework Context Detection
// =============================================

/**
 * Detect React and other framework signals from AST
 */
export function detectFrameworkContext(ast: File): FrameworkContext {
  let hasReactImport = false;
  let usesHooks = false;
  let usesJSX = false;

  // Traverse the AST to look for React signals
  const visit = (node: unknown): void => {
    if (!node || typeof node !== "object") return;

    const n = node as Record<string, unknown>;

    // Check for React import
    if (n.type === "ImportDeclaration") {
      const source = (n.source as { value?: string })?.value;
      if (source === "react" || source === "React") {
        hasReactImport = true;
      }
    }

    // Check for hook usage (useState, useEffect, etc.)
    if (n.type === "CallExpression") {
      const callee = n.callee as Record<string, unknown>;
      if (callee?.type === "Identifier") {
        const name = callee.name as string;
        if (name && /^use[A-Z]/.test(name)) {
          usesHooks = true;
        }
      }
    }

    // Check for JSX
    if (
      n.type === "JSXElement" ||
      n.type === "JSXFragment" ||
      n.type === "JSXText"
    ) {
      usesJSX = true;
    }

    // Recursively check children
    for (const key of Object.keys(n)) {
      const value = n[key];
      if (Array.isArray(value)) {
        value.forEach(visit);
      } else if (value && typeof value === "object") {
        visit(value);
      }
    }
  };

  visit(ast);

  // React is detected if we have import + hooks, or import + JSX, or just hooks/JSX
  const isReact = hasReactImport || usesHooks || usesJSX;

  return {
    isReact,
    hasReactImport,
    usesHooks,
    usesJSX,
    hasTypeScript: false, // Determined by language, not AST
  };
}

// =============================================
// AST Traversal Helpers
// =============================================

export type NodeVisitor = (node: unknown, parent: unknown | null) => void;

/**
 * Simple AST traversal
 */
export function traverse(ast: File, visitor: NodeVisitor): void {
  const visit = (node: unknown, parent: unknown | null = null): void => {
    if (!node || typeof node !== "object") return;

    visitor(node, parent);

    const n = node as Record<string, unknown>;
    for (const key of Object.keys(n)) {
      if (key === "loc" || key === "start" || key === "end") continue;

      const value = n[key];
      if (Array.isArray(value)) {
        value.forEach((child) => visit(child, node));
      } else if (value && typeof value === "object") {
        visit(value, node);
      }
    }
  };

  visit(ast.program);
}

/**
 * Find all nodes matching a predicate
 */
export function findNodes<T>(
  ast: File,
  predicate: (node: unknown) => node is T
): T[] {
  const results: T[] = [];

  traverse(ast, (node) => {
    if (predicate(node)) {
      results.push(node);
    }
  });

  return results;
}

/**
 * Check if a node is of a specific type
 */
export function isNodeType<T>(
  node: unknown,
  type: string
): node is T & { type: string } {
  return (
    node !== null &&
    typeof node === "object" &&
    "type" in node &&
    (node as { type: string }).type === type
  );
}

/**
 * Get location info from node
 */
export function getNodeLocation(node: unknown): { line: number; column: number } | null {
  if (!node || typeof node !== "object") return null;

  const n = node as { loc?: { start?: { line: number; column: number } } };
  if (n.loc?.start) {
    return {
      line: n.loc.start.line,
      column: n.loc.start.column,
    };
  }
  return null;
}
