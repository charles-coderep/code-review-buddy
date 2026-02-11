# Cortext Coding Coach - Build Progress

## Status: APP FUNCTIONAL — AI connected, engine tested, user flow working

Full stack working: signup → login → dashboard → submit code → AI coaching feedback → skill tracking.
Grok API (grok-4-latest) connected and returning real coaching feedback.

## What's Done

### Infrastructurenpm run dev

- [x] Prisma schema updated for Prisma 7 (removed `url` from datasource, removed deprecated `driverAdapters` preview feature)
- [x] `prisma generate` — Prisma client generated
- [x] `prisma db push --accept-data-loss` — Supabase aligned with current schema (dropped old `reviewsThisMonth` + `lastReviewReset` columns)
- [x] `prisma/seed.ts` — updated for Prisma 7 (uses PrismaPg adapter), seeded all 98 topics
- [x] `npx next build` — compiles clean, all routes working

### Routing Fix

- [x] Deleted conflicting `(dashboard)/page.tsx` (was at `/`, conflicting with landing page)
- [x] Created `(dashboard)/dashboard/page.tsx` (dashboard now lives at `/dashboard`)
- [x] Updated `dashboard-shell.tsx` nav link from `/` to `/dashboard`
- [x] Updated `login/page.tsx` redirect from `/` to `/dashboard`
- [x] Root `page.tsx` redirects authenticated users to `/dashboard`

### Coaching Language (rebranding from "code review" to "coding coach")

- [x] Nav: "Submit Review" → "Submit Code"
- [x] Dashboard stat card: "Reviews" → "Sessions"
- [x] Dashboard alert: "Submit a review" → "Submit code"
- [x] Dashboard CTA: "Submit a Code Review" → "Get Coaching on Your Code"
- [x] Review page title: "Submit Code Review" → "Get Code Coaching"
- [x] Review page button: "Submit for Review" → "Submit for Coaching"
- [x] Constants: "Basic code review" → "AI code coaching", "Unlimited reviews" → "Unlimited coaching sessions"
- [x] Grok system prompt: told AI not to add title headings (static "Coaching Feedback" heading used instead)
- [x] Mock fallback heading: "Code Review Feedback" → "Coaching Feedback"

### Code Submission UX

- [x] Removed language dropdown (was JavaScript/TypeScript/JSX/TSX)
- [x] Engine auto-detects JS vs React via AST analysis (detectLanguage + detectFrameworkContext)
- [x] Topics are graded by framework affinity: js-pure (10), react-specific (51), shared (37)
- [x] Updated description: "Enter your JavaScript, React, or JSX code below"
- [x] Monaco editor uses `language="javascript"` for syntax highlighting (handles JSX fine)

### Pipeline Progress Animation

- [x] Multi-stage loading indicator shows what's happening during analysis
- [x] 5 stages: Parsing AST → Detecting patterns → Updating Glicko-2 → Coaching with AI → Saving progress
- [x] Each stage shows spinner (active), checkmark (complete), or dimmed (pending)
- [x] Replaces old single "Analyzing..." spinner

### AI Feedback Polish

- [x] Grok API connected and working (requires xAI credits — $10 added)
- [x] Static "Coaching Feedback" heading on results card
- [x] AI instructed not to add its own title heading (rule 8 in system prompt)
- [x] Leading markdown headings stripped from AI response as safety net
- [x] Mock fallback still works when API key missing or call fails

### Engine Details Panel

- [x] Collapsible "Engine Details" section at bottom of results
- [x] Shows: detected language, React context, parse error count
- [x] Raw AST detections: topic slug, line/col, positive/negative/idiomatic badges
- [x] Performance scores: per-topic +/- counts, idiomatic count, final score (0.00-1.00)
- [x] Added `engineDetails` field to ReviewResult type and server action response

### Detector Improvements

- [x] Fixed `detectArrayFilter()` — now checks for missing return in block-body callbacks
- [x] Fixed `detectArrayMap()` — same missing-return check added
- [x] Both correctly handle: implicit return (expression arrow), explicit return (block body), missing return (negative)
- [x] Added `hasReturnStatement()` helper that recursively checks AST for return nodes
- [x] Details string now explains what was detected (e.g. "filter() callback has no return statement")

### Backend (Previous Sessions)

- [x] Prisma schema (9 models, 98 topic markers) — prisma/schema.prisma
- [x] Seed file for all 98 topics — prisma/seed.ts
- [x] Glicko-2 rating system — src/lib/glicko2.ts
- [x] AST code analysis (13 detectors via Babel) — src/lib/analysis/
- [x] Error classification (SLIP/MISTAKE/MISCONCEPTION) — src/lib/errorClassification.ts
- [x] Stuck detection system — src/lib/stuckDetection.ts
- [x] Prerequisite chain analysis — src/lib/prerequisites.ts
- [x] Progression gates (layer unlocking) — src/lib/progression.ts
- [x] Grok AI feedback generation (with mock fallback) — src/lib/grok.ts
- [x] Server actions — src/app/actions/review.ts + user.ts
- [x] NextAuth v5 config — src/lib/auth.ts

### Frontend (Previous Sessions)

- [x] Phase A: Foundation — .env, constants.ts (grok-4-latest), shadcn/ui, root layout, landing page, auth API route
- [x] Phase B: Auth — login/signup pages, signUp server action
- [x] Phase C: Dashboard — star-rating, layer-progress-card, dashboard-shell, dashboard layout + page
- [x] Phase D: Code Coaching — review-results component, review page (Monaco editor + submit)
- [x] Phase E: Skill Matrix — skill-matrix-view (framework toggle), skills page

## COMPLETE: Architecture Refactor — AI-Driven Evaluation

### Problem

AST detectors are doing two jobs: detecting which topics are present AND scoring whether they're used correctly. AST can only do structural pattern matching — it can't assess semantic correctness. This means broken code (e.g. `.filter()` with no return) gets scored as "positive", inflating Glicko-2 ratings and making skill tracking inaccurate.

### Solution

Split detection (AST) from evaluation (AI). AST identifies which topics are present. Grok evaluates whether each is used correctly and returns structured per-topic scores. Those scores drive Glicko-2 updates instead of AST-computed scores.

### Pipeline Change

**Before:** Code → AST detectors (isPositive/isNegative) → scoreTopicPerformance() → Glicko-2
**After:** Code → AST detectors (topic presence only) → Grok (code + detected topics → structured scores + coaching) → Glicko-2

### Implementation Steps

#### Completed (this session — partially done, interrupted)

- [x] **`src/lib/grok.ts` — Prompt & types (PARTIALLY DONE)**
  - [x] Added `TopicScore` type (`{ slug, score, reason }`)
  - [x] Added `topicScores: TopicScore[]` to `GrokResponse`
  - [x] Added `detectedTopics` field to `GrokRequest`
  - [x] Updated `buildSystemPrompt()` — added TOPIC_SCORES instruction block with score guide (1.0/0.8/0.6/0.3/0.0)
  - [x] Updated `buildUserPrompt()` — sends detected topics list for AI to evaluate, renamed AST sections to "AST Analysis Context"
  - [x] Added `parseTopicScores()` — extracts JSON from ` ```TOPIC_SCORES ` block in AI response
  - [x] Added `stripScoresBlock()` — removes TOPIC_SCORES block from displayed coaching text
  - [x] Updated `generateFeedback()` — parses scores from raw response, strips block from feedbackText
  - [x] **`generateMockFeedback()` — generates fallback `topicScores` from AST detections** (0.3 for issues, 0.8 for positives, 0.5 for detected-but-not-evaluated)

- [x] **`src/app/actions/review.ts` — Use AI scores for Glicko-2**
  - [x] Pass `detectedTopics` to GrokRequest (build from `analysis.detections`)
  - [x] After receiving Grok response, use `topicScores` from AI instead of `scoreTopicPerformance()`
  - [x] Map AI scores to the existing `performanceScore` flow (error classification + updateRating)
  - [x] Keep `scoreTopicPerformance()` call as fallback when AI scores are unavailable
  - [x] Update `engineDetails` to include `aiEvaluations` and `scoringSource` fields
  - [x] Update `ReviewResult` type with new engineDetails shape

- [x] **`src/components/review/review-results.tsx` — Update Engine Details panel**
  - [x] Add "AI Evaluations" section showing per-topic AI scores and reasons
  - [x] Rename current detection display to "AST Detections — topic presence"
  - [x] Show `scoringSource` indicator badge ("AI" vs "AST fallback")
  - [x] Show both AST detections and AI evaluations
  - [x] Rename Performance Scores to show active/reference status

- [x] **AST detectors — NO changes needed**
  - Detectors keep their `isPositive/isNegative` flags for fallback and Grok prompt context
  - AST scoring is no longer the primary scoring source (handled in review.ts)

- [ ] **Testing**
  - Submit code with deliberate `.filter()` missing-return bug
  - Verify AST shows `array-filter` detected, AI scores it 0.0
  - Verify Glicko-2 rating goes DOWN for array-filter
  - Submit clean code — verify AI scores it high and rating goes up
  - Disconnect API key — verify fallback to AST scoring with warning

### Architecture Reference

Full details in CLAUDE.md under "## Analysis Architecture"

### Key Design Details for Next Session

- **Score parsing regex:** Handles both fenced (` ```TOPIC_SCORES `) and unfenced (`TOPIC_SCORES [...]`) formats
- **Score values:** 1.0 perfect/idiomatic, 0.8 correct but not idiomatic, 0.6 minor issue, 0.3 significant mistake, 0.0 fundamental misunderstanding or crash
- **Scoring strictness:** System prompt includes critical rules — scores must match coaching criticism, runtime errors = 0.0, type confusion = 0.3, "demonstrates awareness" ≠ correct usage, when in doubt score lower
- **Fallback strategy:** When `grokResponse.topicScores` is empty (parse fail or mock), use `scoreTopicPerformance()` and set `scoringSource: "ast-fallback"`
- **engineDetails new fields:** `aiEvaluations: Array<{ slug, score, reason }>`, `scoringSource: "ai" | "ast-fallback"`
- **Mock feedback:** Needs to generate scores from request's `issues`/`positiveFindings` arrays as fallback (score 0.3 for issues, 0.8 for positives)

## COMPLETE: AST Detector Expansion — Total Node Coverage

### Goal

Expand from 98 to ~180 topic markers so virtually every line of JS/React code maps to trackable skills.

### Implementation Steps

- [x] **Type inference utility** — `src/lib/analysis/typeInference.ts`
  - Tracks variable types through AST (object, array, string, number, map, set, date, promise, etc.)
  - Exports `buildTypeMap()`, `inferTypeFromNode()`, `isVariableType()`

- [x] **Array mutation detector** — `src/lib/analysis/detectors/arrayMutationMethods.ts`
  - push/pop, shift/unshift, splice, indexOf/includes, sort, slice/concat, flat/flatMap, Array.from/isArray, length, bracket notation

- [x] **String methods detector** — `src/lib/analysis/detectors/stringMethods.ts`
  - template literals, split/join, search methods, transform, slice/substring, pad/repeat

- [x] **Object methods detector** — `src/lib/analysis/detectors/objectMethods.ts`
  - keys/values/entries, assign/freeze, fromEntries, computed properties, property access, existence checks

- [x] **Number/math detector** — `src/lib/analysis/detectors/numberMath.ts`
  - parsing, checking, formatting, Math methods

- [x] **JSON detector** — `src/lib/analysis/detectors/jsonOperations.ts`
  - parse (with/without error handling), stringify

- [x] **Modern operators detector** — `src/lib/analysis/detectors/modernOperators.ts`
  - optional chaining, nullish coalescing, logical assignment, typeof, instanceof, equality, ternary

- [x] **Control flow detector** — `src/lib/analysis/detectors/controlFlow.ts`
  - switch/case, for...in, guard clauses, short-circuit evaluation

- [x] **Class syntax detector** — `src/lib/analysis/detectors/classSyntax.ts`
  - declaration, methods, inheritance, getters/setters, private fields, properties

- [x] **Module patterns detector** — `src/lib/analysis/detectors/modulePatterns.ts`
  - import/export (default, named, namespace, dynamic)

- [x] **Map/Set detector** — `src/lib/analysis/detectors/mapSetCollections.ts`
  - Map, Set, iteration, WeakMap/WeakRef

- [x] **Timers detector** — `src/lib/analysis/detectors/timersScheduling.ts`
  - setTimeout, setInterval, rAF, debounce/throttle

- [x] **Date handling detector** — `src/lib/analysis/detectors/dateHandling.ts`
  - creation, formatting, methods

- [x] **Regex detector** — `src/lib/analysis/detectors/regexPatterns.ts`
  - literals, methods, flags, groups

- [x] **DOM operations detector** — `src/lib/analysis/detectors/domOperations.ts`
  - query selectors, manipulation, events, classList, dataset

- [x] **Browser APIs detector** — `src/lib/analysis/detectors/browserApis.ts`
  - localStorage, URL, FormData, history

- [x] **Observer APIs detector** — `src/lib/analysis/detectors/observerApis.ts`
  - Intersection, Mutation, Resize observers

- [x] **Anti-patterns detector** — `src/lib/analysis/detectors/antiPatterns.ts`
  - no-var, strict equality, eval, innerHTML, magic numbers, empty catch, type coercion

- [x] **Integration** — All 17 new detectors registered in `src/lib/analysis/index.ts`
- [x] **Seed file** — 82 new topic slugs added to `prisma/seed.ts` (180 total)
- [x] **Build verification** — `npx next build` compiles clean
- [x] **Seed execution** — `npx tsx prisma/seed.ts` — 182 topics seeded successfully

## COMPLETE: ESLint Integration — Programmatic Linting Layer

### Goal

Add ESLint as a second detection layer alongside Babel AST. ESLint catches rule violations (unreachable code, missing returns, complexity, React best practices) that structural AST pattern matching cannot. ~120 rules, ~152 new topics.

### Implementation Steps

- [x] **Rule catalog generation** — `scripts/generate-eslint-topics.ts`
  - Extracts metadata from ESLint core (`builtinRules`), `eslint-plugin-react`, `eslint-plugin-react-hooks`
  - Filters deprecated, formatting, snippet-noise, niche, and React compiler internal rules
  - Maps 22 overlapping rules to existing Babel slugs via `BABEL_OVERLAP_MAP`
  - Classifies remaining into FUNDAMENTALS/INTERMEDIATE/PATTERNS layers
  - Outputs `scripts/eslint-topics.json` (152 topics) and `scripts/eslint-overlap-map.json`

- [x] **Seed file update** — `prisma/seed.ts`
  - Imports `eslint-topics.json`, merges with Babel topics (deduplicates by slug)
  - Total: ~332 topics (180 Babel + 152 ESLint)

- [x] **ESLint detection module** — `src/lib/analysis/eslintDetector.ts`
  - Uses ESLint `Linter` class (synchronous, in-memory, flat config)
  - Four configs: BASE_JS, BASE_TS, REACT_JS, REACT_TS
  - `typescript-eslint` parser for TS/TSX support
  - `globals` package for environment globals
  - `BABEL_OVERLAP_MAP` for 22 overlapping rules
  - `ruleIdToSlug()`: overlap map first, then `eslint-*` prefix
  - All violations: `isPositive: false, isNegative: true`
  - `isTrivial: true` for auto-fixable rules
  - Graceful degradation: empty array on failure

- [x] **Pipeline integration** — `src/lib/analysis/index.ts`
  - Added `source?: "babel" | "eslint"` to `Detection` interface
  - Babel detections tagged `source: "babel"` after running
  - ESLint called after Babel, results merged into `allDetections`
  - Updated `serializeAnalysis()` to include `source` field

- [x] **Server action update** — `src/app/actions/review.ts`
  - `engineDetails.detections` includes `source` field
  - `detectedTopics` sent to Grok includes `source` and `details`

- [x] **Grok prompt update** — `src/lib/grok.ts`
  - `GrokRequest.detectedTopics` type includes optional `source` and `details`
  - `buildUserPrompt()` splits topics into "Detected Topics (AST)" and "ESLint Violations" sections

- [x] **Turbopack fix** — `next.config.ts`
  - Added `serverExternalPackages` for eslint, eslint-plugin-react, eslint-plugin-react-hooks, typescript-eslint, globals
  - Required because eslint-plugin-react-hooks → @babel/core can't be bundled by Turbopack

- [x] **UI updates** — `src/components/review/review-results.tsx`, `src/app/(dashboard)/review/page.tsx`
  - Split detection display into Babel vs ESLint vs Data Flow sections
  - Add ESLint + Data Flow pipeline stages in loading animation
  - Update detection count in pipeline stages

- [x] **Build verification** — `npx next build` compiles clean
- [x] **Seed execution** — `npx tsx prisma/seed.ts` — 344 topics seeded
- [x] **End-to-end test** — Submitted code with known violations, verified in Engine Details

## COMPLETE: Data Flow Detection — Semantic Analysis Layer

### Goal

Add 12 semantic data flow detectors that catch issues pure syntax matching (Babel) and lint rules (ESLint) cannot — like shared object reference mutations, missing array callback returns, React state mutations, var-before-init, array-as-object, deep nesting, loop bounds off-by-one, and string arithmetic coercion.

### Implementation Steps

- [x] **Alias tracking** — `src/lib/analysis/typeInference.ts`
  - Extended with `AliasInfo`, `AliasMap` interfaces and `buildAliasMap()` function
  - Two-pass analysis: Pass 1 tracks object/array declarations and property assignments to find aliases; Pass 2 detects mutations via property assignment on aliased objects
  - Foundation for `object-reference-sharing` and `object-spread-missing` detectors

- [x] **Data flow detector module** — `src/lib/analysis/dataFlowDetector.ts`
  - 12 detectors: object-reference-sharing, nested-ternary, deep-nesting, long-parameter-list, state-mutation-react, missing-cleanup-effect, object-spread-missing, array-method-no-return, var-used-before-init, array-as-object, loop-bounds-off-by-one, string-arithmetic-coercion
  - Main entry: `analyzeDataFlow(ast, isReact)` → `Detection[]` with `source: "dataflow"`
  - JS detectors always run; React detectors (state-mutation-react, missing-cleanup-effect) only when React detected
  - `analyzeReturnPaths()` helper for smart return path analysis in array callbacks
  - `var-used-before-init`: scans top-level program body for Identifier references to var-declared variables that appear before the declaration line (skips function bodies since they execute when called)
  - `array-as-object`: detects when `[]`-typed variable gets string-keyed assignments — catches StringLiteral keys, string-typed variable keys, and variable keys with ObjectExpression values

- [x] **Topic definitions** — `scripts/dataflow-topics.json`
  - 12 topics with slug, name, layer, category, criticality, prerequisites, relatedTopics

- [x] **Seed file update** — `prisma/seed.ts`
  - Imports `dataflow-topics.json`, merges with Babel + ESLint topics
  - Total: 347 topics (181 Babel + 152 ESLint + 14 Data Flow)

- [x] **Pipeline integration** — `src/lib/analysis/index.ts`
  - Added `"dataflow"` to Detection source type
  - Data flow detector called after ESLint, results merged

- [x] **Grok prompt update** — `src/lib/grok.ts`
  - `buildUserPrompt()` splits into "Detected Topics (AST)", "ESLint Violations", and "Data Flow Issues"

- [x] **UI updates** — `src/components/review/review-results.tsx`, `src/app/(dashboard)/review/page.tsx`
  - Added purple/violet Data Flow section in Engine Details
  - Added "Analyzing data flow" pipeline stage with GitBranch icon
  - Three-way detection count header

- [x] **Testing** — All 12 detectors verified working via `scripts/test-dataflow.ts`
- [x] **Build** — `npx next build` compiles clean
- [x] **Seed** — 347 topics seeded successfully

## COMPLETE: AI Scoring Strictness — Prompt Improvement

### Problem

AI coaching text correctly identified code issues but TOPIC_SCORES were too generous. Example: `var-hoisting` scored 0.8 ("demonstrates hoisting correctly") for code that would crash at runtime when calling `printSummary()` before assignment. `bracket-notation` scored 1.0 for using string keys on an array (type confusion bug).

### Solution

Expanded the TOPIC_SCORES instruction in `buildSystemPrompt()` (`src/lib/grok.ts`) with:

- Detailed score guide with concrete examples at each level (1.0, 0.8, 0.6, 0.3, 0.0)
- 6 critical scoring rules enforcing strict correctness-based scoring
- Key rules: scores must match coaching criticism, runtime errors = 0.0, type confusion = 0.3, "demonstrates awareness" ≠ correct usage, when in doubt score lower

### Files Changed

- [x] `src/lib/grok.ts` — Expanded `scoringInstruction` in `buildSystemPrompt()`

## COMPLETE: Detection Quality & Coaching Fixes

### Problems

1. **Callback false positive:** `addTax(price, taxRate)` flagged as "Function passed as callback argument" — the detector treated any Identifier argument as a callback, causing unfair -48 rating drops for skills users never demonstrated.
2. **Console-cleanup penalizing learners:** Console statements flagged as anti-patterns, dropping ratings. In a learning context, console.log is a pedagogical tool, not an anti-pattern.
3. **Coaching severity disorder:** AI coaching led with style feedback (remove console.log) instead of runtime errors (TypeError from out-of-bounds access).
4. **Missing string coercion detection:** `"100" * 0.2` — arithmetic with string operands silently coerces to NaN for non-numeric strings, but the data flow detector didn't catch it.

### Files Changed

- [x] **`src/lib/analysis/detectors/functionPatterns.ts`** — Fixed callback-functions detection
  - Added `callbackAcceptingMethods` whitelist (map, filter, setTimeout, addEventListener, then, etc.)
  - Inline arrow/function expressions always count as callbacks
  - Identifier arguments only count as callbacks when passed to known callback-accepting methods
- [x] **`src/lib/analysis/detectors/antiPatterns.ts`** — Removed `detectConsoleCleanup()` entirely
- [x] **`src/lib/analysis/eslintDetector.ts`** — Removed `no-console` rule and overlap mapping
- [x] **`scripts/eslint-overlap-map.json`** — Removed `no-console: console-cleanup` mapping
- [x] **`scripts/generate-eslint-topics.ts`** — Removed `no-console: console-cleanup` from BABEL_OVERLAP_MAP
- [x] **`prisma/seed.ts`** — Removed console-cleanup topic entry
- [x] **`src/lib/grok.ts`** — Added rules 10-11 to system prompt:
  - Rule 10: Severity weighting (CRITICAL > HIGH > MEDIUM > LOW) with concrete examples
  - Rule 11: Console statements ENCOURAGED as pedagogical tools, never flagged
- [x] **`src/lib/analysis/dataFlowDetector.ts`** — Added `detectStringArithmeticCoercion()` and `detectLoopBoundsOffByOne()`
- [x] **`scripts/dataflow-topics.json`** — Added `string-arithmetic-coercion` and `loop-bounds-off-by-one` topic entries
- [x] **Build** — `npx next build` compiles clean
- [x] **Seed** — 347 topics seeded (181 Babel + 152 ESLint + 14 Data Flow)
- [x] **End-to-end testing** — Two test submissions verified all fixes working:
  - Callback false positive eliminated
  - Console-cleanup gone from detections
  - AI coaching leads with runtime errors, not style
  - Data flow detections catching shared references and array-as-object bugs
  - AI scoring well calibrated with severity weighting

## Other TODO

- [ ] Phase F: Topic detail page (stretch — /topics/[slug])
- [ ] Production deployment considerations (Vercel, Sentry, Stripe)

## Key Info for Future Sessions

- **Database:** Supabase PostgreSQL — schema synced, 347 topics defined in seed.ts (181 Babel + 152 ESLint + 14 Data Flow). Run `npx prisma db seed` to push new topics.
- **Prisma 7:** Uses `prisma.config.ts` for datasource URL (not in schema.prisma). Seed script uses PrismaPg adapter.
- **xAI:** API key in .env as XAI_API_KEY, model is grok-4-latest, requires credits on https://console.x.ai
- **UI style:** Dark theme, shadcn/ui (new-york style) + Monaco Editor, lucide-react icons
- **Routing:** Landing at `/`, dashboard at `/dashboard`, auth check redirects between them
- **Pattern:** Server components call server actions, pass data to client components as props
- **Auth:** NextAuth v5 beta, Credentials provider, JWT strategy
- **Code detection:** No user language selection — engine auto-detects JS vs React via AST. Topics graded by affinity (js-pure, react-specific, shared).
- **Engine debug:** Collapsible "Engine Details" panel in results shows raw AST detections, ESLint detections, Data Flow detections, and performance scores
- **Analysis architecture:** Four-layer detection: Babel AST (topic presence) + ESLint (rule violations) + Data Flow (semantic patterns) + AI (correctness scoring). See CLAUDE.md "Analysis Architecture" section.
- **Detectors:** 30 Babel detector files in `src/lib/analysis/detectors/` + ESLint detector at `src/lib/analysis/eslintDetector.ts` + Data Flow detector at `src/lib/analysis/dataFlowDetector.ts`. Type inference + alias tracking at `src/lib/analysis/typeInference.ts`. All registered in `src/lib/analysis/index.ts`.
- **ESLint config:** Uses `Linter` class with flat config (ESLint 9). Requires `serverExternalPackages` in `next.config.ts` for Turbopack. 22 ESLint rules overlap with Babel topics (mapped, not duplicated).
