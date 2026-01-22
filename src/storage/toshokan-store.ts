/**
 * Toshokan (Library) Storage
 *
 * Manages the knowledge library for each Otaku.
 * Stores both core knowledge (for CLAUDE.md) and full knowledge (reference).
 */

import { existsSync, mkdirSync, writeFileSync, readFileSync, rmSync } from 'fs';
import { dirname, join } from 'path';
import { getOtakuPaths, getGakuenPaths } from '../utils/paths';
import type {
  TrainingResult,
  CoreKnowledge,
  RawKnowledge,
  Pattern,
  Gotcha,
} from '../core/research/types';

export class ToshokanStore {
  private projectRoot: string;

  constructor(projectRoot: string) {
    this.projectRoot = projectRoot;
  }

  /**
   * Save training results to the toshokan
   */
  saveTrainingResult(result: TrainingResult): string {
    const paths = getOtakuPaths(this.projectRoot, result.otakuId);

    // Create toshokan directory
    if (!existsSync(paths.toshokan)) {
      mkdirSync(paths.toshokan, { recursive: true });
    }

    // Save core knowledge
    this.saveCoreKnowledge(result.otakuId, result.coreKnowledge);

    // Save raw knowledge
    this.saveRawKnowledge(result.otakuId, result.rawKnowledge);

    // Save training report
    this.saveTrainingReport(result);

    // Save sources metadata
    this.writeJson(paths.sources, {
      trainedAt: result.trainingReport.trainedAt,
      sources: result.rawKnowledge.meta.sourcesUsed,
      gaps: result.trainingReport.gaps,
    });

    return paths.toshokan;
  }

  /**
   * Save core knowledge in markdown format
   */
  saveCoreKnowledge(otakuId: string, knowledge: CoreKnowledge): void {
    const paths = getOtakuPaths(this.projectRoot, otakuId);

    // Save patterns
    this.writeFile(paths.patterns, this.formatPatterns(knowledge.goldenPatterns));

    // Save gotchas
    this.writeFile(paths.gotchas, this.formatGotchas(knowledge.criticalGotchas));

    // Save full core knowledge
    const coreKnowledgePath = join(paths.toshokan, 'core-knowledge.md');
    this.writeFile(coreKnowledgePath, this.formatCoreKnowledge(knowledge));

    // Save JSON version for programmatic access
    const coreJsonPath = join(paths.toshokan, 'core-knowledge.json');
    this.writeJson(coreJsonPath, knowledge);
  }

  /**
   * Save raw knowledge for reference
   */
  saveRawKnowledge(otakuId: string, raw: RawKnowledge): void {
    const paths = getOtakuPaths(this.projectRoot, otakuId);

    // Save documentation
    this.writeFile(paths.docs, this.formatDocumentation(raw));

    // Save issues knowledge
    const issuesPath = join(paths.toshokan, 'issues.md');
    this.writeFile(issuesPath, this.formatIssues(raw));

    // Save changelog
    const changelogPath = join(paths.toshokan, 'changelog.md');
    this.writeFile(changelogPath, this.formatChangelog(raw));

    // Save community knowledge
    const communityPath = join(paths.toshokan, 'community.md');
    this.writeFile(communityPath, this.formatCommunity(raw));

    // Save source code analysis (if exists)
    if (raw.sourceCode) {
      const sourceCodePath = join(paths.toshokan, 'source-analysis.md');
      this.writeFile(sourceCodePath, this.formatSourceCode(raw.sourceCode));
    }

    // Save full raw knowledge JSON
    const rawJsonPath = join(paths.toshokan, 'raw-knowledge.json');
    this.writeJson(rawJsonPath, raw);
  }

  /**
   * Save training report
   */
  saveTrainingReport(result: TrainingResult): void {
    const paths = getOtakuPaths(this.projectRoot, result.otakuId);
    const reportPath = join(paths.toshokan, 'training-report.md');

    const report = `# Training Report: ${result.trainingReport.otakuName}

**Trained**: ${result.trainingReport.trainedAt}
**Duration**: ${Math.round(result.trainingReport.duration)} seconds

## Sources Used

| Source | Count | Details |
|--------|-------|---------|
| Documentation | ${result.trainingReport.sources.documentation.pages} pages | ${result.trainingReport.sources.documentation.source} |
| GitHub Issues | ${result.trainingReport.sources.issues.count} problems | ${result.trainingReport.sources.issues.analyzed} analyzed |
| Releases | ${result.trainingReport.sources.releases.count} | - |
| Web Research | ${result.trainingReport.sources.webResults.count} insights | - |
${result.trainingReport.sources.sourceCode ? `| Source Code | ${result.trainingReport.sources.sourceCode.files} patterns | ${result.trainingReport.sources.sourceCode.repo} |` : ''}

## Knowledge Compiled

- **Mental Model**: ${result.trainingReport.knowledge.mentalModelWords} words
- **Golden Patterns**: ${result.trainingReport.knowledge.patternsCount}
- **Critical Gotchas**: ${result.trainingReport.knowledge.gotchasCount}

## Knowledge Gaps

${result.trainingReport.gaps.length > 0
  ? result.trainingReport.gaps.map((g) => `- ${g}`).join('\n')
  : 'None identified'}
`;

    this.writeFile(reportPath, report);
  }

  /**
   * Load core knowledge for an Otaku
   */
  loadCoreKnowledge(otakuId: string): CoreKnowledge | null {
    const paths = getOtakuPaths(this.projectRoot, otakuId);
    const jsonPath = join(paths.toshokan, 'core-knowledge.json');

    if (!existsSync(jsonPath)) {
      return null;
    }

    try {
      const content = readFileSync(jsonPath, 'utf-8');
      return JSON.parse(content) as CoreKnowledge;
    } catch {
      return null;
    }
  }

  /**
   * Check if an Otaku has been trained
   */
  isTrained(otakuId: string): boolean {
    const paths = getOtakuPaths(this.projectRoot, otakuId);
    return existsSync(join(paths.toshokan, 'core-knowledge.json'));
  }

  /**
   * Get the toshokan path for an Otaku
   */
  getToshokanPath(otakuId: string): string {
    const paths = getOtakuPaths(this.projectRoot, otakuId);
    return paths.toshokan;
  }

  /**
   * Clear all knowledge for an Otaku (for retraining)
   */
  clearOtakuKnowledge(otakuId: string): void {
    const paths = getOtakuPaths(this.projectRoot, otakuId);
    if (existsSync(paths.toshokan)) {
      rmSync(paths.toshokan, { recursive: true, force: true });
    }
  }

  // ═══════════════════════════════════════════════════════════
  // FORMATTING HELPERS
  // ═══════════════════════════════════════════════════════════

  private formatPatterns(patterns: Pattern[]): string {
    if (patterns.length === 0) {
      return '# Golden Patterns\n\nNo patterns extracted during training.\n';
    }

    let content = '# Golden Patterns\n\n';
    content += 'Proven patterns for this domain.\n\n';

    for (const pattern of patterns) {
      content += `## ${pattern.name}\n\n`;
      content += `**When to use**: ${pattern.whenToUse}\n\n`;
      content += `**Implementation**:\n${pattern.implementation}\n\n`;
      content += `**Why it works**: ${pattern.whyItWorks}\n\n`;
      content += `**Watch out for**: ${pattern.watchOutFor}\n\n`;
      content += '---\n\n';
    }

    return content;
  }

  private formatGotchas(gotchas: Gotcha[]): string {
    if (gotchas.length === 0) {
      return '# Critical Gotchas\n\nNo gotchas identified during training.\n';
    }

    let content = '# Critical Gotchas\n\n';
    content += 'Common pitfalls and how to avoid them.\n\n';

    // Sort by severity
    const sorted = [...gotchas].sort((a, b) => {
      const order = { critical: 0, high: 1, medium: 2 };
      return order[a.severity] - order[b.severity];
    });

    for (const gotcha of sorted) {
      const severityEmoji = {
        critical: '🚨',
        high: '⚠️',
        medium: '📌',
      }[gotcha.severity];

      content += `## ${severityEmoji} ${gotcha.title}\n\n`;
      content += `**Severity**: ${gotcha.severity.toUpperCase()}\n\n`;
      content += `**The trap**: ${gotcha.trap}\n\n`;
      content += `**What happens**: ${gotcha.consequence}\n\n`;
      content += `**The fix**: ${gotcha.fix}\n\n`;
      content += '---\n\n';
    }

    return content;
  }

  private formatCoreKnowledge(knowledge: CoreKnowledge): string {
    return `# Core Knowledge

## Mental Model

${knowledge.mentalModel}

## Decision Framework

${knowledge.decisionFramework}

---

See also:
- [patterns.md](./patterns.md) - Golden patterns
- [gotchas.md](./gotchas.md) - Critical gotchas
`;
  }

  private formatDocumentation(raw: RawKnowledge): string {
    const doc = raw.documentation;
    return `# Documentation Summary

**Source**: ${doc.source}

## Key Concepts

${doc.concepts.length > 0
  ? doc.concepts.map((c) => `- ${c}`).join('\n')
  : 'None extracted'}

## API Reference

${doc.apiReference || 'None extracted'}

## Recommended Patterns

${doc.patterns.length > 0
  ? doc.patterns.map((p) => `- ${p}`).join('\n')
  : 'None extracted'}

## Warnings

${doc.warnings.length > 0
  ? doc.warnings.map((w) => `- ${w}`).join('\n')
  : 'None extracted'}

## Raw Content

${doc.rawContent || 'None extracted'}
`;
  }

  private formatIssues(raw: RawKnowledge): string {
    const issues = raw.issues;
    let content = `# GitHub Issues Analysis

**Total Analyzed**: ${issues.totalAnalyzed}

## Problem-Solution Pairs

`;

    if (issues.problemSolutions.length > 0) {
      for (const ps of issues.problemSolutions) {
        content += `### ${ps.symptom}\n\n`;
        content += `**Root Cause**: ${ps.rootCause}\n\n`;
        content += `**Solution**: ${ps.solution}\n\n`;
        content += `**Prevention**: ${ps.prevention}\n\n`;
        if (ps.issueUrl) {
          content += `**Reference**: ${ps.issueUrl}\n\n`;
        }
        content += '---\n\n';
      }
    } else {
      content += 'None extracted\n\n';
    }

    content += `## Common Problems\n\n`;
    content += issues.commonProblems.length > 0
      ? issues.commonProblems.map((p) => `- ${p}`).join('\n')
      : 'None extracted';

    content += `\n\n## Workarounds\n\n`;
    content += issues.workarounds.length > 0
      ? issues.workarounds.map((w) => `- ${w}`).join('\n')
      : 'None extracted';

    return content;
  }

  private formatChangelog(raw: RawKnowledge): string {
    const cl = raw.changelog;
    let content = `# Changelog Analysis

## Breaking Changes

`;

    if (cl.breakingChanges.length > 0) {
      for (const bc of cl.breakingChanges) {
        content += `### ${bc.version}: ${bc.description}\n\n`;
        content += `**Migration**: ${bc.migration}\n\n`;
        if (bc.gotcha) {
          content += `**Gotcha**: ${bc.gotcha}\n\n`;
        }
        content += '---\n\n';
      }
    } else {
      content += 'None found\n\n';
    }

    content += `## Deprecations\n\n`;
    if (cl.deprecations.length > 0) {
      for (const d of cl.deprecations) {
        content += `- **${d.what}** → ${d.replacedBy}`;
        if (d.removeVersion) {
          content += ` (removed in ${d.removeVersion})`;
        }
        content += '\n';
      }
    } else {
      content += 'None found\n';
    }

    content += `\n## Recent Features\n\n`;
    content += cl.recentFeatures.length > 0
      ? cl.recentFeatures.map((f) => `- ${f}`).join('\n')
      : 'None found';

    content += `\n\n## Migration Tips\n\n`;
    content += cl.migrationTips.length > 0
      ? cl.migrationTips.map((t) => `- ${t}`).join('\n')
      : 'None found';

    return content;
  }

  private formatCommunity(raw: RawKnowledge): string {
    const comm = raw.community;
    return `# Community Knowledge

## Blog Insights

${comm.blogInsights.length > 0
  ? comm.blogInsights.map((b) => `- ${b}`).join('\n')
  : 'None found'}

## Stack Overflow Solutions

${comm.stackOverflowSolutions.length > 0
  ? comm.stackOverflowSolutions.map((s) => `- ${s}`).join('\n')
  : 'None found'}

## Best Practices

${comm.bestPractices.length > 0
  ? comm.bestPractices.map((p) => `- ${p}`).join('\n')
  : 'None found'}

## Aha Moments

${comm.ahaMoments.length > 0
  ? comm.ahaMoments.map((a) => `- ${a}`).join('\n')
  : 'None found'}
`;
  }

  private formatSourceCode(sourceCode: RawKnowledge['sourceCode']): string {
    if (!sourceCode) {
      return '# Source Code Analysis\n\nNot analyzed.\n';
    }

    return `# Source Code Analysis

**Repository**: ${sourceCode.repoUrl}

## Architecture

${sourceCode.architecture || 'Not analyzed'}

## Undocumented Behaviors

${sourceCode.undocumentedBehaviors.length > 0
  ? sourceCode.undocumentedBehaviors.map((b) => `- ${b}`).join('\n')
  : 'None found'}

## Internal Patterns

${sourceCode.internalPatterns.length > 0
  ? sourceCode.internalPatterns.map((p) => `- ${p}`).join('\n')
  : 'None found'}

## Code Comment Insights

${sourceCode.codeCommentInsights.length > 0
  ? sourceCode.codeCommentInsights.map((c) => `- ${c}`).join('\n')
  : 'None found'}

## Edge Cases

${sourceCode.edgeCases.length > 0
  ? sourceCode.edgeCases.map((e) => `- ${e}`).join('\n')
  : 'None found'}
`;
  }

  // ═══════════════════════════════════════════════════════════
  // FILE HELPERS
  // ═══════════════════════════════════════════════════════════

  private writeFile(path: string, content: string): void {
    const dir = dirname(path);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
    writeFileSync(path, content, 'utf-8');
  }

  private writeJson(path: string, data: unknown): void {
    const dir = dirname(path);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
    writeFileSync(path, JSON.stringify(data, null, 2), 'utf-8');
  }
}
