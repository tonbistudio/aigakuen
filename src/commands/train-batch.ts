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
import type { DomainInfo, ResearchOptions, TrainingResult } from '../core/research';
import {
  startMetricsCollection,
  finalizeMetrics,
  metricsToJSON,
} from '../core/metrics';

interface BatchResult {
  otakuId: string;
  otakuName: string;
  success: boolean;
  duration: number;
  patterns: number;
  gotchas: number;
  error?: string;
}

export const trainBatchCommand = new Command('train-batch')
  .description('Train multiple Otaku in parallel')
  .option('--quick', 'Quick training for all (fewer sources, faster)')
  .option('--deep', 'Deep training for all (more sources, thorough)')
  .option('--parallel <n>', 'Number of parallel trainings', '3')
  .option('--all', 'Train all untrained Otaku')
  .option('--ids <ids>', 'Comma-separated list of Otaku IDs to train')
  .option('--no-source-code', 'Skip source code analysis')
  .action(async (options) => {
    try {
      const projectRoot = requireGakuenRoot();
      const registry = new OtakuRegistryStore(projectRoot);
      const toshokan = new ToshokanStore(projectRoot);

      // Determine which Otaku to train
      let otakuIds: string[] = [];

      if (options.ids) {
        otakuIds = options.ids.split(',').map((id: string) => id.trim());
      } else if (options.all) {
        // Get all untrained Otaku
        const allOtaku = registry.listOtaku();
        otakuIds = allOtaku
          .filter((o) => o.status === 'recommended' || !toshokan.isTrained(o.id))
          .map((o) => o.id);
      }

      if (otakuIds.length === 0) {
        logger.error('No Otaku specified. Use --all or --ids <id1,id2,...>');
        process.exit(1);
      }

      // Validate all Otaku exist
      const validOtaku = otakuIds.filter((id) => registry.getOtaku(id));
      if (validOtaku.length !== otakuIds.length) {
        const invalid = otakuIds.filter((id) => !registry.getOtaku(id));
        logger.error(`Invalid Otaku IDs: ${invalid.join(', ')}`);
        process.exit(1);
      }

      const parallelCount = Math.min(parseInt(options.parallel, 10) || 3, otakuIds.length);

      logger.blank();
      logger.gakuen(`Batch training ${otakuIds.length} Otaku (${parallelCount} in parallel)...`);
      logger.blank();

      const mode = options.quick ? 'quick' : options.deep ? 'deep' : 'standard';
      logger.info(`Training mode: ${mode}`);
      logger.blank();

      const results: BatchResult[] = [];
      const startTime = Date.now();

      // Process in batches
      for (let i = 0; i < otakuIds.length; i += parallelCount) {
        const batch = otakuIds.slice(i, i + parallelCount);
        const batchNum = Math.floor(i / parallelCount) + 1;
        const totalBatches = Math.ceil(otakuIds.length / parallelCount);

        logger.info(`Batch ${batchNum}/${totalBatches}: ${batch.join(', ')}`);

        // Train batch in parallel
        const batchPromises = batch.map((otakuId) =>
          trainSingleOtaku(
            projectRoot,
            registry,
            toshokan,
            otakuId,
            mode,
            options.sourceCode !== false
          )
        );

        const batchResults = await Promise.all(batchPromises);
        results.push(...batchResults);

        // Show batch progress
        const completed = results.filter((r) => r.success).length;
        const failed = results.filter((r) => !r.success).length;
        logger.info(`  ✓ ${completed} completed, ${failed} failed`);
        logger.blank();
      }

      // Summary
      const totalDuration = Math.round((Date.now() - startTime) / 1000);
      const successful = results.filter((r) => r.success);
      const failed = results.filter((r) => !r.success);

      logger.divider();
      logger.success(`Batch training complete!`);
      logger.blank();
      logger.info(`Total time: ${Math.floor(totalDuration / 60)}m ${totalDuration % 60}s`);
      logger.info(`Successful: ${successful.length}/${results.length}`);

      if (successful.length > 0) {
        const totalPatterns = successful.reduce((sum, r) => sum + r.patterns, 0);
        const totalGotchas = successful.reduce((sum, r) => sum + r.gotchas, 0);
        logger.info(`Total patterns: ${totalPatterns}`);
        logger.info(`Total gotchas: ${totalGotchas}`);
      }

      if (failed.length > 0) {
        logger.blank();
        logger.warn('Failed trainings:');
        for (const f of failed) {
          logger.dim(`  - ${f.otakuName}: ${f.error}`);
        }
      }

      // Save batch report
      const reportPath = join(projectRoot, '.gakuen', 'batch-training-report.json');
      writeFileSync(reportPath, JSON.stringify({
        timestamp: new Date().toISOString(),
        mode,
        parallelCount,
        totalDuration,
        results,
      }, null, 2), 'utf-8');
      logger.blank();
      logger.info(`Report saved: ${reportPath}`);

      logger.blank();
    } catch (error) {
      logger.error(
        error instanceof Error ? error.message : 'Unknown error during batch training'
      );
      console.error(error);
      process.exit(1);
    }
  });

async function trainSingleOtaku(
  projectRoot: string,
  registry: OtakuRegistryStore,
  toshokan: ToshokanStore,
  otakuId: string,
  mode: 'quick' | 'standard' | 'deep',
  includeSourceCode: boolean
): Promise<BatchResult> {
  const otaku = registry.getOtaku(otakuId)!;
  const startTime = Date.now();

  try {
    // Update status to training
    registry.updateOtaku(otakuId, { status: 'training' });

    // Start metrics collection
    startMetricsCollection(otakuId, otaku.name);

    // Build DomainInfo
    const domain: DomainInfo = {
      id: otaku.id,
      name: otaku.name,
      description: otaku.specialty,
      technologies: otaku.expertise.technologies,
      keywords: [...otaku.expertise.domains, ...otaku.expertise.taskTypes],
    };

    // Build research options
    const researchOptions: ResearchOptions = {
      includeSourceCode,
      maxIssues: DEFAULT_RESEARCH_OPTIONS.maxIssues,
      maxWebResults: DEFAULT_RESEARCH_OPTIONS.maxWebResults,
      maxReleases: DEFAULT_RESEARCH_OPTIONS.maxReleases,
    };

    // Silent progress (no console output)
    const onProgress = () => {};

    // Run training
    let result: TrainingResult;
    if (mode === 'quick') {
      result = await quickTrainOtaku(otakuId, domain, onProgress);
    } else if (mode === 'deep') {
      result = await deepTrainOtaku(otakuId, domain, onProgress);
    } else {
      result = await trainOtaku(otakuId, domain, researchOptions, onProgress);
    }

    // Save to toshokan
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

    return {
      otakuId,
      otakuName: otaku.name,
      success: true,
      duration: Math.round((Date.now() - startTime) / 1000),
      patterns: result.coreKnowledge.goldenPatterns.length,
      gotchas: result.coreKnowledge.criticalGotchas.length,
    };
  } catch (error) {
    // Reset status on failure
    registry.updateOtaku(otakuId, { status: 'recommended' });

    return {
      otakuId,
      otakuName: otaku.name,
      success: false,
      duration: Math.round((Date.now() - startTime) / 1000),
      patterns: 0,
      gotchas: 0,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}
