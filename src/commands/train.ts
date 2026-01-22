import { Command } from 'commander';
import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';
import { logger } from '../utils';
import { requireGakuenRoot, OtakuRegistryStore, ToshokanStore } from '../storage';
import {
  trainOtaku,
  quickTrainOtaku,
  deepTrainOtaku,
  DEFAULT_RESEARCH_OPTIONS,
} from '../core/research';
import type { DomainInfo, ResearchOptions } from '../core/research';
import {
  startMetricsCollection,
  finalizeMetrics,
  formatMetricsReport,
  metricsToJSON,
} from '../core/metrics';

export const trainCommand = new Command('train')
  .description('Train an Otaku with auto-discovery research')
  .argument('<otaku-id>', 'ID of the Otaku to train')
  .option('--quick', 'Quick training (fewer sources, faster)')
  .option('--deep', 'Deep training (more sources, thorough)')
  .option('--no-source-code', 'Skip source code analysis')
  .option('--max-issues <n>', 'Maximum GitHub issues to analyze', '50')
  .option('--max-web <n>', 'Maximum web search results', '20')
  .option('--repo <url>', 'GitHub repository URL to analyze')
  .action(async (otakuId, options) => {
    try {
      const projectRoot = requireGakuenRoot();
      const registry = new OtakuRegistryStore(projectRoot);
      const toshokan = new ToshokanStore(projectRoot);

      const otaku = registry.getOtaku(otakuId);

      if (!otaku) {
        logger.error(`Otaku '${otakuId}' not found. Run 'aigakuen roster' to see available Otaku.`);
        process.exit(1);
      }

      logger.blank();
      logger.gakuen(`Training ${otaku.name}...`);
      logger.blank();

      // Update status to training
      registry.updateOtaku(otakuId, { status: 'training' });

      // Start metrics collection
      startMetricsCollection(otakuId, otaku.name);

      // Build DomainInfo from Otaku profile
      const domain: DomainInfo = {
        id: otaku.id,
        name: otaku.name,
        description: otaku.specialty,
        technologies: otaku.expertise.technologies,
        keywords: [...otaku.expertise.domains, ...otaku.expertise.taskTypes],
        githubRepo: options.repo,
      };

      // Build research options
      const researchOptions: ResearchOptions = {
        includeSourceCode: options.sourceCode !== false,
        maxIssues: parseInt(options.maxIssues, 10) || DEFAULT_RESEARCH_OPTIONS.maxIssues,
        maxWebResults: parseInt(options.maxWeb, 10) || DEFAULT_RESEARCH_OPTIONS.maxWebResults,
        maxReleases: DEFAULT_RESEARCH_OPTIONS.maxReleases,
      };

      // Progress callback
      const onProgress = (progress: { phase: string; progress: number; message: string }) => {
        const bar = createProgressBar(progress.progress);
        process.stdout.write(`\r${bar} ${progress.message.padEnd(60)}`);
      };

      const startTime = Date.now();

      // Run training
      let result;
      if (options.quick) {
        logger.info('Running quick training (fewer sources)...');
        result = await quickTrainOtaku(otakuId, domain, onProgress);
      } else if (options.deep) {
        logger.info('Running deep training (thorough analysis)...');
        result = await deepTrainOtaku(otakuId, domain, onProgress);
      } else {
        logger.info('Running standard training...');
        result = await trainOtaku(otakuId, domain, researchOptions, onProgress);
      }

      // Clear the progress line
      process.stdout.write('\r' + ' '.repeat(80) + '\r');

      // Save to toshokan
      logger.info('Saving knowledge to toshokan...');
      const toshokanPath = toshokan.saveTrainingResult(result);
      result.toshokanPath = toshokanPath;

      // Update Otaku with training results
      const trainingSources = result.rawKnowledge.meta.sourcesUsed.map(
        (s) => `${s.type}${s.url ? `: ${s.url}` : ''}`
      );

      registry.updateOtaku(otakuId, {
        status: 'idle',
        knowledge: {
          documentation: result.coreKnowledge.mentalModel ? [result.coreKnowledge.mentalModel.slice(0, 500)] : [],
          patterns: result.coreKnowledge.goldenPatterns.map((p) => p.name),
          examples: [],
          gotchas: result.coreKnowledge.criticalGotchas.map((g) => g.title),
        },
        meta: {
          ...otaku.meta,
          lastTrained: new Date().toISOString(),
          trainingSources,
        },
      });

      const durationSeconds = (Date.now() - startTime) / 1000;

      // Finalize and save metrics
      const metrics = finalizeMetrics();
      if (metrics) {
        const metricsDir = join(projectRoot, '.gakuen', 'metrics');
        if (!existsSync(metricsDir)) {
          mkdirSync(metricsDir, { recursive: true });
        }
        const metricsFile = join(metricsDir, `${otakuId}-${Date.now()}.json`);
        writeFileSync(metricsFile, metricsToJSON(metrics), 'utf-8');
      }

      // Display results
      logger.blank();
      logger.success(`Training complete!`);
      logger.blank();
      logger.divider();
      logger.info(`Duration: ${Math.round(durationSeconds)} seconds`);
      logger.info(`Mental model: ${result.trainingReport.knowledge.mentalModelWords} words`);
      logger.info(`Golden patterns: ${result.trainingReport.knowledge.patternsCount}`);
      logger.info(`Critical gotchas: ${result.trainingReport.knowledge.gotchasCount}`);
      logger.blank();

      // Show patterns learned
      if (result.coreKnowledge.goldenPatterns.length > 0) {
        logger.info('Patterns learned:');
        for (const pattern of result.coreKnowledge.goldenPatterns.slice(0, 5)) {
          logger.item(`${pattern.name}`);
        }
        if (result.coreKnowledge.goldenPatterns.length > 5) {
          logger.info(`  ...and ${result.coreKnowledge.goldenPatterns.length - 5} more`);
        }
        logger.blank();
      }

      // Show gotchas
      if (result.coreKnowledge.criticalGotchas.length > 0) {
        logger.info('Gotchas identified:');
        for (const gotcha of result.coreKnowledge.criticalGotchas.slice(0, 5)) {
          const emoji = { critical: '🚨', high: '⚠️', medium: '📌' }[gotcha.severity];
          logger.item(`${emoji} ${gotcha.title}`);
        }
        if (result.coreKnowledge.criticalGotchas.length > 5) {
          logger.info(`  ...and ${result.coreKnowledge.criticalGotchas.length - 5} more`);
        }
        logger.blank();
      }

      // Show knowledge gaps
      if (result.trainingReport.gaps.length > 0) {
        logger.warn('Knowledge gaps:');
        for (const gap of result.trainingReport.gaps) {
          logger.item(gap);
        }
        logger.blank();
      }

      logger.divider();
      logger.info(`Knowledge saved to: ${toshokanPath}`);
      logger.blank();

      // Display metrics report
      if (metrics) {
        logger.blank();
        console.log(formatMetricsReport(metrics));
      }

      logger.info('Next steps:');
      logger.info(`  1. Review knowledge: cat ${toshokanPath}/core-knowledge.md`);
      logger.info(`  2. Activate Otaku: aigakuen study ${otakuId}`);
      logger.blank();
    } catch (error) {
      logger.error(
        error instanceof Error ? error.message : 'Unknown error'
      );
      console.error(error);
      process.exit(1);
    }
  });

function createProgressBar(percent: number): string {
  const width = 20;
  const filled = Math.round((percent / 100) * width);
  const empty = width - filled;
  return `[${'█'.repeat(filled)}${'░'.repeat(empty)}] ${percent.toString().padStart(3)}%`;
}
