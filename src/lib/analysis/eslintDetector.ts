// =============================================
// ESLint Detection Module
// Runs ESLint programmatically on user-submitted code
// Maps violations to topic slugs for the coaching pipeline
// =============================================

import { Linter } from "eslint";
import react from "eslint-plugin-react";
import reactHooks from "eslint-plugin-react-hooks";
import tseslint from "typescript-eslint";
import globals from "globals";
import type { Detection } from "./index";

// =============================================
// Rule → Topic Slug Mapping
// Overlapping rules map to existing Babel topic slugs
// Non-overlapping rules use eslint-* prefixed slugs
// =============================================

const BABEL_OVERLAP_MAP: Record<string, string> = {
  "no-var": "no-var-usage",
  "eqeqeq": "strict-equality",
  "no-eval": "no-eval",
  "no-empty": "empty-catch-blocks",
  "no-magic-numbers": "no-magic-numbers",
  "no-implicit-coercion": "implicit-type-coercion",
  "prefer-const": "let-const-usage",
  "prefer-template": "template-literals",
  "prefer-rest-params": "rest-parameters",
  "prefer-spread": "spread-operator",
  "object-shorthand": "object-shorthand",
  "prefer-arrow-callback": "callback-functions",
  "dot-notation": "property-access-patterns",
  "prefer-destructuring": "object-destructuring",
  "no-useless-catch": "empty-catch-blocks",
  "guard-for-in": "for-in-loops",
  "react/jsx-key": "jsx-keys",
  "react/no-direct-mutation-state": "state-immutability",
  "react/no-array-index-key": "jsx-keys",
  "react/jsx-no-duplicate-props": "props-basics",
  "react-hooks/exhaustive-deps": "useeffect-dependencies",
  "react-hooks/rules-of-hooks": "usestate-basics",
};

/**
 * Convert ESLint ruleId to topic slug
 * Uses overlap map for existing topics, otherwise generates eslint-* slug
 */
function ruleIdToSlug(ruleId: string): string {
  // Check for overlap with existing Babel topics first
  if (BABEL_OVERLAP_MAP[ruleId]) {
    return BABEL_OVERLAP_MAP[ruleId];
  }

  // Generate eslint-* slug for non-overlapping rules
  if (ruleId.startsWith("react-hooks/")) {
    return "eslint-" + ruleId.replace("/", "-");
  }
  if (ruleId.startsWith("react/")) {
    return "eslint-" + ruleId.replace("/", "-");
  }
  return "eslint-" + ruleId;
}

// =============================================
// ESLint Rule Configuration
// =============================================

const CORE_RULES: Record<string, Linter.RuleEntry> = {
  // === FUNDAMENTALS — Error Prevention ===
  "for-direction": "error",
  "getter-return": "error",
  "no-async-promise-executor": "error",
  "no-compare-neg-zero": "error",
  "no-cond-assign": "error",
  "no-const-assign": "error",
  "no-constant-binary-expression": "error",
  "no-constant-condition": "error",
  "no-debugger": "warn",
  "no-dupe-args": "error",
  "no-dupe-else-if": "error",
  "no-dupe-keys": "error",
  "no-duplicate-case": "error",
  "no-empty-pattern": "error",
  "no-ex-assign": "error",
  "no-fallthrough": "error",
  "no-func-assign": "error",
  "no-import-assign": "error",
  "no-inner-declarations": "error",
  "no-irregular-whitespace": "warn",
  "no-loss-of-precision": "error",
  "no-obj-calls": "error",
  "no-prototype-builtins": "warn",
  "no-self-assign": "error",
  "no-self-compare": "error",
  "no-sparse-arrays": "error",
  "no-this-before-super": "error",
  "no-unexpected-multiline": "error",
  "no-unreachable": "error",
  "no-unreachable-loop": "error",
  "no-unsafe-finally": "error",
  "no-unsafe-negation": "error",
  "no-unsafe-optional-chaining": "error",
  "use-isnan": "error",
  "valid-typeof": "error",
  "no-case-declarations": "error",
  "no-delete-var": "error",
  "no-global-assign": "error",
  "no-octal": "error",
  "no-with": "error",
  "no-class-assign": "error",
  "no-dupe-class-members": "error",
  "no-new-native-nonconstructor": "error",
  "constructor-super": "error",
  "no-setter-return": "error",
  "require-yield": "error",
  "no-control-regex": "warn",
  "no-empty-character-class": "error",
  "no-invalid-regexp": "error",
  "no-misleading-character-class": "error",
  "no-regex-spaces": "warn",
  "no-extra-boolean-cast": "warn",
  "no-useless-backreference": "warn",

  // Overlapping rules (map to existing Babel topics)
  "no-var": "error",
  "eqeqeq": "error",
  "no-eval": "error",
  "prefer-const": "warn",
  "no-empty": "warn",
  "no-implicit-coercion": "warn",
  "prefer-template": "warn",
  "prefer-rest-params": "warn",
  "prefer-spread": "warn",
  "object-shorthand": "warn",
  "prefer-arrow-callback": "warn",
  "dot-notation": "warn",
  "prefer-destructuring": ["warn", { object: true, array: false }],
  "no-useless-catch": "warn",
  "guard-for-in": "warn",

  // === INTERMEDIATE — Best Practices ===
  "array-callback-return": "warn",
  "no-loop-func": "warn",
  "no-template-curly-in-string": "warn",
  "no-unmodified-loop-condition": "warn",
  "no-promise-executor-return": "warn",
  "no-constructor-return": "warn",
  "no-duplicate-imports": "warn",
  "no-throw-literal": "warn",
  "consistent-return": "warn",
  "default-case": "warn",
  "default-case-last": "warn",
  "default-param-last": "warn",
  "no-else-return": "warn",
  "no-lone-blocks": "warn",
  "no-useless-constructor": "warn",
  "no-useless-return": "warn",
  "no-useless-rename": "warn",
  "no-useless-computed-key": "warn",
  "no-useless-concat": "warn",
  "no-useless-escape": "warn",
  "no-new": "warn",
  "no-new-func": "warn",
  "no-new-wrappers": "warn",
  "no-sequences": "warn",
  "no-unused-expressions": "warn",
  "no-caller": "warn",
  "no-extend-native": "warn",
  "no-extra-bind": "warn",
  "no-return-assign": "warn",
  "no-script-url": "warn",
  "no-param-reassign": "warn",
  "no-implied-eval": "warn",
  "no-alert": "warn",
  "no-lonely-if": "warn",
  "no-unneeded-ternary": "warn",
  "no-useless-call": "warn",
  "no-unused-private-class-members": "warn",
  "block-scoped-var": "warn",
  "radix": "warn",
  "prefer-object-has-own": "warn",
  "prefer-object-spread": "warn",
  "prefer-regex-literals": "warn",
  "arrow-body-style": "warn",
  "no-useless-assignment": "warn",

  // === PATTERNS — Advanced ===
  "no-await-in-loop": "warn",
  "require-atomic-updates": "warn",
  "require-await": "warn",
  "prefer-promise-reject-errors": "warn",
  "complexity": ["warn", { max: 15 }],
  "class-methods-use-this": "warn",
  "grouped-accessor-pairs": "warn",
  "accessor-pairs": "warn",
  "logical-assignment-operators": "warn",
  "prefer-named-capture-group": "warn",
  "no-magic-numbers": ["warn", {
    ignore: [0, 1, -1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 100],
    ignoreDefaultValues: true,
    ignoreArrayIndexes: true,
  }],
};

const REACT_RULES: Record<string, Linter.RuleEntry> = {
  // Overlapping
  "react/jsx-key": "error",
  "react/no-direct-mutation-state": "error",
  "react/no-array-index-key": "warn",
  "react/jsx-no-duplicate-props": "error",

  // Non-overlapping React rules
  "react/display-name": "warn",
  "react/no-children-prop": "warn",
  "react/no-danger": "warn",
  "react/no-danger-with-children": "error",
  "react/no-deprecated": "warn",
  "react/no-string-refs": "warn",
  "react/no-unescaped-entities": "warn",
  "react/no-unknown-property": "warn",
  "react/require-render-return": "error",
  "react/self-closing-comp": "warn",
  "react/void-dom-elements-no-children": "error",
  "react/jsx-no-target-blank": "warn",
  "react/jsx-no-script-url": "warn",
  "react/jsx-no-comment-textnodes": "warn",
  "react/jsx-boolean-value": "warn",
  "react/jsx-curly-brace-presence": "warn",
  "react/jsx-fragments": "warn",
  "react/jsx-no-useless-fragment": "warn",
  "react/jsx-pascal-case": "warn",
  "react/jsx-no-bind": ["warn", { allowArrowFunctions: true }],
  "react/jsx-no-leaked-render": "warn",
  "react/jsx-no-constructed-context-values": "warn",
  "react/no-unstable-nested-components": "warn",
  "react/no-access-state-in-setstate": "warn",
  "react/no-this-in-sfc": "warn",
  "react/no-unused-state": "warn",
  "react/no-unused-prop-types": "warn",
  "react/button-has-type": "warn",
  "react/forward-ref-uses-ref": "warn",
  "react/function-component-definition": ["warn", { namedComponents: "function-declaration" }],
  "react/iframe-missing-sandbox": "warn",
  "react/no-invalid-html-attribute": "warn",
  "react/no-namespace": "warn",
  "react/no-object-type-as-default-prop": "warn",
  "react/no-unsafe": "warn",
  "react/prefer-stateless-function": "warn",
  "react/style-prop-object": "warn",
  "react/jsx-props-no-spread-multi": "warn",
  "react/hook-use-state": "warn",
};

const HOOKS_RULES: Record<string, Linter.RuleEntry> = {
  // Overlapping
  "react-hooks/rules-of-hooks": "error",
  "react-hooks/exhaustive-deps": "warn",

  // Non-overlapping hooks rules
  "react-hooks/set-state-in-effect": "warn",
  "react-hooks/set-state-in-render": "error",
  "react-hooks/no-deriving-state-in-effects": "warn",
  "react-hooks/error-boundaries": "warn",
  "react-hooks/purity": "warn",
};

// =============================================
// Linter Configuration
// =============================================

const BASE_JS_CONFIG: Linter.Config = {
  languageOptions: {
    ecmaVersion: 2022,
    sourceType: "module",
    globals: {
      ...(globals as Record<string, Record<string, boolean>>).es2021,
      ...(globals as Record<string, Record<string, boolean>>).browser,
      ...(globals as Record<string, Record<string, boolean>>).node,
    },
  },
  rules: CORE_RULES,
};

const BASE_TS_CONFIG: Linter.Config = {
  languageOptions: {
    parser: tseslint.parser as Linter.Parser,
    ecmaVersion: 2022,
    sourceType: "module",
    globals: {
      ...(globals as Record<string, Record<string, boolean>>).es2021,
      ...(globals as Record<string, Record<string, boolean>>).browser,
      ...(globals as Record<string, Record<string, boolean>>).node,
    },
  },
  rules: CORE_RULES,
};

const REACT_JS_CONFIG: Linter.Config = {
  plugins: {
    react: react as unknown as Record<string, unknown>,
    "react-hooks": reactHooks as unknown as Record<string, unknown>,
  },
  languageOptions: {
    ecmaVersion: 2022,
    sourceType: "module",
    parserOptions: {
      ecmaFeatures: { jsx: true },
    },
    globals: {
      ...(globals as Record<string, Record<string, boolean>>).es2021,
      ...(globals as Record<string, Record<string, boolean>>).browser,
      React: "readonly" as const,
    },
  },
  settings: {
    react: { version: "18" },
  },
  rules: {
    ...CORE_RULES,
    ...REACT_RULES,
    ...HOOKS_RULES,
  },
};

const REACT_TS_CONFIG: Linter.Config = {
  plugins: {
    react: react as unknown as Record<string, unknown>,
    "react-hooks": reactHooks as unknown as Record<string, unknown>,
  },
  languageOptions: {
    parser: tseslint.parser as Linter.Parser,
    ecmaVersion: 2022,
    sourceType: "module",
    parserOptions: {
      ecmaFeatures: { jsx: true },
    },
    globals: {
      ...(globals as Record<string, Record<string, boolean>>).es2021,
      ...(globals as Record<string, Record<string, boolean>>).browser,
      React: "readonly" as const,
    },
  },
  settings: {
    react: { version: "18" },
  },
  rules: {
    ...CORE_RULES,
    ...REACT_RULES,
    ...HOOKS_RULES,
  },
};

// =============================================
// Main Detection Function
// =============================================

/**
 * Run ESLint on user-submitted code and return detections
 * Uses the Linter class for synchronous, in-memory linting
 */
export function analyzeWithESLint(
  code: string,
  isReact: boolean,
  hasTypeScript: boolean = false
): Detection[] {
  try {
    const linter = new Linter();

    // Pick the right config based on framework and language
    let config: Linter.Config;
    if (isReact && hasTypeScript) {
      config = REACT_TS_CONFIG;
    } else if (isReact) {
      config = REACT_JS_CONFIG;
    } else if (hasTypeScript) {
      config = BASE_TS_CONFIG;
    } else {
      config = BASE_JS_CONFIG;
    }

    const messages = linter.verify(code, [config]);

    return messages
      .filter((msg) => msg.ruleId !== null)
      .map((msg) => mapToDetection(msg));
  } catch (error) {
    // Graceful degradation: if ESLint fails, return empty array
    console.error("ESLint analysis failed:", error);
    return [];
  }
}

/**
 * Map an ESLint LintMessage to a Detection object
 */
function mapToDetection(msg: Linter.LintMessage): Detection {
  const ruleId = msg.ruleId!;
  const slug = ruleIdToSlug(ruleId);

  return {
    topicSlug: slug,
    detected: true,
    isPositive: false,
    isNegative: true,
    isIdiomatic: false,
    isTrivial: msg.fix !== undefined,
    location: { line: msg.line, column: msg.column },
    details: `[ESLint ${ruleId}] ${msg.message}`,
    source: "eslint",
  };
}
