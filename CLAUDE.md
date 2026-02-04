# Cortext Coding Coach - Implementation Reference

## Project Overview
AI-powered coding coach using Glicko-2 ratings to track JavaScript/React skill mastery. Not a tutorial platform — an always-on coach that uses your own code to push your existing knowledge forward. Builds persistent mental model of each learner, adapts coaching when stuck, tracks confidence separately from skill level, and tells you what to practice next.

## Tech Stack
- **Framework:** Next.js 14 (App Router)
- **Frontend:** React 18, Tailwind CSS, shadcn/ui, Monaco Editor
- **Database:** PostgreSQL (Neon/Vercel Postgres), Prisma ORM
- **Auth:** NextAuth.js v5
- **AI:** xAI Grok API
- **Code Analysis:** Babel Parser (AST)
- **Deployment:** Vercel, Sentry, Stripe

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

### submissions
```
id: UUID PK
user_id: FK
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
| Constant | Value |
|----------|-------|
| INITIAL_RATING | 1500 |
| INITIAL_RD | 350 |
| INITIAL_VOLATILITY | 0.06 |
| MIN_RATING | 1200 |
| MAX_RATING | 1800 |
| MIN_RD | 50 |
| MAX_RD | 350 |
| TAU | 0.5 |
| DECAY_CONSTANT | 0.5 |

### Display Thresholds
| Constant | Value | Meaning |
|----------|-------|---------|
| NOVICE_CEILING | 1400 | Below = Novice (⭐) |
| BASIC_CEILING | 1500 | Below = Basic (⭐⭐) |
| COMPETENT_CEILING | 1650 | Below = Competent (⭐⭐⭐) |
| PROFICIENT_CEILING | 1750 | Below = Proficient (⭐⭐⭐⭐) |
| HIGH_CONFIDENCE_RD | 80 | Below = ●●● |
| MEDIUM_CONFIDENCE_RD | 150 | Below = ●●○ |

### Error Classification
| Type | Criteria |
|------|----------|
| SLIP | rating > 1650, last 2 clean, trivial error |
| MISCONCEPTION | rating < 1450, encounters ≥ 3, volatility > 0.12 |
| MISTAKE | Everything else (default) |

### Stuck Detection (ALL must be true)
- rating < 1450
- times_encountered ≥ 4
- rd > 180
- volatility > 0.12

### Progression Unlock
**Intermediate:** coverage ≥ 90%, avg rating ≥ 1650, avg RD < 100, submissions ≥ 10, last review ≤ 30 days
**Patterns:** coverage ≥ 90%, avg rating ≥ 1700, avg RD < 80, submissions ≥ 20, last review ≤ 30 days

### Performance Scores
| Outcome | Score |
|---------|-------|
| Perfect (clean + idiomatic) | 1.0 |
| Clean only | 0.8 |
| Slip | 0.6 |
| Mistake | 0.3 |
| Misconception | 0.0 |

---

## Topic Markers (98 total)

### FUNDAMENTALS LAYER (42 markers)

#### Variable Handling (js-pure) - 4 markers
| Slug | Prerequisites |
|------|---------------|
| let-const-usage | none |
| var-hoisting | let-const-usage |
| temporal-dead-zone | let-const-usage |
| block-vs-function-scope | let-const-usage |

#### Array Methods (shared) - 7 markers
| Slug | Prerequisites |
|------|---------------|
| array-map | none |
| array-filter | none |
| array-reduce | array-map |
| array-find | array-filter |
| array-some-every | array-filter |
| array-foreach | none |
| array-method-chaining | array-map, array-filter |

#### Object Operations (shared) - 4 markers
| Slug | Prerequisites |
|------|---------------|
| object-destructuring | none |
| array-destructuring | none |
| spread-operator | object-destructuring |
| object-shorthand | object-destructuring |

#### Functions (shared) - 6 markers
| Slug | Prerequisites |
|------|---------------|
| arrow-functions | none |
| default-parameters | arrow-functions |
| rest-parameters | spread-operator |
| pure-functions | arrow-functions |
| callback-functions | arrow-functions |
| higher-order-functions | callback-functions |

#### Closures (shared) - 3 markers
| Slug | Prerequisites |
|------|---------------|
| closure-basics | arrow-functions |
| closure-in-loops | closure-basics |
| closure-state | closure-basics |

#### Async Fundamentals (shared) - 5 markers
| Slug | Prerequisites |
|------|---------------|
| promise-basics | callback-functions |
| promise-chaining | promise-basics |
| promise-catch | promise-basics |
| async-await-basics | promise-basics |
| async-await-error-handling | async-await-basics, try-catch |

#### Error Handling (shared) - 4 markers
| Slug | Prerequisites |
|------|---------------|
| try-catch | none |
| error-throwing | try-catch |
| fetch-error-checking | async-await-basics, try-catch |
| error-messages | try-catch |

#### JSX Fundamentals (react-specific) - 5 markers
| Slug | Prerequisites |
|------|---------------|
| jsx-syntax | none |
| jsx-expressions | jsx-syntax |
| jsx-conditional-rendering | jsx-expressions |
| jsx-list-rendering | array-map, jsx-expressions |
| jsx-keys | jsx-list-rendering |

#### React State Basics (react-specific) - 4 markers
| Slug | Prerequisites |
|------|---------------|
| usestate-basics | jsx-syntax |
| usestate-functional-updates | usestate-basics |
| state-immutability | usestate-basics, spread-operator |
| lifting-state | usestate-basics |

### INTERMEDIATE LAYER (32 markers)

#### Loops & Iteration (js-pure) - 3 markers
| Slug | Prerequisites |
|------|---------------|
| for-loop-basics | none |
| for-of-loops | for-loop-basics |
| while-loops | for-loop-basics |

#### This & Context (js-pure) - 3 markers
| Slug | Prerequisites |
|------|---------------|
| this-binding | closure-basics |
| bind-call-apply | this-binding |
| arrow-vs-regular-this | this-binding, arrow-functions |

#### useEffect Mastery (react-specific) - 5 markers
| Slug | Prerequisites |
|------|---------------|
| useeffect-basics | usestate-basics |
| useeffect-dependencies | useeffect-basics |
| useeffect-cleanup | useeffect-basics |
| useeffect-async | useeffect-basics, async-await-basics |
| useeffect-infinite-loop | useeffect-dependencies |

#### Props & Components (react-specific) - 5 markers
| Slug | Prerequisites |
|------|---------------|
| props-basics | jsx-syntax |
| props-destructuring | props-basics, object-destructuring |
| children-prop | props-basics |
| prop-types-validation | props-basics |
| default-props | props-basics, default-parameters |

#### Component Patterns (react-specific) - 4 markers
| Slug | Prerequisites |
|------|---------------|
| controlled-components | usestate-basics, jsx-expressions |
| uncontrolled-components | controlled-components |
| component-composition | props-basics, children-prop |
| conditional-component-rendering | jsx-conditional-rendering |

#### Event Handling (react-specific) - 4 markers
| Slug | Prerequisites |
|------|---------------|
| event-handlers | jsx-syntax, arrow-functions |
| event-handler-params | event-handlers |
| prevent-default | event-handlers |
| event-delegation | event-handlers |

#### API Integration (shared) - 4 markers
| Slug | Prerequisites |
|------|---------------|
| fetch-basics | async-await-basics |
| fetch-with-options | fetch-basics |
| loading-states | usestate-basics, fetch-basics |
| error-state-handling | loading-states, fetch-error-checking |

#### Refs (react-specific) - 4 markers
| Slug | Prerequisites |
|------|---------------|
| useref-basics | usestate-basics |
| useref-dom | useref-basics |
| useref-mutable | useref-basics |
| callback-refs | useref-basics, callback-functions |

### PATTERNS LAYER (24 markers)

#### Custom Hooks (react-specific) - 4 markers
| Slug | Prerequisites |
|------|---------------|
| custom-hook-basics | usestate-basics, useeffect-basics |
| custom-hook-parameters | custom-hook-basics |
| custom-hook-return | custom-hook-basics |
| custom-hook-composition | custom-hook-basics |

#### Context (react-specific) - 4 markers
| Slug | Prerequisites |
|------|---------------|
| context-basics | props-basics |
| context-provider | context-basics |
| usecontext-hook | context-basics |
| context-performance | usecontext-hook |

#### Performance Optimization (react-specific) - 5 markers
| Slug | Prerequisites |
|------|---------------|
| react-memo | component-composition |
| usememo-basics | usestate-basics |
| usecallback-basics | event-handlers, closure-basics |
| key-optimization | jsx-keys |
| unnecessary-rerenders | react-memo, usememo-basics |

#### Advanced Async (shared) - 4 markers
| Slug | Prerequisites |
|------|---------------|
| promise-all | promise-basics |
| promise-race | promise-basics |
| request-cancellation | fetch-basics, useeffect-cleanup |
| retry-logic | fetch-error-checking |

#### State Patterns (react-specific) - 4 markers
| Slug | Prerequisites |
|------|---------------|
| usereducer-basics | usestate-basics |
| reducer-patterns | usereducer-basics |
| complex-state | usereducer-basics |
| state-normalization | complex-state |

#### Error Boundaries (react-specific) - 3 markers
| Slug | Prerequisites |
|------|---------------|
| error-boundary-basics | try-catch |
| error-boundary-fallback | error-boundary-basics |
| error-boundary-recovery | error-boundary-basics |

### Summary by Affinity
| Layer | Total | js-pure | react-specific | shared |
|-------|-------|---------|----------------|--------|
| Fundamentals | 42 | 4 | 9 | 29 |
| Intermediate | 32 | 6 | 22 | 4 |
| Patterns | 24 | 0 | 20 | 4 |
| **Total** | **98** | **10** | **51** | **37** |

---

## Glicko-2 Algorithm Summary

### Rating Scale
| Range | Level | Stars |
|-------|-------|-------|
| 1200-1400 | Novice | ⭐ |
| 1400-1500 | Basic | ⭐⭐ |
| 1500-1650 | Competent | ⭐⭐⭐ |
| 1650-1750 | Proficient | ⭐⭐⭐⭐ |
| 1750-1800 | Expert | ⭐⭐⭐⭐⭐ |

### Confidence (RD → Dots)
| RD Range | Display | Meaning |
|----------|---------|---------|
| < 80 | ●●● | High confidence |
| 80-150 | ●●○ | Medium confidence |
| > 150 | ●○○ | Low confidence |

### Update Process
1. Score performance 0.0-1.0
2. Compare to expected score based on rating
3. Adjust rating (magnitude depends on RD)
4. Decrease RD (more evidence = more confidence)
5. Adjust volatility based on consistency

### Knowledge Decay
RD increases over time without practice (τ = 0.5). Topic mastered 6 months ago: RD might go 60 → 150.

---

## Detection Rules (AST Pattern Examples)

**array-map:** CallExpression with callee.property.name === "map" and function argument
**jsx-keys:** In mapped JSX, check for "key" attribute. Missing = negative. Index as key = negative. item.id = idiomatic.
**async-await-error-handling:** AwaitExpression not inside TryStatement = negative
**usestate-basics:** CallExpression callee.name === "useState", check array destructuring

### Framework Context Detection
React signals: React imports, hook usage (useState, useEffect), JSX elements

---

## Adaptive Teaching

### Scaffolding Levels
| Level | Rating | Approach |
|-------|--------|----------|
| HIGH | < 1400 | Supportive, break into steps, almost give answers |
| MEDIUM | 1400-1600 | Explain reasoning, synthesis questions |
| LOW | > 1600 | Minimal hints, architectural questions |

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
