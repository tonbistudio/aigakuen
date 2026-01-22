/**
 * Gap Detector
 *
 * Compares discovered issues against an Otaku's existing knowledge
 * to identify gaps that should be added to their training.
 */

import { analyzeWithSchema } from '../../claude';
import type { SessionIssue, KnowledgeGap } from './types';
import type { Gotcha, Pattern } from '../research/types';

interface OtakuKnowledge {
  id: string;
  name: string;
  specialty: string;
  domains: string[];
  patterns: Pattern[];
  gotchas: Gotcha[];
}

const GAP_ANALYSIS_SCHEMA = `{
  "gaps": [
    {
      "issueIndex": "number - index of the issue in the input array",
      "shouldHaveKnown": "boolean - should this Otaku have known about this?",
      "reasoning": "string - why this is/isn't in the Otaku's domain",
      "suggestedGotcha": {
        "title": "string - short descriptive title",
        "trap": "string - what developers commonly do wrong",
        "consequence": "string - what bad thing happens",
        "fix": "string - how to do it right",
        "severity": "'critical' | 'high' | 'medium'",
        "category": "'isolated' | 'integration' | 'timing' | 'state-flow' | 'contract-violation'",
        "detectionStrategy": "string - how to catch this before it happens"
      },
      "suggestedPattern": {
        "name": "string - pattern name (optional, only if this reveals a new pattern)",
        "whenToUse": "string - context for using this pattern",
        "implementation": "string - how to implement",
        "whyItWorks": "string - underlying principle",
        "watchOutFor": "string - common mistakes"
      }
    }
  ]
}`;

const GAP_ANALYSIS_PROMPT = `You are analyzing whether a specialized AI agent (Otaku) should have known about certain issues that were discovered during development.

OTAKU PROFILE:
- Name: {{otakuName}}
- Specialty: {{specialty}}
- Domains: {{domains}}

EXISTING GOTCHAS (what the Otaku already knows to avoid):
{{existingGotchas}}

EXISTING PATTERNS (what the Otaku already knows to do):
{{existingPatterns}}

ISSUES DISCOVERED DURING DEVELOPMENT:
{{issues}}

For each issue, determine:
1. Is this within the Otaku's domain of expertise?
2. Should they have warned about this BEFORE it happened?
3. If yes, generate a gotcha and/or pattern to add to their knowledge

Be strict - only flag issues that are clearly within this Otaku's specialty. A React Flashcard UI specialist SHOULD know about Safari CSS quirks, but shouldn't necessarily know about Supabase auth edge cases.

Generate specific, actionable gotchas that would prevent this issue in the future.`;

/**
 * Analyze issues to find knowledge gaps in an Otaku
 */
export async function detectKnowledgeGaps(
  issues: SessionIssue[],
  otaku: OtakuKnowledge
): Promise<KnowledgeGap[]> {
  if (issues.length === 0) {
    return [];
  }

  // Format existing knowledge
  const existingGotchas = otaku.gotchas.length > 0
    ? otaku.gotchas.map(g => `- ${g.title}: ${g.trap}`).join('\n')
    : 'None documented yet';

  const existingPatterns = otaku.patterns.length > 0
    ? otaku.patterns.map(p => `- ${p.name}: ${p.whenToUse}`).join('\n')
    : 'None documented yet';

  const issuesText = issues
    .map((issue, i) => `${i + 1}. ${issue.description}
   Symptoms: ${issue.symptoms}
   Root cause: ${issue.rootCause}
   Fix: ${issue.fix}
   Domains: ${issue.relatedDomains.join(', ')}`)
    .join('\n\n');

  const prompt = GAP_ANALYSIS_PROMPT
    .replace('{{otakuName}}', otaku.name)
    .replace('{{specialty}}', otaku.specialty)
    .replace('{{domains}}', otaku.domains.join(', '))
    .replace('{{existingGotchas}}', existingGotchas)
    .replace('{{existingPatterns}}', existingPatterns)
    .replace('{{issues}}', issuesText);

  const result = await analyzeWithSchema<{
    gaps: Array<{
      issueIndex: number;
      shouldHaveKnown: boolean;
      reasoning: string;
      suggestedGotcha?: KnowledgeGap['suggestedGotcha'];
      suggestedPattern?: KnowledgeGap['suggestedPattern'];
    }>;
  }>(prompt, GAP_ANALYSIS_SCHEMA);

  if (!result?.gaps) {
    return [];
  }

  // Map results back to issues
  return result.gaps
    .filter(gap => gap.shouldHaveKnown)
    .map(gap => ({
      issue: issues[gap.issueIndex - 1], // Convert 1-indexed to 0-indexed
      otakuId: otaku.id,
      otakuName: otaku.name,
      shouldHaveKnown: gap.shouldHaveKnown,
      reasoning: gap.reasoning,
      suggestedGotcha: gap.suggestedGotcha,
      suggestedPattern: gap.suggestedPattern,
    }));
}

/**
 * Check if a gotcha already exists (fuzzy match)
 */
export function gotchaExists(
  existingGotchas: Gotcha[],
  newGotcha: { title: string; trap: string }
): boolean {
  const normalizedNew = newGotcha.title.toLowerCase();

  return existingGotchas.some(existing => {
    const normalizedExisting = existing.title.toLowerCase();

    // Check for similar titles
    if (normalizedExisting.includes(normalizedNew) ||
        normalizedNew.includes(normalizedExisting)) {
      return true;
    }

    // Check for keyword overlap
    const existingWords = new Set(normalizedExisting.split(/\s+/));
    const newWords = normalizedNew.split(/\s+/);
    const overlap = newWords.filter(w => existingWords.has(w)).length;

    return overlap >= Math.min(3, newWords.length * 0.6);
  });
}

/**
 * Check if a pattern already exists (fuzzy match)
 */
export function patternExists(
  existingPatterns: Pattern[],
  newPattern: { name: string }
): boolean {
  const normalizedNew = newPattern.name.toLowerCase();

  return existingPatterns.some(existing => {
    const normalizedExisting = existing.name.toLowerCase();
    return normalizedExisting.includes(normalizedNew) ||
           normalizedNew.includes(normalizedExisting);
  });
}
