/**
 * Types for the reflection system
 */

export interface SessionIssue {
  description: string;
  symptoms: string;
  rootCause: string;
  fix: string;
  category: 'bug' | 'gotcha' | 'pattern-gap' | 'missing-knowledge';
  severity: 'critical' | 'high' | 'medium' | 'low';
  relatedDomains: string[];
}

export interface KnowledgeGap {
  issue: SessionIssue;
  otakuId: string;
  otakuName: string;
  shouldHaveKnown: boolean;
  reasoning: string;
  suggestedGotcha?: {
    title: string;
    trap: string;
    consequence: string;
    fix: string;
    severity: 'critical' | 'high' | 'medium';
    category: 'isolated' | 'integration' | 'timing' | 'state-flow' | 'contract-violation';
    detectionStrategy: string;
  };
  suggestedPattern?: {
    name: string;
    whenToUse: string;
    implementation: string;
    whyItWorks: string;
    watchOutFor: string;
  };
}

export interface ReflectionResult {
  sessionSummary: string;
  activeOtaku: {
    id: string;
    name: string;
    specialty: string;
  };
  issuesFound: SessionIssue[];
  knowledgeGaps: KnowledgeGap[];
  suggestedUpdates: number;
  appliedUpdates: number;
}

export interface SessionContext {
  handoffContent: string;
  recentCommits: CommitInfo[];
  activeOtakuId: string;
  currentTask?: string;
}

export interface CommitInfo {
  hash: string;
  message: string;
  date: string;
  filesChanged: string[];
}
