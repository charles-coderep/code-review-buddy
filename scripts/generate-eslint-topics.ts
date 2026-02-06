// =============================================
// ESLint Topic Catalog Generator
// Extracts ESLint rules and maps them to coaching topics
// Run: npx tsx scripts/generate-eslint-topics.ts
// =============================================

import { builtinRules } from "eslint/use-at-your-own-risk";
import react from "eslint-plugin-react";
import reactHooks from "eslint-plugin-react-hooks";
import * as fs from "fs";
import * as path from "path";

// =============================================
// Types
// =============================================

interface ESLintTopicEntry {
  slug: string;
  name: string;
  layer: string;
  category: string;
  frameworkAffinity: string;
  criticality: string;
  prerequisites: string[];
  detectionRules: {
    eslintRule: string;
    type: string;
    description: string;
    recommended: boolean;
    fixable: boolean;
    babelOverlap?: string;
  };
}

interface RuleMeta {
  type?: string;
  docs?: {
    description?: string;
    recommended?: boolean | string;
    url?: string;
  };
  deprecated?: boolean | object;
  fixable?: string;
  hasSuggestions?: boolean;
}

// =============================================
// Overlap Mapping: ESLint rules → existing Babel topic slugs
// These ESLint rules map to existing topics instead of creating new ones
// =============================================

const BABEL_OVERLAP_MAP: Record<string, string> = {
  // Core ESLint → existing Babel topics
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

  // React plugin → existing Babel topics
  "react/jsx-key": "jsx-keys",
  "react/no-direct-mutation-state": "state-immutability",
  "react/no-array-index-key": "jsx-keys",
  "react/jsx-no-duplicate-props": "props-basics",

  // React Hooks → existing Babel topics
  "react-hooks/exhaustive-deps": "useeffect-dependencies",
  "react-hooks/rules-of-hooks": "usestate-basics",
};

// =============================================
// Rules to exclude entirely
// =============================================

const EXCLUDED_RULES = new Set([
  // Snippet noise: these fire on nearly every code snippet
  "no-undef",
  "no-unused-vars",
  "no-use-before-define",
  "no-redeclare",
  "no-shadow",
  "no-implicit-globals",
  "no-invalid-this",
  "no-unassigned-vars",

  // Niche/obscure rules (low coaching value)
  "no-nonoctal-decimal-escape",
  "no-octal-escape",
  "no-empty-static-block",
  "no-div-regex",
  "require-unicode-regexp",
  "no-shadow-restricted-names",
  "no-multi-str",
  "no-iterator",
  "no-proto",
  "no-undef-init",
  "no-eq-null",
  "preserve-caught-error",

  // Formatting/style rules (no coaching value)
  "unicode-bom",
  "sort-imports",
  "sort-keys",
  "sort-vars",
  "capitalized-comments",
  "one-var",
  "one-var-declaration-per-line",
  "vars-on-top",
  "yoda",
  "curly",
  "id-denylist",
  "id-length",
  "id-match",
  "camelcase",
  "new-cap",
  "func-name-matching",
  "func-names",
  "func-style",
  "consistent-this",
  "max-lines",
  "max-lines-per-function",
  "max-depth",
  "max-nested-callbacks",
  "max-params",
  "max-statements",
  "max-classes-per-file",
  "no-inline-comments",
  "no-ternary",
  "no-continue",
  "no-plusplus",
  "no-bitwise",
  "operator-assignment",
  "no-multi-assign",
  "no-underscore-dangle",
  "no-void",
  "no-restricted-exports",
  "no-restricted-globals",
  "no-restricted-imports",
  "no-restricted-properties",
  "no-restricted-syntax",
  "no-warning-comments",
  "strict",
  "prefer-numeric-literals",
  "prefer-exponentiation-operator",
  "symbol-description",
  "no-object-constructor",
  "no-array-constructor",
  "init-declarations",
  "no-label-var",
  "no-undefined",
  "no-labels",
  "no-extra-label",
  "no-unused-labels",
  "line-comment-position",
  "multiline-comment-style",
  "no-negated-condition",
  "no-nested-ternary",

  // React formatting/style rules
  "react/jsx-closing-bracket-location",
  "react/jsx-closing-tag-location",
  "react/jsx-curly-spacing",
  "react/jsx-curly-newline",
  "react/jsx-equals-spacing",
  "react/jsx-first-prop-new-line",
  "react/jsx-indent",
  "react/jsx-indent-props",
  "react/jsx-max-props-per-line",
  "react/jsx-newline",
  "react/jsx-one-expression-per-line",
  "react/jsx-props-no-multi-spaces",
  "react/jsx-sort-props",
  "react/jsx-tag-spacing",
  "react/jsx-wrap-multilines",
  "react/jsx-child-element-spacing",
  "react/sort-comp",
  "react/sort-default-props",
  "react/sort-prop-types",
  "react/jsx-max-depth",
  "react/jsx-filename-extension",
  "react/jsx-space-before-closing",
  "react/jsx-props-no-spreading",
  "react/no-set-state",
  "react/require-optimization",
  "react/no-multi-comp",
  "react/forbid-component-props",
  "react/forbid-dom-props",
  "react/forbid-elements",
  "react/forbid-foreign-prop-types",
  "react/forbid-prop-types",
  "react/no-typos",
  "react/static-property-placement",
  "react/state-in-constructor",
  "react/prefer-read-only-props",
  "react/require-default-props",
  "react/destructuring-assignment",
  "react/no-adjacent-inline-elements",
  "react/boolean-prop-naming",
  "react/jsx-handler-names",
  "react/checked-requires-onchange-or-readonly",

  // React outdated/niche rules
  "react/jsx-no-undef",
  "react/jsx-uses-react",
  "react/react-in-jsx-scope",
  "react/jsx-uses-vars",
  "react/jsx-no-literals",
  "react/prefer-exact-props",
  "react/prefer-es6-class",
  "react/no-is-mounted",
  "react/no-find-dom-node",
  "react/no-render-return-value",
  "react/default-props-match-prop-types",
  "react/no-did-mount-set-state",
  "react/no-did-update-set-state",
  "react/no-will-update-set-state",
  "react/no-arrow-function-lifecycle",
  "react/no-redundant-should-component-update",
  "react/no-unused-class-component-methods",
  "react/prop-types",

  // React Hooks internal/compiler rules (not for user coaching)
  "react-hooks/hooks",
  "react-hooks/capitalized-calls",
  "react-hooks/static-components",
  "react-hooks/use-memo",
  "react-hooks/void-use-memo",
  "react-hooks/component-hook-factories",
  "react-hooks/preserve-manual-memoization",
  "react-hooks/incompatible-library",
  "react-hooks/immutability",
  "react-hooks/globals",
  "react-hooks/refs",
  "react-hooks/memoized-effect-dependencies",
  "react-hooks/invariant",
  "react-hooks/todo",
  "react-hooks/syntax",
  "react-hooks/unsupported-syntax",
  "react-hooks/config",
  "react-hooks/gating",
  "react-hooks/rule-suppression",
  "react-hooks/automatic-effect-dependencies",
  "react-hooks/fire",
  "react-hooks/fbt",
]);

// =============================================
// Layer classification
// =============================================

const LAYER_OVERRIDES: Record<string, string> = {
  // Force specific rules to specific layers
  "for-direction": "FUNDAMENTALS",
  "getter-return": "FUNDAMENTALS",
  "no-async-promise-executor": "FUNDAMENTALS",
  "no-compare-neg-zero": "FUNDAMENTALS",
  "no-cond-assign": "FUNDAMENTALS",
  "no-constant-binary-expression": "FUNDAMENTALS",
  "no-constant-condition": "FUNDAMENTALS",
  "no-dupe-args": "FUNDAMENTALS",
  "no-dupe-keys": "FUNDAMENTALS",
  "no-duplicate-case": "FUNDAMENTALS",
  "no-empty-pattern": "FUNDAMENTALS",
  "no-ex-assign": "FUNDAMENTALS",
  "no-fallthrough": "FUNDAMENTALS",
  "no-self-assign": "FUNDAMENTALS",
  "no-self-compare": "FUNDAMENTALS",
  "no-sparse-arrays": "FUNDAMENTALS",
  "no-unreachable": "FUNDAMENTALS",
  "use-isnan": "FUNDAMENTALS",
  "valid-typeof": "FUNDAMENTALS",
  "no-unsafe-finally": "FUNDAMENTALS",
  "no-unsafe-negation": "FUNDAMENTALS",
  "no-loss-of-precision": "FUNDAMENTALS",
  "no-extra-boolean-cast": "FUNDAMENTALS",
  "no-regex-spaces": "FUNDAMENTALS",
  "no-control-regex": "FUNDAMENTALS",
  "no-empty-character-class": "FUNDAMENTALS",
  "no-invalid-regexp": "FUNDAMENTALS",
  "no-misleading-character-class": "FUNDAMENTALS",
  "no-prototype-builtins": "FUNDAMENTALS",
  "no-unexpected-multiline": "FUNDAMENTALS",
  "no-inner-declarations": "FUNDAMENTALS",
  "no-func-assign": "FUNDAMENTALS",
  "no-import-assign": "FUNDAMENTALS",
  "no-obj-calls": "FUNDAMENTALS",
  "no-setter-return": "FUNDAMENTALS",
  "no-global-assign": "FUNDAMENTALS",
  "no-delete-var": "FUNDAMENTALS",
  "no-octal": "FUNDAMENTALS",
  "no-with": "FUNDAMENTALS",

  // Intermediate
  "array-callback-return": "INTERMEDIATE",
  "no-loop-func": "INTERMEDIATE",
  "no-template-curly-in-string": "INTERMEDIATE",
  "no-unmodified-loop-condition": "INTERMEDIATE",
  "no-promise-executor-return": "INTERMEDIATE",
  "no-constructor-return": "INTERMEDIATE",
  "no-duplicate-imports": "INTERMEDIATE",
  "no-throw-literal": "INTERMEDIATE",
  "consistent-return": "INTERMEDIATE",
  "default-case-last": "INTERMEDIATE",
  "default-case": "INTERMEDIATE",
  "no-else-return": "INTERMEDIATE",
  "no-lone-blocks": "INTERMEDIATE",
  "no-useless-constructor": "INTERMEDIATE",
  "no-useless-return": "INTERMEDIATE",
  "no-useless-rename": "INTERMEDIATE",
  "no-useless-computed-key": "INTERMEDIATE",
  "no-useless-concat": "INTERMEDIATE",
  "no-useless-escape": "INTERMEDIATE",
  "no-new": "INTERMEDIATE",
  "no-new-func": "INTERMEDIATE",
  "no-new-wrappers": "INTERMEDIATE",
  "no-sequences": "INTERMEDIATE",
  "no-unused-expressions": "INTERMEDIATE",
  "no-caller": "INTERMEDIATE",
  "no-extend-native": "INTERMEDIATE",
  "no-extra-bind": "INTERMEDIATE",
  "no-iterator": "INTERMEDIATE",
  "no-proto": "INTERMEDIATE",
  "no-return-assign": "INTERMEDIATE",
  "no-script-url": "INTERMEDIATE",
  "no-param-reassign": "INTERMEDIATE",
  "no-implied-eval": "INTERMEDIATE",
  "prefer-object-has-own": "INTERMEDIATE",
  "prefer-object-spread": "INTERMEDIATE",
  "prefer-regex-literals": "INTERMEDIATE",
  "block-scoped-var": "INTERMEDIATE",
  "radix": "INTERMEDIATE",

  // Patterns
  "no-await-in-loop": "PATTERNS",
  "require-atomic-updates": "PATTERNS",
  "require-await": "PATTERNS",
  "prefer-promise-reject-errors": "PATTERNS",
  "complexity": "PATTERNS",
  "class-methods-use-this": "PATTERNS",
  "grouped-accessor-pairs": "PATTERNS",
  "logical-assignment-operators": "PATTERNS",
  "prefer-named-capture-group": "PATTERNS",
  "accessor-pairs": "PATTERNS",
  "no-useless-backreference": "PATTERNS",

  // React patterns
  "react/jsx-no-constructed-context-values": "PATTERNS",
  "react/no-unstable-nested-components": "PATTERNS",
  "react/no-object-type-as-default-prop": "PATTERNS",
  "react/prefer-stateless-function": "PATTERNS",
};

// =============================================
// Category mapping
// =============================================

function getCoreCategory(ruleName: string, meta: RuleMeta): string {
  // Try to group by what the rule checks
  if (ruleName.includes("async") || ruleName.includes("await") || ruleName.includes("promise")) return "ESLint Async";
  if (ruleName.includes("regex") || ruleName.includes("character-class")) return "ESLint Regex";
  if (ruleName.includes("class") || ruleName.includes("constructor") || ruleName.includes("accessor")) return "ESLint Classes";
  if (ruleName.includes("regex") || ruleName.includes("character-class")) return "ESLint Regex";
  if (ruleName.includes("import") || ruleName.includes("export")) return "ESLint Modules";
  if (ruleName.includes("loop") || ruleName.includes("for-")) return "ESLint Loops";
  if (ruleName.includes("return")) return "ESLint Control Flow";
  if (meta.type === "problem") return "ESLint Error Prevention";
  if (meta.type === "suggestion") return "ESLint Best Practices";
  return "ESLint General";
}

function getReactCategory(ruleName: string): string {
  if (ruleName.includes("jsx")) return "ESLint React JSX";
  if (ruleName.includes("hook") || ruleName.includes("state") || ruleName.includes("effect")) return "ESLint React Hooks & State";
  return "ESLint React Patterns";
}

// =============================================
// Main generation logic
// =============================================

function isDeprecated(meta: RuleMeta): boolean {
  if (!meta.deprecated) return false;
  if (typeof meta.deprecated === "boolean") return meta.deprecated;
  // ESLint 9 uses object format for deprecated
  return true;
}

function isRecommended(meta: RuleMeta): boolean {
  if (!meta.docs?.recommended) return false;
  if (typeof meta.docs.recommended === "boolean") return meta.docs.recommended;
  if (typeof meta.docs.recommended === "string") return meta.docs.recommended !== "false";
  return false;
}

function classifyLayer(ruleName: string, meta: RuleMeta, prefix: string): string {
  const fullName = prefix ? `${prefix}/${ruleName}` : ruleName;
  if (LAYER_OVERRIDES[fullName]) return LAYER_OVERRIDES[fullName];
  if (LAYER_OVERRIDES[ruleName]) return LAYER_OVERRIDES[ruleName];

  if (isRecommended(meta) && meta.type === "problem") return "FUNDAMENTALS";
  if (isRecommended(meta)) return "FUNDAMENTALS";
  if (meta.type === "problem") return "INTERMEDIATE";
  return "INTERMEDIATE";
}

function classifyCriticality(meta: RuleMeta): string {
  if (isRecommended(meta) && meta.type === "problem") return "critical";
  if (isRecommended(meta)) return "high";
  if (meta.type === "problem") return "high";
  return "medium";
}

function ruleIdToSlug(ruleId: string): string {
  if (ruleId.startsWith("react-hooks/")) {
    return "eslint-" + ruleId.replace("/", "-");
  }
  if (ruleId.startsWith("react/")) {
    return "eslint-" + ruleId.replace("/", "-");
  }
  return "eslint-" + ruleId;
}

function ruleIdToName(ruleId: string, description: string): string {
  // Use description but title-case it and keep it short
  if (description) {
    // Capitalize first letter, truncate if too long
    const name = description.charAt(0).toUpperCase() + description.slice(1);
    return name.length > 60 ? name.substring(0, 57) + "..." : name;
  }
  return ruleId;
}

function generateTopics(): ESLintTopicEntry[] {
  const topics: ESLintTopicEntry[] = [];
  const seenSlugs = new Set<string>();

  // Process core ESLint rules
  for (const [ruleName, ruleModule] of builtinRules) {
    const meta = (ruleModule.meta || {}) as RuleMeta;

    if (isDeprecated(meta)) continue;
    if (EXCLUDED_RULES.has(ruleName)) continue;

    const fullRuleId = ruleName;
    const babelOverlap = BABEL_OVERLAP_MAP[fullRuleId];

    // If this rule maps to an existing Babel topic, don't create a new topic
    if (babelOverlap) {
      continue;
    }

    const slug = ruleIdToSlug(fullRuleId);
    if (seenSlugs.has(slug)) continue;
    seenSlugs.add(slug);

    topics.push({
      slug,
      name: ruleIdToName(fullRuleId, meta.docs?.description || ""),
      layer: classifyLayer(ruleName, meta, ""),
      category: getCoreCategory(ruleName, meta),
      frameworkAffinity: "shared",
      criticality: classifyCriticality(meta),
      prerequisites: [],
      detectionRules: {
        eslintRule: fullRuleId,
        type: meta.type || "suggestion",
        description: meta.docs?.description || "",
        recommended: isRecommended(meta),
        fixable: !!meta.fixable,
      },
    });
  }

  // Process React plugin rules
  const reactRules = react.rules as Record<string, { meta?: RuleMeta }>;
  for (const [ruleName, ruleModule] of Object.entries(reactRules)) {
    const meta = (ruleModule.meta || {}) as RuleMeta;

    if (isDeprecated(meta)) continue;
    const fullRuleId = `react/${ruleName}`;
    if (EXCLUDED_RULES.has(fullRuleId)) continue;

    const babelOverlap = BABEL_OVERLAP_MAP[fullRuleId];
    if (babelOverlap) continue;

    const slug = ruleIdToSlug(fullRuleId);
    if (seenSlugs.has(slug)) continue;
    seenSlugs.add(slug);

    topics.push({
      slug,
      name: ruleIdToName(fullRuleId, meta.docs?.description || ""),
      layer: classifyLayer(ruleName, meta, "react"),
      category: getReactCategory(ruleName),
      frameworkAffinity: "react-specific",
      criticality: classifyCriticality(meta),
      prerequisites: [],
      detectionRules: {
        eslintRule: fullRuleId,
        type: meta.type || "suggestion",
        description: meta.docs?.description || "",
        recommended: isRecommended(meta),
        fixable: !!meta.fixable,
      },
    });
  }

  // Process React Hooks rules (only non-excluded)
  const hooksRules = reactHooks.rules as Record<string, { meta?: RuleMeta }>;
  for (const [ruleName, ruleModule] of Object.entries(hooksRules)) {
    const meta = (ruleModule.meta || {}) as RuleMeta;

    const fullRuleId = `react-hooks/${ruleName}`;
    if (EXCLUDED_RULES.has(fullRuleId)) continue;
    if (isDeprecated(meta)) continue;

    const babelOverlap = BABEL_OVERLAP_MAP[fullRuleId];
    if (babelOverlap) continue;

    const slug = ruleIdToSlug(fullRuleId);
    if (seenSlugs.has(slug)) continue;
    seenSlugs.add(slug);

    topics.push({
      slug,
      name: ruleIdToName(fullRuleId, meta.docs?.description || ""),
      layer: classifyLayer(ruleName, meta, "react-hooks"),
      category: "ESLint React Hooks & State",
      frameworkAffinity: "react-specific",
      criticality: classifyCriticality(meta),
      prerequisites: [],
      detectionRules: {
        eslintRule: fullRuleId,
        type: meta.type || "suggestion",
        description: meta.docs?.description || "",
        recommended: isRecommended(meta),
        fixable: !!meta.fixable,
      },
    });
  }

  return topics;
}

// =============================================
// Run and output
// =============================================

const topics = generateTopics();

// Sort by layer, then category, then slug
topics.sort((a, b) => {
  const layerOrder = { FUNDAMENTALS: 0, INTERMEDIATE: 1, PATTERNS: 2 };
  const la = layerOrder[a.layer as keyof typeof layerOrder] ?? 1;
  const lb = layerOrder[b.layer as keyof typeof layerOrder] ?? 1;
  if (la !== lb) return la - lb;
  if (a.category !== b.category) return a.category.localeCompare(b.category);
  return a.slug.localeCompare(b.slug);
});

// Write output
const outputPath = path.join(__dirname, "eslint-topics.json");
fs.writeFileSync(outputPath, JSON.stringify(topics, null, 2));

// Print summary
const fundamentals = topics.filter((t) => t.layer === "FUNDAMENTALS");
const intermediate = topics.filter((t) => t.layer === "INTERMEDIATE");
const patterns = topics.filter((t) => t.layer === "PATTERNS");
const shared = topics.filter((t) => t.frameworkAffinity === "shared");
const reactSpecific = topics.filter((t) => t.frameworkAffinity === "react-specific");

console.log(`\nGenerated ${topics.length} ESLint topics`);
console.log(`\nBy Layer:`);
console.log(`  FUNDAMENTALS: ${fundamentals.length}`);
console.log(`  INTERMEDIATE: ${intermediate.length}`);
console.log(`  PATTERNS: ${patterns.length}`);
console.log(`\nBy Framework:`);
console.log(`  shared: ${shared.length}`);
console.log(`  react-specific: ${reactSpecific.length}`);
console.log(`\nOverlapping rules mapped to existing Babel topics: ${Object.keys(BABEL_OVERLAP_MAP).length}`);
console.log(`Output written to: ${outputPath}`);

// Also export the overlap map for use by the detector
const overlapPath = path.join(__dirname, "eslint-overlap-map.json");
fs.writeFileSync(overlapPath, JSON.stringify(BABEL_OVERLAP_MAP, null, 2));
console.log(`Overlap map written to: ${overlapPath}`);
