# Code Review Buddy - TODO

## Current Sprint: Three-Layer Model Refactor

### COMPLETED
- [x] Basic Next.js 14 setup with App Router
- [x] PostgreSQL + Prisma integration
- [x] NextAuth.js authentication (email/password)
- [x] Code submission form
- [x] AST-based pattern detection (Babel)
- [x] Rule-based pattern heuristics
- [x] OpenAI/xAI LLM integration
- [x] Feedback storage and rating
- [x] Basic mastery tracking (UserPattern)
- [x] Stuck concept detection in prompt builder
- [x] Review rate limiting (free: 5/month, pro: unlimited)
- [x] Cost tracking per review
- [x] Landing page
- [x] User profile page

### IN PROGRESS
- [ ] **Three-layer curriculum structure** (lib/curriculum.ts)
  - Define FUNDAMENTALS array with topics
  - Define INTERMEDIATE array with topics
  - Define PATTERNS array with topics
  - Include prerequisites, criticality, descriptions

- [ ] **UserSkillMatrix schema update**
  - Add UserSkillMatrix model to Prisma schema
  - Migrate from flat UserPattern to three-layer structure
  - Update estimatedLevel calculation

- [ ] **Layer-aware analysis**
  - Categorize detected issues by layer
  - Return structured {fundamentals, intermediate, patterns} object
  - Implement prioritization logic

- [ ] **Dashboard pyramid visualization**
  - Three sections: Foundation, Intermediate, Patterns
  - Progressive unlocking (intermediate at fundamentals >= 2)
  - Progress bars per topic
  - Resource links for low mastery topics
  - "What's Next" guidance section

- [ ] **Layer badges in review results**
  - Show "⚠️ Fundamentals (2)" style badges
  - Color-code by layer (red/yellow/blue)
  - Only show relevant layers based on user level

### NEXT UP
- [ ] Seed database with curriculum topics
- [ ] Update feedback rating to update skill matrix by layer
- [ ] Add resource links (MDN, React docs) to curriculum
- [ ] Implement mastery decay for repeated issues
- [ ] Replace textarea with Monaco Editor

### BACKLOG (Phase 2)
- [ ] Stripe payment integration
- [ ] GitHub OAuth
- [ ] Email verification
- [ ] Socratic "deep dive" mode (exists but not wired to UI)
- [ ] VS Code extension
- [ ] Weekly challenges
- [ ] Gamification (badges, streaks)
- [ ] Bootcamp dashboard (B2B)
- [ ] Sentry error tracking
- [ ] Dark mode toggle

### KNOWN ISSUES
- XAI_API_KEY needs to be configured in .env
- Pattern catalog is hardcoded in component (should be from DB/curriculum.ts)
- No email verification flow
- Subscription upgrade buttons are placeholders

---

## File Changes Tracking

### Files to CREATE
- `src/lib/curriculum.ts` - Three-layer topic definitions

### Files to MODIFY
- `prisma/schema.prisma` - Add UserSkillMatrix model
- `src/app/actions/analyzeCode.ts` - Return three-layer structure
- `src/app/actions/generateFeedback.ts` - Use layer prioritization
- `src/app/actions/buildPrompt.ts` - Layer-aware prompt building
- `src/app/actions/feedback.ts` - Update skill matrix by layer
- `src/app/(dashboard)/dashboard/page.tsx` - Pyramid visualization
- `src/app/(dashboard)/review/page.tsx` - Layer badges
- `src/app/(dashboard)/pattern-library/page.tsx` - Rename to curriculum, three sections

### Files to DELETE/DEPRECATE
- None yet (will refactor in place)

---

## Last Updated
January 28, 2026
