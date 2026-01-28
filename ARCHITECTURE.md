# Code Review Buddy - Architecture

## Core Philosophy: Three-Layer Learning Model

CRB is built on a pedagogical foundation that mirrors how developers actually learn. The system is NOT a pattern-hunting linter—it's a teaching tool that prioritizes **fundamentals first**.

```
┌────────────────────────────────────┐
│  PATTERNS (20%)                    │  ← Only shown when intermediate is solid
│  Custom hooks, memoization,        │
│  Promise refactoring, Context      │
└────────────────────────────────────┘
┌────────────────────────────────────┐
│  INTERMEDIATE (30%)                │  ← Unlocks when fundamentals >= 3
│  Closures, modules, useEffect,     │
│  Error handling, APIs, composition │
└────────────────────────────────────┘
┌────────────────────────────────────┐
│  FUNDAMENTALS (40-50%)             │  ← Always prioritized first
│  Variables, loops, functions,      │
│  ES6, async/await basics,          │
│  JSX, useState, props              │
└────────────────────────────────────┘
```

**Key Principle**: A beginner NEVER sees pattern feedback. They see fundamentals issues first. This prevents cognitive overload and builds genuine understanding.

---

## Tech Stack

| Component | Technology | Why |
|-----------|------------|-----|
| Framework | Next.js 14 (App Router) | Single codebase, server actions, Vercel deploy |
| Frontend | React 18 + Tailwind + Shadcn/ui | Fast, accessible |
| Editor | Textarea (Monaco planned) | MVP simplicity |
| State | TanStack Query | API caching + mutations |
| Database | PostgreSQL (Supabase) | Relational, robust |
| ORM | Prisma | Type-safe, migrations |
| LLM | xAI Grok (OpenAI-compatible) | Quality + cost balance |
| Auth | NextAuth.js v5 | JWT strategy, credentials |
| Analysis | Babel Parser | AST-based detection |

---

## Key Data Models

### UserSkillMatrix (NEW - Three-Layer Tracking)
```prisma
model UserSkillMatrix {
  userId              String @unique

  // Layer 1: Fundamentals (40-50%)
  fundamentalsLevel   Int @default(1)    // 1-5 average
  fundamentalsTopics  Json               // {topic: {timesSeen, mastery}}

  // Layer 2: Intermediate (30%)
  intermediateLevel   Int @default(0)
  intermediateTopics  Json

  // Layer 3: Patterns (20%)
  patternsLevel       Int @default(0)
  patternsMastery     Json

  estimatedLevel      String @default("beginner") // beginner|intermediate|advanced
}
```

### Level Estimation Logic
```typescript
function estimateLevel(fundamentals, intermediate, patterns) {
  if (fundamentals < 3) return "beginner";
  if (fundamentals >= 3 && intermediate < 3) return "intermediate";
  if (fundamentals >= 4 && intermediate >= 3) return "advanced";
  return "intermediate";
}
```

---

## Review Flow (8 Steps)

1. **Code Submission** → User pastes code, selects language
2. **Three-Layer Analysis** → AST + rules detect issues across all layers
3. **Fetch Skill Matrix** → Get user's proficiency per layer
4. **Prioritize by Layer** → Fundamentals first, then intermediate, then patterns
5. **Build Dynamic Prompt** → Include stuck detection, mastered concepts
6. **LLM Feedback** → GPT generates layer-aware review
7. **Display + Rate** → Show feedback with layer badges
8. **Update Matrix** → Adjust mastery based on rating

---

## Prioritization Logic

```typescript
function prioritizeIssues(analysis, userLevel) {
  const prioritized = [];

  // ALWAYS include fundamentals first
  if (analysis.fundamentals.issues.length > 0) {
    prioritized.push(...analysis.fundamentals.issues.map(i => ({layer: "FUNDAMENTAL", ...i})));
  }

  // Only add intermediate if:
  // - User is not beginner AND
  // - No fundamental issues exist
  if (userLevel !== "beginner" && analysis.fundamentals.issues.length === 0) {
    prioritized.push(...analysis.intermediate.issues.map(i => ({layer: "INTERMEDIATE", ...i})));
  }

  // Only add patterns if:
  // - No lower-layer issues AND
  // - User is intermediate or advanced
  if (analysis.fundamentals.issues.length === 0 &&
      (userLevel === "intermediate" || userLevel === "advanced")) {
    prioritized.push(...analysis.patterns.detected.map(p => ({layer: "PATTERN", ...p})));
  }

  return prioritized.slice(0, 3); // Focus on top 3
}
```

---

## Stuck Concept Detection (The Moat)

When a user has seen a concept 3+ times but mastery is still < 3:

```typescript
if (timesSeen > 3 && masteryLevel < 3) {
  // User is STUCK - use different teaching strategy:
  // 1. Anchor to concepts they DO understand
  // 2. Ask diagnostic questions
  // 3. Break into smaller prerequisites
  // 4. Show empathy
}
```

This adaptive feedback is what differentiates CRB from generic AI tools.

---

## File Structure

```
src/
├── app/
│   ├── (auth)/           # Login, signup
│   ├── (dashboard)/      # Protected routes
│   │   ├── dashboard/    # Main dashboard with pyramid progress
│   │   ├── review/       # Code submission + feedback
│   │   └── curriculum/   # Browse all topics by layer
│   └── actions/          # Server actions
│       ├── analyzeCode.ts      # Three-layer detection
│       ├── buildPrompt.ts      # Layer-aware prompts
│       ├── generateFeedback.ts # Main review flow
│       └── feedback.ts         # Rating + matrix updates
├── lib/
│   ├── curriculum.ts     # FUNDAMENTALS, INTERMEDIATE, PATTERNS definitions
│   ├── prisma.ts
│   ├── openai.ts
│   └── auth.ts
└── types/
    └── index.ts          # Shared types
```

---

## Environment Variables

```env
DATABASE_URL=           # PostgreSQL connection
NEXTAUTH_SECRET=        # JWT signing key
NEXTAUTH_URL=           # Base URL
XAI_API_KEY=            # LLM API key
```

---

## Last Updated
January 28, 2026
