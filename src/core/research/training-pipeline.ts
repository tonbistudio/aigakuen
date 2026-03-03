/**
 * Training Pipeline
 *
 * Orchestrates the full training process for an Otaku:
 * 1. Fetch documentation via Context7
 * 2. Mine GitHub issues
 * 3. Analyze changelog/releases
 * 4. Research community knowledge
 * 5. Analyze source code (optional)
 * 6. Synthesize into core knowledge
 */

import { fetchDocumentation } from './context7-fetcher';
import { mineGitHubIssues, mineIssuesForTechnology } from './github-miner';
import { analyzeChangelog, analyzeChangelogForTechnology } from './changelog-analyzer';
import { researchCommunity } from './web-researcher';
import { analyzeSourceCode, analyzeSourceForTechnology } from './source-analyzer';
import { synthesizeKnowledge, generateTrainingReport } from './knowledge-synthesizer';
import { detectDomainType } from './types';
import type {
  DomainInfo,
  DomainType,
  ResearchOptions,
  RawKnowledge,
  CoreKnowledge,
  TrainingResult,
  TrainingReport,
  SourceInfo,
  DocumentationKnowledge,
  IssueKnowledge,
  ChangelogKnowledge,
} from './types';

export interface TrainingProgress {
  phase: string;
  progress: number; // 0-100
  message: string;
}

export type ProgressCallback = (progress: TrainingProgress) => void;

/**
 * Run the full training pipeline for an Otaku
 */
export async function trainOtaku(
  otakuId: string,
  domain: DomainInfo,
  options: ResearchOptions,
  onProgress?: ProgressCallback
): Promise<TrainingResult> {
  const startTime = Date.now();
  const sourcesUsed: SourceInfo[] = [];

  const report = (phase: string, progress: number, message: string) => {
    if (onProgress) {
      onProgress({ phase, progress, message });
    }
  };

  try {
    const domainType: DomainType = detectDomainType(domain);

    let documentation: DocumentationKnowledge;
    let issues: IssueKnowledge;
    let changelog: ChangelogKnowledge;
    let sourceCode = null;

    if (domainType === 'non-technical') {
      // ═══════════════════════════════════════════════════════════
      // NON-TECHNICAL PATH: Skip Context7, GitHub, source code
      // ═══════════════════════════════════════════════════════════
      report('documentation', 10, 'Skipping Context7 (non-technical domain)');
      documentation = { concepts: [], apiReference: '', patterns: [], warnings: [], rawContent: '', source: 'skipped' };

      report('issues', 20, 'Skipping GitHub issues (non-technical domain)');
      issues = { problemSolutions: [], commonProblems: [], workarounds: [], totalAnalyzed: 0 };

      report('changelog', 30, 'Skipping changelog analysis (non-technical domain)');
      changelog = { breakingChanges: [], deprecations: [], recentFeatures: [], migrationTips: [] };

      // Double the web research budget for non-technical domains
      const webBudget = options.maxWebResults * 2;
      report('community', 40, `Researching community knowledge (expanded budget: ${webBudget})...`);
      const community = await researchCommunity(
        domain.name,
        domain.technologies,
        domain.keywords,
        webBudget,
        domainType
      );
      sourcesUsed.push({
        type: 'web-search',
        itemCount: community.blogInsights.length + community.stackOverflowSolutions.length,
        fetchedAt: new Date().toISOString(),
      });

      report('sourceCode', 70, 'Skipping source code analysis (non-technical domain)');

      // Compile raw knowledge
      const rawKnowledge: RawKnowledge = {
        documentation,
        issues,
        changelog,
        community,
        sourceCode,
        meta: {
          startedAt: new Date(startTime).toISOString(),
          sourcesUsed,
        },
      };

      // Phase 6: Knowledge Synthesis
      report('synthesis', 85, 'Synthesizing expert knowledge...');
      const coreKnowledge = await synthesizeKnowledge(domain, rawKnowledge);

      // Complete
      const endTime = Date.now();
      const durationSeconds = (endTime - startTime) / 1000;

      rawKnowledge.meta.completedAt = new Date(endTime).toISOString();

      // Generate training report
      const { summary, gaps } = generateTrainingReport(
        domain,
        rawKnowledge,
        coreKnowledge,
        durationSeconds
      );

      const trainingReport: TrainingReport = {
        otakuId,
        otakuName: domain.name,
        trainedAt: new Date().toISOString(),
        duration: durationSeconds,
        sources: {
          documentation: {
            pages: 0,
            source: 'skipped',
          },
          issues: {
            count: 0,
            analyzed: 0,
          },
          releases: {
            count: 0,
          },
          webResults: {
            count: community.blogInsights.length + community.stackOverflowSolutions.length,
          },
          sourceCode: null,
        },
        knowledge: {
          mentalModelWords: coreKnowledge.mentalModel.split(' ').length,
          patternsCount: coreKnowledge.goldenPatterns.length,
          gotchasCount: coreKnowledge.criticalGotchas.length,
        },
        gaps,
      };

      report('complete', 100, `Training complete! ${coreKnowledge.goldenPatterns.length} patterns, ${coreKnowledge.criticalGotchas.length} gotchas learned.`);

      return {
        otakuId,
        coreKnowledge,
        rawKnowledge,
        toshokanPath: '', // Will be set by the caller after saving
        trainingReport,
      };
    }

    // ═══════════════════════════════════════════════════════════
    // TECHNICAL PATH: All 6 phases (unchanged)
    // ═══════════════════════════════════════════════════════════

    // Phase 1: Documentation (Context7)
    report('documentation', 10, 'Fetching documentation via Context7...');
    documentation = await fetchDocumentation(domain);
    sourcesUsed.push({
      type: 'context7',
      itemCount: documentation.concepts.length,
      fetchedAt: new Date().toISOString(),
    });

    // Phase 2: GitHub Issues
    report('issues', 25, 'Mining GitHub issues for problems and solutions...');
    if (domain.githubRepo) {
      issues = await mineGitHubIssues(domain.githubRepo, options.maxIssues);
      sourcesUsed.push({
        type: 'github-issues',
        url: domain.githubRepo,
        itemCount: issues.totalAnalyzed,
        fetchedAt: new Date().toISOString(),
      });
    } else {
      // Search for issues related to the technology
      const primaryTech = domain.technologies[0] || domain.name;
      issues = await mineIssuesForTechnology(primaryTech, options.maxIssues);
      sourcesUsed.push({
        type: 'github-issues',
        itemCount: issues.totalAnalyzed,
        fetchedAt: new Date().toISOString(),
      });
    }

    // Phase 3: Changelog
    report('changelog', 40, 'Analyzing releases and changelogs...');
    if (domain.githubRepo) {
      changelog = await analyzeChangelog(domain.githubRepo, options.maxReleases);
      sourcesUsed.push({
        type: 'github-releases',
        url: domain.githubRepo,
        itemCount: changelog.breakingChanges.length + changelog.deprecations.length,
        fetchedAt: new Date().toISOString(),
      });
    } else {
      const primaryTech = domain.technologies[0] || domain.name;
      changelog = await analyzeChangelogForTechnology(primaryTech);
      sourcesUsed.push({
        type: 'github-releases',
        itemCount: changelog.breakingChanges.length + changelog.deprecations.length,
        fetchedAt: new Date().toISOString(),
      });
    }

    // Phase 4: Community Knowledge (Web Search)
    report('community', 55, 'Researching community knowledge...');
    const community = await researchCommunity(
      domain.name,
      domain.technologies,
      domain.keywords,
      options.maxWebResults,
      domainType
    );
    sourcesUsed.push({
      type: 'web-search',
      itemCount: community.blogInsights.length + community.stackOverflowSolutions.length,
      fetchedAt: new Date().toISOString(),
    });

    // Phase 5: Source Code Analysis (Optional)
    report('sourceCode', 70, 'Analyzing source code patterns...');
    if (options.includeSourceCode) {
      if (domain.githubRepo) {
        sourceCode = await analyzeSourceCode(domain.githubRepo, domain.keywords);
      } else {
        const primaryTech = domain.technologies[0] || domain.name;
        sourceCode = await analyzeSourceForTechnology(primaryTech, domain.keywords);
      }
      if (sourceCode) {
        sourcesUsed.push({
          type: 'source-code',
          url: sourceCode.repoUrl,
          itemCount: sourceCode.internalPatterns.length + sourceCode.edgeCases.length,
          fetchedAt: new Date().toISOString(),
        });
      }
    }

    // Compile raw knowledge
    const rawKnowledge: RawKnowledge = {
      documentation,
      issues,
      changelog,
      community,
      sourceCode,
      meta: {
        startedAt: new Date(startTime).toISOString(),
        sourcesUsed,
      },
    };

    // Phase 6: Knowledge Synthesis
    report('synthesis', 85, 'Synthesizing expert knowledge...');
    const coreKnowledge = await synthesizeKnowledge(domain, rawKnowledge);

    // Complete
    const endTime = Date.now();
    const durationSeconds = (endTime - startTime) / 1000;

    rawKnowledge.meta.completedAt = new Date(endTime).toISOString();

    // Generate training report
    const { summary, gaps } = generateTrainingReport(
      domain,
      rawKnowledge,
      coreKnowledge,
      durationSeconds
    );

    const trainingReport: TrainingReport = {
      otakuId,
      otakuName: domain.name,
      trainedAt: new Date().toISOString(),
      duration: durationSeconds,
      sources: {
        documentation: {
          pages: documentation.concepts.length,
          source: documentation.source,
        },
        issues: {
          count: issues.problemSolutions.length,
          analyzed: issues.totalAnalyzed,
        },
        releases: {
          count: changelog.breakingChanges.length + changelog.recentFeatures.length,
        },
        webResults: {
          count: community.blogInsights.length + community.stackOverflowSolutions.length,
        },
        sourceCode: sourceCode
          ? {
              files: sourceCode.internalPatterns.length,
              repo: sourceCode.repoUrl,
            }
          : null,
      },
      knowledge: {
        mentalModelWords: coreKnowledge.mentalModel.split(' ').length,
        patternsCount: coreKnowledge.goldenPatterns.length,
        gotchasCount: coreKnowledge.criticalGotchas.length,
      },
      gaps,
    };

    report('complete', 100, `Training complete! ${coreKnowledge.goldenPatterns.length} patterns, ${coreKnowledge.criticalGotchas.length} gotchas learned.`);

    return {
      otakuId,
      coreKnowledge,
      rawKnowledge,
      toshokanPath: '', // Will be set by the caller after saving
      trainingReport,
    };
  } catch (error) {
    console.error('Training pipeline error:', error);
    throw error;
  }
}

/**
 * Quick training - only essential sources
 */
export async function quickTrainOtaku(
  otakuId: string,
  domain: DomainInfo,
  onProgress?: ProgressCallback
): Promise<TrainingResult> {
  return trainOtaku(
    otakuId,
    domain,
    {
      includeSourceCode: false,
      maxIssues: 20,
      maxWebResults: 10,
      maxReleases: 5,
    },
    onProgress
  );
}

/**
 * Deep training - all sources, more thorough
 */
export async function deepTrainOtaku(
  otakuId: string,
  domain: DomainInfo,
  onProgress?: ProgressCallback
): Promise<TrainingResult> {
  return trainOtaku(
    otakuId,
    domain,
    {
      includeSourceCode: true,
      maxIssues: 100,
      maxWebResults: 30,
      maxReleases: 20,
    },
    onProgress
  );
}
