/**
 * Knowledge Synthesizer
 *
 * Takes raw knowledge from multiple sources and synthesizes it into
 * expert-level core knowledge (mental model, patterns, gotchas).
 */

import { prompt, analyzeWithSchema } from '../../claude';
import type {
  RawKnowledge,
  CoreKnowledge,
  Pattern,
  Gotcha,
  DomainInfo,
  IntegrationHazard,
  Contract,
  StateFlowRule,
  TimingRule,
} from './types';

// Simpler schema for fallback when full schema causes truncation
const ESSENTIAL_KNOWLEDGE_SCHEMA = `{
  "mentalModel": "string - 300-500 word explanation of core concepts and how they relate",
  "goldenPatterns": [
    {
      "name": "string - pattern name",
      "whenToUse": "string - when to use this pattern",
      "implementation": "string - how to implement",
      "whyItWorks": "string - why it works",
      "watchOutFor": "string - common mistakes"
    }
  ],
  "criticalGotchas": [
    {
      "title": "string - short title",
      "trap": "string - what developers do wrong",
      "consequence": "string - what happens",
      "fix": "string - how to fix",
      "severity": "'critical' | 'high' | 'medium'"
    }
  ],
  "decisionFramework": "string - 100-200 word guide for making decisions"
}`;

const CORE_KNOWLEDGE_SCHEMA = `{
  "mentalModel": "string - 500-1000 word explanation including BOTH component thinking AND system thinking",
  "goldenPatterns": [
    {
      "name": "string - pattern name",
      "whenToUse": "string - context/conditions for using this pattern",
      "implementation": "string - how to implement (pseudocode or key steps)",
      "whyItWorks": "string - the underlying principle",
      "watchOutFor": "string - common mistakes with this pattern",
      "conflictsWith": ["string - patterns/approaches this CANNOT coexist with (optional)"],
      "synergiesWith": ["string - patterns that work well together (optional)"],
      "contracts": {
        "requires": ["string - preconditions (optional)"],
        "guarantees": ["string - what this promises to consumers (optional)"],
        "sideEffects": ["string - what else changes (optional)"]
      },
      "crossLayerConcerns": ["string - timing/state sync across boundaries (optional)"]
    }
  ],
  "criticalGotchas": [
    {
      "title": "string - short descriptive title",
      "trap": "string - what developers commonly do wrong",
      "consequence": "string - what bad thing happens",
      "fix": "string - how to do it right",
      "severity": "'critical' | 'high' | 'medium'",
      "category": "'isolated' | 'integration' | 'timing' | 'state-flow' | 'contract-violation' (optional)",
      "relatedPatterns": ["string - patterns that trigger this (optional)"],
      "emergentFrom": ["string - what combination creates this bug (optional)"],
      "detectionStrategy": "string - how to catch this BEFORE it happens (optional)"
    }
  ],
  "decisionFramework": "string - 200-400 word guide for making decisions in this domain",
  "integrationHazards": [
    {
      "name": "string - hazard name",
      "components": ["string - what things interact dangerously"],
      "hazard": "string - what goes wrong",
      "symptoms": ["string - how it manifests"],
      "detection": "string - how to catch it early",
      "prevention": "string - how to avoid it"
    }
  ],
  "contractDefinitions": [
    {
      "provider": "string - what provides this contract",
      "requires": ["string - preconditions"],
      "guarantees": ["string - what it promises"],
      "violations": ["string - common ways contract gets broken"],
      "enforcement": "string - how to enforce (types, tests, lint)"
    }
  ],
  "stateFlowRules": [
    {
      "name": "string - rule name",
      "rule": "string - the invariant that must hold",
      "violation": "string - what happens when violated",
      "commonCauses": ["string - typical violating patterns"],
      "detection": "string - how to detect violations"
    }
  ],
  "timingCoordination": [
    {
      "name": "string - rule name",
      "layers": ["string - what layers are involved"],
      "coordination": "string - how timing must sync",
      "mismatchSymptoms": ["string - what happens when out of sync"],
      "solution": "string - how to keep coordinated"
    }
  ]
}`;

/**
 * Build a simplified synthesis prompt for retry (shorter, fewer requirements)
 */
function buildSimplifiedSynthesisPrompt(domain: DomainInfo, rawKnowledge: RawKnowledge): string {
  // Build a truncated context to reduce input size
  const truncatedContext = buildKnowledgeContext(rawKnowledge).slice(0, 8000);

  return `Synthesize expert knowledge for: "${domain.name}"

Technologies: ${domain.technologies.join(', ')}

KNOWLEDGE CONTEXT (truncated):
${truncatedContext}

---

Create a CONCISE JSON with:
1. mentalModel: 300-500 words explaining core concepts
2. goldenPatterns: 3-5 essential patterns (name, whenToUse, implementation, whyItWorks, watchOutFor)
3. criticalGotchas: 3-5 gotchas (title, trap, consequence, fix, severity)
4. decisionFramework: 100-200 words on decision-making

IMPORTANT: Keep responses SHORT to avoid truncation. Quality over quantity.
Output ONLY valid JSON matching the schema.`;
}

/**
 * Synthesize raw knowledge into core expert knowledge
 */
export async function synthesizeKnowledge(
  domain: DomainInfo,
  rawKnowledge: RawKnowledge
): Promise<CoreKnowledge> {
  // Build comprehensive context from all sources
  const knowledgeContext = buildKnowledgeContext(rawKnowledge);

  const synthesisPrompt = `You are synthesizing knowledge to create an OBSESSIVE EXPERT in: "${domain.name}"

Description: ${domain.description}
Technologies: ${domain.technologies.join(', ')}

---
RAW KNOWLEDGE FROM RESEARCH:
${knowledgeContext}
---

Your task is to synthesize this into EXPERT knowledge with BOTH component-level AND system-level thinking.

## 1. MENTAL MODEL (500-1000 words)
Write a comprehensive explanation including TWO perspectives:

A) COMPONENT THINKING:
- Core concepts and how they relate
- Analogies that illuminate key ideas
- The "secret insight" that separates experts from beginners

B) SYSTEM THINKING:
- How do patterns in this domain INTERACT with each other?
- What are the invisible CONTRACTS that must be maintained?
- Where do TIMING and SYNCHRONIZATION issues emerge?
- What are the "seams" where INTEGRATION BUGS hide?
- How do you trace STATE FLOW to detect cycles?

## 2. GOLDEN PATTERNS (3-7 patterns)
Each pattern MUST include system-focused fields:

{
  "name": "Pattern Name",
  "whenToUse": "Context/conditions",
  "implementation": "How to implement",
  "whyItWorks": "Underlying principle",
  "watchOutFor": "Common mistakes",
  "conflictsWith": ["Patterns/approaches this CANNOT coexist with"],
  "synergiesWith": ["Patterns that work well together"],
  "contracts": {
    "requires": ["Preconditions that must be true"],
    "guarantees": ["What this promises to consumers"],
    "sideEffects": ["What else changes"]
  },
  "crossLayerConcerns": ["Timing/state concerns across CSS/JS/API boundaries"]
}

## 3. CRITICAL GOTCHAS (3-10 gotchas)
Include BOTH isolated gotchas AND integration gotchas. Each gotcha MUST specify its category:

{
  "title": "Short title",
  "trap": "What developers do wrong",
  "consequence": "What bad thing happens",
  "fix": "How to do it right",
  "severity": "critical|high|medium",
  "category": "isolated|integration|timing|state-flow|contract-violation",
  "relatedPatterns": ["Which patterns trigger this"],
  "emergentFrom": ["What combination creates this bug"],
  "detectionStrategy": "How to catch this BEFORE it happens (lint rules, code review checklist, tests)"
}

REQUIRED: At least 2 gotchas with category "integration" or "timing" or "state-flow".

## 4. DECISION FRAMEWORK (200-400 words)
Include system-level decision criteria:
- How to evaluate pattern interactions
- How to trace state flow for cycles
- How to coordinate timing across layers

## 5. INTEGRATION HAZARDS (2-4 hazards)
What dangerous combinations exist? What breaks when correct patterns are combined incorrectly?

{
  "name": "Hazard Name",
  "components": ["Thing A", "Thing B that conflicts"],
  "hazard": "What goes wrong when combined",
  "symptoms": ["How it manifests"],
  "detection": "How to catch early",
  "prevention": "How to avoid"
}

## 6. CONTRACT DEFINITIONS (2-4 contracts)
What must each pattern/hook/function GUARANTEE to consumers?

{
  "provider": "What provides this contract (e.g., 'Custom React Hook')",
  "requires": ["Preconditions"],
  "guarantees": ["What it promises"],
  "violations": ["Common ways contract is broken"],
  "enforcement": "How to enforce (types, tests, lint rules)"
}

## 7. STATE FLOW RULES (1-3 rules)
What invariants must hold for state updates? How to detect cycles?

{
  "name": "Rule Name",
  "rule": "The invariant that must hold",
  "violation": "What happens when violated (e.g., infinite loop)",
  "commonCauses": ["Code patterns that violate this"],
  "detection": "How to detect (trace deps, look for X pattern)"
}

## 8. TIMING COORDINATION (1-3 rules)
How must different layers (CSS, JS, API) coordinate timing?

{
  "name": "Rule Name",
  "layers": ["CSS transitions", "JavaScript"],
  "coordination": "How timing must be synchronized",
  "mismatchSymptoms": ["What happens when out of sync"],
  "solution": "How to keep coordinated"
}

---

CRITICAL REQUIREMENTS:
- Every pattern must include conflictsWith, contracts, or crossLayerConcerns
- Every gotcha must include category and detectionStrategy
- At least 2 integration hazards identifying dangerous pattern combinations
- At least 2 contracts defining what components guarantee
- Be specific with code patterns, API names, and technical details
- Think about what bugs emerge from COMPOSITION, not just isolation

Respond with JSON matching the schema.`;

  try {
    const result = await analyzeWithSchema<CoreKnowledge>(
      synthesisPrompt,
      CORE_KNOWLEDGE_SCHEMA,
      { metricsPhase: 'synthesis' }
    );

    // Validate and normalize the result
    let knowledge = normalizeCoreKnowledge(result);

    // Check if patterns need enrichment (if they have empty fields)
    const incompletePatterns = knowledge.goldenPatterns.filter(
      (p) => !p.whenToUse || !p.implementation || !p.whyItWorks
    );

    if (incompletePatterns.length > 0 && knowledge.goldenPatterns.length > 0) {
      console.log('Enriching incomplete patterns...');
      knowledge = await enrichPatterns(domain, knowledge);
    }

    // Second pass: generate prose if structured data succeeded but prose failed
    knowledge = await enrichProseIfNeeded(domain, knowledge);

    return knowledge;
  } catch (error) {
    console.error('Error with full synthesis, trying simplified schema...', error);

    // Retry with simpler schema
    try {
      const simplifiedPrompt = buildSimplifiedSynthesisPrompt(domain, rawKnowledge);
      const result = await analyzeWithSchema<CoreKnowledge>(
        simplifiedPrompt,
        ESSENTIAL_KNOWLEDGE_SCHEMA,
        { metricsPhase: 'synthesis-retry' }
      );

      console.log('Simplified synthesis succeeded');
      let knowledge = normalizeCoreKnowledge(result);

      // Second pass: generate prose from structured data
      knowledge = await enrichProseIfNeeded(domain, knowledge);

      return knowledge;
    } catch (retryError) {
      console.error('Simplified synthesis also failed:', retryError);
      // Return minimal fallback
      return fallbackCoreKnowledge(domain);
    }
  }
}

/**
 * Enrich prose (mental model, decision framework) if structured data exists but prose failed
 */
async function enrichProseIfNeeded(
  domain: DomainInfo,
  knowledge: CoreKnowledge
): Promise<CoreKnowledge> {
  const proseFailed = knowledge.mentalModel.includes('could not be synthesized') ||
    knowledge.decisionFramework.includes('could not be synthesized');
  const hasStructuredData = knowledge.goldenPatterns.length >= 2 || knowledge.criticalGotchas.length >= 2;

  if (proseFailed && hasStructuredData) {
    console.log('Generating prose from structured knowledge...');
    const prose = await generateProseFromStructuredKnowledge(
      domain,
      knowledge.goldenPatterns,
      knowledge.criticalGotchas,
      knowledge.integrationHazards
    );

    if (prose.mentalModel && prose.mentalModel.length > 100) {
      knowledge.mentalModel = prose.mentalModel;
    }
    if (prose.decisionFramework && prose.decisionFramework.length > 50) {
      knowledge.decisionFramework = prose.decisionFramework;
    }
  }

  return knowledge;
}

/**
 * Second-pass enrichment for patterns that came back incomplete
 */
async function enrichPatterns(
  domain: DomainInfo,
  knowledge: CoreKnowledge
): Promise<CoreKnowledge> {
  const patternNames = knowledge.goldenPatterns.map((p) => p.name);

  const enrichPrompt = `For the domain "${domain.name}", provide detailed information for these patterns:

${patternNames.map((name, i) => `${i + 1}. ${name}`).join('\n')}

For EACH pattern, provide:
- whenToUse: Specific conditions/contexts when this pattern applies
- implementation: Step-by-step how to implement it (pseudocode or key steps)
- whyItWorks: The underlying principle that makes it effective
- watchOutFor: Common mistakes when applying this pattern

Return JSON array with the same pattern names but filled-in details:
[
  {
    "name": "Pattern Name",
    "whenToUse": "...",
    "implementation": "...",
    "whyItWorks": "...",
    "watchOutFor": "..."
  }
]

Be specific and technical. Respond with ONLY the JSON array.`;

  try {
    const response = await prompt(enrichPrompt, {
      system: `You are an expert in ${domain.name}. Provide detailed, actionable pattern descriptions.`,
      metricsPhase: 'enrichPatterns',
    });

    // Parse response
    let jsonStr = response.trim();
    if (jsonStr.startsWith('```')) {
      jsonStr = jsonStr.replace(/```json?\n?/g, '').replace(/```/g, '').trim();
    }

    const enrichedPatterns = JSON.parse(jsonStr);

    if (Array.isArray(enrichedPatterns)) {
      // Merge enriched data back into patterns
      const updatedPatterns = knowledge.goldenPatterns.map((p) => {
        const enriched = enrichedPatterns.find(
          (e: Record<string, unknown>) => e.name === p.name
        );
        if (enriched) {
          return {
            name: p.name,
            whenToUse: enriched.whenToUse || p.whenToUse || '',
            implementation: enriched.implementation || p.implementation || '',
            whyItWorks: enriched.whyItWorks || p.whyItWorks || '',
            watchOutFor: enriched.watchOutFor || p.watchOutFor || '',
          };
        }
        return p;
      });

      return {
        ...knowledge,
        goldenPatterns: updatedPatterns,
      };
    }
  } catch (error) {
    console.error('Error enriching patterns:', error);
  }

  return knowledge;
}

/**
 * Build context string from raw knowledge
 */
function buildKnowledgeContext(raw: RawKnowledge): string {
  const sections: string[] = [];

  // Documentation
  if (raw.documentation.rawContent || raw.documentation.concepts.length > 0) {
    sections.push(`## DOCUMENTATION (from ${raw.documentation.source})

**Concepts:**
${raw.documentation.concepts.map((c) => `- ${c}`).join('\n') || 'None extracted'}

**API Reference:**
${raw.documentation.apiReference || 'None extracted'}

**Recommended Patterns:**
${raw.documentation.patterns.map((p) => `- ${p}`).join('\n') || 'None extracted'}

**Warnings from Docs:**
${raw.documentation.warnings.map((w) => `- ${w}`).join('\n') || 'None extracted'}

**Raw Content:**
${truncate(raw.documentation.rawContent, 2000)}`);
  }

  // Issues
  if (raw.issues.problemSolutions.length > 0 || raw.issues.commonProblems.length > 0) {
    const topProblems = raw.issues.problemSolutions.slice(0, 10);
    sections.push(`## GITHUB ISSUES (${raw.issues.totalAnalyzed} analyzed)

**Problem-Solution Pairs:**
${topProblems.map((ps) => `- Symptom: ${ps.symptom}
  Root cause: ${ps.rootCause}
  Solution: ${ps.solution}
  Prevention: ${ps.prevention}`).join('\n\n') || 'None extracted'}

**Common Problems:**
${raw.issues.commonProblems.map((p) => `- ${p}`).join('\n') || 'None extracted'}

**Workarounds:**
${raw.issues.workarounds.map((w) => `- ${w}`).join('\n') || 'None extracted'}`);
  }

  // Changelog
  if (raw.changelog.breakingChanges.length > 0 || raw.changelog.deprecations.length > 0) {
    sections.push(`## CHANGELOG & RELEASES

**Breaking Changes:**
${raw.changelog.breakingChanges.map((bc) => `- ${bc.version}: ${bc.description}
  Migration: ${bc.migration}${bc.gotcha ? `\n  Gotcha: ${bc.gotcha}` : ''}`).join('\n\n') || 'None extracted'}

**Deprecations:**
${raw.changelog.deprecations.map((d) => `- ${d.what} → ${d.replacedBy}${d.removeVersion ? ` (removed in ${d.removeVersion})` : ''}${d.reason ? `\n  Reason: ${d.reason}` : ''}`).join('\n\n') || 'None extracted'}

**Recent Features:**
${raw.changelog.recentFeatures.map((f) => `- ${f}`).join('\n') || 'None extracted'}

**Migration Tips:**
${raw.changelog.migrationTips.map((t) => `- ${t}`).join('\n') || 'None extracted'}`);
  }

  // Community
  if (raw.community.blogInsights.length > 0 || raw.community.stackOverflowSolutions.length > 0) {
    sections.push(`## COMMUNITY KNOWLEDGE

**Blog Insights:**
${raw.community.blogInsights.slice(0, 10).map((b) => `- ${b}`).join('\n') || 'None extracted'}

**Stack Overflow Solutions:**
${raw.community.stackOverflowSolutions.slice(0, 10).map((s) => `- ${s}`).join('\n') || 'None extracted'}

**Best Practices:**
${raw.community.bestPractices.slice(0, 10).map((p) => `- ${p}`).join('\n') || 'None extracted'}

**Aha Moments:**
${raw.community.ahaMoments.slice(0, 10).map((a) => `- ${a}`).join('\n') || 'None extracted'}`);
  }

  // Source Code
  if (raw.sourceCode) {
    sections.push(`## SOURCE CODE ANALYSIS (${raw.sourceCode.repoUrl})

**Architecture:**
${truncate(raw.sourceCode.architecture, 500)}

**Undocumented Behaviors:**
${raw.sourceCode.undocumentedBehaviors.slice(0, 8).map((b) => `- ${b}`).join('\n') || 'None found'}

**Internal Patterns:**
${raw.sourceCode.internalPatterns.slice(0, 8).map((p) => `- ${p}`).join('\n') || 'None found'}

**Code Comment Insights:**
${raw.sourceCode.codeCommentInsights.slice(0, 8).map((c) => `- ${c}`).join('\n') || 'None found'}

**Edge Cases:**
${raw.sourceCode.edgeCases.slice(0, 8).map((e) => `- ${e}`).join('\n') || 'None found'}`);
  }

  return sections.join('\n\n---\n\n') || 'No knowledge gathered from sources.';
}

/**
 * Normalize and validate core knowledge
 */
function normalizeCoreKnowledge(result: unknown): CoreKnowledge {
  if (!result || typeof result !== 'object') {
    throw new Error('Invalid core knowledge result');
  }

  const r = result as Record<string, unknown>;

  // Validate mental model
  const mentalModel = typeof r.mentalModel === 'string' && r.mentalModel.length > 100
    ? r.mentalModel
    : 'Mental model could not be synthesized.';

  // Validate patterns
  const goldenPatterns: Pattern[] = Array.isArray(r.goldenPatterns)
    ? r.goldenPatterns.map(normalizePattern).filter(Boolean) as Pattern[]
    : [];

  // Validate gotchas
  const criticalGotchas: Gotcha[] = Array.isArray(r.criticalGotchas)
    ? r.criticalGotchas.map(normalizeGotcha).filter(Boolean) as Gotcha[]
    : [];

  // Validate decision framework
  const decisionFramework = typeof r.decisionFramework === 'string' && r.decisionFramework.length > 50
    ? r.decisionFramework
    : 'Decision framework could not be synthesized.';

  // Validate system-focused fields (optional)
  const integrationHazards: IntegrationHazard[] = Array.isArray(r.integrationHazards)
    ? r.integrationHazards.map(normalizeIntegrationHazard).filter(Boolean) as IntegrationHazard[]
    : [];

  const contractDefinitions: Contract[] = Array.isArray(r.contractDefinitions)
    ? r.contractDefinitions.map(normalizeContract).filter(Boolean) as Contract[]
    : [];

  const stateFlowRules: StateFlowRule[] = Array.isArray(r.stateFlowRules)
    ? r.stateFlowRules.map(normalizeStateFlowRule).filter(Boolean) as StateFlowRule[]
    : [];

  const timingCoordination: TimingRule[] = Array.isArray(r.timingCoordination)
    ? r.timingCoordination.map(normalizeTimingRule).filter(Boolean) as TimingRule[]
    : [];

  return {
    mentalModel,
    goldenPatterns,
    criticalGotchas,
    decisionFramework,
    integrationHazards: integrationHazards.length > 0 ? integrationHazards : undefined,
    contractDefinitions: contractDefinitions.length > 0 ? contractDefinitions : undefined,
    stateFlowRules: stateFlowRules.length > 0 ? stateFlowRules : undefined,
    timingCoordination: timingCoordination.length > 0 ? timingCoordination : undefined,
  };
}

function normalizePattern(pattern: unknown): Pattern | null {
  if (!pattern || typeof pattern !== 'object') {
    return null;
  }
  const p = pattern as Record<string, unknown>;

  if (typeof p.name !== 'string' || !p.name) {
    return null;
  }

  const result: Pattern = {
    name: p.name,
    whenToUse: typeof p.whenToUse === 'string' ? p.whenToUse : '',
    implementation: typeof p.implementation === 'string' ? p.implementation : '',
    whyItWorks: typeof p.whyItWorks === 'string' ? p.whyItWorks : '',
    watchOutFor: typeof p.watchOutFor === 'string' ? p.watchOutFor : '',
  };

  // System-focused fields (optional)
  if (Array.isArray(p.conflictsWith) && p.conflictsWith.length > 0) {
    result.conflictsWith = p.conflictsWith.filter((x): x is string => typeof x === 'string');
  }
  if (Array.isArray(p.synergiesWith) && p.synergiesWith.length > 0) {
    result.synergiesWith = p.synergiesWith.filter((x): x is string => typeof x === 'string');
  }
  if (p.contracts && typeof p.contracts === 'object') {
    const c = p.contracts as Record<string, unknown>;
    result.contracts = {
      requires: Array.isArray(c.requires) ? c.requires.filter((x): x is string => typeof x === 'string') : undefined,
      guarantees: Array.isArray(c.guarantees) ? c.guarantees.filter((x): x is string => typeof x === 'string') : undefined,
      sideEffects: Array.isArray(c.sideEffects) ? c.sideEffects.filter((x): x is string => typeof x === 'string') : undefined,
    };
  }
  if (Array.isArray(p.crossLayerConcerns) && p.crossLayerConcerns.length > 0) {
    result.crossLayerConcerns = p.crossLayerConcerns.filter((x): x is string => typeof x === 'string');
  }

  return result;
}

function normalizeGotcha(gotcha: unknown): Gotcha | null {
  if (!gotcha || typeof gotcha !== 'object') {
    return null;
  }
  const g = gotcha as Record<string, unknown>;

  if (typeof g.title !== 'string' || !g.title) {
    return null;
  }

  const validSeverities = ['critical', 'high', 'medium'];
  const severity = validSeverities.includes(g.severity as string)
    ? (g.severity as 'critical' | 'high' | 'medium')
    : 'medium';

  const validCategories = ['isolated', 'integration', 'timing', 'state-flow', 'contract-violation'];
  const category = validCategories.includes(g.category as string)
    ? (g.category as 'isolated' | 'integration' | 'timing' | 'state-flow' | 'contract-violation')
    : undefined;

  const result: Gotcha = {
    title: g.title,
    trap: typeof g.trap === 'string' ? g.trap : '',
    consequence: typeof g.consequence === 'string' ? g.consequence : '',
    fix: typeof g.fix === 'string' ? g.fix : '',
    severity,
  };

  // System-focused fields (optional)
  if (category) {
    result.category = category;
  }
  if (Array.isArray(g.relatedPatterns) && g.relatedPatterns.length > 0) {
    result.relatedPatterns = g.relatedPatterns.filter((x): x is string => typeof x === 'string');
  }
  if (Array.isArray(g.emergentFrom) && g.emergentFrom.length > 0) {
    result.emergentFrom = g.emergentFrom.filter((x): x is string => typeof x === 'string');
  }
  if (typeof g.detectionStrategy === 'string' && g.detectionStrategy) {
    result.detectionStrategy = g.detectionStrategy;
  }

  return result;
}

function normalizeIntegrationHazard(hazard: unknown): IntegrationHazard | null {
  if (!hazard || typeof hazard !== 'object') {
    return null;
  }
  const h = hazard as Record<string, unknown>;

  if (typeof h.name !== 'string' || !h.name) {
    return null;
  }

  return {
    name: h.name,
    components: Array.isArray(h.components) ? h.components.filter((x): x is string => typeof x === 'string') : [],
    hazard: typeof h.hazard === 'string' ? h.hazard : '',
    symptoms: Array.isArray(h.symptoms) ? h.symptoms.filter((x): x is string => typeof x === 'string') : [],
    detection: typeof h.detection === 'string' ? h.detection : '',
    prevention: typeof h.prevention === 'string' ? h.prevention : '',
  };
}

function normalizeContract(contract: unknown): Contract | null {
  if (!contract || typeof contract !== 'object') {
    return null;
  }
  const c = contract as Record<string, unknown>;

  if (typeof c.provider !== 'string' || !c.provider) {
    return null;
  }

  return {
    provider: c.provider,
    requires: Array.isArray(c.requires) ? c.requires.filter((x): x is string => typeof x === 'string') : [],
    guarantees: Array.isArray(c.guarantees) ? c.guarantees.filter((x): x is string => typeof x === 'string') : [],
    violations: Array.isArray(c.violations) ? c.violations.filter((x): x is string => typeof x === 'string') : [],
    enforcement: typeof c.enforcement === 'string' ? c.enforcement : '',
  };
}

function normalizeStateFlowRule(rule: unknown): StateFlowRule | null {
  if (!rule || typeof rule !== 'object') {
    return null;
  }
  const r = rule as Record<string, unknown>;

  if (typeof r.name !== 'string' || !r.name) {
    return null;
  }

  return {
    name: r.name,
    rule: typeof r.rule === 'string' ? r.rule : '',
    violation: typeof r.violation === 'string' ? r.violation : '',
    commonCauses: Array.isArray(r.commonCauses) ? r.commonCauses.filter((x): x is string => typeof x === 'string') : [],
    detection: typeof r.detection === 'string' ? r.detection : '',
  };
}

function normalizeTimingRule(rule: unknown): TimingRule | null {
  if (!rule || typeof rule !== 'object') {
    return null;
  }
  const r = rule as Record<string, unknown>;

  if (typeof r.name !== 'string' || !r.name) {
    return null;
  }

  return {
    name: r.name,
    layers: Array.isArray(r.layers) ? r.layers.filter((x): x is string => typeof x === 'string') : [],
    coordination: typeof r.coordination === 'string' ? r.coordination : '',
    mismatchSymptoms: Array.isArray(r.mismatchSymptoms) ? r.mismatchSymptoms.filter((x): x is string => typeof x === 'string') : [],
    solution: typeof r.solution === 'string' ? r.solution : '',
  };
}

function fallbackCoreKnowledge(domain: DomainInfo): CoreKnowledge {
  return {
    mentalModel: `This is the domain of ${domain.name}. ${domain.description}. Key technologies: ${domain.technologies.join(', ')}.`,
    goldenPatterns: [],
    criticalGotchas: [],
    decisionFramework: 'Evaluate based on your specific requirements and constraints.',
  };
}

/**
 * Generate mental model and decision framework from patterns/gotchas
 * Used as a second pass when primary synthesis captures structured data but not prose
 */
async function generateProseFromStructuredKnowledge(
  domain: DomainInfo,
  patterns: Pattern[],
  gotchas: Gotcha[],
  integrationHazards?: IntegrationHazard[]
): Promise<{ mentalModel: string; decisionFramework: string }> {
  // Build context from structured knowledge
  const patternSummary = patterns.map(p =>
    `- ${p.name}: ${p.whenToUse} (Why: ${p.whyItWorks})`
  ).join('\n');

  const gotchaSummary = gotchas.map(g =>
    `- [${g.severity}] ${g.title}: ${g.trap} → ${g.consequence}`
  ).join('\n');

  const hazardSummary = integrationHazards?.map(h =>
    `- ${h.name}: ${h.components.join(' + ')} causes ${h.hazard}`
  ).join('\n') || 'None identified';

  const prosePrompt = `You are writing expert documentation for: "${domain.name}"

Based on these patterns and gotchas, write TWO sections:

## PATTERNS LEARNED:
${patternSummary}

## GOTCHAS IDENTIFIED:
${gotchaSummary}

## INTEGRATION HAZARDS:
${hazardSummary}

---

Write:

1. **MENTAL MODEL** (300-500 words): Explain how an expert thinks about ${domain.name}. Include:
   - Core concepts and how they relate
   - The key insight that separates experts from beginners
   - How the patterns connect to form a coherent approach
   - What makes this domain tricky (based on the gotchas)

2. **DECISION FRAMEWORK** (150-250 words): A practical guide for making decisions:
   - When to use which pattern
   - How to avoid the critical gotchas
   - Key questions to ask before implementing

Respond with JSON:
{
  "mentalModel": "...",
  "decisionFramework": "..."
}`;

  try {
    const response = await prompt(prosePrompt, {
      system: `You are an expert technical writer synthesizing knowledge about ${domain.name}. Write clear, actionable prose.`,
      metricsPhase: 'prose-synthesis',
    });

    // Parse response
    let jsonStr = response.trim();
    if (jsonStr.startsWith('```')) {
      jsonStr = jsonStr.replace(/```json?\n?/g, '').replace(/```/g, '').trim();
    }

    // Find JSON object
    const jsonMatch = jsonStr.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      return {
        mentalModel: typeof parsed.mentalModel === 'string' ? parsed.mentalModel : '',
        decisionFramework: typeof parsed.decisionFramework === 'string' ? parsed.decisionFramework : '',
      };
    }
  } catch (error) {
    console.error('Error generating prose from structured knowledge:', error);
  }

  return { mentalModel: '', decisionFramework: '' };
}

function truncate(str: string, maxLength: number): string {
  if (!str) return '';
  if (str.length <= maxLength) return str;
  return str.slice(0, maxLength) + '... [truncated]';
}

/**
 * Generate a training report from the knowledge
 */
export function generateTrainingReport(
  domain: DomainInfo,
  rawKnowledge: RawKnowledge,
  coreKnowledge: CoreKnowledge,
  durationSeconds: number
): {
  summary: string;
  gaps: string[];
} {
  const gaps: string[] = [];

  // Identify knowledge gaps
  if (rawKnowledge.documentation.rawContent.length < 100) {
    gaps.push('Limited documentation found');
  }
  if (rawKnowledge.issues.totalAnalyzed === 0) {
    gaps.push('No GitHub issues analyzed');
  }
  if (!rawKnowledge.sourceCode) {
    gaps.push('Source code not analyzed');
  }
  if (coreKnowledge.goldenPatterns.length < 2) {
    gaps.push('Few patterns extracted - may need more research');
  }
  if (coreKnowledge.criticalGotchas.length === 0) {
    gaps.push('No gotchas identified - may be missing edge cases');
  }

  // System-focused knowledge gaps
  const integrationGotchas = coreKnowledge.criticalGotchas.filter(
    (g) => g.category === 'integration' || g.category === 'timing' || g.category === 'state-flow'
  );
  if (integrationGotchas.length < 2) {
    gaps.push('Few integration/timing/state-flow gotchas - may miss composition bugs');
  }
  if (!coreKnowledge.integrationHazards || coreKnowledge.integrationHazards.length === 0) {
    gaps.push('No integration hazards identified - may miss pattern conflicts');
  }
  if (!coreKnowledge.contractDefinitions || coreKnowledge.contractDefinitions.length === 0) {
    gaps.push('No contracts defined - may miss implicit guarantees');
  }
  const patternsWithContracts = coreKnowledge.goldenPatterns.filter(
    (p) => p.contracts || p.conflictsWith
  );
  if (patternsWithContracts.length < coreKnowledge.goldenPatterns.length / 2) {
    gaps.push('Few patterns have contracts/conflicts - limited system-level understanding');
  }

  const summary = `# Training Report: ${domain.name}

## Summary
- **Duration**: ${Math.round(durationSeconds)} seconds
- **Mental Model**: ${coreKnowledge.mentalModel.split(' ').length} words
- **Patterns**: ${coreKnowledge.goldenPatterns.length} golden patterns
- **Gotchas**: ${coreKnowledge.criticalGotchas.length} critical gotchas

## System-Focused Knowledge
- **Integration Hazards**: ${coreKnowledge.integrationHazards?.length || 0}
- **Contracts**: ${coreKnowledge.contractDefinitions?.length || 0}
- **State Flow Rules**: ${coreKnowledge.stateFlowRules?.length || 0}
- **Timing Rules**: ${coreKnowledge.timingCoordination?.length || 0}
- **Integration Gotchas**: ${integrationGotchas.length}
- **Patterns with Contracts**: ${patternsWithContracts.length}/${coreKnowledge.goldenPatterns.length}

## Sources Used
- Documentation: ${rawKnowledge.documentation.source || 'None'}
- Issues Analyzed: ${rawKnowledge.issues.totalAnalyzed}
- Breaking Changes: ${rawKnowledge.changelog.breakingChanges.length}
- Community Insights: ${rawKnowledge.community.blogInsights.length + rawKnowledge.community.stackOverflowSolutions.length}
${rawKnowledge.sourceCode ? `- Source Code: ${rawKnowledge.sourceCode.repoUrl}` : ''}

## Knowledge Gaps
${gaps.length > 0 ? gaps.map((g) => `- ${g}`).join('\n') : 'None identified'}

## Patterns Learned
${coreKnowledge.goldenPatterns.map((p) => {
  const systemInfo = [];
  if (p.conflictsWith?.length) systemInfo.push(`conflicts: ${p.conflictsWith.length}`);
  if (p.contracts) systemInfo.push('has contracts');
  const suffix = systemInfo.length > 0 ? ` (${systemInfo.join(', ')})` : '';
  return `- **${p.name}**: ${p.whenToUse}${suffix}`;
}).join('\n') || 'None extracted'}

## Critical Gotchas
${coreKnowledge.criticalGotchas.map((g) => {
  const categoryTag = g.category ? `[${g.category}]` : '';
  return `- [${g.severity.toUpperCase()}]${categoryTag} ${g.title}`;
}).join('\n') || 'None identified'}

## Integration Hazards
${coreKnowledge.integrationHazards?.map((h) => `- **${h.name}**: ${h.components.join(' + ')} → ${h.hazard}`).join('\n') || 'None identified'}

## Contracts
${coreKnowledge.contractDefinitions?.map((c) => `- **${c.provider}**: guarantees ${c.guarantees.join(', ')}`).join('\n') || 'None defined'}
`;

  return { summary, gaps };
}
