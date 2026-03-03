import { Command } from 'commander';
import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';
import { logger } from '../utils';
import { requireGakuenRoot, OtakuRegistryStore, ToshokanStore } from '../storage';
import { createOtakuFromPrompt } from '../core/analyzer/otaku-recommender';
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

export const createCommand = new Command('create')
  .description('Create an Otaku from a prompt and optionally train it')
  .argument('<prompt>', 'Description of the expert to create (e.g., "React hooks and state management expert")')
  .option('--no-train', 'Skip auto-training after creation')
  .option('--quick', 'Quick training (fewer sources, faster)')
  .option('--deep', 'Deep training (more sources, thorough)')
  .option('--repo <url>', 'GitHub repository URL to analyze')
  .action(async (promptText, options) => {
    try {
      const projectRoot = requireGakuenRoot();
      const registry = new OtakuRegistryStore(projectRoot);

      // Step 1: Generate Otaku profile from prompt
      logger.blank();
      logger.gakuen(`Creating Otaku from prompt...`);
      logger.info(`"${promptText}"`);
      logger.blank();

      const profile = await createOtakuFromPrompt(promptText);

      // Display profile summary
      logger.success(`Generated: ${profile.name} (${profile.id})`);
      logger.info(`  Specialty: ${profile.specialty}`);
      logger.info(`  "${profile.catchphrase}"`);
      logger.info(`  Technologies: ${profile.expertise.technologies.slice(0, 5).join(', ')}`);
      logger.blank();

      // Step 2: Register the Otaku
      const fullProfile = {
        ...profile,
        meta: {
          createdAt: new Date().toISOString(),
          lastTrained: null,
          lastActive: null,
          trainingSources: [],
        },
      };

      registry.registerOtaku(fullProfile);
      logger.success(`Registered ${profile.name} in roster.`);

      // Step 3: Train (unless --no-train)
      if (options.train === false) {
        logger.blank();
        logger.info('Skipped training (--no-train).');
        logger.info('Next steps:');
        logger.info(`  1. Train: aigakuen train ${profile.id}`);
        logger.info(`  2. Activate: aigakuen study ${profile.id}`);
        logger.blank();
        return;
      }

      logger.blank();
      logger.gakuen(`Training ${profile.name}...`);
      logger.blank();

      // Update status to training
      registry.updateOtaku(profile.id, { status: 'training' });

      // Start metrics collection
      startMetricsCollection(profile.id, profile.name);

      // Build DomainInfo from profile
      const domain: DomainInfo = {
        id: profile.id,
        name: profile.name,
        description: profile.specialty,
        technologies: profile.expertise.technologies,
        keywords: [...profile.expertise.domains, ...profile.expertise.taskTypes],
        githubRepo: options.repo,
      };

      // Build research options
      const researchOptions: ResearchOptions = {
        includeSourceCode: true,
        maxIssues: DEFAULT_RESEARCH_OPTIONS.maxIssues,
        maxWebResults: DEFAULT_RESEARCH_OPTIONS.maxWebResults,
        maxReleases: DEFAULT_RESEARCH_OPTIONS.maxReleases,
      };

      // Progress callback
      const onProgress = (progress: { phase: string; progress: number; message: string }) => {
        const bar = createProgressBar(progress.progress);
        process.stdout.write(`\r${bar} ${progress.message.padEnd(60)}`);
      };

      const startTime = Date.now();

      // Run training
      const toshokan = new ToshokanStore(projectRoot);
      let result;
      if (options.quick) {
        logger.info('Running quick training (fewer sources)...');
        result = await quickTrainOtaku(profile.id, domain, onProgress);
      } else if (options.deep) {
        logger.info('Running deep training (thorough analysis)...');
        result = await deepTrainOtaku(profile.id, domain, onProgress);
      } else {
        logger.info('Running standard training...');
        result = await trainOtaku(profile.id, domain, researchOptions, onProgress);
      }

      // Clear the progress line
      process.stdout.write('\r' + ' '.repeat(80) + '\r');

      // Save to toshokan
      logger.info('Saving knowledge to toshokan...');
      const toshokanPath = toshokan.saveTrainingResult(result);
      result.toshokanPath = toshokanPath;

      // Update Otaku with training results
      const trainingSources = result.rawKnowledge.meta.sourcesUsed.map(
        (s: any) => `${s.type}${s.url ? `: ${s.url}` : ''}`
      );

      registry.updateOtaku(profile.id, {
        status: 'idle',
        knowledge: {
          documentation: result.coreKnowledge.mentalModel ? [result.coreKnowledge.mentalModel.slice(0, 500)] : [],
          patterns: result.coreKnowledge.goldenPatterns.map((p: any) => p.name),
          examples: [],
          gotchas: result.coreKnowledge.criticalGotchas.map((g: any) => g.title),
        },
        meta: {
          ...fullProfile.meta,
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
        const metricsFile = join(metricsDir, `${profile.id}-${Date.now()}.json`);
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
      logger.info(`  2. Activate Otaku: aigakuen study ${profile.id}`);
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
