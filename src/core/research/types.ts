/**
 * Types for the Otaku training research pipeline
 */

export interface ResearchConfig {
  domain: DomainInfo;
  options: ResearchOptions;
}

export type DomainType = 'technical' | 'non-technical';

export interface DomainInfo {
  id: string;
  name: string;
  description: string;
  technologies: string[];
  keywords: string[];
  // Optional: specific resources to research
  docsUrl?: string;
  githubRepo?: string;
  npmPackage?: string;
  // Optional: explicit domain type override (auto-detected if not set)
  domainType?: DomainType;
}

/**
 * Auto-detect whether a domain is technical (software/code) or non-technical.
 * Checks for code-specific resources, technologies, and keywords.
 */
export function detectDomainType(domain: DomainInfo): DomainType {
  // Explicit override
  if (domain.domainType) return domain.domainType;

  // Code-specific resources present → technical
  if (domain.githubRepo || domain.npmPackage || domain.docsUrl) return 'technical';

  // Known code/infra technologies
  const codeTech = [
    'react','vue','angular','svelte','next','nuxt','node','express',
    'django','flask','rails','typescript','javascript','python','rust','go','java',
    'kotlin','docker','kubernetes','terraform','aws','gcp','azure','postgres','mysql',
    'mongodb','redis','supabase','firebase','graphql','webpack','vite','bun',
  ];
  const techLower = domain.technologies.map(t => t.toLowerCase());
  if (techLower.some(t => codeTech.some(ct => t.includes(ct)))) return 'technical';

  // Check name/description/keywords for code technology mentions (single match suffices)
  const allText = [...domain.keywords, domain.name, domain.description].join(' ').toLowerCase();
  if (codeTech.some(ct => allText.includes(ct))) return 'technical';

  // Check for general code signals (need ≥2 matches since these are more ambiguous)
  const codeKeywords = ['api','sdk','library','framework','database','server','frontend','backend','devops',
    'programming','coding','software','developer','codebase','repository','CI/CD','microservice'];
  if (codeKeywords.filter(kw => allText.includes(kw)).length >= 2) return 'technical';

  return 'non-technical';
}

export interface ResearchOptions {
  includeSourceCode: boolean;
  maxIssues: number;
  maxWebResults: number;
  maxReleases: number;
}

export const DEFAULT_RESEARCH_OPTIONS: ResearchOptions = {
  includeSourceCode: true,
  maxIssues: 50,
  maxWebResults: 20,
  maxReleases: 10,
};

// ═══════════════════════════════════════════════════════════
// RAW KNOWLEDGE TYPES
// ═══════════════════════════════════════════════════════════

export interface RawKnowledge {
  documentation: DocumentationKnowledge;
  issues: IssueKnowledge;
  changelog: ChangelogKnowledge;
  community: CommunityKnowledge;
  sourceCode: SourceCodeKnowledge | null;
  meta: ResearchMeta;
}

export interface DocumentationKnowledge {
  concepts: string[];
  apiReference: string;
  patterns: string[];
  warnings: string[];
  rawContent: string;
  source: string;
}

export interface IssueKnowledge {
  problemSolutions: ProblemSolution[];
  commonProblems: string[];
  workarounds: string[];
  totalAnalyzed: number;
}

export interface ProblemSolution {
  symptom: string;
  rootCause: string;
  solution: string;
  prevention: string;
  issueUrl?: string;
  reactions?: number;
}

export interface ChangelogKnowledge {
  breakingChanges: BreakingChange[];
  deprecations: Deprecation[];
  recentFeatures: string[];
  migrationTips: string[];
}

export interface BreakingChange {
  version: string;
  description: string;
  migration: string;
  gotcha?: string;
}

export interface Deprecation {
  what: string;
  replacedBy: string;
  removeVersion?: string;
  reason?: string;
}

export interface CommunityKnowledge {
  blogInsights: string[];
  stackOverflowSolutions: string[];
  bestPractices: string[];
  ahaMoments: string[];
}

export interface SourceCodeKnowledge {
  architecture: string;
  undocumentedBehaviors: string[];
  internalPatterns: string[];
  codeCommentInsights: string[];
  edgeCases: string[];
  repoUrl: string;
}

export interface ResearchMeta {
  startedAt: string;
  completedAt?: string;
  sourcesUsed: SourceInfo[];
  totalTokensProcessed?: number;
}

export interface SourceInfo {
  type: 'context7' | 'github-issues' | 'github-releases' | 'web-search' | 'source-code';
  url?: string;
  itemCount: number;
  fetchedAt: string;
}

// ═══════════════════════════════════════════════════════════
// SYNTHESIZED KNOWLEDGE TYPES
// ═══════════════════════════════════════════════════════════

export interface CoreKnowledge {
  mentalModel: string;
  goldenPatterns: Pattern[];
  criticalGotchas: Gotcha[];
  decisionFramework: string;
  // System-focused knowledge (optional for backward compatibility)
  integrationHazards?: IntegrationHazard[];
  contractDefinitions?: Contract[];
  stateFlowRules?: StateFlowRule[];
  timingCoordination?: TimingRule[];
}

// ═══════════════════════════════════════════════════════════
// SYSTEM-FOCUSED KNOWLEDGE TYPES
// ═══════════════════════════════════════════════════════════

export interface IntegrationHazard {
  name: string;
  components: string[];          // What things interact dangerously
  hazard: string;                // What goes wrong
  symptoms: string[];            // How it manifests
  detection: string;             // How to catch it early
  prevention: string;            // How to avoid it
}

export interface Contract {
  provider: string;              // What provides this contract (hook, function, component)
  requires: string[];            // Preconditions that must be true
  guarantees: string[];          // What it promises to all consumers
  violations: string[];          // Common ways the contract gets broken
  enforcement: string;           // How to enforce this (types, tests, lint rules)
}

export interface StateFlowRule {
  name: string;
  rule: string;                  // The invariant that must hold
  violation: string;             // What happens when violated
  commonCauses: string[];        // Typical code patterns that violate this
  detection: string;             // How to detect cycles/violations
}

export interface TimingRule {
  name: string;
  layers: string[];              // What layers are involved (CSS, JS, API, etc.)
  coordination: string;          // How timing must be synchronized
  mismatchSymptoms: string[];    // What happens when out of sync
  solution: string;              // How to keep them coordinated
}

export interface Pattern {
  name: string;
  whenToUse: string;
  implementation: string;
  whyItWorks: string;
  watchOutFor: string;
  // System-focused fields (optional for backward compatibility)
  conflictsWith?: string[];      // Patterns/approaches this CANNOT coexist with
  synergiesWith?: string[];      // Patterns that amplify each other
  contracts?: {
    requires?: string[];         // Preconditions that must be true
    guarantees?: string[];       // What this promises to consumers
    sideEffects?: string[];      // What else changes (state, timing, etc.)
  };
  crossLayerConcerns?: string[]; // Timing, state sync across boundaries
}

export interface Gotcha {
  title: string;
  trap: string;
  consequence: string;
  fix: string;
  severity: 'critical' | 'high' | 'medium';
  // System-focused fields (optional for backward compatibility)
  category?: 'isolated' | 'integration' | 'timing' | 'state-flow' | 'contract-violation';
  relatedPatterns?: string[];    // Which patterns trigger this gotcha
  emergentFrom?: string[];       // What combination of things creates this bug
  detectionStrategy?: string;    // How to catch this BEFORE it happens
}

export interface TrainingResult {
  otakuId: string;
  coreKnowledge: CoreKnowledge;
  rawKnowledge: RawKnowledge;
  toshokanPath: string;
  trainingReport: TrainingReport;
}

export interface TrainingReport {
  otakuId: string;
  otakuName: string;
  trainedAt: string;
  duration: number; // seconds
  sources: {
    documentation: { pages: number; source: string };
    issues: { count: number; analyzed: number };
    releases: { count: number };
    webResults: { count: number };
    sourceCode: { files: number; repo: string } | null;
  };
  knowledge: {
    mentalModelWords: number;
    patternsCount: number;
    gotchasCount: number;
  };
  gaps: string[];
}
