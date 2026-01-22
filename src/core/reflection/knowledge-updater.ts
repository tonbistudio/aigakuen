/**
 * Knowledge Updater
 *
 * Applies discovered knowledge gaps to an Otaku's training data,
 * updating their gotchas and patterns files.
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';
import type { KnowledgeGap } from './types';
import type { Gotcha, Pattern } from '../research/types';

interface UpdateResult {
  gotchasAdded: number;
  patternsAdded: number;
  filesUpdated: string[];
}

/**
 * Apply knowledge gaps to an Otaku's training data
 */
export async function applyKnowledgeUpdates(
  toshokanPath: string,
  otakuId: string,
  gaps: KnowledgeGap[]
): Promise<UpdateResult> {
  const otakuPath = join(toshokanPath, otakuId);
  const result: UpdateResult = {
    gotchasAdded: 0,
    patternsAdded: 0,
    filesUpdated: [],
  };

  if (!existsSync(otakuPath)) {
    throw new Error(`Otaku toshokan not found: ${otakuPath}`);
  }

  // Separate gotchas and patterns
  const newGotchas = gaps
    .filter(g => g.suggestedGotcha)
    .map(g => g.suggestedGotcha!);

  const newPatterns = gaps
    .filter(g => g.suggestedPattern)
    .map(g => g.suggestedPattern!);

  // Update gotchas
  if (newGotchas.length > 0) {
    const gotchasFile = join(otakuPath, 'gotchas.md');
    const added = appendGotchas(gotchasFile, newGotchas);
    result.gotchasAdded = added;
    if (added > 0) {
      result.filesUpdated.push(gotchasFile);
    }
  }

  // Update patterns
  if (newPatterns.length > 0) {
    const patternsFile = join(otakuPath, 'patterns.md');
    const added = appendPatterns(patternsFile, newPatterns);
    result.patternsAdded = added;
    if (added > 0) {
      result.filesUpdated.push(patternsFile);
    }
  }

  // Update core-knowledge.json with new entries
  const coreKnowledgeFile = join(otakuPath, 'core-knowledge.json');
  if (existsSync(coreKnowledgeFile)) {
    updateCoreKnowledgeJson(coreKnowledgeFile, newGotchas, newPatterns);
    result.filesUpdated.push(coreKnowledgeFile);
  }

  return result;
}

/**
 * Append new gotchas to the gotchas.md file
 */
function appendGotchas(
  filePath: string,
  gotchas: KnowledgeGap['suggestedGotcha'][]
): number {
  let content = '';

  if (existsSync(filePath)) {
    content = readFileSync(filePath, 'utf-8');
  } else {
    content = '# Critical Gotchas\n\nKnowledge gaps discovered through reflection.\n';
  }

  let added = 0;

  for (const gotcha of gotchas) {
    if (!gotcha) continue;

    // Check if already exists (simple check)
    if (content.includes(gotcha.title)) {
      continue;
    }

    const severityEmoji = {
      critical: '🚨',
      high: '⚠️',
      medium: '📌',
    }[gotcha.severity] || '📌';

    const entry = `
## ${severityEmoji} ${gotcha.title}

**Category**: ${gotcha.category}
**Severity**: ${gotcha.severity}
**Source**: Discovered via reflection

**Trap**: ${gotcha.trap}

**Consequence**: ${gotcha.consequence}

**Fix**: ${gotcha.fix}

**Detection Strategy**: ${gotcha.detectionStrategy}

---
`;

    content += entry;
    added++;
  }

  if (added > 0) {
    writeFileSync(filePath, content);
  }

  return added;
}

/**
 * Append new patterns to the patterns.md file
 */
function appendPatterns(
  filePath: string,
  patterns: KnowledgeGap['suggestedPattern'][]
): number {
  let content = '';

  if (existsSync(filePath)) {
    content = readFileSync(filePath, 'utf-8');
  } else {
    content = '# Golden Patterns\n\nPatterns discovered through reflection.\n';
  }

  let added = 0;

  for (const pattern of patterns) {
    if (!pattern) continue;

    // Check if already exists
    if (content.includes(pattern.name)) {
      continue;
    }

    const entry = `
## ${pattern.name}

**Source**: Discovered via reflection

**When to Use**: ${pattern.whenToUse}

**Implementation**: ${pattern.implementation}

**Why It Works**: ${pattern.whyItWorks}

**Watch Out For**: ${pattern.watchOutFor}

---
`;

    content += entry;
    added++;
  }

  if (added > 0) {
    writeFileSync(filePath, content);
  }

  return added;
}

/**
 * Update core-knowledge.json with new gotchas and patterns
 */
function updateCoreKnowledgeJson(
  filePath: string,
  gotchas: KnowledgeGap['suggestedGotcha'][],
  patterns: KnowledgeGap['suggestedPattern'][]
): void {
  let coreKnowledge: any = {};

  try {
    coreKnowledge = JSON.parse(readFileSync(filePath, 'utf-8'));
  } catch {
    coreKnowledge = { criticalGotchas: [], goldenPatterns: [] };
  }

  // Ensure arrays exist
  if (!Array.isArray(coreKnowledge.criticalGotchas)) {
    coreKnowledge.criticalGotchas = [];
  }
  if (!Array.isArray(coreKnowledge.goldenPatterns)) {
    coreKnowledge.goldenPatterns = [];
  }

  // Add gotchas
  for (const gotcha of gotchas) {
    if (!gotcha) continue;

    // Check for duplicates
    const exists = coreKnowledge.criticalGotchas.some(
      (g: any) => g.title === gotcha.title
    );

    if (!exists) {
      coreKnowledge.criticalGotchas.push({
        title: gotcha.title,
        trap: gotcha.trap,
        consequence: gotcha.consequence,
        fix: gotcha.fix,
        severity: gotcha.severity,
        category: gotcha.category,
        detectionStrategy: gotcha.detectionStrategy,
        source: 'reflection',
        addedAt: new Date().toISOString(),
      });
    }
  }

  // Add patterns
  for (const pattern of patterns) {
    if (!pattern) continue;

    const exists = coreKnowledge.goldenPatterns.some(
      (p: any) => p.name === pattern.name
    );

    if (!exists) {
      coreKnowledge.goldenPatterns.push({
        name: pattern.name,
        whenToUse: pattern.whenToUse,
        implementation: pattern.implementation,
        whyItWorks: pattern.whyItWorks,
        watchOutFor: pattern.watchOutFor,
        source: 'reflection',
        addedAt: new Date().toISOString(),
      });
    }
  }

  writeFileSync(filePath, JSON.stringify(coreKnowledge, null, 2));
}

/**
 * Generate a reflection report
 */
export function generateReflectionReport(
  gaps: KnowledgeGap[],
  updateResult: UpdateResult
): string {
  const lines: string[] = [
    '# Reflection Report',
    '',
    `**Date**: ${new Date().toISOString()}`,
    `**Knowledge Gaps Found**: ${gaps.length}`,
    `**Gotchas Added**: ${updateResult.gotchasAdded}`,
    `**Patterns Added**: ${updateResult.patternsAdded}`,
    '',
    '## Discovered Gaps',
    '',
  ];

  for (const gap of gaps) {
    lines.push(`### ${gap.issue.description}`);
    lines.push('');
    lines.push(`**Otaku**: ${gap.otakuName}`);
    lines.push(`**Reasoning**: ${gap.reasoning}`);
    lines.push('');

    if (gap.suggestedGotcha) {
      lines.push(`**New Gotcha**: ${gap.suggestedGotcha.title}`);
      lines.push(`- Trap: ${gap.suggestedGotcha.trap}`);
      lines.push(`- Fix: ${gap.suggestedGotcha.fix}`);
      lines.push('');
    }

    if (gap.suggestedPattern) {
      lines.push(`**New Pattern**: ${gap.suggestedPattern.name}`);
      lines.push(`- When: ${gap.suggestedPattern.whenToUse}`);
      lines.push('');
    }

    lines.push('---');
    lines.push('');
  }

  if (updateResult.filesUpdated.length > 0) {
    lines.push('## Files Updated');
    lines.push('');
    for (const file of updateResult.filesUpdated) {
      lines.push(`- ${file}`);
    }
  }

  return lines.join('\n');
}
