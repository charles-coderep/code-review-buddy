# Cortext Coding Coach - Build Progress

## Status: APP FUNCTIONAL — AI connected, engine tested, user flow working

Full stack working: signup → login → dashboard → submit code → AI coaching feedback → skill tracking.
Grok API (grok-4-latest) connected and returning real coaching feedback.

## What's Done

### Infrastructure

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

## IN PROGRESS: Architecture Refactor — AI-Driven Evaluation

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

- **Score parsing regex:** `/```TOPIC_SCORES\n([\s\S]*?)```/` — extracts JSON array from AI response
- **Score values:** 1.0 perfect, 0.8 correct not idiomatic, 0.6 minor issue, 0.3 significant mistake, 0.0 broken
- **Fallback strategy:** When `grokResponse.topicScores` is empty (parse fail or mock), use `scoreTopicPerformance()` and set `scoringSource: "ast-fallback"`
- **engineDetails new fields:** `aiEvaluations: Array<{ slug, score, reason }>`, `scoringSource: "ai" | "ast-fallback"`
- **Mock feedback:** Needs to generate scores from request's `issues`/`positiveFindings` arrays as fallback (score 0.3 for issues, 0.8 for positives)

## Other TODO

- [ ] Phase F: Topic detail page (stretch — /topics/[slug])
- [ ] Production deployment considerations (Vercel, Sentry, Stripe)

## Key Info for Future Sessions

- **Database:** Supabase PostgreSQL — schema synced, 98 topics seeded (11 tables, all needed)
- **Prisma 7:** Uses `prisma.config.ts` for datasource URL (not in schema.prisma). Seed script uses PrismaPg adapter.
- **xAI:** API key in .env as XAI_API_KEY, model is grok-4-latest, requires credits on https://console.x.ai
- **UI style:** Dark theme, shadcn/ui (new-york style) + Monaco Editor, lucide-react icons
- **Routing:** Landing at `/`, dashboard at `/dashboard`, auth check redirects between them
- **Pattern:** Server components call server actions, pass data to client components as props
- **Auth:** NextAuth v5 beta, Credentials provider, JWT strategy
- **Code detection:** No user language selection — engine auto-detects JS vs React via AST. Topics graded by affinity (js-pure, react-specific, shared).
- **Engine debug:** Collapsible "Engine Details" panel in results shows raw AST detections and performance scores
- **Analysis architecture:** AST handles detection (which topics?), AI handles evaluation (used correctly?). See CLAUDE.md "Analysis Architecture" section.
