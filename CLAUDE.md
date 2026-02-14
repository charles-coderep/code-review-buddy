# Cortext Coding Coach - Implementation Reference

## Project Overview

AI-powered coding coach using Glicko-2 ratings to track JavaScript/React skill mastery. Not a tutorial platform — an always-on coach that uses your own code to push your existing knowledge forward. Builds persistent mental model of each learner, adapts coaching when stuck, tracks confidence separately from skill level, and tells you what to practice next.

## Current Status

**APP FUNCTIONAL** — Full stack working: signup → login → dashboard → submit code → AI coaching feedback → skill tracking.

**Coding Sandbox & Coaching IDE: COMPLETE (Phase 9)** — Review page transformed from single-column submission form into a "VS Code-lite" 3-pane IDE. Left pane: collapsible snippet library (CRUD). Center: Monaco editor with toolbar (save/run/submit). Right: tabbed output (Console via Web Worker execution | Coaching feedback). Mobile: full-screen tabs with Sheet-based snippet library. Uses `react-resizable-panels` v4.6.2 for resizable split layout.

**AI-Driven Evaluation Refactor: COMPLETE** — AST handles topic detection (which topics?), AI handles evaluation (used correctly?), Glicko-2 updates driven by AI scores with AST fallback.

**AST Detector Expansion: COMPLETE** — Expanded from 13 to 30 detector files covering ~180 topic markers. Type inference utility added. All detectors registered in index.ts, all topics seeded in seed.ts.

**ESLint Integration: COMPLETE** — Programmatic ESLint analysis added as second detection layer. ~152 ESLint rules mapped to topics (22 overlap with existing Babel topics, ~130 new).

**Data Flow Detection: COMPLETE** — 14 semantic data flow detectors (alias tracking, reference sharing, nesting analysis, React state mutation, loop bounds, string coercion). Catches issues that syntax-only detectors and lint rules miss.

**Total topics: 347** (181 Babel + 152 ESLint + 14 Data Flow)

**Detection Quality & Scoring Audit: COMPLETE (Phase 10)** — Fixed false positives (deep-nesting double-count, magic-numbers noise, no-var inflation). Added scoring audit log showing full Glicko-2 thought process per topic. UI fixes for hydration errors, cursor-pointer, and layout reorganization.

**Pipeline:**

```
Code → Babel AST Parse → AST Detectors (topic presence, +/-)
                       → ESLint Linter (rule violations, - only)
                       → Data Flow Analyzer (semantic patterns, - only)
     → Positive Inference (infer correct usage from prerequisites)
     → Merge detections → Grok AI (correctness scoring + coaching) → Glicko-2 (rating update) → Save
```

## Tech Stack

- **Framework:** Next.js 16.1.6 (App Router, Turbopack)
- **Frontend:** React 19.2.3, Tailwind CSS v4, shadcn/ui (new-york style), Monaco Editor (`@monaco-editor/react` 4.7.0)
- **Database:** PostgreSQL (Supabase), Prisma 7 ORM
- **Auth:** NextAuth.js v5 (Credentials, JWT strategy)
- **AI:** xAI Grok API (grok-4-latest)
- **Code Analysis:** Babel Parser (AST) + custom detectors + ESLint (programmatic Linter) + Data Flow analysis
- **IDE Layout:** `react-resizable-panels` v4.6.2 (resizable 3-pane split)
- **Code Execution:** Web Worker (`public/sandbox-worker.js`) with 3-second timeout
- **Deployment:** Vercel, Sentry, Stripe

## File Structure

```
src/
├── app/
│   ├── actions/
│   │   ├── review.ts          # Main code submission server action (accepts snippetId)
│   │   ├── snippets.ts        # Snippet CRUD server actions (5 actions: list, get, create, update, delete)
│   │   └── user.ts            # User/signup server action
│   ├── (dashboard)/
│   │   ├── dashboard/page.tsx # Dashboard page (has own p-6 padding wrapper)
│   │   ├── review/page.tsx    # Coding IDE page (3-pane layout: library + editor + output)
│   │   ├── skills/page.tsx    # Skill matrix view (has own p-6 padding wrapper)
│   │   ├── pattern-library/page.tsx # Topic library page (has own p-6 padding wrapper)
│   │   ├── login/page.tsx     # Login page
│   │   └── signup/page.tsx    # Signup page
│   └── page.tsx               # Landing page
├── components/
│   ├── review/
│   │   ├── review-results.tsx # Results display (feedback + skill changes + scoring audit + engine details)
│   │   ├── console-output.tsx # Console output pane (captures console.log/warn/error/info)
│   │   ├── snippet-library.tsx # Left sidebar: user's saved snippets list with CRUD
│   │   └── pipeline-progress.tsx # Pipeline animation (7 stages, extracted from page)
│   ├── layout/
│   │   └── dashboard-shell.tsx # Dashboard shell (main is overflow-hidden, pages add own padding)
│   ├── dashboard/             # Dashboard components
│   ├── skills/                # Skill matrix components
│   └── ui/                    # shadcn/ui components
├── lib/
│   ├── analysis/
│   │   ├── parser.ts          # Babel AST parser + traverse helpers
│   │   ├── index.ts           # Analysis orchestrator (runs all detectors + ESLint)
│   │   ├── eslintDetector.ts  # ESLint programmatic analysis (Linter class, ~120 rules)
│   │   ├── dataFlowDetector.ts # Data flow analysis (14 semantic detectors)
│   │   ├── typeInference.ts    # Type inference + alias tracking utility
│   │   └── detectors/         # AST detector files (one per category, 30 total)
│   │       ├── arrayMethods.ts          # map, filter, reduce, find, some/every, forEach, chaining
│   │       ├── arrayMutationMethods.ts  # push/pop, shift/unshift, splice, indexOf/includes, sort, slice/concat, flat/flatMap, Array.from/isArray, length, bracket notation
│   │       ├── asyncPatterns.ts         # promises, async/await, Promise.all/race
│   │       ├── reactHooks.ts            # useState, useEffect basics
│   │       ├── jsxPatterns.ts           # JSX syntax, expressions, conditional/list rendering, keys
│   │       ├── errorHandling.ts         # try/catch, throw, fetch error checking, let/const, destructuring, spread, arrows
│   │       ├── variablePatterns.ts      # var-hoisting, TDZ, block/function scope, object shorthand
│   │       ├── functionPatterns.ts      # default/rest params, pure functions, callbacks, HOF, closures
│   │       ├── loopsAndContext.ts       # for/for-of/while, this binding, bind/call/apply, arrow vs regular this
│   │       ├── advancedHooks.ts         # useEffect mastery, useRef
│   │       ├── componentPatterns.ts     # controlled/uncontrolled, composition, conditional rendering
│   │       ├── statePatterns.ts         # useReducer, reducer patterns, complex state
│   │       ├── advancedReactPatterns.ts # custom hooks, context, performance optimization
│   │       ├── errorBoundaries.ts       # error boundary class components
│   │       ├── stringMethods.ts         # template literals, split/join, search, transform, slice/substring, pad/repeat
│   │       ├── objectMethods.ts         # keys/values/entries, assign/freeze, fromEntries, computed props, property access/existence
│   │       ├── numberMath.ts            # parsing, checking, formatting, Math methods
│   │       ├── jsonOperations.ts        # JSON.parse (with error handling check), JSON.stringify
│   │       ├── modernOperators.ts       # optional chaining, nullish coalescing, logical assignment, typeof, instanceof, equality, ternary
│   │       ├── controlFlow.ts           # switch/case, for...in, guard clauses, short-circuit evaluation
│   │       ├── classSyntax.ts           # declaration, methods, inheritance, getters/setters, private fields, properties
│   │       ├── modulePatterns.ts        # import/export (named, default, dynamic, namespace)
│   │       ├── mapSetCollections.ts     # Map, Set, iteration, WeakMap/WeakRef
│   │       ├── timersScheduling.ts      # setTimeout, setInterval, rAF, debounce/throttle
│   │       ├── dateHandling.ts          # Date creation, formatting, methods
│   │       ├── regexPatterns.ts         # regex literals, methods, flags, groups
│   │       ├── domOperations.ts         # query selectors, manipulation, events, classList, dataset
│   │       ├── browserApis.ts           # localStorage, URL, FormData, History
│   │       ├── observerApis.ts          # IntersectionObserver, MutationObserver, ResizeObserver
│   │       └── antiPatterns.ts          # no-var, strict equality, eval, innerHTML, magic numbers, empty catch, type coercion
│   ├── glicko2.ts             # Glicko-2 rating algorithm
│   ├── grok.ts                # Grok AI integration (prompts, parsing, mock)
│   ├── errorClassification.ts # SLIP/MISTAKE/MISCONCEPTION classification
│   ├── stuckDetection.ts      # Stuck topic detection
│   ├── prerequisites.ts       # Prerequisite chain analysis
│   ├── progression.ts         # Layer unlock progression gates
│   ├── auth.ts                # NextAuth v5 config
│   ├── prisma.ts              # Prisma client
│   └── constants.ts           # All config constants
scripts/
├── generate-eslint-topics.ts  # Generates ESLint topic catalog from rule metadata
├── eslint-topics.json         # Generated: ~152 ESLint topics for DB seeding
├── eslint-overlap-map.json    # Generated: ESLint rule → existing Babel slug mapping
├── eslint-prerequisites.json  # ESLint topic → Babel prerequisite mappings for positive inference
└── dataflow-topics.json       # 14 data flow topic definitions for DB seeding (includes prerequisites)
public/
└── sandbox-worker.js          # Web Worker for sandboxed JS execution (console capture, 3s timeout)
prisma/
├── schema.prisma              # Database schema (10 models including Snippet)
├── prisma.config.ts           # Prisma 7 config (datasource URL)
└── seed.ts                    # 347 topic markers seed (181 Babel + 152 ESLint + 14 Data Flow)
```

## Analysis Architecture

### How AST Detectors Work

Detectors are custom TypeScript files in `src/lib/analysis/detectors/`. Each file:

1. Imports `traverse`, `isNodeType`, `getNodeLocation` from `parser.ts`
2. Walks the Babel AST looking for specific node types (CallExpression, MemberExpression, etc.)
3. Returns `Detection[]` — each detection maps to a topic slug with `isPositive`, `isNegative`, `isIdiomatic` flags
4. The main `analyzeCode()` in `index.ts` calls all detectors and aggregates results

### Detection Interface

```typescript
interface Detection {
  topicSlug: string; // maps to topics table slug
  detected: boolean; // always true when returned
  isPositive: boolean; // good usage
  isNegative: boolean; // problematic usage
  isIdiomatic: boolean; // best-practice usage
  isTrivial?: boolean; // minor issue
  location?: { line: number; column: number };
  details?: string; // human-readable explanation
  source?: "babel" | "eslint" | "dataflow"; // which engine produced this detection
}
```

### Detector Registration

In `src/lib/analysis/index.ts`, `analyzeCode()` calls:

- **Always (JS — original 6):** detectArrayMethods, detectAsyncPatterns, detectErrorHandlingPatterns, detectVariablePatterns, detectFunctionPatterns, detectLoopsAndContext
- **Always (JS — expanded 17):** detectArrayMutationMethods, detectStringMethods, detectObjectMethods, detectNumberMath, detectJsonOperations, detectModernOperators, detectControlFlow, detectClassSyntax, detectModulePatterns, detectMapSetCollections, detectTimersScheduling, detectDateHandling, detectRegexPatterns, detectDomOperations, detectBrowserApis, detectObserverApis, detectAntiPatterns
- **React only:** detectReactHooks, detectJSXPatterns, detectAdvancedHooks, detectComponentPatterns, detectStatePatterns, detectAdvancedReactPatterns, detectErrorBoundaries
- **ESLint (always, after Babel):** `analyzeWithESLint(code, isReact, hasTypeScript)` — runs ~120 rules, returns `Detection[]` with `source: "eslint"`
- **Data Flow (always, after ESLint):** `analyzeDataFlow(ast, isReact)` — 14 semantic detectors, returns `Detection[]` with `source: "dataflow"`

### ESLint Detection Layer

**File:** `src/lib/analysis/eslintDetector.ts`

The ESLint detector runs as a second detection pass after all Babel AST detectors. It uses ESLint's `Linter` class (synchronous, in-memory, no filesystem) with flat config.

**Key design:**

- **Overlap handling:** 22 ESLint rules overlap with existing Babel topic slugs (e.g., `no-var` → `no-var-usage`, `eqeqeq` → `strict-equality`). These map to the same slug — no duplicate topics.
- **Non-overlapping rules:** Get `eslint-*` prefixed slugs (e.g., `eslint-no-unreachable`, `eslint-react-self-closing-comp`).
- **Four configs:** `BASE_JS_CONFIG`, `BASE_TS_CONFIG`, `REACT_JS_CONFIG`, `REACT_TS_CONFIG` — selected based on framework and language detection.
- **All ESLint detections:** `isPositive: false, isNegative: true` (violations only). `isTrivial: true` when auto-fixable.
- **Graceful degradation:** Returns empty array if ESLint parsing fails.

**Rule categories (~120 rules):**

- FUNDAMENTALS: `for-direction`, `no-const-assign`, `no-dupe-keys`, `no-unreachable`, `use-isnan`, `valid-typeof`, `no-var`, `eqeqeq`, `prefer-const`, etc.
- INTERMEDIATE: `array-callback-return`, `no-loop-func`, `consistent-return`, `no-else-return`, `no-param-reassign`, etc.
- PATTERNS: `no-await-in-loop`, `complexity`, `require-await`, `prefer-named-capture-group`, etc.
- REACT: `react/jsx-key`, `react/no-direct-mutation-state`, `react/jsx-no-target-blank`, `react/no-unstable-nested-components`, etc.
- HOOKS: `react-hooks/rules-of-hooks`, `react-hooks/exhaustive-deps`, `react-hooks/set-state-in-render`, etc.

**Grok prompt integration:** Detected topics are split by source in the AI prompt — "Detected Topics (AST)", "ESLint Violations", and "Data Flow Issues" — giving the AI context about which engine found each issue.

**Topic generation:** `scripts/generate-eslint-topics.ts` extracts rule metadata from ESLint core + plugins, filters out deprecated/formatting/noise rules, and outputs `scripts/eslint-topics.json` (~152 topics). These are merged with Babel topics in `prisma/seed.ts`.

**Bundling note:** `next.config.ts` includes `serverExternalPackages` for eslint, eslint-plugin-react, eslint-plugin-react-hooks, typescript-eslint, and globals — required because Turbopack cannot bundle ESLint's dependency tree (includes @babel/core).

### Data Flow Detection Layer

**File:** `src/lib/analysis/dataFlowDetector.ts`

The data flow detector runs as a third detection pass after Babel and ESLint. It catches semantic patterns that pure syntax matching and lint rules cannot — like shared object references, missing returns in array callbacks, and React state mutations.

**Key design:**

- **Alias tracking foundation:** `typeInference.ts` extended with `buildAliasMap(ast, typeMap)` — tracks when variables point to the same object/array, detects property assignments and mutations through aliases.
- **14 detectors, 2 React-only:** JS detectors always run; `state-mutation-react` and `missing-cleanup-effect` only run when React is detected.
- **All detections:** `isPositive: false, isNegative: true` (semantic issues only). Tagged `source: "dataflow"`.

**Detectors:**
| Slug | Layer | What it catches |
|------|-------|----------------|
| `object-reference-sharing` | FUNDAMENTALS | Mutating shared object through alias affects all references |
| `object-spread-missing` | FUNDAMENTALS | Same object assigned to multiple properties by reference |
| `array-method-no-return` | FUNDAMENTALS | map/filter/find callback with no return or conditional-only return |
| `var-used-before-init` | FUNDAMENTALS | Reading a var-declared variable before its initializer line (undefined due to hoisting) |
| `array-as-object` | FUNDAMENTALS | Array declared with `[]` used with string keys (type confusion — .length and indexing break) |
| `state-mutation-react` | FUNDAMENTALS | Direct mutation of useState variable (push, property assignment) |
| `nested-ternary` | INTERMEDIATE | Ternary operators nested more than one level deep |
| `deep-nesting` | INTERMEDIATE | Block statements nested more than 4 levels |
| `long-parameter-list` | INTERMEDIATE | Functions with more than 4 parameters |
| `missing-cleanup-effect` | INTERMEDIATE | useEffect with subscriptions/timers but no cleanup return |
| `loop-bounds-off-by-one` | FUNDAMENTALS | for loop with i <= arr.length causes out-of-bounds access at arr[arr.length] |
| `string-arithmetic-coercion` | FUNDAMENTALS | Arithmetic operator (\*, -, /, %) with string operand causes silent coercion to number/NaN |
| `shallow-copy-nested-mutation` | FUNDAMENTALS | Spread/Object.assign creates shallow copy, then nested property mutated through copy affects original |
| `array-self-mutation-in-iteration` | FUNDAMENTALS | Array mutated (push/pop/splice) inside its own iteration callback (map/forEach/filter) |

**Topic definitions:** `scripts/dataflow-topics.json` (14 topics). Merged with Babel + ESLint topics in `prisma/seed.ts`.

### Scoring Pipeline

1. Babel AST detectors run → produce `Detection[]` with topic slugs (source: "babel"), both positive and negative
2. ESLint Linter runs → produce additional `Detection[]` (source: "eslint"), violations only (isNegative: true)
3. Data Flow analyzer runs → produce additional `Detection[]` (source: "dataflow"), issues only (isNegative: true)
4. Positive Inference runs → `inferPositiveDetections()` cross-references Babel detections with ESLint/Data Flow prerequisites. If prerequisites met and rule didn't fire, creates positive Detection (isPositive: true, isInferred: true, source matches origin layer)
5. **Neutral Tier filtering** → Inferred detections (`isInferred: true`) are classified as "neutral" — displayed in UI but excluded from AI scoring prompt and Glicko-2 updates. Only directly-observed topics (Babel positives/negatives, ESLint/DataFlow violations) are sent to the AI.
6. Scorable detections merged, sent to Grok AI with the code (split by source in prompt)
7. AI returns `TOPIC_SCORES` block: `[{ slug, score (0-1), reason }]`
8. `parseTopicScores()` extracts scores — supports complete blocks, and recovers partial scores from truncated responses via `repairTruncatedScoresJson()`
9. For scores < 0.5, error classifier (`classifyError()`) may override the performance score based on user history (SLIP=0.6, MISTAKE=0.3, MISCONCEPTION=0.0)
10. `calculateExpectedScore()` computes what Glicko-2 expects based on current rating vs difficulty 1500
11. `updateRating()` runs Glicko-2 math: compares actual performance score to expected, updates rating/RD/volatility
12. Neutral topics get `tier: "neutral"` entries in `skillChanges` and `scoringAudit` with zero changes — displayed but no rating impact
13. `scoringAudit` array captures the full chain per topic: input state → AI score → expected score → surprise → error classification → rating update
14. `scoringSource` field in engine details indicates "ai" or "ast-fallback"

**Token limit:** `MAX_FEEDBACK_TOKENS: 4096` in constants.ts. With 50+ topics to score, each needing ~30-35 tokens for the JSON entry, the TOPIC_SCORES block alone can consume ~2000+ tokens. The 4096 limit gives ample room for both coaching text and scoring.

### Parser Helpers (from parser.ts)

- `traverse(ast, visitor)` — walk all AST nodes
- `findNodes(ast, predicate)` — find nodes matching type guard
- `isNodeType<T>(node, "TypeName")` — type-safe node check
- `getNodeLocation(node)` — get line/column from node

---

## Database Schema

### users

```
id: UUID PK
email: unique
password_hash: string
subscription_tier: 'free' | 'pro'
monthly_reviews_used: int
display_frameworks: ['js', 'react']
created_at: timestamp
```

### topics

```
id: serial PK
slug: unique (e.g., "array-map")
name: string
layer: 'FUNDAMENTALS' | 'INTERMEDIATE' | 'PATTERNS'
category: string
framework_affinity: 'js-pure' | 'react-specific' | 'shared'
criticality: 'critical' | 'high' | 'medium' | 'low'
parent_topic_id: FK (self-reference)
prerequisites: int[] (topic IDs)
detection_rules: JSONB
```

### user_skill_matrix

```
user_id: FK -> users
topic_id: FK -> topics
rating: float (default 1500)
rd: float (default 350)
volatility: float (default 0.06)
times_encountered: int (default 0)
last_practiced: timestamp
is_stuck: boolean (default false)
stuck_since: timestamp?
PK: (user_id, topic_id)
```

### performance_history

```
id: serial PK
user_id: FK
topic_id: FK
submission_id: FK
performance_score: float (0.0-1.0)
error_type: 'SLIP' | 'MISTAKE' | 'MISCONCEPTION'
rating_before: float
rating_after: float
rd_before: float
rd_after: float
created_at: timestamp
```

### snippets

```
id: UUID PK
user_id: FK
title: string (default "Untitled")
code: text
language: string (default "javascript")
created_at: timestamp
updated_at: timestamp
```

### submissions

```
id: UUID PK
user_id: FK
snippet_id: FK? (optional → snippets)
code: text
language: 'javascript' | 'typescript' | 'jsx' | 'tsx'
description: text?
analysis_data: JSONB
created_at: timestamp
```

### feedback

```
id: UUID PK
submission_id: FK
user_id: FK
feedback_text: text
analysis_layers: JSONB
stuck_topics: JSONB
tokens_used: int
cost: decimal
created_at: timestamp
```

### misconceptions

```
id: serial PK
user_id: FK
pattern: string
evidence_count: int (default 1)
first_seen: timestamp
last_seen: timestamp
is_resolved: boolean (default false)
resolved_at: timestamp?
related_topics: int[]
```

### user_progress (denormalized)

```
user_id: PK, FK
fundamentals_rating: float
fundamentals_rd: float
intermediate_rating: float
intermediate_rd: float
patterns_rating: float
patterns_rd: float
intermediate_unlocked: boolean
intermediate_unlocked_at: timestamp?
patterns_unlocked: boolean
patterns_unlocked_at: timestamp?
total_reviews: int
last_review_at: timestamp
estimated_level: 'beginner' | 'intermediate' | 'advanced'
```

---

## Configuration Constants

### Glicko-2 Parameters

| Constant           | Value |
| ------------------ | ----- |
| INITIAL_RATING     | 1500  |
| INITIAL_RD         | 350   |
| INITIAL_VOLATILITY | 0.06  |
| MIN_RATING         | 1200  |
| MAX_RATING         | 1800  |
| MIN_RD             | 50    |
| MAX_RD             | 350   |
| TAU                | 0.5   |
| DECAY_CONSTANT     | 0.5   |

### Display Thresholds

| Constant             | Value | Meaning                       |
| -------------------- | ----- | ----------------------------- |
| NOVICE_CEILING       | 1400  | Below = Novice (⭐)           |
| BASIC_CEILING        | 1500  | Below = Basic (⭐⭐)          |
| COMPETENT_CEILING    | 1650  | Below = Competent (⭐⭐⭐)    |
| PROFICIENT_CEILING   | 1750  | Below = Proficient (⭐⭐⭐⭐) |
| HIGH_CONFIDENCE_RD   | 80    | Below = ●●●                   |
| MEDIUM_CONFIDENCE_RD | 150   | Below = ●●○                   |

### Error Classification

| Type          | Criteria                                         |
| ------------- | ------------------------------------------------ |
| SLIP          | rating > 1650, last 2 clean, trivial error       |
| MISCONCEPTION | rating < 1450, encounters ≥ 3, volatility > 0.12 |
| MISTAKE       | Everything else (default)                        |

### Stuck Detection (ALL must be true)

- rating < 1450
- times_encountered ≥ 4
- rd > 180
- volatility > 0.12

### Progression Unlock

**Intermediate:** coverage ≥ 90%, avg rating ≥ 1650, avg RD < 100, submissions ≥ 10, last review ≤ 30 days
**Patterns:** coverage ≥ 90%, avg rating ≥ 1700, avg RD < 80, submissions ≥ 20, last review ≤ 30 days

### Performance Scores

| Outcome                     | Score |
| --------------------------- | ----- |
| Perfect (clean + idiomatic) | 1.0   |
| Clean only                  | 0.8   |
| Slip                        | 0.6   |
| Mistake                     | 0.3   |
| Misconception               | 0.0   |

---

## Topic Markers (98 total)

### FUNDAMENTALS LAYER (42 markers)

#### Variable Handling (js-pure) - 4 markers

| Slug                    | Prerequisites   |
| ----------------------- | --------------- |
| let-const-usage         | none            |
| var-hoisting            | let-const-usage |
| temporal-dead-zone      | let-const-usage |
| block-vs-function-scope | let-const-usage |

#### Array Methods (shared) - 7 markers

| Slug                  | Prerequisites           |
| --------------------- | ----------------------- |
| array-map             | none                    |
| array-filter          | none                    |
| array-reduce          | array-map               |
| array-find            | array-filter            |
| array-some-every      | array-filter            |
| array-foreach         | none                    |
| array-method-chaining | array-map, array-filter |

#### Object Operations (shared) - 4 markers

| Slug                 | Prerequisites        |
| -------------------- | -------------------- |
| object-destructuring | none                 |
| array-destructuring  | none                 |
| spread-operator      | object-destructuring |
| object-shorthand     | object-destructuring |

#### Functions (shared) - 6 markers

| Slug                   | Prerequisites      |
| ---------------------- | ------------------ |
| arrow-functions        | none               |
| default-parameters     | arrow-functions    |
| rest-parameters        | spread-operator    |
| pure-functions         | arrow-functions    |
| callback-functions     | arrow-functions    |
| higher-order-functions | callback-functions |

#### Closures (shared) - 3 markers

| Slug             | Prerequisites   |
| ---------------- | --------------- |
| closure-basics   | arrow-functions |
| closure-in-loops | closure-basics  |
| closure-state    | closure-basics  |

#### Async Fundamentals (shared) - 5 markers

| Slug                       | Prerequisites                 |
| -------------------------- | ----------------------------- |
| promise-basics             | callback-functions            |
| promise-chaining           | promise-basics                |
| promise-catch              | promise-basics                |
| async-await-basics         | promise-basics                |
| async-await-error-handling | async-await-basics, try-catch |

#### Error Handling (shared) - 4 markers

| Slug                 | Prerequisites                 |
| -------------------- | ----------------------------- |
| try-catch            | none                          |
| error-throwing       | try-catch                     |
| fetch-error-checking | async-await-basics, try-catch |
| error-messages       | try-catch                     |

#### JSX Fundamentals (react-specific) - 5 markers

| Slug                      | Prerequisites              |
| ------------------------- | -------------------------- |
| jsx-syntax                | none                       |
| jsx-expressions           | jsx-syntax                 |
| jsx-conditional-rendering | jsx-expressions            |
| jsx-list-rendering        | array-map, jsx-expressions |
| jsx-keys                  | jsx-list-rendering         |

#### React State Basics (react-specific) - 4 markers

| Slug                        | Prerequisites                    |
| --------------------------- | -------------------------------- |
| usestate-basics             | jsx-syntax                       |
| usestate-functional-updates | usestate-basics                  |
| state-immutability          | usestate-basics, spread-operator |
| lifting-state               | usestate-basics                  |

### INTERMEDIATE LAYER (32 markers)

#### Loops & Iteration (js-pure) - 3 markers

| Slug            | Prerequisites   |
| --------------- | --------------- |
| for-loop-basics | none            |
| for-of-loops    | for-loop-basics |
| while-loops     | for-loop-basics |

#### This & Context (js-pure) - 3 markers

| Slug                  | Prerequisites                 |
| --------------------- | ----------------------------- |
| this-binding          | closure-basics                |
| bind-call-apply       | this-binding                  |
| arrow-vs-regular-this | this-binding, arrow-functions |

#### useEffect Mastery (react-specific) - 5 markers

| Slug                    | Prerequisites                        |
| ----------------------- | ------------------------------------ |
| useeffect-basics        | usestate-basics                      |
| useeffect-dependencies  | useeffect-basics                     |
| useeffect-cleanup       | useeffect-basics                     |
| useeffect-async         | useeffect-basics, async-await-basics |
| useeffect-infinite-loop | useeffect-dependencies               |

#### Props & Components (react-specific) - 5 markers

| Slug                  | Prerequisites                      |
| --------------------- | ---------------------------------- |
| props-basics          | jsx-syntax                         |
| props-destructuring   | props-basics, object-destructuring |
| children-prop         | props-basics                       |
| prop-types-validation | props-basics                       |
| default-props         | props-basics, default-parameters   |

#### Component Patterns (react-specific) - 4 markers

| Slug                            | Prerequisites                    |
| ------------------------------- | -------------------------------- |
| controlled-components           | usestate-basics, jsx-expressions |
| uncontrolled-components         | controlled-components            |
| component-composition           | props-basics, children-prop      |
| conditional-component-rendering | jsx-conditional-rendering        |

#### Event Handling (react-specific) - 4 markers

| Slug                 | Prerequisites               |
| -------------------- | --------------------------- |
| event-handlers       | jsx-syntax, arrow-functions |
| event-handler-params | event-handlers              |
| prevent-default      | event-handlers              |
| event-delegation     | event-handlers              |

#### API Integration (shared) - 4 markers

| Slug                 | Prerequisites                        |
| -------------------- | ------------------------------------ |
| fetch-basics         | async-await-basics                   |
| fetch-with-options   | fetch-basics                         |
| loading-states       | usestate-basics, fetch-basics        |
| error-state-handling | loading-states, fetch-error-checking |

#### Refs (react-specific) - 4 markers

| Slug           | Prerequisites                     |
| -------------- | --------------------------------- |
| useref-basics  | usestate-basics                   |
| useref-dom     | useref-basics                     |
| useref-mutable | useref-basics                     |
| callback-refs  | useref-basics, callback-functions |

### PATTERNS LAYER (24 markers)

#### Custom Hooks (react-specific) - 4 markers

| Slug                    | Prerequisites                     |
| ----------------------- | --------------------------------- |
| custom-hook-basics      | usestate-basics, useeffect-basics |
| custom-hook-parameters  | custom-hook-basics                |
| custom-hook-return      | custom-hook-basics                |
| custom-hook-composition | custom-hook-basics                |

#### Context (react-specific) - 4 markers

| Slug                | Prerequisites   |
| ------------------- | --------------- |
| context-basics      | props-basics    |
| context-provider    | context-basics  |
| usecontext-hook     | context-basics  |
| context-performance | usecontext-hook |

#### Performance Optimization (react-specific) - 5 markers

| Slug                  | Prerequisites                  |
| --------------------- | ------------------------------ |
| react-memo            | component-composition          |
| usememo-basics        | usestate-basics                |
| usecallback-basics    | event-handlers, closure-basics |
| key-optimization      | jsx-keys                       |
| unnecessary-rerenders | react-memo, usememo-basics     |

#### Advanced Async (shared) - 4 markers

| Slug                 | Prerequisites                   |
| -------------------- | ------------------------------- |
| promise-all          | promise-basics                  |
| promise-race         | promise-basics                  |
| request-cancellation | fetch-basics, useeffect-cleanup |
| retry-logic          | fetch-error-checking            |

#### State Patterns (react-specific) - 4 markers

| Slug                | Prerequisites     |
| ------------------- | ----------------- |
| usereducer-basics   | usestate-basics   |
| reducer-patterns    | usereducer-basics |
| complex-state       | usereducer-basics |
| state-normalization | complex-state     |

#### Error Boundaries (react-specific) - 3 markers

| Slug                    | Prerequisites         |
| ----------------------- | --------------------- |
| error-boundary-basics   | try-catch             |
| error-boundary-fallback | error-boundary-basics |
| error-boundary-recovery | error-boundary-basics |

### Summary by Affinity (Original 98 + 82 Expanded = 180 total)

| Layer        | Original | Expanded | Total   |
| ------------ | -------- | -------- | ------- |
| Fundamentals | 42       | 40       | 82      |
| Intermediate | 32       | 39       | 71      |
| Patterns     | 24       | 3        | 27      |
| **Total**    | **98**   | **82**   | **180** |

### EXPANDED TOPICS (new detectors)

#### Array Mutation (shared) - FUNDAMENTALS

| Slug                   | Prerequisites  |
| ---------------------- | -------------- |
| array-push-pop         | none           |
| array-shift-unshift    | array-push-pop |
| array-splice           | array-push-pop |
| array-indexOf-includes | none           |
| array-sort             | none           |
| array-slice-concat     | none           |
| array-flat-flatMap     | array-map      |
| array-from-isArray     | none           |
| array-length           | none           |
| bracket-notation       | none           |

#### String Methods (shared) - FUNDAMENTALS

| Slug                   | Prerequisites   |
| ---------------------- | --------------- |
| template-literals      | let-const-usage |
| string-split-join      | none            |
| string-search-methods  | none            |
| string-transform       | none            |
| string-slice-substring | none            |
| string-pad-repeat      | none            |

#### Object Methods (shared) - FUNDAMENTALS

| Slug                       | Prerequisites              |
| -------------------------- | -------------------------- |
| object-keys-values-entries | none                       |
| object-assign-freeze       | object-destructuring       |
| object-fromEntries         | object-keys-values-entries |
| computed-property-names    | none                       |
| property-access-patterns   | none                       |
| property-existence-check   | none                       |

#### Number & Math (js-pure) - FUNDAMENTALS

| Slug              | Prerequisites |
| ----------------- | ------------- |
| number-parsing    | none          |
| number-checking   | none          |
| number-formatting | none          |
| math-methods      | none          |

#### JSON Operations (shared) - FUNDAMENTALS

| Slug           | Prerequisites |
| -------------- | ------------- |
| json-parse     | try-catch     |
| json-stringify | none          |

#### Type Checking & Comparison (shared) - FUNDAMENTALS

| Slug                | Prerequisites |
| ------------------- | ------------- |
| typeof-operator     | none          |
| instanceof-operator | none          |
| equality-operators  | none          |
| ternary-operator    | none          |

#### Module Patterns (shared) - FUNDAMENTALS

| Slug                  | Prerequisites |
| --------------------- | ------------- |
| import-export-named   | none          |
| import-export-default | none          |
| import-dynamic        | none          |
| import-namespace      | none          |

#### Modern Operators (shared) - INTERMEDIATE

| Slug               | Prerequisites            |
| ------------------ | ------------------------ |
| optional-chaining  | property-access-patterns |
| nullish-coalescing | none                     |
| logical-assignment | none                     |

#### Control Flow (shared) - FUNDAMENTALS/INTERMEDIATE

| Slug                     | Prerequisites   |
| ------------------------ | --------------- |
| switch-case              | none            |
| for-in-loops             | for-loop-basics |
| guard-clauses            | arrow-functions |
| short-circuit-evaluation | none            |

#### Class Syntax (js-pure) - INTERMEDIATE

| Slug                  | Prerequisites     |
| --------------------- | ----------------- |
| class-declaration     | none              |
| class-methods         | class-declaration |
| class-inheritance     | class-declaration |
| class-getters-setters | class-declaration |
| class-private-fields  | class-declaration |
| class-properties      | class-declaration |

#### Map & Set (shared) - INTERMEDIATE

| Slug              | Prerequisites |
| ----------------- | ------------- |
| map-basics        | none          |
| set-basics        | none          |
| map-set-iteration | map-basics    |
| weakmap-weakref   | map-basics    |

#### Timers & Scheduling (shared) - INTERMEDIATE

| Slug                        | Prerequisites                    |
| --------------------------- | -------------------------------- |
| setTimeout-usage            | callback-functions               |
| setInterval-usage           | setTimeout-usage                 |
| requestAnimationFrame-usage | callback-functions               |
| debounce-throttle           | setTimeout-usage, closure-basics |

#### Date Handling (shared) - INTERMEDIATE

| Slug            | Prerequisites |
| --------------- | ------------- |
| date-creation   | none          |
| date-formatting | date-creation |
| date-methods    | date-creation |

#### Regex (shared) - INTERMEDIATE

| Slug          | Prerequisites |
| ------------- | ------------- |
| regex-literal | none          |
| regex-methods | regex-literal |
| regex-flags   | regex-literal |
| regex-groups  | regex-literal |

#### DOM Operations (shared) - INTERMEDIATE

| Slug                | Prerequisites       |
| ------------------- | ------------------- |
| dom-query-selectors | none                |
| dom-manipulation    | dom-query-selectors |
| dom-events          | dom-query-selectors |
| dom-classlist       | dom-query-selectors |
| dom-dataset         | dom-query-selectors |

#### Browser APIs (shared) - INTERMEDIATE

| Slug               | Prerequisites  |
| ------------------ | -------------- |
| localStorage-usage | json-stringify |
| url-api            | none           |
| formdata-api       | none           |
| history-api        | none           |

#### Observer APIs (shared) - PATTERNS

| Slug                  | Prerequisites      |
| --------------------- | ------------------ |
| intersection-observer | callback-functions |
| mutation-observer     | callback-functions |
| resize-observer       | callback-functions |

#### Anti-Patterns (shared) - FUNDAMENTALS

| Slug                   | Prerequisites   |
| ---------------------- | --------------- |
| no-var-usage           | let-const-usage |
| strict-equality        | none            |
| no-eval                | none            |
| no-innerHTML           | none            |
| no-magic-numbers       | let-const-usage |
| empty-catch-blocks     | try-catch       |
| implicit-type-coercion | none            |

### Type Inference Utility (IMPLEMENTED)

`src/lib/analysis/typeInference.ts` — Shared utility that tracks variable types through the AST. Exports `buildTypeMap(ast)` → `Map<string, InferredType>`, `inferTypeFromNode(node)` → `InferredType`, and `isVariableType(typeMap, varName, expectedType)`. Infers types from initializers: ObjectExpression → object, ArrayExpression → array, StringLiteral → string, NumericLiteral → number, NewExpression(Map/Set/Date/Promise) → map/set/date/promise, etc.

---

## Glicko-2 Algorithm Summary

### Rating Scale

| Range     | Level      | Stars      |
| --------- | ---------- | ---------- |
| 1200-1400 | Novice     | ⭐         |
| 1400-1500 | Basic      | ⭐⭐       |
| 1500-1650 | Competent  | ⭐⭐⭐     |
| 1650-1750 | Proficient | ⭐⭐⭐⭐   |
| 1750-1800 | Expert     | ⭐⭐⭐⭐⭐ |

### Confidence (RD → Dots)

| RD Range | Display | Meaning           |
| -------- | ------- | ----------------- |
| < 80     | ●●●     | High confidence   |
| 80-150   | ●●○     | Medium confidence |
| > 150    | ●○○     | Low confidence    |

### Update Process

1. Score performance 0.0-1.0
2. Compare to expected score based on rating
3. Adjust rating (magnitude depends on RD)
4. Decrease RD (more evidence = more confidence)
5. Adjust volatility based on consistency

### Knowledge Decay

RD increases over time without practice (τ = 0.5). Topic mastered 6 months ago: RD might go 60 → 150.

---

## Analysis Architecture

### Separation of Concerns: Detection vs Evaluation

The analysis pipeline has three detection layers followed by AI evaluation:

**1a. Topic Detection (AST — Babel Parser)**

- **Role:** Identify which of the ~181 Babel topics appear in the submitted code
- **How:** Walk the AST looking for structural patterns (CallExpressions, JSX elements, hook usage, etc.)
- **Output:** List of detected topic slugs with line/column locations, `source: "babel"`
- **Strength:** Fast, free, deterministic, reliable at finding what patterns exist
- **Limitation:** Cannot assess correctness, semantics, or logic errors. Only sees structure.

**1b. Rule Violation Detection (ESLint — Linter)**

- **Role:** Catch code quality violations, best-practice issues, and error-prone patterns
- **How:** Run ESLint's `Linter` class with ~120 rules (core + React + Hooks) on raw code
- **Output:** List of violation-based detections, `source: "eslint"`, always `isNegative: true`
- **Strength:** Catches patterns AST detectors miss (unreachable code, missing returns, complexity, React-specific issues)
- **Overlap:** 22 rules map to existing Babel slugs; rest get `eslint-*` prefixed slugs

**1c. Semantic Analysis (Data Flow — Custom)**

- **Role:** Catch semantic issues that syntax matching and lint rules cannot detect
- **How:** Alias tracking + type inference on AST, then 14 specialized detectors
- **Output:** List of semantic detections, `source: "dataflow"`, always `isNegative: true`
- **Strength:** Catches shared object mutation, missing array callback returns, React state mutation, deep nesting, long parameter lists
- **Topics:** 14 (object-reference-sharing, object-spread-missing, array-method-no-return, var-used-before-init, array-as-object, state-mutation-react, nested-ternary, deep-nesting, long-parameter-list, missing-cleanup-effect, loop-bounds-off-by-one, string-arithmetic-coercion, shallow-copy-nested-mutation, array-self-mutation-in-iteration)

**1d. Positive Inference (Cross-Layer)**

- **Role:** Infer correct usage for ESLint/Data Flow topics when prerequisites are detected but the rule didn't fire
- **How:** `inferPositiveDetections()` in index.ts cross-references Babel detection counts with prerequisite mappings from `scripts/eslint-prerequisites.json` (ESLint) and `scripts/dataflow-topics.json` (Data Flow). Requires `minInstances` threshold to be met.
- **Output:** Synthetic positive detections, `isPositive: true, isNegative: false`, tagged with original source layer ("eslint" or "dataflow")
- **Strength:** Makes ESLint/Data Flow symmetric with Babel — all three layers can now increase AND decrease Glicko-2 ratings
- **Exclusions:** 22 BABEL_OVERLAP_MAP rules (already handled by Babel), universal error-prevention rules (no meaningful prerequisites)

**2. Topic Evaluation (AI — Grok)**

- **Role:** Assess whether each detected topic is used correctly and score it
- **How:** Receives the code + list of detected topics (by source), returns structured per-topic scores
- **Output:** Per-topic performance scores (0.0-1.0) that drive Glicko-2 rating updates
- **Strength:** Understands semantics, catches logic errors, missing returns, wrong variable references, misuse of APIs
- **Why needed:** AST pattern matching cannot determine if `.filter()` is used correctly — only that it's present. The AI can see that a filter callback with no return produces an empty array.

**Pipeline flow:**

```
Code → Babel AST Detection (which topics?) + ESLint Linter (rule violations) + Data Flow (semantic issues) → Positive Inference (prereqs met + no violation = correct usage) → Merge → AI Evaluation (used correctly?) → Glicko-2 Update (rating change) → Save
```

The AST should NOT score positive/negative — it should only report topic presence. ESLint and Data Flow report violations (always negative). The AI returns structured JSON with per-topic assessments that the Glicko-2 system uses for rating updates.

### AST Detection Rules (Pattern Examples)

**array-map:** CallExpression with callee.property.name === "map" → topic present
**jsx-keys:** In mapped JSX, check for "key" attribute → topic present
**async-await-error-handling:** AwaitExpression found → topic present
**usestate-basics:** CallExpression callee.name === "useState" → topic present

### AI Evaluation Response Format

The AI should return structured JSON alongside coaching text:

```json
{
  "topicScores": [
    {
      "slug": "array-filter",
      "score": 0.0,
      "reason": "filter callback has no return"
    },
    {
      "slug": "let-const-usage",
      "score": 1.0,
      "reason": "correctly using const"
    },
    {
      "slug": "arrow-functions",
      "score": 0.8,
      "reason": "correct usage but could use implicit return"
    }
  ]
}
```

### AI Scoring Strictness

The system prompt includes critical scoring rules to prevent generous scores that inflate Glicko-2 ratings:

- Scores must reflect **actual correctness**, not intent or awareness
- If coaching text criticizes a topic, the score must reflect the criticism (no 0.8 for a topic you just called out as broken)
- Code that crashes at runtime (TypeError, ReferenceError) = 0.0 for that topic
- Type confusion (e.g., array used with string keys) = 0.3 or lower
- "Demonstrates awareness" is not correct usage — relying on `var` hoisting to read `undefined` values = 0.0
- When in doubt, score lower — generous scores hide real skill gaps
- Engine-detected correct usage (Positive) with correct code must score 0.6+ — do not penalize simple-but-correct usage as a Mistake
- Absence-based topics (e.g., `no-var-usage`) do not emit positive detections — only fire negative when the bad pattern is present

### Framework Context Detection

React signals: React imports, hook usage (useState, useEffect), JSX elements

---

## Adaptive Teaching

### Scaffolding Levels

| Level  | Rating    | Approach                                          |
| ------ | --------- | ------------------------------------------------- |
| HIGH   | < 1400    | Supportive, break into steps, almost give answers |
| MEDIUM | 1400-1600 | Explain reasoning, synthesis questions            |
| LOW    | > 1600    | Minimal hints, architectural questions            |

### Stuck Strategy

1. Acknowledge struggle
2. Anchor to mastered topics
3. Ask diagnostic question
4. Offer smaller challenge
5. Guide discovery (no direct answers)

### Prerequisite Chain Analysis

When user fails Topic X, check all prerequisites. Find lowest weak prerequisite = real gap. Target feedback there.

---

## Known Misconception Patterns

- "setState is synchronous" → usestate-basics, usestate-functional-updates, controlled-components
- "useEffect runs before render" → useeffect-basics, useeffect-dependencies, useref-dom
- "Props are mutable" → props-basics, state-immutability
- "Array index as key is fine" → jsx-keys, jsx-list-rendering
- "Missing dependency is just a warning" → useeffect-dependencies, useeffect-infinite-loop, closure-basics

---

## Implementation Phases

### Phase 1: Foundation

- Next.js 14 + TypeScript + Tailwind + shadcn/ui
- Prisma schema + PostgreSQL
- NextAuth.js auth
- Monaco Editor integration

### Phase 2: Analysis Engine

- Babel AST parsing
- Framework context detection
- Detection rules for 98 markers
- Glicko-2 implementation
- Performance scoring
- Error classification

### Phase 3: Intelligence Layer

- Grok API integration
- Dynamic prompt construction
- Stuck detection
- Prerequisite chain analysis
- Misconception tracking

### Phase 4: Polish

- Dashboard UI
- Framework preference toggles
- Progression gates
- Testing + deployment

### Phase 5: ESLint Integration

- Programmatic ESLint analysis (Linter class, flat config)
- ~120 rules across core JS, React, and Hooks
- Overlap mapping (22 rules → existing Babel slugs)
- ~152 new ESLint topic markers in DB
- Merged detection pipeline (Babel + ESLint → AI → Glicko-2)
- serverExternalPackages for Turbopack compatibility

### Phase 6: Data Flow Detection

- Alias tracking in typeInference.ts (buildAliasMap)
- 14 semantic detectors in dataFlowDetector.ts
- Catches: shared object mutation, missing returns, React state mutation, deep nesting, long params, loop bounds off-by-one, string arithmetic coercion
- 14 new topic markers in DB (347 total)
- Three-layer detection pipeline (Babel + ESLint + Data Flow → AI → Glicko-2)

### Phase 7: Detection Quality & Coaching Fixes

- Fixed callback-functions false positive in functionPatterns.ts — now only counts inline arrow/function expressions as callbacks, or Identifier args passed to known callback-accepting methods (map, filter, setTimeout, addEventListener, etc.)
- Removed console-cleanup topic entirely — console statements are pedagogical tools in a learning context, not anti-patterns. Removed from antiPatterns.ts, eslintDetector.ts, eslint-overlap-map.json, generate-eslint-topics.ts, seed.ts
- Added severity weighting to Grok system prompt (rules 10-11) — CRITICAL (runtime errors) > HIGH (logic bugs) > MEDIUM (performance) > LOW (style). AI must never lead with style feedback when runtime errors are present. Console statements explicitly encouraged.
- Added string-arithmetic-coercion data flow detector — catches \*, -, /, %, \*\* operators with string operands
- Added loop-bounds-off-by-one data flow detector — catches i <= arr.length (off-by-one, arr[arr.length] is undefined)
- Total topics: 347 (181 Babel + 152 ESLint + 14 Data Flow)

### Phase 8: Positive Inference for ESLint & Data Flow

- **Problem:** ESLint and Data Flow layers only report violations (isNegative: true), creating scoring asymmetry — 166 topics can only hurt ratings, never help. Users writing correct code get zero credit.
- **Solution:** Prerequisite-based positive inference. After all 3 detection passes, if Babel detected a prerequisite pattern (e.g., `array-map`) and the corresponding ESLint/Data Flow rule didn't fire, infer correct usage.
- Created `scripts/eslint-prerequisites.json` — maps ~60 ESLint topic slugs to Babel prerequisite arrays with `minInstances` thresholds. Excludes 22 BABEL_OVERLAP_MAP rules (Babel already covers them) and universal error-prevention rules (no meaningful prerequisites).
- Added `inferPositiveDetections()` in `src/lib/analysis/index.ts` — standalone, testable function. Counts Babel detection instances per topic, checks ESLint/Data Flow prerequisites, enforces thresholds, creates positive Detection objects.
- Data Flow topics use existing prerequisites from `scripts/dataflow-topics.json` with `minInstances: 2`.
- Updated `src/lib/grok.ts` — added `isPositive` to GrokRequest detectedTopics, splits ESLint/Data Flow into "Violations" and "Correct Usage (Inferred)" sections in AI prompt.
- Updated `src/components/review/review-results.tsx` — green "correct" badges alongside red "violation" badges in ESLint and Data Flow engine details sections.
- Added AI scoring guidance rules 9 (inferred positives: trivial avoidance 0.5-0.7, complex pattern 0.8-0.9, never 1.0) and 10 (trivial code: single use 0.4-0.6, consistent purposeful use 0.8-1.0).
- Added explicit slug checklist in prompt — forces AI to score ALL topics from all sections (AST, ESLint, Data Flow).
- Fixed token truncation: increased `MAX_FEEDBACK_TOKENS` from 2000 to 4096 — with 50+ topics, the TOPIC_SCORES JSON block alone needs ~2000+ tokens.
- Added truncated JSON recovery to `parseTopicScores()` — if AI response is cut off mid-JSON, `repairTruncatedScoresJson()` salvages completed scores instead of falling back to AST for everything.
- Updated `stripScoresBlock()` to also strip truncated TOPIC_SCORES blocks from display text.
- **Result:** All three layers now contribute both positive and negative signals to Glicko-2 ratings, creating fair and complete skill profiles.

### Phase 9: Coding Sandbox & Coaching IDE

- **Goal:** Transform submission form into interactive 3-pane IDE with code execution, snippet library, and coaching — all in one view.

#### Snippet System
- **Snippet model** in Prisma: mutable user code (id, userId, title, code, language, timestamps). `onDelete: Cascade` from User.
- **Submission FK:** Optional `snippetId` on Submission model (`onDelete: SetNull`) — preserves coaching history when snippets are deleted.
- **Server actions** (`src/app/actions/snippets.ts`): `getUserSnippets()` (lean list), `getSnippet(id)`, `createSnippet(data?)`, `updateSnippet(id, data)`, `deleteSnippet(id)`. All verify userId ownership. Follow same `{ success, data?, error? }` pattern as review.ts.
- **Types:** `SnippetListItem { id, title, language, updatedAt }`, `SnippetFull { id, title, code, language, createdAt, updatedAt }`.

#### 3-Pane IDE Layout (Desktop)
- **Library:** `react-resizable-panels` v4 — imports are `Group as PanelGroup, Panel, Separator as PanelResizeHandle`. Uses `orientation="horizontal"` (NOT `direction`). Percentage strings for sizes (e.g., `defaultSize="18%"`).
- **Panel sizes:** Library 18% (min 14%, max 30%, collapsible), Editor 50% (min 30%), Output 32% (min 20%).
- **Toolbar:** Library toggle (ghost icon) | Title input | Save (ghost, active when isDirty) | Run (outline, play icon) | Submit for Coaching (solid primary).
- **Right pane tabs:** Console tab (ConsoleOutput component) | Coaching tab (PipelineProgress + ReviewResults).
- **Height:** `h-[calc(100dvh-49px)] lg:h-screen` — 49px accounts for mobile header.

#### Mobile Layout
- Full-screen tab system: Editor | Console | Coaching (using shadcn/ui Tabs).
- Snippet library opens in Sheet slide-out (same pattern as dashboard-shell mobile nav).
- Compact toolbar with icon-only buttons.

#### Web Worker Execution
- **File:** `public/sandbox-worker.js` (plain JS, not TypeScript — workers loaded from /public).
- **Behavior:** Hijacks console.log/warn/error/info → `postMessage({ type: 'console', method, args })`. Runs code via indirect eval `(0, eval)(code)`. Catches exceptions → posts as console.error. Posts `{ type: 'done' }` on completion.
- **Timeout:** 3 seconds, enforced by main thread via `worker.terminate()`. Posts "Execution timed out (3s limit)" to console entries. Prevents infinite loops from freezing browser.
- **Console output:** `ConsoleEntry { method, text, timestamp }`. Color-coded: log=white, info=blue, warn=yellow, error=red.

#### Key Handlers
- `handleCodeChange` — Updates code state, sets isDirty=true, checks isStale against codeAtCoachingRef.
- `handleLoadSnippet(id)` — Fetches full snippet via getSnippet(), loads into editor, resets coaching/console.
- `handleSave` — If activeSnippetId → updateSnippet(), else → createSnippet(). Sets isDirty=false. Refreshes list.
- `handleNewSnippet` — Resets all editor state to defaults.
- `handleRun` — Clears console, creates Worker, sends code, starts 3s timeout, switches to Console tab.
- `handleSubmitForCoaching` — Same as original submitReview but also snapshots codeAtCoachingRef, passes snippetId, switches to Coaching tab.
- `handleDeleteSnippet(id)` — Deletes via server action, resets editor if active snippet deleted.

#### Keyboard Shortcuts
- `Ctrl+S` / `Cmd+S` — Save snippet
- `Ctrl+Enter` / `Cmd+Enter` — Run code
- `Ctrl+Shift+Enter` / `Cmd+Shift+Enter` — Submit for coaching

#### Stale State Detection
- When user edits code after coaching: yellow dot on Coaching tab trigger, coaching content wrapped in `opacity-50`, yellow banner "Code has changed since this coaching."
- If user undoes edits back to coached code, isStale resets to false (compares against codeAtCoachingRef).

#### Dashboard Shell Change
- `dashboard-shell.tsx` main changed from `flex-1 p-6 lg:p-8 max-w-6xl` to `flex-1 overflow-hidden`.
- Dashboard, Skills, and Pattern Library pages each wrap their content in `<div className="p-6 lg:p-8 max-w-6xl">` to preserve their layout.
- Review page uses full viewport without padding.

#### react-resizable-panels v4 API Notes
- **Exports:** `Group` (aliased as PanelGroup), `Panel`, `Separator` (aliased as PanelResizeHandle). NOT PanelGroup/PanelResizeHandle directly.
- **Props:** `orientation` (NOT `direction`). No `autoSaveId`. `defaultSize` accepts percentage strings (`"18%"`), numeric values are treated as pixels.
- **Resize handle styling:** `w-1 bg-border hover:bg-primary/50 transition-colors`.

#### Preserves Existing Systems
- PipelineProgress animation (extracted to its own component), ReviewResults component, submitReview server action — all unchanged, just relocated into the Coaching tab of the right pane.

#### Phase 9 Bug Fix: for-in slug misclassification
- Fixed `loopsAndContext.ts` — `ForInStatement` was emitting under `for-of-loops` slug instead of `for-in-loops`
- Removed duplicate `for-in` detection from `loopsAndContext.ts` (canonical detector is in `controlFlow.ts`)

### Phase 10: Detection Quality Fixes & Scoring Audit Log

#### False Positive Fixes
- **`deep-nesting` false positive** — `dataFlowDetector.ts` was double-counting: `BlockStatement` counted alongside control structures. Fixed by removing `BlockStatement` from nesting check and adding function boundary depth resets. `function→for→if` now correctly = depth 2 (not 5).
- **`no-magic-numbers` noise on array literals** — Fixed in two places: Babel detector (`antiPatterns.ts`) now skips `ArrayExpression` parents; ESLint config (`eslintDetector.ts`) expanded ignore list to 0-10.
- **`no-var-usage` free inflation** — Removed positive emission from `detectNoVarUsage()` in `antiPatterns.ts`. Not using `var` is the baseline, not evidence of skill. Topic now only fires negative when `var` is actually found.

#### AI Scoring Prompt Fix
- **Rule 11: Engine-detected correct usage** — Added to `grok.ts` system prompt. If engine detects a topic as Positive and the code is actually correct, AI must score 0.6+ (Competent). Prevents AI from penalizing correct-but-simple usage (e.g., `.push()` on `property-access-patterns` scored as MISTAKE).

#### UI Fixes
- **Nested `<button>` hydration error** — `snippet-library.tsx` outer `<button>` elements changed to `<div role="button">` with keyboard handlers.
- **Missing cursor-pointer** — Added `cursor-pointer` to all interactive buttons in review page and snippet library (Tailwind v4 doesn't auto-apply).
- **Layout reorganization** — File controls (title, save, +new) moved to left panel header. Run/Submit moved to mini-toolbar above editor. Visual states for snippet list items (active=white ring, saved=grey, unsaved=translucent).

#### Scoring Audit Log
- **Backend** (`src/app/actions/review.ts`) — Added `scoringAudit` array to `ReviewResult`. Captures per topic: input state (rating, RD, volatility), AI score, expected score (via `calculateExpectedScore`), surprise delta, error classification override, and final rating update.
- **Frontend** (`src/components/review/review-results.tsx`) — New collapsible "Scoring Audit Log" section with color-coded cards showing the full Glicko-2 thought process per topic. Green cards for gains, red for losses. Shows expected vs actual, surprise label (Big Win/Win/Neutral/Miss/Big Miss), error classification overrides.

#### Files Changed
- `src/lib/analysis/dataFlowDetector.ts` — deep-nesting fix
- `src/lib/analysis/detectors/antiPatterns.ts` — magic numbers + no-var-usage fixes
- `src/lib/analysis/eslintDetector.ts` — magic numbers ignore list expansion
- `src/lib/grok.ts` — AI scoring rule 11
- `src/components/review/snippet-library.tsx` — hydration + layout fixes
- `src/app/(dashboard)/review/page.tsx` — layout reorganization
- `src/app/actions/review.ts` — scoring audit data capture
- `src/components/review/review-results.tsx` — scoring audit UI component
