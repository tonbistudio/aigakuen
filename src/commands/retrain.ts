import { Command } from 'commander';
import { writeFileSync, mkdirSync, existsSync, rmSync } from 'fs';
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

export const retrainCommand = new Command('retrain')
  .description('Re-train an already trained Otaku (clears existing knowledge)')
  .argument('<otaku-id>', 'ID of the Otaku to re-train')
  .option('--quick', 'Quick training (fewer sources, faster)')
  .option('--deep', 'Deep training (more sources, thorough)')
  .option('--no-source-code', 'Skip source code analysis')
  .option('--max-issues <n>', 'Maximum GitHub issues to analyze', '50')
  .option('--max-web <n>', 'Maximum web search results', '20')
  .option('--repo <url>', 'GitHub repository URL to analyze')
  .option('--force', 'Skip confirmation prompt')
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

      // Check if already trained
      if (!toshokan.isTrained(otakuId)) {
        logger.error(`Otaku '${otakuId}' has not been trained yet.`);
        logger.info(`Run \`aigakuen train ${otakuId}\` instead.`);
        process.exit(1);
      }

      // Confirm unless --force
      if (!options.force) {
        logger.blank();
        logger.warn(`This will clear existing knowledge for ${otaku.name}.`);
        logger.info('Use --force to skip this prompt.');
        logger.blank();

        const readline = await import('readline');
        const rl = readline.createInterface({
          input: process.stdin,
          output: process.stdout,
        });

        const confirmed = await new Promise<boolean>((resolve) => {
          rl.question('Continue? (y/N) ', (answer) => {
            rl.close();
            resolve(answer.toLowerCase() === 'y');
          });
        });

        if (!confirmed) {
          logger.info('Aborted.');
          process.exit(0);
        }
      }

      logger.blank();
      logger.gakuen(`Re-training ${otaku.name}...`);
      logger.blank();

      // Clear existing knowledge
      logger.info('Clearing existing knowledge...');
      toshokan.clearOtakuKnowledge(otakuId);

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
        (s: { name: string }) => s.name
      );
      const patternNames = result.coreKnowledge.goldenPatterns.map(
        (p: { name: string }) => p.name
      );
      const gotchaTitles = result.coreKnowledge.criticalGotchas.map(
        (g: { title: string }) => g.title
      );

      registry.updateOtaku(otakuId, {
        status: 'idle',
        training: {
          trainingSources,
          trainingDate: new Date().toISOString(),
          lastUpdated: new Date().toISOString(),
        },
        knowledge: {
          patterns: patternNames,
          gotchas: gotchaTitles,
          toshokanPath,
        },
      });

      const durationSec = Math.round((Date.now() - startTime) / 1000);

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
      logger.success(`${otaku.name} re-training complete!`);
      logger.divider();

      logger.info(`Duration: ${Math.floor(durationSec / 60)}m ${durationSec % 60}s`);
      logger.info(`Patterns learned: ${result.coreKnowledge.goldenPatterns.length}`);
      logger.info(`Gotchas identified: ${result.coreKnowledge.criticalGotchas.length}`);
      logger.info(`Knowledge saved to: ${toshokanPath}`);

      // Display metrics report if available
      if (metrics) {
        logger.blank();
        logger.info('Training Metrics:');
        console.log(formatMetricsReport(metrics));
      }

      if (result.report.gaps.length > 0) {
        logger.blank();
        logger.warn('Knowledge gaps identified:');
        result.report.gaps.forEach((gap: string) => logger.dim(`  - ${gap}`));
      }

      logger.blank();
      logger.info(`Run \`aigakuen study ${otakuId}\` to activate this specialist.`);
      logger.blank();
    } catch (error) {
      logger.error(
        error instanceof Error ? error.message : 'Unknown error during re-training'
      );
      console.error(error);
      process.exit(1);
    }
  });

function createProgressBar(progress: number): string {
  const width = 20;
  const filled = Math.round((progress / 100) * width);
  const empty = width - filled;
  return `[${'█'.repeat(filled)}${'░'.repeat(empty)}] ${progress.toString().padStart(3)}%`;
}
