# Code Review Buddy - Project Notes

## What This Project Is

Code Review Buddy (CRB) is an AI-powered **pedagogical** code reviewer for junior to intermediate JavaScript/React developers. The key differentiator is:

1. **Teaches, not just fixes** - First-principles explanations
2. **Remembers your journey** - Persistent skill tracking
3. **Adapts as you learn** - Feedback evolves with mastery
4. **Fundamentals first** - Never overwhelms beginners with advanced patterns

## The Moat: Three-Layer Learning Model

This is the MOST IMPORTANT part of the app. CRB is NOT a pattern-hunter. It analyzes code holistically across three layers:

- **Fundamentals (40-50%)**: var vs const, ===, error handling, state basics
- **Intermediate (30%)**: Closures, useEffect deps, APIs, composition
- **Patterns (20%)**: Custom hooks, memoization, context patterns

**A beginner NEVER sees pattern feedback.** They see fundamentals first.

## Stuck Concept Detection

When `timesSeen > 3 && mastery < 3`:
- Don't repeat the same explanation
- Anchor to concepts they DO understand
- Ask diagnostic questions
- Break into smaller prerequisites
- Show empathy

## Key Business Context

- **Target**: Junior devs who lack mentorship (60-70% cite this as top barrier)
- **Pricing**: Free (5 reviews/month) | Pro (£9/month unlimited)
- **Break-even**: 250 users at 92% margins
- **LLM cost**: ~£0.05 per review

## Blueprint Document

The full implementation blueprint is at:
`H:\Code Review Buddy App\Docs\Code Review Buddy - Complete Implementation Blueprint - final.pdf`

This doc is NOT in the repo (gitignored). It contains:
- Detailed user journey (8 steps)
- Database schema specs
- Curriculum definitions
- Prompt engineering details
- Go-to-market strategy

## Tech Decisions

### Why xAI Grok instead of OpenAI?
Currently configured for xAI. Can switch to GPT-4 Turbo by changing:
- `src/lib/openai.ts` baseURL and API key
- Model name in `generateFeedback.ts`

### Why no Monaco Editor yet?
MVP simplicity. Textarea works. Monaco adds complexity and bundle size.

### Why JWT instead of database sessions?
Stateless auth scales better. No session table queries on every request.

### Why flat UserPattern instead of UserSkillMatrix?
This was an early implementation. We're refactoring to the three-layer model now.

## Current State (Jan 28, 2026)

- Core review flow works end-to-end
- Auth works (signup/login/logout)
- Pattern detection works (AST + rules)
- Prompt building is sophisticated (stuck detection works)
- **BUT**: Dashboard shows flat pattern list, not three-layer pyramid
- **BUT**: No layer prioritization in feedback
- **BUT**: Curriculum is hardcoded, not structured

## Refactor Priority

1. Create `lib/curriculum.ts` with three-layer definitions
2. Update schema with `UserSkillMatrix`
3. Update `analyzeCode.ts` to return `{fundamentals, intermediate, patterns}`
4. Update `generateFeedback.ts` to prioritize by layer
5. Update dashboard to show pyramid progress
6. Update review UI to show layer badges

## GitHub Repo

https://github.com/charles-coderep/code-review-buddy

## Important Files to Reference

- `ARCHITECTURE.md` - Technical decisions and data models
- `TODO.md` - What's done and what's next
- `src/lib/curriculum.ts` - Topic definitions (being created)
- `src/app/actions/buildPrompt.ts` - Prompt engineering (sophisticated)
- `prisma/schema.prisma` - Database models

---

## Session Context

When resuming work:
1. Read these three .md files first
2. Check TODO.md for current task
3. Reference ARCHITECTURE.md for design decisions
4. Blueprint PDF is in parent Docs folder (not in repo)

---

## Last Updated
January 28, 2026
