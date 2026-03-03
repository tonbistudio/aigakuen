# RESEARCH_SPEC.md -- Knowledge Compilation Spec for Specialized Agents

Version: 1.3 (2026-03-03)
Status: Active -- validated against AI Gakuen head-to-head comparison

This spec defines how to research and compile domain knowledge for a hyper-specialized
OpenClaw agent. Follow it exactly. Generic tutorial content is useless here.

---

## Goal

Produce expert-level, immediately actionable knowledge that a senior developer
carries in their head -- not a beginner's guide, not a docs summary.

The test: would a senior engineer already know this? If yes, skip it.
The test: would this have prevented a real bug? If yes, include it.

---

## What You Are Building

Seven markdown files per domain:

| File | Purpose | Target Size |
|------|---------|-------------|
| `core-knowledge.md` | Mental models, how it actually works under the hood | 4-7KB |
| `api-reference.md` | Typed signatures + one-line "when to use" for every API | 4-8KB |
| `patterns.md` | The RIGHT way to do common things, with code | 6-10KB |
| `gotchas.md` | Specific bugs with severity ratings: symptom -> cause -> fix | 8-12KB |
| `community.md` | Aha moments, expert insights, decision frameworks | 6-10KB |
| `changelog.md` | Breaking changes, deprecations, migration paths, codemods | 6-10KB |
| `issues.md` | Real bugs from GitHub/SO with exact solutions | 8-14KB |

Total target: 45-70KB of dense, curated knowledge.

---

## Research Process (Follow This Order)

### Phase 1 -- Official API Reference
Fetch the official documentation for EVERY public API in the domain.

**Output -> api-reference.md**

For each API produce:
```
### apiName(param: Type, param2: Type): ReturnType
When to use: <one sentence>
When NOT to use: <one sentence>
```

Include: ALL hooks/functions including recent additions (e.g. React 19's useActionState,
use(), useOptimistic, useFormStatus, useId, useSyncExternalStore).

This is the factual backbone. An agent must be able to answer "what's the signature
for X's third argument?" without hallucinating. Do not skip this step.

### Phase 2 -- Changelog & Release Analysis
Fetch GitHub releases for the PRIMARY library AND its 2-3 most important ecosystem
libraries. Analyze the last 3 major versions of each.

**Output -> changelog.md**

For each library produce:
- Breaking changes with migration paths (include codemod commands where they exist)
- Deprecations with replacement APIs
- New features worth knowing
- Non-obvious "gotcha" side effects of version upgrades

Example scope for React Hooks: React 19, TanStack Query 5, Zustand 5, RTK 2
Example scope for Solana/Anchor: Anchor 0.30, @solana/web3.js 2.0, @solana/kit

Key insight: silent breakage is the most dangerous. Flag anything that fails
without an error (e.g. "PropTypes stop working silently in React 19 -- no warning
is emitted").

### Phase 3 -- Foundation (how it actually works)
- Official docs: advanced/internals sections only, not the quickstart
- Core contributor blog posts / conference talks
- GitHub README internals sections

**What to extract:**
- How does it work under the hood? (not "what does it do")
- What assumptions does it make that will bite you?
- The mental model that changes how you think about the tool

### Phase 4 -- Real Problems (what goes wrong)
Search these sources in order:

1. **GitHub Issues** -- search the main repo for: "bug", "unexpected", "broken", "regression"
   - Filter: closed issues with >3 comments (real problems that got solved)
   - Look for: issues where the fix was non-obvious

2. **Stack Overflow** -- search: "<topic> bug", "<topic> not working", "<topic> unexpected behavior"
   - Filter: answers with >10 upvotes
   - Look for: the "aha, THAT's why" answers

3. **Dev.to / Medium / personal blogs** -- search: "<topic> gotchas", "<topic> mistakes", "<topic> lessons learned"
   - Filter: posts from engineers with real production experience
   - Look for: "I spent 3 days on this" moments

4. **Twitter/X threads** -- search: "<topic> tip", "<topic> mistake"
   - Filter: threads with >100 likes

**Minimum:** 10 real bugs/solutions from external sources (not just docs)

### Phase 5 -- Ecosystem Patterns
Research patterns for the 2-3 most common companion libraries in the domain.
Do NOT treat the primary library in isolation -- real-world usage always involves
the ecosystem.

**Output -> patterns.md (ecosystem section)**

Example for React Hooks:
- TanStack Query: queryKey factories, server state separation pattern
- Zustand: create() + useShallow for object selectors, granular atom pattern
- Jotai: derived atoms, atom families

Example for Solana:
- Anchor + @solana/kit: account validation patterns
- Helius: webhook + indexing patterns

For each ecosystem pattern: what problem it solves, code example, gotchas specific
to how it interacts with the primary library.

### Phase 6 -- Expert Knowledge (what seniors know)
Search: "<topic> advanced", "<topic> internals", "<topic> deep dive"

Sources:
- Conference talks -- transcripts or summaries
- Official team blog posts
- Core contributor writing
- Well-known community experts

**What to extract:**
- Mental models that change how you think about the tool
- Things technically true but practically misleading in the docs
- Performance implications that aren't obvious

---

## Quality Standards

### Gotchas MUST have ALL of:
```
**[SEVERITY: CRITICAL|HIGH|MEDIUM]**
**Symptom:** What you observe going wrong (specific, not vague)
**Cause:** Why it happens (mechanistic explanation)
**Fix:** The exact solution with code
```

Severity guide:
- CRITICAL: causes silent data loss, security issues, or production breakage with no error
- HIGH: causes bugs that are hard to debug, common in real codebases
- MEDIUM: causes performance issues or confusing behavior, has a clear workaround

Bad gotcha: "Be careful with useEffect dependencies"
Good gotcha:
```
**[SEVERITY: HIGH]**
**Symptom:** useEffect runs on every render even though your data hasn't changed
**Cause:** Object/array dependency {} !== {} on each render in JavaScript
**Fix:** Destructure to primitives, or wrap with useMemo to stabilize the reference
```

### Patterns MUST have:
- A code snippet (even 3 lines is fine)
- Context for WHEN to use it (not just HOW)
- The anti-pattern it replaces

### API Reference MUST have:
- Full TypeScript signature
- One-line "when to use"
- One-line "when NOT to use" (this is often missing from docs)

### Changelog entries MUST have:
- Which version introduced the change
- Whether it's a silent break or throws an error
- Migration path (with codemod command if one exists)

### Issues MUST be:
- From a real source (GitHub issue URL, SO link, blog URL)
- Solved (we want the fix, not just the problem)
- Generalizable (teaches a principle, not just one typo)

---

## Decision Frameworks (Required)

Every knowledge base MUST include at least one decision framework in community.md.
This is the most common "which approach do I use?" question in the domain, expressed
as a decision tree or flowchart in text form.

Example for React Hooks state management:
```
Where does this state live?
  -> Server data (fetched from API)? -> TanStack Query
  -> Shared across many components? -> Zustand / Jotai
  -> Complex transitions/state machine? -> useReducer
  -> Simple local UI state? -> useState
  -> Derived from other state? -> useMemo (don't store it)
```

Also include: a pre-flight checklist for the most commonly misused API.
Example: "Before You Write useEffect" checklist.

---

## SSR/Server Considerations (Required)

Every knowledge base MUST explicitly address server-side rendering implications,
even if the domain seems client-only. Add a section to gotchas.md:

- What breaks in SSR that works in CSR?
- What causes hydration mismatches?
- What APIs are unavailable server-side?

---

## What to SKIP

- Anything in the official "Getting Started" / quickstart
- Generic advice ("always test your code", "read the docs")
- Bugs caused by typos or obvious mistakes
- Content that's just rephrasing the official docs
- Anything older than 3 years unless it's a foundational principle
- Version-specific workarounds for versions < 2 years old

---

## Hard Rules (Do Not Violate)

These are anti-patterns validated in head-to-head testing. Do not regress on any of these.

### 1. No prose-only patterns
Every pattern MUST have a fenced code block. Description alone is not enough.
An agent reading "use functional updates to avoid stale state" cannot help a user
without seeing what that actually looks like in code.

Bad:
```
Use functional updates when the new state depends on the old state.
```

Good:
```
Use functional updates when the new state depends on the old state:
\`\`\`js
// BAD -- stale closure risk
setCount(count + 1);

// GOOD -- always uses latest state
setCount(prev => prev + 1);
\`\`\`
```

### 2. Every issue MUST have a source URL
If you analyzed a GitHub issue, link it. If you found a bug on Stack Overflow, link it.
"Analyzed 20 issues" with zero URLs is useless -- the agent can't verify, dig deeper,
or point a user to the original context.

Format:
```
**Source:** https://github.com/facebook/react/issues/12345
```

No URL = don't include the issue. Find one that you can actually cite.

### 3. No redundant JSON files
If machine-readable output is needed, produce ONE clean JSON file, not two overlapping
ones (e.g. raw-knowledge.json + core-knowledge.json). The markdown files ARE the output.
JSON is only needed if the build pipeline explicitly requires it downstream.

---

## Output Format

Each file starts with:
```
<!-- Domain: <name> | Version: <library@version> | Compiled: YYYY-MM-DD | Sources: N -->
```

**core-knowledge.md:**
- ## Mental Model
- ## How It Actually Works
- ## Key Abstractions
- ## Version Notes

**api-reference.md:**
- ## [API Name] (one section per hook/function)

**patterns.md:**
- ## Core Patterns
- ## Ecosystem Patterns (TanStack Query / Zustand / etc.)
- Each pattern: When to use / Code example / Anti-pattern

**gotchas.md:**
- ## [Short Title] [SEVERITY] (one section per gotcha)
- ## SSR / Hydration Gotchas (dedicated section)

**community.md:**
- ## Aha Moments
- ## Expert Insights
- ## Decision Framework: [Most Common Question]
- ## Pre-flight Checklist: [Most Misused API]
- ## Common Misconceptions

**changelog.md:**
- ## [Library Name] (one section per library)
  - Breaking Changes / Deprecations / New Features / Migration Tips

**issues.md:**
- ## [Short Title] (one section per issue)
  - Source / Problem / Root Cause / Solution

---

## Domain Type Classification

Before researching, classify the domain. The type determines which research phases
to emphasize and which sources to prioritize.

---

### Type A: Technical Stack Domain
*Examples: React Native, Expo, Solana/Anchor, Supabase RLS, React Hooks*

These are libraries, frameworks, APIs — things with source code, changelogs, GitHub issues.

**Emphasis:**
- Phase 1 (API Reference) — critical, do thoroughly
- Phase 2 (Changelog) — critical, breaking changes matter
- Phase 4 (Real Bugs) — GitHub issues are primary source
- Phase 5 (Ecosystem) — companion libraries essential

**Primary sources:** Official docs, GitHub issues, Stack Overflow, core contributor blogs
**Key output:** api-reference.md, changelog.md are mandatory
**Quality test:** Would this have prevented a real bug in production code?

---

### Type B: Product / Domain Knowledge
*Examples: iOS Education Apps, Gamification, App Store compliance, SaaS onboarding*

These are disciplines, not APIs. No changelog, no typed signatures. The knowledge is
about what works, what doesn't, what the gatekeepers require.

**Emphasis:**
- Phase 1 (API Reference) — SKIP or minimal (no APIs to document)
- Phase 2 (Changelog) — replace with: platform policy updates (App Store guidelines version history, relevant policy changes)
- Phase 3 (Mental Models) — critical: what frameworks do practitioners use to think about this?
- Phase 4 (Real Problems) — shift sources (see below)
- Phase 5 (Ecosystem) — replace with: successful product examples and teardowns

**Primary sources:**
- Community: Reddit (r/learnreactnative, r/indiegaming, relevant subs), Hacker News threads, indie dev blogs
- Platform requirements: App Store Review Guidelines, Google Play policy docs
- Product teardowns: how do successful apps in this space actually work?
- Practitioner writing: product managers, UX researchers, indie devs who shipped in this space
- Research: HCI papers, learning science for education domains, conversion research for monetization

**Replace api-reference.md with: requirements.md**
```
requirements.md -- platform requirements, compliance checklist, submission gotchas
```

**Replace changelog.md with: patterns-and-precedents.md**
```
patterns-and-precedents.md -- what successful products do, with named examples
(e.g. "Duolingo streak mechanic", "Khan Academy mastery-based progression")
```

**Key output:** community.md and patterns.md are the most valuable files
**Quality test:** Would this help someone ship a better product / avoid a rejection / make a design decision?

**Gotcha format for Type B:**
```
**[SEVERITY: CRITICAL|HIGH|MEDIUM]**
**Situation:** When does this come up?
**Common mistake:** What do people do wrong?
**Better approach:** What actually works?
**Example:** Real product or case (named if possible)
```

---

### Type C: Mixed Domain
*Examples: Expo (tech) + iOS Education (product) in one agent*

When an agent covers both Type A and Type B domains, apply the appropriate
research approach per domain. Do not use GitHub issues as the primary source
for product domains just because the agent also has tech domains.

Each domain folder gets researched according to its type:
```
knowledge/
  react-native/    <- Type A approach
  expo/            <- Type A approach
  ios-education/   <- Type B approach
```

The MEMORY.md domain map should note the type for each domain so the agent
knows which kind of knowledge to expect when it opens a folder.

---

## Domain-Specific Notes

*(Fill this in before spawning the research sub-agent)*

Example for React Hooks:
- Primary: React 19
- Ecosystem: TanStack Query 5, Zustand 5, Jotai 2, RTK 2
- Focus: hooks execution model, closure problems, React 18/19 migration
- Key sources: react.dev, Dan Abramov's writing, @tkdodo (TkDodo's blog), Robin Wieruch

Example for Solana/Anchor:
- Primary: Anchor 0.30
- Ecosystem: @solana/kit, Helius, Jupiter
- Focus: account model, PDAs, CPI patterns, IDL gotchas
- Key sources: Anchor GitHub issues, Coral blog, Helius docs, Armani Ferrante writing

---

## Iteration Notes

### v1.0 -- 2026-03-03
- Won head-to-head vs AI Gakuen React Hooks output ("not particularly close")
- Missing: api-reference.md, changelog.md, severity ratings, decision frameworks, SSR section, ecosystem patterns

### v1.1 -- 2026-03-03
- Added: api-reference.md (Phase 1), changelog.md with ecosystem scope (Phase 2)
- Added: ecosystem patterns research (Phase 5)
- Added: severity ratings on gotchas (CRITICAL/HIGH/MEDIUM)
- Added: decision frameworks requirement
- Added: SSR/hydration section requirement
- Updated: output from 5 files to 7 files
- Source: AI Gakuen second-run comparison analysis

### v1.3 -- 2026-03-03
- Added: Sub-Agent Sizing section with hard limit (one domain per sub-agent)
- Root cause: first iOS agent run timed out because 3 domains × 7 files = 21 files exceeded 15min window
- Fix: spawn one sub-agent per domain, check output, follow-up for missing files
- Added: file count reference (Type A = 7 files, Type B = 6 files)
- Added: recommended spawn pattern for multi-domain agents

### v1.2 -- 2026-03-03
- Added: Domain Type Classification (Type A: Tech Stack, Type B: Product/Domain, Type C: Mixed)
- Type B replaces api-reference.md with requirements.md, changelog.md with patterns-and-precedents.md
- Type B shifts primary sources to community, platform policy, product teardowns
- Type B gotcha format adjusted for product/UX decisions vs code bugs
- Trigger: iOS Education App agent design (mixed domain: RN/Expo + education UX)

### v1.1 Hard Rules addendum -- 2026-03-03
- Confirmed advantage: fenced code blocks for every pattern (Set B superior, do not regress)
- Confirmed advantage: per-issue source URLs (Set B superior, do not regress)
- Confirmed anti-pattern: dual redundant JSON files (raw + core) -- produce markdown only
- Source: final AI Gakuen comparison verdict

---

## Sub-Agent Sizing (Avoid Timeouts)

Sub-agents have a ~15 minute execution window. Exceeding it causes partial output.
Scope tasks carefully to fit within this limit.

### Rules for scoping research tasks:

**One domain per sub-agent (hard limit)**
Never give a sub-agent more than one domain to research. A single Type A domain
(7 files, ~80-120KB output) already uses most of the available window.

**Type A domain = one sub-agent**
7 files per domain. Expected runtime: 10-14 minutes. Do not combine with other domains.

**Type B domain = one sub-agent**
6 files per domain. Expected runtime: 8-12 minutes. Do not combine with Type A domains.

**Multi-domain agents = multiple sequential sub-agents**
For an agent with 3 domains, spawn 3 sub-agents, one per domain.
Wait for each to complete before spawning the next (or spawn in parallel if confident
in sizing — parallel risks all timing out simultaneously).

**If a sub-agent times out:**
- Check what files were written (some output may be complete)
- Spawn a follow-up sub-agent for ONLY the missing files
- Be explicit in the follow-up prompt: "These files already exist, only write these missing ones: ..."

### Recommended spawn pattern for multi-domain agents:

```
Agent: ios-specialist (3 domains)

Sub-agent 1: react-native domain only (Type A, 7 files)
Sub-agent 2: expo domain only (Type A, 7 files)  
Sub-agent 3: ios-process domain only (Type B, 6 files)

Spawn sequentially or in parallel -- parallel is faster but riskier.
If parallel, monitor and re-run any that timeout.
```

### File count reference:
- Type A: 7 files (core-knowledge, api-reference, patterns, gotchas, community, changelog, issues)
- Type B: 6 files (core-knowledge, requirements, patterns, gotchas, community, patterns-and-precedents)

---

## Usage

1. Copy this spec
2. Fill in the Domain-Specific Notes section for your target domain
3. Spawn ONE sub-agent per domain (not one for all domains)
4. Sub-agent treats quality standards and "what to skip" as hard rules
5. Check output after each run — spawn follow-ups for any missing files

The sub-agent should NOT summarize what it found -- it should produce the files
directly in the specified format, ready to drop into the agent workspace.
