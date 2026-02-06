import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import "dotenv/config";
import * as fs from "fs";
import * as path from "path";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

// Load ESLint topics from generated catalog
const eslintTopicsPath = path.join(__dirname, "..", "scripts", "eslint-topics.json");
const eslintTopicsRaw: Array<{
  slug: string;
  name: string;
  layer: string;
  category: string;
  frameworkAffinity: string;
  criticality: string;
  prerequisites: string[];
  detectionRules: object;
}> = fs.existsSync(eslintTopicsPath)
  ? JSON.parse(fs.readFileSync(eslintTopicsPath, "utf-8"))
  : [];

// Load data flow topics
const dataflowTopicsPath = path.join(__dirname, "..", "scripts", "dataflow-topics.json");
const dataflowTopicsRaw: Array<{
  slug: string;
  name: string;
  description: string;
  layer: string;
  category: string;
  framework: string;
  criticality: string;
  prerequisites: string[];
  relatedTopics: string[];
}> = fs.existsSync(dataflowTopicsPath)
  ? JSON.parse(fs.readFileSync(dataflowTopicsPath, "utf-8"))
  : [];

// Topic definitions - 180 Babel AST topics + ESLint topics
const topics = [
  // ============================================
  // FUNDAMENTALS LAYER (42 markers)
  // ============================================

  // Variable Handling (js-pure) - 4 markers
  {
    slug: "let-const-usage",
    name: "Let/Const Usage",
    layer: "FUNDAMENTALS",
    category: "Variable Handling",
    frameworkAffinity: "js-pure",
    criticality: "critical",
    prerequisites: [],
    detectionRules: {
      patterns: ["VariableDeclaration"],
      check: "Detects var vs let/const usage and reassignment patterns",
    },
  },
  {
    slug: "var-hoisting",
    name: "Var Hoisting",
    layer: "FUNDAMENTALS",
    category: "Variable Handling",
    frameworkAffinity: "js-pure",
    criticality: "medium",
    prerequisites: ["let-const-usage"],
    detectionRules: {
      patterns: ["VariableDeclaration[kind=var]"],
      check: "Detects var declarations and potential hoisting issues",
    },
  },
  {
    slug: "temporal-dead-zone",
    name: "Temporal Dead Zone",
    layer: "FUNDAMENTALS",
    category: "Variable Handling",
    frameworkAffinity: "js-pure",
    criticality: "medium",
    prerequisites: ["let-const-usage"],
    detectionRules: {
      patterns: ["VariableDeclaration"],
      check: "Detects access before declaration with let/const",
    },
  },
  {
    slug: "block-vs-function-scope",
    name: "Block vs Function Scope",
    layer: "FUNDAMENTALS",
    category: "Variable Handling",
    frameworkAffinity: "js-pure",
    criticality: "high",
    prerequisites: ["let-const-usage"],
    detectionRules: {
      patterns: ["BlockStatement", "FunctionDeclaration"],
      check: "Detects scope-related patterns",
    },
  },

  // Array Methods (shared) - 7 markers
  {
    slug: "array-map",
    name: "Array Map",
    layer: "FUNDAMENTALS",
    category: "Array Methods",
    frameworkAffinity: "shared",
    criticality: "critical",
    prerequisites: [],
    detectionRules: {
      patterns: ["CallExpression[callee.property.name=map]"],
      check: "Detects .map() usage with function argument",
    },
  },
  {
    slug: "array-filter",
    name: "Array Filter",
    layer: "FUNDAMENTALS",
    category: "Array Methods",
    frameworkAffinity: "shared",
    criticality: "critical",
    prerequisites: [],
    detectionRules: {
      patterns: ["CallExpression[callee.property.name=filter]"],
      check: "Detects .filter() usage with predicate function",
    },
  },
  {
    slug: "array-reduce",
    name: "Array Reduce",
    layer: "FUNDAMENTALS",
    category: "Array Methods",
    frameworkAffinity: "shared",
    criticality: "high",
    prerequisites: ["array-map"],
    detectionRules: {
      patterns: ["CallExpression[callee.property.name=reduce]"],
      check: "Detects .reduce() usage with accumulator pattern",
    },
  },
  {
    slug: "array-find",
    name: "Array Find",
    layer: "FUNDAMENTALS",
    category: "Array Methods",
    frameworkAffinity: "shared",
    criticality: "medium",
    prerequisites: ["array-filter"],
    detectionRules: {
      patterns: ["CallExpression[callee.property.name=find]"],
      check: "Detects .find() usage",
    },
  },
  {
    slug: "array-some-every",
    name: "Array Some/Every",
    layer: "FUNDAMENTALS",
    category: "Array Methods",
    frameworkAffinity: "shared",
    criticality: "medium",
    prerequisites: ["array-filter"],
    detectionRules: {
      patterns: [
        "CallExpression[callee.property.name=some]",
        "CallExpression[callee.property.name=every]",
      ],
      check: "Detects .some() and .every() usage",
    },
  },
  {
    slug: "array-foreach",
    name: "Array ForEach",
    layer: "FUNDAMENTALS",
    category: "Array Methods",
    frameworkAffinity: "shared",
    criticality: "medium",
    prerequisites: [],
    detectionRules: {
      patterns: ["CallExpression[callee.property.name=forEach]"],
      check: "Detects .forEach() usage and potential anti-patterns",
    },
  },
  {
    slug: "array-method-chaining",
    name: "Array Method Chaining",
    layer: "FUNDAMENTALS",
    category: "Array Methods",
    frameworkAffinity: "shared",
    criticality: "medium",
    prerequisites: ["array-map", "array-filter"],
    detectionRules: {
      patterns: ["CallExpression > CallExpression"],
      check: "Detects chained array method calls",
    },
  },

  // Object Operations (shared) - 4 markers
  {
    slug: "object-destructuring",
    name: "Object Destructuring",
    layer: "FUNDAMENTALS",
    category: "Object Operations",
    frameworkAffinity: "shared",
    criticality: "critical",
    prerequisites: [],
    detectionRules: {
      patterns: ["ObjectPattern"],
      check: "Detects object destructuring patterns",
    },
  },
  {
    slug: "array-destructuring",
    name: "Array Destructuring",
    layer: "FUNDAMENTALS",
    category: "Object Operations",
    frameworkAffinity: "shared",
    criticality: "high",
    prerequisites: [],
    detectionRules: {
      patterns: ["ArrayPattern"],
      check: "Detects array destructuring patterns",
    },
  },
  {
    slug: "spread-operator",
    name: "Spread Operator",
    layer: "FUNDAMENTALS",
    category: "Object Operations",
    frameworkAffinity: "shared",
    criticality: "critical",
    prerequisites: ["object-destructuring"],
    detectionRules: {
      patterns: ["SpreadElement"],
      check: "Detects spread operator usage in arrays and objects",
    },
  },
  {
    slug: "object-shorthand",
    name: "Object Shorthand",
    layer: "FUNDAMENTALS",
    category: "Object Operations",
    frameworkAffinity: "shared",
    criticality: "low",
    prerequisites: ["object-destructuring"],
    detectionRules: {
      patterns: ["Property[shorthand=true]"],
      check: "Detects object property shorthand syntax",
    },
  },

  // Functions (shared) - 6 markers
  {
    slug: "arrow-functions",
    name: "Arrow Functions",
    layer: "FUNDAMENTALS",
    category: "Functions",
    frameworkAffinity: "shared",
    criticality: "critical",
    prerequisites: [],
    detectionRules: {
      patterns: ["ArrowFunctionExpression"],
      check: "Detects arrow function syntax and usage",
    },
  },
  {
    slug: "default-parameters",
    name: "Default Parameters",
    layer: "FUNDAMENTALS",
    category: "Functions",
    frameworkAffinity: "shared",
    criticality: "medium",
    prerequisites: ["arrow-functions"],
    detectionRules: {
      patterns: ["AssignmentPattern"],
      check: "Detects default parameter values in functions",
    },
  },
  {
    slug: "rest-parameters",
    name: "Rest Parameters",
    layer: "FUNDAMENTALS",
    category: "Functions",
    frameworkAffinity: "shared",
    criticality: "medium",
    prerequisites: ["spread-operator"],
    detectionRules: {
      patterns: ["RestElement"],
      check: "Detects rest parameter usage in functions",
    },
  },
  {
    slug: "pure-functions",
    name: "Pure Functions",
    layer: "FUNDAMENTALS",
    category: "Functions",
    frameworkAffinity: "shared",
    criticality: "high",
    prerequisites: ["arrow-functions"],
    detectionRules: {
      patterns: ["FunctionDeclaration", "ArrowFunctionExpression"],
      check: "Analyzes function for side effects and mutation",
    },
  },
  {
    slug: "callback-functions",
    name: "Callback Functions",
    layer: "FUNDAMENTALS",
    category: "Functions",
    frameworkAffinity: "shared",
    criticality: "critical",
    prerequisites: ["arrow-functions"],
    detectionRules: {
      patterns: ["CallExpression > ArrowFunctionExpression"],
      check: "Detects functions passed as arguments",
    },
  },
  {
    slug: "higher-order-functions",
    name: "Higher-Order Functions",
    layer: "FUNDAMENTALS",
    category: "Functions",
    frameworkAffinity: "shared",
    criticality: "high",
    prerequisites: ["callback-functions"],
    detectionRules: {
      patterns: ["FunctionDeclaration", "ArrowFunctionExpression"],
      check: "Detects functions that return or accept functions",
    },
  },

  // Closures (shared) - 3 markers
  {
    slug: "closure-basics",
    name: "Closure Basics",
    layer: "FUNDAMENTALS",
    category: "Closures",
    frameworkAffinity: "shared",
    criticality: "high",
    prerequisites: ["arrow-functions"],
    detectionRules: {
      patterns: ["FunctionDeclaration", "ArrowFunctionExpression"],
      check: "Detects nested functions accessing outer scope",
    },
  },
  {
    slug: "closure-in-loops",
    name: "Closure in Loops",
    layer: "FUNDAMENTALS",
    category: "Closures",
    frameworkAffinity: "shared",
    criticality: "high",
    prerequisites: ["closure-basics"],
    detectionRules: {
      patterns: ["ForStatement > ArrowFunctionExpression"],
      check: "Detects closure-related issues in loops",
    },
  },
  {
    slug: "closure-state",
    name: "Closure State",
    layer: "FUNDAMENTALS",
    category: "Closures",
    frameworkAffinity: "shared",
    criticality: "medium",
    prerequisites: ["closure-basics"],
    detectionRules: {
      patterns: ["FunctionDeclaration"],
      check: "Detects closure-based state patterns",
    },
  },

  // Async Fundamentals (shared) - 5 markers
  {
    slug: "promise-basics",
    name: "Promise Basics",
    layer: "FUNDAMENTALS",
    category: "Async Fundamentals",
    frameworkAffinity: "shared",
    criticality: "critical",
    prerequisites: ["callback-functions"],
    detectionRules: {
      patterns: ["NewExpression[callee.name=Promise]", "CallExpression[callee.property.name=then]"],
      check: "Detects Promise creation and .then() usage",
    },
  },
  {
    slug: "promise-chaining",
    name: "Promise Chaining",
    layer: "FUNDAMENTALS",
    category: "Async Fundamentals",
    frameworkAffinity: "shared",
    criticality: "high",
    prerequisites: ["promise-basics"],
    detectionRules: {
      patterns: ["CallExpression[callee.property.name=then] > CallExpression"],
      check: "Detects chained .then() calls",
    },
  },
  {
    slug: "promise-catch",
    name: "Promise Catch",
    layer: "FUNDAMENTALS",
    category: "Async Fundamentals",
    frameworkAffinity: "shared",
    criticality: "high",
    prerequisites: ["promise-basics"],
    detectionRules: {
      patterns: ["CallExpression[callee.property.name=catch]"],
      check: "Detects .catch() error handling",
    },
  },
  {
    slug: "async-await-basics",
    name: "Async/Await Basics",
    layer: "FUNDAMENTALS",
    category: "Async Fundamentals",
    frameworkAffinity: "shared",
    criticality: "critical",
    prerequisites: ["promise-basics"],
    detectionRules: {
      patterns: ["AwaitExpression", "FunctionDeclaration[async=true]"],
      check: "Detects async function declarations and await usage",
    },
  },
  {
    slug: "async-await-error-handling",
    name: "Async/Await Error Handling",
    layer: "FUNDAMENTALS",
    category: "Async Fundamentals",
    frameworkAffinity: "shared",
    criticality: "critical",
    prerequisites: ["async-await-basics", "try-catch"],
    detectionRules: {
      patterns: ["AwaitExpression"],
      check: "Detects await expressions not inside try-catch",
    },
  },

  // Error Handling (shared) - 4 markers
  {
    slug: "try-catch",
    name: "Try/Catch",
    layer: "FUNDAMENTALS",
    category: "Error Handling",
    frameworkAffinity: "shared",
    criticality: "critical",
    prerequisites: [],
    detectionRules: {
      patterns: ["TryStatement"],
      check: "Detects try-catch-finally blocks",
    },
  },
  {
    slug: "error-throwing",
    name: "Error Throwing",
    layer: "FUNDAMENTALS",
    category: "Error Handling",
    frameworkAffinity: "shared",
    criticality: "medium",
    prerequisites: ["try-catch"],
    detectionRules: {
      patterns: ["ThrowStatement"],
      check: "Detects throw statements and Error types",
    },
  },
  {
    slug: "fetch-error-checking",
    name: "Fetch Error Checking",
    layer: "FUNDAMENTALS",
    category: "Error Handling",
    frameworkAffinity: "shared",
    criticality: "high",
    prerequisites: ["async-await-basics", "try-catch"],
    detectionRules: {
      patterns: ["CallExpression[callee.name=fetch]"],
      check: "Detects fetch calls and response.ok checking",
    },
  },
  {
    slug: "error-messages",
    name: "Error Messages",
    layer: "FUNDAMENTALS",
    category: "Error Handling",
    frameworkAffinity: "shared",
    criticality: "medium",
    prerequisites: ["try-catch"],
    detectionRules: {
      patterns: ["NewExpression[callee.name=Error]"],
      check: "Detects Error construction with meaningful messages",
    },
  },

  // JSX Fundamentals (react-specific) - 5 markers
  {
    slug: "jsx-syntax",
    name: "JSX Syntax",
    layer: "FUNDAMENTALS",
    category: "JSX Fundamentals",
    frameworkAffinity: "react-specific",
    criticality: "critical",
    prerequisites: [],
    detectionRules: {
      patterns: ["JSXElement"],
      check: "Detects JSX element syntax",
    },
  },
  {
    slug: "jsx-expressions",
    name: "JSX Expressions",
    layer: "FUNDAMENTALS",
    category: "JSX Fundamentals",
    frameworkAffinity: "react-specific",
    criticality: "critical",
    prerequisites: ["jsx-syntax"],
    detectionRules: {
      patterns: ["JSXExpressionContainer"],
      check: "Detects {} expressions in JSX",
    },
  },
  {
    slug: "jsx-conditional-rendering",
    name: "JSX Conditional Rendering",
    layer: "FUNDAMENTALS",
    category: "JSX Fundamentals",
    frameworkAffinity: "react-specific",
    criticality: "high",
    prerequisites: ["jsx-expressions"],
    detectionRules: {
      patterns: ["LogicalExpression", "ConditionalExpression"],
      check: "Detects && and ternary patterns in JSX",
    },
  },
  {
    slug: "jsx-list-rendering",
    name: "JSX List Rendering",
    layer: "FUNDAMENTALS",
    category: "JSX Fundamentals",
    frameworkAffinity: "react-specific",
    criticality: "critical",
    prerequisites: ["array-map", "jsx-expressions"],
    detectionRules: {
      patterns: ["CallExpression[callee.property.name=map] > JSXElement"],
      check: "Detects .map() returning JSX",
    },
  },
  {
    slug: "jsx-keys",
    name: "JSX Keys",
    layer: "FUNDAMENTALS",
    category: "JSX Fundamentals",
    frameworkAffinity: "react-specific",
    criticality: "critical",
    prerequisites: ["jsx-list-rendering"],
    detectionRules: {
      patterns: ["JSXAttribute[name.name=key]"],
      check: "Detects key attribute presence and quality (index vs id)",
    },
  },

  // React State Basics (react-specific) - 4 markers
  {
    slug: "usestate-basics",
    name: "useState Basics",
    layer: "FUNDAMENTALS",
    category: "React State Basics",
    frameworkAffinity: "react-specific",
    criticality: "critical",
    prerequisites: ["jsx-syntax"],
    detectionRules: {
      patterns: ["CallExpression[callee.name=useState]"],
      check: "Detects useState hook with array destructuring",
    },
  },
  {
    slug: "usestate-functional-updates",
    name: "useState Functional Updates",
    layer: "FUNDAMENTALS",
    category: "React State Basics",
    frameworkAffinity: "react-specific",
    criticality: "high",
    prerequisites: ["usestate-basics"],
    detectionRules: {
      patterns: ["CallExpression"],
      check: "Detects setState(prev => ...) pattern vs direct value",
    },
  },
  {
    slug: "state-immutability",
    name: "State Immutability",
    layer: "FUNDAMENTALS",
    category: "React State Basics",
    frameworkAffinity: "react-specific",
    criticality: "critical",
    prerequisites: ["usestate-basics", "spread-operator"],
    detectionRules: {
      patterns: ["AssignmentExpression", "SpreadElement"],
      check: "Detects direct state mutation vs immutable updates",
    },
  },
  {
    slug: "lifting-state",
    name: "Lifting State",
    layer: "FUNDAMENTALS",
    category: "React State Basics",
    frameworkAffinity: "react-specific",
    criticality: "high",
    prerequisites: ["usestate-basics"],
    detectionRules: {
      patterns: ["JSXAttribute"],
      check: "Detects state passed as props to children",
    },
  },

  // ============================================
  // INTERMEDIATE LAYER (32 markers)
  // ============================================

  // Loops & Iteration (js-pure) - 3 markers
  {
    slug: "for-loop-basics",
    name: "For Loop Basics",
    layer: "INTERMEDIATE",
    category: "Loops & Iteration",
    frameworkAffinity: "js-pure",
    criticality: "medium",
    prerequisites: [],
    detectionRules: {
      patterns: ["ForStatement"],
      check: "Detects traditional for loop usage",
    },
  },
  {
    slug: "for-of-loops",
    name: "For...of Loops",
    layer: "INTERMEDIATE",
    category: "Loops & Iteration",
    frameworkAffinity: "js-pure",
    criticality: "medium",
    prerequisites: ["for-loop-basics"],
    detectionRules: {
      patterns: ["ForOfStatement"],
      check: "Detects for...of iteration",
    },
  },
  {
    slug: "while-loops",
    name: "While Loops",
    layer: "INTERMEDIATE",
    category: "Loops & Iteration",
    frameworkAffinity: "js-pure",
    criticality: "low",
    prerequisites: ["for-loop-basics"],
    detectionRules: {
      patterns: ["WhileStatement", "DoWhileStatement"],
      check: "Detects while and do-while loops",
    },
  },

  // This & Context (js-pure) - 3 markers
  {
    slug: "this-binding",
    name: "This Binding",
    layer: "INTERMEDIATE",
    category: "This & Context",
    frameworkAffinity: "js-pure",
    criticality: "high",
    prerequisites: ["closure-basics"],
    detectionRules: {
      patterns: ["ThisExpression"],
      check: "Detects 'this' keyword usage and context",
    },
  },
  {
    slug: "bind-call-apply",
    name: "Bind/Call/Apply",
    layer: "INTERMEDIATE",
    category: "This & Context",
    frameworkAffinity: "js-pure",
    criticality: "medium",
    prerequisites: ["this-binding"],
    detectionRules: {
      patterns: [
        "CallExpression[callee.property.name=bind]",
        "CallExpression[callee.property.name=call]",
        "CallExpression[callee.property.name=apply]",
      ],
      check: "Detects explicit context binding methods",
    },
  },
  {
    slug: "arrow-vs-regular-this",
    name: "Arrow vs Regular This",
    layer: "INTERMEDIATE",
    category: "This & Context",
    frameworkAffinity: "js-pure",
    criticality: "high",
    prerequisites: ["this-binding", "arrow-functions"],
    detectionRules: {
      patterns: ["ArrowFunctionExpression", "FunctionExpression"],
      check: "Detects this binding differences between arrow and regular functions",
    },
  },

  // useEffect Mastery (react-specific) - 5 markers
  {
    slug: "useeffect-basics",
    name: "useEffect Basics",
    layer: "INTERMEDIATE",
    category: "useEffect Mastery",
    frameworkAffinity: "react-specific",
    criticality: "critical",
    prerequisites: ["usestate-basics"],
    detectionRules: {
      patterns: ["CallExpression[callee.name=useEffect]"],
      check: "Detects useEffect hook usage",
    },
  },
  {
    slug: "useeffect-dependencies",
    name: "useEffect Dependencies",
    layer: "INTERMEDIATE",
    category: "useEffect Mastery",
    frameworkAffinity: "react-specific",
    criticality: "critical",
    prerequisites: ["useeffect-basics"],
    detectionRules: {
      patterns: ["CallExpression[callee.name=useEffect]"],
      check: "Analyzes dependency array completeness",
    },
  },
  {
    slug: "useeffect-cleanup",
    name: "useEffect Cleanup",
    layer: "INTERMEDIATE",
    category: "useEffect Mastery",
    frameworkAffinity: "react-specific",
    criticality: "high",
    prerequisites: ["useeffect-basics"],
    detectionRules: {
      patterns: ["ReturnStatement"],
      check: "Detects cleanup function in useEffect",
    },
  },
  {
    slug: "useeffect-async",
    name: "useEffect Async",
    layer: "INTERMEDIATE",
    category: "useEffect Mastery",
    frameworkAffinity: "react-specific",
    criticality: "high",
    prerequisites: ["useeffect-basics", "async-await-basics"],
    detectionRules: {
      patterns: ["CallExpression[callee.name=useEffect]"],
      check: "Detects async patterns in useEffect (inner function, not direct)",
    },
  },
  {
    slug: "useeffect-infinite-loop",
    name: "useEffect Infinite Loop",
    layer: "INTERMEDIATE",
    category: "useEffect Mastery",
    frameworkAffinity: "react-specific",
    criticality: "critical",
    prerequisites: ["useeffect-dependencies"],
    detectionRules: {
      patterns: ["CallExpression[callee.name=useEffect]"],
      check: "Detects potential infinite loops from dependency issues",
    },
  },

  // Props & Components (react-specific) - 5 markers
  {
    slug: "props-basics",
    name: "Props Basics",
    layer: "INTERMEDIATE",
    category: "Props & Components",
    frameworkAffinity: "react-specific",
    criticality: "critical",
    prerequisites: ["jsx-syntax"],
    detectionRules: {
      patterns: ["JSXAttribute", "FunctionDeclaration"],
      check: "Detects props parameter and JSX attribute usage",
    },
  },
  {
    slug: "props-destructuring",
    name: "Props Destructuring",
    layer: "INTERMEDIATE",
    category: "Props & Components",
    frameworkAffinity: "react-specific",
    criticality: "medium",
    prerequisites: ["props-basics", "object-destructuring"],
    detectionRules: {
      patterns: ["ObjectPattern"],
      check: "Detects destructuring in function parameters for props",
    },
  },
  {
    slug: "children-prop",
    name: "Children Prop",
    layer: "INTERMEDIATE",
    category: "Props & Components",
    frameworkAffinity: "react-specific",
    criticality: "high",
    prerequisites: ["props-basics"],
    detectionRules: {
      patterns: ["MemberExpression[property.name=children]"],
      check: "Detects props.children or children destructuring",
    },
  },
  {
    slug: "prop-types-validation",
    name: "Prop Types Validation",
    layer: "INTERMEDIATE",
    category: "Props & Components",
    frameworkAffinity: "react-specific",
    criticality: "medium",
    prerequisites: ["props-basics"],
    detectionRules: {
      patterns: ["MemberExpression[property.name=propTypes]"],
      check: "Detects PropTypes or TypeScript prop types",
    },
  },
  {
    slug: "default-props",
    name: "Default Props",
    layer: "INTERMEDIATE",
    category: "Props & Components",
    frameworkAffinity: "react-specific",
    criticality: "medium",
    prerequisites: ["props-basics", "default-parameters"],
    detectionRules: {
      patterns: ["AssignmentPattern", "MemberExpression[property.name=defaultProps]"],
      check: "Detects default prop values",
    },
  },

  // Component Patterns (react-specific) - 4 markers
  {
    slug: "controlled-components",
    name: "Controlled Components",
    layer: "INTERMEDIATE",
    category: "Component Patterns",
    frameworkAffinity: "react-specific",
    criticality: "critical",
    prerequisites: ["usestate-basics", "jsx-expressions"],
    detectionRules: {
      patterns: ["JSXAttribute[name.name=value]", "JSXAttribute[name.name=onChange]"],
      check: "Detects controlled input patterns",
    },
  },
  {
    slug: "uncontrolled-components",
    name: "Uncontrolled Components",
    layer: "INTERMEDIATE",
    category: "Component Patterns",
    frameworkAffinity: "react-specific",
    criticality: "medium",
    prerequisites: ["controlled-components"],
    detectionRules: {
      patterns: ["JSXAttribute[name.name=defaultValue]"],
      check: "Detects uncontrolled input patterns with refs",
    },
  },
  {
    slug: "component-composition",
    name: "Component Composition",
    layer: "INTERMEDIATE",
    category: "Component Patterns",
    frameworkAffinity: "react-specific",
    criticality: "high",
    prerequisites: ["props-basics", "children-prop"],
    detectionRules: {
      patterns: ["JSXElement > JSXElement"],
      check: "Detects component nesting and composition patterns",
    },
  },
  {
    slug: "conditional-component-rendering",
    name: "Conditional Component Rendering",
    layer: "INTERMEDIATE",
    category: "Component Patterns",
    frameworkAffinity: "react-specific",
    criticality: "high",
    prerequisites: ["jsx-conditional-rendering"],
    detectionRules: {
      patterns: ["LogicalExpression", "ConditionalExpression"],
      check: "Detects conditional rendering of whole components",
    },
  },

  // Event Handling (react-specific) - 4 markers
  {
    slug: "event-handlers",
    name: "Event Handlers",
    layer: "INTERMEDIATE",
    category: "Event Handling",
    frameworkAffinity: "react-specific",
    criticality: "critical",
    prerequisites: ["jsx-syntax", "arrow-functions"],
    detectionRules: {
      patterns: ["JSXAttribute[name.name=/^on[A-Z]/]"],
      check: "Detects onClick, onChange, etc. handlers",
    },
  },
  {
    slug: "event-handler-params",
    name: "Event Handler Parameters",
    layer: "INTERMEDIATE",
    category: "Event Handling",
    frameworkAffinity: "react-specific",
    criticality: "high",
    prerequisites: ["event-handlers"],
    detectionRules: {
      patterns: ["ArrowFunctionExpression"],
      check: "Detects inline arrow functions for passing params to handlers",
    },
  },
  {
    slug: "prevent-default",
    name: "Prevent Default",
    layer: "INTERMEDIATE",
    category: "Event Handling",
    frameworkAffinity: "react-specific",
    criticality: "high",
    prerequisites: ["event-handlers"],
    detectionRules: {
      patterns: ["CallExpression[callee.property.name=preventDefault]"],
      check: "Detects e.preventDefault() in form handlers",
    },
  },
  {
    slug: "event-delegation",
    name: "Event Delegation",
    layer: "INTERMEDIATE",
    category: "Event Handling",
    frameworkAffinity: "react-specific",
    criticality: "medium",
    prerequisites: ["event-handlers"],
    detectionRules: {
      patterns: ["JSXAttribute"],
      check: "Detects event handling at parent vs child level",
    },
  },

  // API Integration (shared) - 4 markers
  {
    slug: "fetch-basics",
    name: "Fetch Basics",
    layer: "INTERMEDIATE",
    category: "API Integration",
    frameworkAffinity: "shared",
    criticality: "critical",
    prerequisites: ["async-await-basics"],
    detectionRules: {
      patterns: ["CallExpression[callee.name=fetch]"],
      check: "Detects fetch API usage",
    },
  },
  {
    slug: "fetch-with-options",
    name: "Fetch with Options",
    layer: "INTERMEDIATE",
    category: "API Integration",
    frameworkAffinity: "shared",
    criticality: "high",
    prerequisites: ["fetch-basics"],
    detectionRules: {
      patterns: ["CallExpression[callee.name=fetch]"],
      check: "Detects fetch with method, headers, body options",
    },
  },
  {
    slug: "loading-states",
    name: "Loading States",
    layer: "INTERMEDIATE",
    category: "API Integration",
    frameworkAffinity: "shared",
    criticality: "high",
    prerequisites: ["usestate-basics", "fetch-basics"],
    detectionRules: {
      patterns: ["CallExpression[callee.name=useState]"],
      check: "Detects loading state management pattern",
    },
  },
  {
    slug: "error-state-handling",
    name: "Error State Handling",
    layer: "INTERMEDIATE",
    category: "API Integration",
    frameworkAffinity: "shared",
    criticality: "high",
    prerequisites: ["loading-states", "fetch-error-checking"],
    detectionRules: {
      patterns: ["CallExpression[callee.name=useState]"],
      check: "Detects error state management pattern",
    },
  },

  // Refs (react-specific) - 4 markers
  {
    slug: "useref-basics",
    name: "useRef Basics",
    layer: "INTERMEDIATE",
    category: "Refs",
    frameworkAffinity: "react-specific",
    criticality: "high",
    prerequisites: ["usestate-basics"],
    detectionRules: {
      patterns: ["CallExpression[callee.name=useRef]"],
      check: "Detects useRef hook usage",
    },
  },
  {
    slug: "useref-dom",
    name: "useRef DOM",
    layer: "INTERMEDIATE",
    category: "Refs",
    frameworkAffinity: "react-specific",
    criticality: "high",
    prerequisites: ["useref-basics"],
    detectionRules: {
      patterns: ["JSXAttribute[name.name=ref]"],
      check: "Detects ref attribute on DOM elements",
    },
  },
  {
    slug: "useref-mutable",
    name: "useRef Mutable",
    layer: "INTERMEDIATE",
    category: "Refs",
    frameworkAffinity: "react-specific",
    criticality: "medium",
    prerequisites: ["useref-basics"],
    detectionRules: {
      patterns: ["MemberExpression[property.name=current]"],
      check: "Detects ref.current for mutable values",
    },
  },
  {
    slug: "callback-refs",
    name: "Callback Refs",
    layer: "INTERMEDIATE",
    category: "Refs",
    frameworkAffinity: "react-specific",
    criticality: "medium",
    prerequisites: ["useref-basics", "callback-functions"],
    detectionRules: {
      patterns: ["JSXAttribute[name.name=ref]"],
      check: "Detects callback ref pattern",
    },
  },

  // ============================================
  // PATTERNS LAYER (24 markers)
  // ============================================

  // Custom Hooks (react-specific) - 4 markers
  {
    slug: "custom-hook-basics",
    name: "Custom Hook Basics",
    layer: "PATTERNS",
    category: "Custom Hooks",
    frameworkAffinity: "react-specific",
    criticality: "high",
    prerequisites: ["usestate-basics", "useeffect-basics"],
    detectionRules: {
      patterns: ["FunctionDeclaration[id.name=/^use[A-Z]/]"],
      check: "Detects custom hook definition (use* naming)",
    },
  },
  {
    slug: "custom-hook-parameters",
    name: "Custom Hook Parameters",
    layer: "PATTERNS",
    category: "Custom Hooks",
    frameworkAffinity: "react-specific",
    criticality: "medium",
    prerequisites: ["custom-hook-basics"],
    detectionRules: {
      patterns: ["FunctionDeclaration"],
      check: "Detects parameterized custom hooks",
    },
  },
  {
    slug: "custom-hook-return",
    name: "Custom Hook Return",
    layer: "PATTERNS",
    category: "Custom Hooks",
    frameworkAffinity: "react-specific",
    criticality: "medium",
    prerequisites: ["custom-hook-basics"],
    detectionRules: {
      patterns: ["ReturnStatement"],
      check: "Detects custom hook return patterns (array vs object)",
    },
  },
  {
    slug: "custom-hook-composition",
    name: "Custom Hook Composition",
    layer: "PATTERNS",
    category: "Custom Hooks",
    frameworkAffinity: "react-specific",
    criticality: "medium",
    prerequisites: ["custom-hook-basics"],
    detectionRules: {
      patterns: ["CallExpression[callee.name=/^use[A-Z]/]"],
      check: "Detects hooks calling other hooks",
    },
  },

  // Context (react-specific) - 4 markers
  {
    slug: "context-basics",
    name: "Context Basics",
    layer: "PATTERNS",
    category: "Context",
    frameworkAffinity: "react-specific",
    criticality: "high",
    prerequisites: ["props-basics"],
    detectionRules: {
      patterns: ["CallExpression[callee.name=createContext]"],
      check: "Detects React.createContext usage",
    },
  },
  {
    slug: "context-provider",
    name: "Context Provider",
    layer: "PATTERNS",
    category: "Context",
    frameworkAffinity: "react-specific",
    criticality: "high",
    prerequisites: ["context-basics"],
    detectionRules: {
      patterns: ["JSXElement[openingElement.name.property.name=Provider]"],
      check: "Detects Context.Provider usage",
    },
  },
  {
    slug: "usecontext-hook",
    name: "useContext Hook",
    layer: "PATTERNS",
    category: "Context",
    frameworkAffinity: "react-specific",
    criticality: "high",
    prerequisites: ["context-basics"],
    detectionRules: {
      patterns: ["CallExpression[callee.name=useContext]"],
      check: "Detects useContext hook consumption",
    },
  },
  {
    slug: "context-performance",
    name: "Context Performance",
    layer: "PATTERNS",
    category: "Context",
    frameworkAffinity: "react-specific",
    criticality: "high",
    prerequisites: ["usecontext-hook"],
    detectionRules: {
      patterns: ["CallExpression[callee.name=useContext]"],
      check: "Analyzes context value structure for performance",
    },
  },

  // Performance Optimization (react-specific) - 5 markers
  {
    slug: "react-memo",
    name: "React.memo",
    layer: "PATTERNS",
    category: "Performance Optimization",
    frameworkAffinity: "react-specific",
    criticality: "high",
    prerequisites: ["component-composition"],
    detectionRules: {
      patterns: ["CallExpression[callee.name=memo]", "CallExpression[callee.property.name=memo]"],
      check: "Detects React.memo usage",
    },
  },
  {
    slug: "usememo-basics",
    name: "useMemo Basics",
    layer: "PATTERNS",
    category: "Performance Optimization",
    frameworkAffinity: "react-specific",
    criticality: "high",
    prerequisites: ["usestate-basics"],
    detectionRules: {
      patterns: ["CallExpression[callee.name=useMemo]"],
      check: "Detects useMemo hook for computed values",
    },
  },
  {
    slug: "usecallback-basics",
    name: "useCallback Basics",
    layer: "PATTERNS",
    category: "Performance Optimization",
    frameworkAffinity: "react-specific",
    criticality: "high",
    prerequisites: ["event-handlers", "closure-basics"],
    detectionRules: {
      patterns: ["CallExpression[callee.name=useCallback]"],
      check: "Detects useCallback hook for function memoization",
    },
  },
  {
    slug: "key-optimization",
    name: "Key Optimization",
    layer: "PATTERNS",
    category: "Performance Optimization",
    frameworkAffinity: "react-specific",
    criticality: "high",
    prerequisites: ["jsx-keys"],
    detectionRules: {
      patterns: ["JSXAttribute[name.name=key]"],
      check: "Analyzes key stability and uniqueness",
    },
  },
  {
    slug: "unnecessary-rerenders",
    name: "Unnecessary Re-renders",
    layer: "PATTERNS",
    category: "Performance Optimization",
    frameworkAffinity: "react-specific",
    criticality: "high",
    prerequisites: ["react-memo", "usememo-basics"],
    detectionRules: {
      patterns: ["JSXElement"],
      check: "Detects potential unnecessary re-render patterns",
    },
  },

  // Advanced Async (shared) - 4 markers
  {
    slug: "promise-all",
    name: "Promise.all",
    layer: "PATTERNS",
    category: "Advanced Async",
    frameworkAffinity: "shared",
    criticality: "high",
    prerequisites: ["promise-basics"],
    detectionRules: {
      patterns: ["CallExpression[callee.property.name=all]"],
      check: "Detects Promise.all for parallel execution",
    },
  },
  {
    slug: "promise-race",
    name: "Promise.race",
    layer: "PATTERNS",
    category: "Advanced Async",
    frameworkAffinity: "shared",
    criticality: "medium",
    prerequisites: ["promise-basics"],
    detectionRules: {
      patterns: ["CallExpression[callee.property.name=race]"],
      check: "Detects Promise.race usage",
    },
  },
  {
    slug: "request-cancellation",
    name: "Request Cancellation",
    layer: "PATTERNS",
    category: "Advanced Async",
    frameworkAffinity: "shared",
    criticality: "high",
    prerequisites: ["fetch-basics", "useeffect-cleanup"],
    detectionRules: {
      patterns: ["NewExpression[callee.name=AbortController]"],
      check: "Detects AbortController for request cancellation",
    },
  },
  {
    slug: "retry-logic",
    name: "Retry Logic",
    layer: "PATTERNS",
    category: "Advanced Async",
    frameworkAffinity: "shared",
    criticality: "medium",
    prerequisites: ["fetch-error-checking"],
    detectionRules: {
      patterns: ["WhileStatement", "ForStatement"],
      check: "Detects retry patterns for failed requests",
    },
  },

  // State Patterns (react-specific) - 4 markers
  {
    slug: "usereducer-basics",
    name: "useReducer Basics",
    layer: "PATTERNS",
    category: "State Patterns",
    frameworkAffinity: "react-specific",
    criticality: "high",
    prerequisites: ["usestate-basics"],
    detectionRules: {
      patterns: ["CallExpression[callee.name=useReducer]"],
      check: "Detects useReducer hook usage",
    },
  },
  {
    slug: "reducer-patterns",
    name: "Reducer Patterns",
    layer: "PATTERNS",
    category: "State Patterns",
    frameworkAffinity: "react-specific",
    criticality: "medium",
    prerequisites: ["usereducer-basics"],
    detectionRules: {
      patterns: ["SwitchStatement"],
      check: "Detects reducer function patterns",
    },
  },
  {
    slug: "complex-state",
    name: "Complex State",
    layer: "PATTERNS",
    category: "State Patterns",
    frameworkAffinity: "react-specific",
    criticality: "high",
    prerequisites: ["usereducer-basics"],
    detectionRules: {
      patterns: ["ObjectExpression"],
      check: "Detects complex state object management",
    },
  },
  {
    slug: "state-normalization",
    name: "State Normalization",
    layer: "PATTERNS",
    category: "State Patterns",
    frameworkAffinity: "react-specific",
    criticality: "medium",
    prerequisites: ["complex-state"],
    detectionRules: {
      patterns: ["ObjectExpression"],
      check: "Detects normalized state structure patterns",
    },
  },

  // Error Boundaries (react-specific) - 3 markers
  {
    slug: "error-boundary-basics",
    name: "Error Boundary Basics",
    layer: "PATTERNS",
    category: "Error Boundaries",
    frameworkAffinity: "react-specific",
    criticality: "high",
    prerequisites: ["try-catch"],
    detectionRules: {
      patterns: ["MethodDefinition[key.name=componentDidCatch]"],
      check: "Detects error boundary class component",
    },
  },
  {
    slug: "error-boundary-fallback",
    name: "Error Boundary Fallback",
    layer: "PATTERNS",
    category: "Error Boundaries",
    frameworkAffinity: "react-specific",
    criticality: "medium",
    prerequisites: ["error-boundary-basics"],
    detectionRules: {
      patterns: ["MethodDefinition[key.name=render]"],
      check: "Detects fallback UI in error boundaries",
    },
  },
  {
    slug: "error-boundary-recovery",
    name: "Error Boundary Recovery",
    layer: "PATTERNS",
    category: "Error Boundaries",
    frameworkAffinity: "react-specific",
    criticality: "medium",
    prerequisites: ["error-boundary-basics"],
    detectionRules: {
      patterns: ["MethodDefinition"],
      check: "Detects error recovery mechanisms",
    },
  },

  // ============================================
  // EXPANDED TOPICS — Array Mutation (shared) - FUNDAMENTALS
  // ============================================

  {
    slug: "array-push-pop",
    name: "Array Push/Pop",
    layer: "FUNDAMENTALS",
    category: "Array Mutation",
    frameworkAffinity: "shared",
    criticality: "medium",
    prerequisites: [],
    detectionRules: { patterns: ["CallExpression"], check: "Detects .push() and .pop() usage" },
  },
  {
    slug: "array-shift-unshift",
    name: "Array Shift/Unshift",
    layer: "FUNDAMENTALS",
    category: "Array Mutation",
    frameworkAffinity: "shared",
    criticality: "medium",
    prerequisites: ["array-push-pop"],
    detectionRules: { patterns: ["CallExpression"], check: "Detects .shift() and .unshift() usage" },
  },
  {
    slug: "array-splice",
    name: "Array Splice",
    layer: "FUNDAMENTALS",
    category: "Array Mutation",
    frameworkAffinity: "shared",
    criticality: "medium",
    prerequisites: ["array-push-pop"],
    detectionRules: { patterns: ["CallExpression"], check: "Detects .splice() usage" },
  },
  {
    slug: "array-indexOf-includes",
    name: "Array indexOf/includes",
    layer: "FUNDAMENTALS",
    category: "Array Mutation",
    frameworkAffinity: "shared",
    criticality: "medium",
    prerequisites: [],
    detectionRules: { patterns: ["CallExpression"], check: "Detects .indexOf() and .includes() usage" },
  },
  {
    slug: "array-sort",
    name: "Array Sort",
    layer: "FUNDAMENTALS",
    category: "Array Mutation",
    frameworkAffinity: "shared",
    criticality: "medium",
    prerequisites: [],
    detectionRules: { patterns: ["CallExpression"], check: "Detects .sort() with/without comparator" },
  },
  {
    slug: "array-slice-concat",
    name: "Array Slice/Concat",
    layer: "FUNDAMENTALS",
    category: "Array Mutation",
    frameworkAffinity: "shared",
    criticality: "medium",
    prerequisites: [],
    detectionRules: { patterns: ["CallExpression"], check: "Detects .slice() and .concat() usage" },
  },
  {
    slug: "array-flat-flatMap",
    name: "Array Flat/FlatMap",
    layer: "FUNDAMENTALS",
    category: "Array Mutation",
    frameworkAffinity: "shared",
    criticality: "medium",
    prerequisites: ["array-map"],
    detectionRules: { patterns: ["CallExpression"], check: "Detects .flat() and .flatMap() usage" },
  },
  {
    slug: "array-from-isArray",
    name: "Array.from/isArray",
    layer: "FUNDAMENTALS",
    category: "Array Mutation",
    frameworkAffinity: "shared",
    criticality: "medium",
    prerequisites: [],
    detectionRules: { patterns: ["CallExpression"], check: "Detects Array.from() and Array.isArray()" },
  },
  {
    slug: "array-length",
    name: "Array Length",
    layer: "FUNDAMENTALS",
    category: "Array Mutation",
    frameworkAffinity: "shared",
    criticality: "low",
    prerequisites: [],
    detectionRules: { patterns: ["MemberExpression"], check: "Detects .length property access" },
  },
  {
    slug: "bracket-notation",
    name: "Bracket Notation",
    layer: "FUNDAMENTALS",
    category: "Array Mutation",
    frameworkAffinity: "shared",
    criticality: "low",
    prerequisites: [],
    detectionRules: { patterns: ["MemberExpression"], check: "Detects bracket notation access" },
  },

  // ============================================
  // EXPANDED TOPICS — String Methods (shared) - FUNDAMENTALS
  // ============================================

  {
    slug: "template-literals",
    name: "Template Literals",
    layer: "FUNDAMENTALS",
    category: "String Methods",
    frameworkAffinity: "shared",
    criticality: "high",
    prerequisites: ["let-const-usage"],
    detectionRules: { patterns: ["TemplateLiteral"], check: "Detects template literal interpolation" },
  },
  {
    slug: "string-split-join",
    name: "String Split/Join",
    layer: "FUNDAMENTALS",
    category: "String Methods",
    frameworkAffinity: "shared",
    criticality: "medium",
    prerequisites: [],
    detectionRules: { patterns: ["CallExpression"], check: "Detects .split() and .join() usage" },
  },
  {
    slug: "string-search-methods",
    name: "String Search Methods",
    layer: "FUNDAMENTALS",
    category: "String Methods",
    frameworkAffinity: "shared",
    criticality: "medium",
    prerequisites: [],
    detectionRules: { patterns: ["CallExpression"], check: "Detects string search methods" },
  },
  {
    slug: "string-transform",
    name: "String Transform",
    layer: "FUNDAMENTALS",
    category: "String Methods",
    frameworkAffinity: "shared",
    criticality: "medium",
    prerequisites: [],
    detectionRules: { patterns: ["CallExpression"], check: "Detects string transformation methods" },
  },
  {
    slug: "string-slice-substring",
    name: "String Slice/Substring",
    layer: "FUNDAMENTALS",
    category: "String Methods",
    frameworkAffinity: "shared",
    criticality: "medium",
    prerequisites: [],
    detectionRules: { patterns: ["CallExpression"], check: "Detects .slice()/.substring() usage" },
  },
  {
    slug: "string-pad-repeat",
    name: "String Pad/Repeat",
    layer: "FUNDAMENTALS",
    category: "String Methods",
    frameworkAffinity: "shared",
    criticality: "low",
    prerequisites: [],
    detectionRules: { patterns: ["CallExpression"], check: "Detects .padStart()/.padEnd()/.repeat()" },
  },

  // ============================================
  // EXPANDED TOPICS — Object Methods (shared) - FUNDAMENTALS
  // ============================================

  {
    slug: "object-keys-values-entries",
    name: "Object.keys/values/entries",
    layer: "FUNDAMENTALS",
    category: "Object Methods",
    frameworkAffinity: "shared",
    criticality: "high",
    prerequisites: [],
    detectionRules: { patterns: ["CallExpression"], check: "Detects Object.keys/values/entries()" },
  },
  {
    slug: "object-assign-freeze",
    name: "Object.assign/freeze",
    layer: "FUNDAMENTALS",
    category: "Object Methods",
    frameworkAffinity: "shared",
    criticality: "medium",
    prerequisites: ["object-destructuring"],
    detectionRules: { patterns: ["CallExpression"], check: "Detects Object.assign() and Object.freeze()" },
  },
  {
    slug: "object-fromEntries",
    name: "Object.fromEntries",
    layer: "FUNDAMENTALS",
    category: "Object Methods",
    frameworkAffinity: "shared",
    criticality: "medium",
    prerequisites: ["object-keys-values-entries"],
    detectionRules: { patterns: ["CallExpression"], check: "Detects Object.fromEntries()" },
  },
  {
    slug: "computed-property-names",
    name: "Computed Property Names",
    layer: "FUNDAMENTALS",
    category: "Object Methods",
    frameworkAffinity: "shared",
    criticality: "medium",
    prerequisites: [],
    detectionRules: { patterns: ["ObjectProperty"], check: "Detects computed property names [expr]" },
  },
  {
    slug: "property-access-patterns",
    name: "Property Access Patterns",
    layer: "FUNDAMENTALS",
    category: "Object Methods",
    frameworkAffinity: "shared",
    criticality: "low",
    prerequisites: [],
    detectionRules: { patterns: ["MemberExpression"], check: "Detects dot vs bracket notation" },
  },
  {
    slug: "property-existence-check",
    name: "Property Existence Check",
    layer: "FUNDAMENTALS",
    category: "Object Methods",
    frameworkAffinity: "shared",
    criticality: "medium",
    prerequisites: [],
    detectionRules: { patterns: ["BinaryExpression", "CallExpression"], check: "Detects 'in' operator and hasOwnProperty" },
  },

  // ============================================
  // EXPANDED TOPICS — Number & Math (js-pure) - FUNDAMENTALS
  // ============================================

  {
    slug: "number-parsing",
    name: "Number Parsing",
    layer: "FUNDAMENTALS",
    category: "Number & Math",
    frameworkAffinity: "js-pure",
    criticality: "medium",
    prerequisites: [],
    detectionRules: { patterns: ["CallExpression"], check: "Detects parseInt/parseFloat/Number()" },
  },
  {
    slug: "number-checking",
    name: "Number Checking",
    layer: "FUNDAMENTALS",
    category: "Number & Math",
    frameworkAffinity: "js-pure",
    criticality: "medium",
    prerequisites: [],
    detectionRules: { patterns: ["CallExpression"], check: "Detects Number.isNaN/isFinite/isInteger" },
  },
  {
    slug: "number-formatting",
    name: "Number Formatting",
    layer: "FUNDAMENTALS",
    category: "Number & Math",
    frameworkAffinity: "js-pure",
    criticality: "low",
    prerequisites: [],
    detectionRules: { patterns: ["CallExpression"], check: "Detects toFixed/toLocaleString" },
  },
  {
    slug: "math-methods",
    name: "Math Methods",
    layer: "FUNDAMENTALS",
    category: "Number & Math",
    frameworkAffinity: "js-pure",
    criticality: "medium",
    prerequisites: [],
    detectionRules: { patterns: ["CallExpression"], check: "Detects Math.* methods" },
  },

  // ============================================
  // EXPANDED TOPICS — JSON Operations (shared) - FUNDAMENTALS
  // ============================================

  {
    slug: "json-parse",
    name: "JSON.parse",
    layer: "FUNDAMENTALS",
    category: "JSON Operations",
    frameworkAffinity: "shared",
    criticality: "high",
    prerequisites: ["try-catch"],
    detectionRules: { patterns: ["CallExpression"], check: "Detects JSON.parse() with error handling" },
  },
  {
    slug: "json-stringify",
    name: "JSON.stringify",
    layer: "FUNDAMENTALS",
    category: "JSON Operations",
    frameworkAffinity: "shared",
    criticality: "medium",
    prerequisites: [],
    detectionRules: { patterns: ["CallExpression"], check: "Detects JSON.stringify()" },
  },

  // ============================================
  // EXPANDED TOPICS — Type Checking & Comparison (shared) - FUNDAMENTALS
  // ============================================

  {
    slug: "typeof-operator",
    name: "typeof Operator",
    layer: "FUNDAMENTALS",
    category: "Type Checking",
    frameworkAffinity: "shared",
    criticality: "medium",
    prerequisites: [],
    detectionRules: { patterns: ["UnaryExpression"], check: "Detects typeof operator" },
  },
  {
    slug: "instanceof-operator",
    name: "instanceof Operator",
    layer: "FUNDAMENTALS",
    category: "Type Checking",
    frameworkAffinity: "shared",
    criticality: "medium",
    prerequisites: [],
    detectionRules: { patterns: ["BinaryExpression"], check: "Detects instanceof operator" },
  },
  {
    slug: "equality-operators",
    name: "Equality Operators",
    layer: "FUNDAMENTALS",
    category: "Type Checking",
    frameworkAffinity: "shared",
    criticality: "high",
    prerequisites: [],
    detectionRules: { patterns: ["BinaryExpression"], check: "Detects === vs == usage" },
  },
  {
    slug: "ternary-operator",
    name: "Ternary Operator",
    layer: "FUNDAMENTALS",
    category: "Type Checking",
    frameworkAffinity: "shared",
    criticality: "medium",
    prerequisites: [],
    detectionRules: { patterns: ["ConditionalExpression"], check: "Detects ternary operator" },
  },

  // ============================================
  // EXPANDED TOPICS — Module Patterns (shared) - FUNDAMENTALS
  // ============================================

  {
    slug: "import-export-named",
    name: "Named Import/Export",
    layer: "FUNDAMENTALS",
    category: "Module Patterns",
    frameworkAffinity: "shared",
    criticality: "high",
    prerequisites: [],
    detectionRules: { patterns: ["ImportDeclaration", "ExportNamedDeclaration"], check: "Detects named imports and exports" },
  },
  {
    slug: "import-export-default",
    name: "Default Import/Export",
    layer: "FUNDAMENTALS",
    category: "Module Patterns",
    frameworkAffinity: "shared",
    criticality: "high",
    prerequisites: [],
    detectionRules: { patterns: ["ImportDeclaration", "ExportDefaultDeclaration"], check: "Detects default imports and exports" },
  },
  {
    slug: "import-dynamic",
    name: "Dynamic Import",
    layer: "FUNDAMENTALS",
    category: "Module Patterns",
    frameworkAffinity: "shared",
    criticality: "medium",
    prerequisites: [],
    detectionRules: { patterns: ["ImportExpression"], check: "Detects dynamic import()" },
  },
  {
    slug: "import-namespace",
    name: "Namespace Import",
    layer: "FUNDAMENTALS",
    category: "Module Patterns",
    frameworkAffinity: "shared",
    criticality: "low",
    prerequisites: [],
    detectionRules: { patterns: ["ImportDeclaration"], check: "Detects import * as namespace" },
  },

  // ============================================
  // EXPANDED TOPICS — Anti-Patterns (shared) - FUNDAMENTALS
  // ============================================

  {
    slug: "no-var-usage",
    name: "No var Usage",
    layer: "FUNDAMENTALS",
    category: "Anti-Patterns",
    frameworkAffinity: "shared",
    criticality: "high",
    prerequisites: ["let-const-usage"],
    detectionRules: { patterns: ["VariableDeclaration"], check: "Flags var declarations" },
  },
  {
    slug: "strict-equality",
    name: "Strict Equality",
    layer: "FUNDAMENTALS",
    category: "Anti-Patterns",
    frameworkAffinity: "shared",
    criticality: "high",
    prerequisites: [],
    detectionRules: { patterns: ["BinaryExpression"], check: "Flags == instead of ===" },
  },
  {
    slug: "no-eval",
    name: "No eval()",
    layer: "FUNDAMENTALS",
    category: "Anti-Patterns",
    frameworkAffinity: "shared",
    criticality: "critical",
    prerequisites: [],
    detectionRules: { patterns: ["CallExpression"], check: "Flags eval() usage" },
  },
  {
    slug: "no-innerHTML",
    name: "No innerHTML",
    layer: "FUNDAMENTALS",
    category: "Anti-Patterns",
    frameworkAffinity: "shared",
    criticality: "high",
    prerequisites: [],
    detectionRules: { patterns: ["AssignmentExpression", "JSXAttribute"], check: "Flags innerHTML/dangerouslySetInnerHTML" },
  },
  {
    slug: "no-magic-numbers",
    name: "No Magic Numbers",
    layer: "FUNDAMENTALS",
    category: "Anti-Patterns",
    frameworkAffinity: "shared",
    criticality: "low",
    prerequisites: ["let-const-usage"],
    detectionRules: { patterns: ["NumericLiteral"], check: "Flags unexplained numeric literals" },
  },
  {
    slug: "empty-catch-blocks",
    name: "Empty Catch Blocks",
    layer: "FUNDAMENTALS",
    category: "Anti-Patterns",
    frameworkAffinity: "shared",
    criticality: "high",
    prerequisites: ["try-catch"],
    detectionRules: { patterns: ["TryStatement"], check: "Flags empty catch blocks" },
  },
  {
    slug: "implicit-type-coercion",
    name: "Implicit Type Coercion",
    layer: "FUNDAMENTALS",
    category: "Anti-Patterns",
    frameworkAffinity: "shared",
    criticality: "medium",
    prerequisites: [],
    detectionRules: { patterns: ["UnaryExpression", "BinaryExpression"], check: "Flags implicit type coercion patterns" },
  },

  // ============================================
  // EXPANDED TOPICS — Modern Operators (shared) - INTERMEDIATE
  // ============================================

  {
    slug: "optional-chaining",
    name: "Optional Chaining",
    layer: "INTERMEDIATE",
    category: "Modern Operators",
    frameworkAffinity: "shared",
    criticality: "high",
    prerequisites: ["property-access-patterns"],
    detectionRules: { patterns: ["OptionalMemberExpression"], check: "Detects ?. operator" },
  },
  {
    slug: "nullish-coalescing",
    name: "Nullish Coalescing",
    layer: "INTERMEDIATE",
    category: "Modern Operators",
    frameworkAffinity: "shared",
    criticality: "high",
    prerequisites: [],
    detectionRules: { patterns: ["LogicalExpression"], check: "Detects ?? operator" },
  },
  {
    slug: "logical-assignment",
    name: "Logical Assignment",
    layer: "INTERMEDIATE",
    category: "Modern Operators",
    frameworkAffinity: "shared",
    criticality: "low",
    prerequisites: [],
    detectionRules: { patterns: ["AssignmentExpression"], check: "Detects &&=, ||=, ??= operators" },
  },

  // ============================================
  // EXPANDED TOPICS — Control Flow (shared) - FUNDAMENTALS/INTERMEDIATE
  // ============================================

  {
    slug: "switch-case",
    name: "Switch/Case",
    layer: "FUNDAMENTALS",
    category: "Control Flow",
    frameworkAffinity: "shared",
    criticality: "medium",
    prerequisites: [],
    detectionRules: { patterns: ["SwitchStatement"], check: "Detects switch/case statements" },
  },
  {
    slug: "for-in-loops",
    name: "For...in Loops",
    layer: "INTERMEDIATE",
    category: "Control Flow",
    frameworkAffinity: "shared",
    criticality: "medium",
    prerequisites: ["for-loop-basics"],
    detectionRules: { patterns: ["ForInStatement"], check: "Detects for...in loops" },
  },
  {
    slug: "guard-clauses",
    name: "Guard Clauses",
    layer: "INTERMEDIATE",
    category: "Control Flow",
    frameworkAffinity: "shared",
    criticality: "medium",
    prerequisites: ["arrow-functions"],
    detectionRules: { patterns: ["IfStatement", "ReturnStatement"], check: "Detects early return patterns" },
  },
  {
    slug: "short-circuit-evaluation",
    name: "Short-Circuit Evaluation",
    layer: "FUNDAMENTALS",
    category: "Control Flow",
    frameworkAffinity: "shared",
    criticality: "medium",
    prerequisites: [],
    detectionRules: { patterns: ["LogicalExpression"], check: "Detects && and || for conditional logic" },
  },

  // ============================================
  // EXPANDED TOPICS — Class Syntax (js-pure) - INTERMEDIATE
  // ============================================

  {
    slug: "class-declaration",
    name: "Class Declaration",
    layer: "INTERMEDIATE",
    category: "Class Syntax",
    frameworkAffinity: "js-pure",
    criticality: "high",
    prerequisites: [],
    detectionRules: { patterns: ["ClassDeclaration"], check: "Detects class declarations" },
  },
  {
    slug: "class-methods",
    name: "Class Methods",
    layer: "INTERMEDIATE",
    category: "Class Syntax",
    frameworkAffinity: "js-pure",
    criticality: "high",
    prerequisites: ["class-declaration"],
    detectionRules: { patterns: ["ClassMethod"], check: "Detects class method definitions" },
  },
  {
    slug: "class-inheritance",
    name: "Class Inheritance",
    layer: "INTERMEDIATE",
    category: "Class Syntax",
    frameworkAffinity: "js-pure",
    criticality: "high",
    prerequisites: ["class-declaration"],
    detectionRules: { patterns: ["ClassDeclaration"], check: "Detects extends keyword" },
  },
  {
    slug: "class-getters-setters",
    name: "Class Getters/Setters",
    layer: "INTERMEDIATE",
    category: "Class Syntax",
    frameworkAffinity: "js-pure",
    criticality: "medium",
    prerequisites: ["class-declaration"],
    detectionRules: { patterns: ["ClassMethod"], check: "Detects get/set accessors" },
  },
  {
    slug: "class-private-fields",
    name: "Class Private Fields",
    layer: "INTERMEDIATE",
    category: "Class Syntax",
    frameworkAffinity: "js-pure",
    criticality: "medium",
    prerequisites: ["class-declaration"],
    detectionRules: { patterns: ["ClassPrivateProperty"], check: "Detects #private fields" },
  },
  {
    slug: "class-properties",
    name: "Class Properties",
    layer: "INTERMEDIATE",
    category: "Class Syntax",
    frameworkAffinity: "js-pure",
    criticality: "medium",
    prerequisites: ["class-declaration"],
    detectionRules: { patterns: ["ClassProperty"], check: "Detects public class fields" },
  },

  // ============================================
  // EXPANDED TOPICS — Map & Set (shared) - INTERMEDIATE
  // ============================================

  {
    slug: "map-basics",
    name: "Map Basics",
    layer: "INTERMEDIATE",
    category: "Map & Set",
    frameworkAffinity: "shared",
    criticality: "medium",
    prerequisites: [],
    detectionRules: { patterns: ["NewExpression"], check: "Detects new Map() usage" },
  },
  {
    slug: "set-basics",
    name: "Set Basics",
    layer: "INTERMEDIATE",
    category: "Map & Set",
    frameworkAffinity: "shared",
    criticality: "medium",
    prerequisites: [],
    detectionRules: { patterns: ["NewExpression"], check: "Detects new Set() usage" },
  },
  {
    slug: "map-set-iteration",
    name: "Map/Set Iteration",
    layer: "INTERMEDIATE",
    category: "Map & Set",
    frameworkAffinity: "shared",
    criticality: "medium",
    prerequisites: ["map-basics"],
    detectionRules: { patterns: ["CallExpression"], check: "Detects Map/Set iteration patterns" },
  },
  {
    slug: "weakmap-weakref",
    name: "WeakMap/WeakRef",
    layer: "INTERMEDIATE",
    category: "Map & Set",
    frameworkAffinity: "shared",
    criticality: "low",
    prerequisites: ["map-basics"],
    detectionRules: { patterns: ["NewExpression"], check: "Detects WeakMap/WeakSet/WeakRef" },
  },

  // ============================================
  // EXPANDED TOPICS — Timers & Scheduling (shared) - INTERMEDIATE
  // ============================================

  {
    slug: "setTimeout-usage",
    name: "setTimeout Usage",
    layer: "INTERMEDIATE",
    category: "Timers & Scheduling",
    frameworkAffinity: "shared",
    criticality: "medium",
    prerequisites: ["callback-functions"],
    detectionRules: { patterns: ["CallExpression"], check: "Detects setTimeout() usage" },
  },
  {
    slug: "setInterval-usage",
    name: "setInterval Usage",
    layer: "INTERMEDIATE",
    category: "Timers & Scheduling",
    frameworkAffinity: "shared",
    criticality: "medium",
    prerequisites: ["setTimeout-usage"],
    detectionRules: { patterns: ["CallExpression"], check: "Detects setInterval() with cleanup" },
  },
  {
    slug: "requestAnimationFrame-usage",
    name: "requestAnimationFrame",
    layer: "INTERMEDIATE",
    category: "Timers & Scheduling",
    frameworkAffinity: "shared",
    criticality: "medium",
    prerequisites: ["callback-functions"],
    detectionRules: { patterns: ["CallExpression"], check: "Detects rAF usage" },
  },
  {
    slug: "debounce-throttle",
    name: "Debounce/Throttle",
    layer: "INTERMEDIATE",
    category: "Timers & Scheduling",
    frameworkAffinity: "shared",
    criticality: "high",
    prerequisites: ["setTimeout-usage", "closure-basics"],
    detectionRules: { patterns: ["CallExpression"], check: "Detects debounce/throttle patterns" },
  },

  // ============================================
  // EXPANDED TOPICS — Date Handling (shared) - INTERMEDIATE
  // ============================================

  {
    slug: "date-creation",
    name: "Date Creation",
    layer: "INTERMEDIATE",
    category: "Date Handling",
    frameworkAffinity: "shared",
    criticality: "medium",
    prerequisites: [],
    detectionRules: { patterns: ["NewExpression"], check: "Detects new Date() and Date.now()" },
  },
  {
    slug: "date-formatting",
    name: "Date Formatting",
    layer: "INTERMEDIATE",
    category: "Date Handling",
    frameworkAffinity: "shared",
    criticality: "medium",
    prerequisites: ["date-creation"],
    detectionRules: { patterns: ["CallExpression"], check: "Detects date formatting methods" },
  },
  {
    slug: "date-methods",
    name: "Date Methods",
    layer: "INTERMEDIATE",
    category: "Date Handling",
    frameworkAffinity: "shared",
    criticality: "medium",
    prerequisites: ["date-creation"],
    detectionRules: { patterns: ["CallExpression"], check: "Detects getFullYear/setDate etc." },
  },

  // ============================================
  // EXPANDED TOPICS — Regex (shared) - INTERMEDIATE
  // ============================================

  {
    slug: "regex-literal",
    name: "Regex Literal",
    layer: "INTERMEDIATE",
    category: "Regex",
    frameworkAffinity: "shared",
    criticality: "medium",
    prerequisites: [],
    detectionRules: { patterns: ["RegExpLiteral"], check: "Detects /pattern/ and new RegExp()" },
  },
  {
    slug: "regex-methods",
    name: "Regex Methods",
    layer: "INTERMEDIATE",
    category: "Regex",
    frameworkAffinity: "shared",
    criticality: "medium",
    prerequisites: ["regex-literal"],
    detectionRules: { patterns: ["CallExpression"], check: "Detects .test() and .exec()" },
  },
  {
    slug: "regex-flags",
    name: "Regex Flags",
    layer: "INTERMEDIATE",
    category: "Regex",
    frameworkAffinity: "shared",
    criticality: "low",
    prerequisites: ["regex-literal"],
    detectionRules: { patterns: ["RegExpLiteral"], check: "Detects regex flags (g, i, m, etc.)" },
  },
  {
    slug: "regex-groups",
    name: "Regex Groups",
    layer: "INTERMEDIATE",
    category: "Regex",
    frameworkAffinity: "shared",
    criticality: "medium",
    prerequisites: ["regex-literal"],
    detectionRules: { patterns: ["RegExpLiteral"], check: "Detects capture/named groups" },
  },

  // ============================================
  // EXPANDED TOPICS — DOM Operations (shared) - INTERMEDIATE
  // ============================================

  {
    slug: "dom-query-selectors",
    name: "DOM Query Selectors",
    layer: "INTERMEDIATE",
    category: "DOM Operations",
    frameworkAffinity: "shared",
    criticality: "high",
    prerequisites: [],
    detectionRules: { patterns: ["CallExpression"], check: "Detects querySelector/getElementById" },
  },
  {
    slug: "dom-manipulation",
    name: "DOM Manipulation",
    layer: "INTERMEDIATE",
    category: "DOM Operations",
    frameworkAffinity: "shared",
    criticality: "high",
    prerequisites: ["dom-query-selectors"],
    detectionRules: { patterns: ["CallExpression"], check: "Detects createElement/appendChild etc." },
  },
  {
    slug: "dom-events",
    name: "DOM Events",
    layer: "INTERMEDIATE",
    category: "DOM Operations",
    frameworkAffinity: "shared",
    criticality: "high",
    prerequisites: ["dom-query-selectors"],
    detectionRules: { patterns: ["CallExpression"], check: "Detects addEventListener" },
  },
  {
    slug: "dom-classlist",
    name: "DOM classList",
    layer: "INTERMEDIATE",
    category: "DOM Operations",
    frameworkAffinity: "shared",
    criticality: "medium",
    prerequisites: ["dom-query-selectors"],
    detectionRules: { patterns: ["CallExpression"], check: "Detects classList.add/remove/toggle" },
  },
  {
    slug: "dom-dataset",
    name: "DOM dataset",
    layer: "INTERMEDIATE",
    category: "DOM Operations",
    frameworkAffinity: "shared",
    criticality: "low",
    prerequisites: ["dom-query-selectors"],
    detectionRules: { patterns: ["MemberExpression"], check: "Detects element.dataset access" },
  },

  // ============================================
  // EXPANDED TOPICS — Browser APIs (shared) - INTERMEDIATE
  // ============================================

  {
    slug: "localStorage-usage",
    name: "localStorage Usage",
    layer: "INTERMEDIATE",
    category: "Browser APIs",
    frameworkAffinity: "shared",
    criticality: "medium",
    prerequisites: ["json-stringify"],
    detectionRules: { patterns: ["CallExpression"], check: "Detects localStorage/sessionStorage" },
  },
  {
    slug: "url-api",
    name: "URL API",
    layer: "INTERMEDIATE",
    category: "Browser APIs",
    frameworkAffinity: "shared",
    criticality: "medium",
    prerequisites: [],
    detectionRules: { patterns: ["NewExpression"], check: "Detects new URL()/URLSearchParams" },
  },
  {
    slug: "formdata-api",
    name: "FormData API",
    layer: "INTERMEDIATE",
    category: "Browser APIs",
    frameworkAffinity: "shared",
    criticality: "medium",
    prerequisites: [],
    detectionRules: { patterns: ["NewExpression"], check: "Detects new FormData()" },
  },
  {
    slug: "history-api",
    name: "History API",
    layer: "INTERMEDIATE",
    category: "Browser APIs",
    frameworkAffinity: "shared",
    criticality: "medium",
    prerequisites: [],
    detectionRules: { patterns: ["CallExpression"], check: "Detects history.pushState/replaceState" },
  },

  // ============================================
  // EXPANDED TOPICS — Observer APIs (shared) - PATTERNS
  // ============================================

  {
    slug: "intersection-observer",
    name: "IntersectionObserver",
    layer: "PATTERNS",
    category: "Observer APIs",
    frameworkAffinity: "shared",
    criticality: "medium",
    prerequisites: ["callback-functions"],
    detectionRules: { patterns: ["NewExpression"], check: "Detects IntersectionObserver" },
  },
  {
    slug: "mutation-observer",
    name: "MutationObserver",
    layer: "PATTERNS",
    category: "Observer APIs",
    frameworkAffinity: "shared",
    criticality: "medium",
    prerequisites: ["callback-functions"],
    detectionRules: { patterns: ["NewExpression"], check: "Detects MutationObserver" },
  },
  {
    slug: "resize-observer",
    name: "ResizeObserver",
    layer: "PATTERNS",
    category: "Observer APIs",
    frameworkAffinity: "shared",
    criticality: "medium",
    prerequisites: ["callback-functions"],
    detectionRules: { patterns: ["NewExpression"], check: "Detects ResizeObserver" },
  },
];

async function main() {
  // Merge Babel topics with ESLint topics (avoid slug collisions)
  const babelSlugs = new Set(topics.map((t) => t.slug));
  const eslintTopics = eslintTopicsRaw.filter((t) => !babelSlugs.has(t.slug));

  // Merge data flow topics (normalize framework field)
  const existingSlugs = new Set([...babelSlugs, ...eslintTopics.map((t) => t.slug)]);
  const dataflowTopics = dataflowTopicsRaw
    .filter((t) => !existingSlugs.has(t.slug))
    .map((t) => ({
      slug: t.slug,
      name: t.name,
      layer: t.layer,
      category: t.category,
      frameworkAffinity: t.framework === "react-specific" ? "react-specific" : t.framework === "js-pure" ? "js-pure" : "shared",
      criticality: t.criticality,
      prerequisites: t.prerequisites,
      detectionRules: { type: "dataflow", relatedTopics: t.relatedTopics },
    }));

  const allTopics = [...topics, ...eslintTopics, ...dataflowTopics];

  console.log(`Seeding ${allTopics.length} topics (${topics.length} Babel + ${eslintTopics.length} ESLint + ${dataflowTopics.length} Data Flow)...`);

  // First, create a map of slug to topic for prerequisite resolution
  const slugToId = new Map<string, number>();

  // Insert all topics first without prerequisites
  for (let i = 0; i < allTopics.length; i++) {
    const topic = allTopics[i];
    const created = await prisma.topic.upsert({
      where: { slug: topic.slug },
      update: {
        name: topic.name,
        layer: topic.layer,
        category: topic.category,
        frameworkAffinity: topic.frameworkAffinity,
        criticality: topic.criticality,
        detectionRules: topic.detectionRules,
      },
      create: {
        slug: topic.slug,
        name: topic.name,
        layer: topic.layer,
        category: topic.category,
        frameworkAffinity: topic.frameworkAffinity,
        criticality: topic.criticality,
        detectionRules: topic.detectionRules,
        prerequisites: [],
      },
    });
    slugToId.set(topic.slug, created.id);
    if (i < topics.length) {
      console.log(`[Babel] ${topic.slug} (ID: ${created.id})`);
    } else if (i < topics.length + eslintTopics.length) {
      console.log(`[ESLint] ${topic.slug} (ID: ${created.id})`);
    } else {
      console.log(`[DataFlow] ${topic.slug} (ID: ${created.id})`);
    }
  }

  // Now update prerequisites with actual IDs (Babel + data flow topics have prerequisites)
  const topicsWithPrereqs = [...topics, ...dataflowTopics];
  for (const topic of topicsWithPrereqs) {
    if (topic.prerequisites.length > 0) {
      const prerequisiteIds = topic.prerequisites
        .map((slug) => slugToId.get(slug))
        .filter((id): id is number => id !== undefined);

      await prisma.topic.update({
        where: { slug: topic.slug },
        data: { prerequisites: prerequisiteIds },
      });
      console.log(`Updated prerequisites for ${topic.slug}: [${prerequisiteIds.join(", ")}]`);
    }
  }

  console.log(`\nSeeded ${allTopics.length} topics successfully!`);
  console.log(`  Babel AST topics: ${topics.length}`);
  console.log(`  ESLint topics: ${eslintTopics.length}`);
  console.log(`  Data Flow topics: ${dataflowTopics.length}`);

  // Print summary by layer
  const fundamentals = allTopics.filter((t) => t.layer === "FUNDAMENTALS");
  const intermediate = allTopics.filter((t) => t.layer === "INTERMEDIATE");
  const patterns = allTopics.filter((t) => t.layer === "PATTERNS");

  console.log("\nBy Layer:");
  console.log(`  FUNDAMENTALS: ${fundamentals.length} topics`);
  console.log(`  INTERMEDIATE: ${intermediate.length} topics`);
  console.log(`  PATTERNS: ${patterns.length} topics`);

  // Print by affinity
  const jsPure = allTopics.filter((t) => t.frameworkAffinity === "js-pure");
  const reactSpecific = allTopics.filter((t) => t.frameworkAffinity === "react-specific");
  const shared = allTopics.filter((t) => t.frameworkAffinity === "shared");

  console.log("\nBy Framework Affinity:");
  console.log(`  js-pure: ${jsPure.length} topics`);
  console.log(`  react-specific: ${reactSpecific.length} topics`);
  console.log(`  shared: ${shared.length} topics`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
