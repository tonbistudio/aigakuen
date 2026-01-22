import { Command } from 'commander';
import { existsSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import ora from 'ora';
import { logger } from '../utils';
import { requireGakuenRoot, OtakuRegistryStore, GakuenStore, ToshokanStore } from '../storage';
import { getGakuenPaths } from '../utils/paths';
import {
  gatherSessionContext,
  extractSessionIssues,
  detectKnowledgeGaps,
  applyKnowledgeUpdates,
  generateReflectionReport,
} from '../core/reflection';

export const reflectCommand = new Command('reflect')
  .description('Analyze session to find knowledge gaps and improve Otaku training')
  .option('--otaku <id>', 'Analyze for specific Otaku (defaults to active)')
  .option('--dry-run', 'Show gaps without applying updates')
  .option('--save-report', 'Save reflection report to .gakuen/')
  .action(async (options) => {
    const spinner = ora();

    try {
      const projectRoot = requireGakuenRoot();
      const registry = new OtakuRegistryStore(projectRoot);
      const store = new GakuenStore(projectRoot);
      const toshokan = new ToshokanStore(projectRoot);
      const paths = getGakuenPaths(projectRoot);
      const config = store.getConfig();

      // Determine which Otaku to analyze
      const otakuId = options.otaku || config.activeOtaku;

      if (!otakuId) {
        logger.error('No active Otaku. Specify one with --otaku <id>');
        process.exit(1);
      }

      const otaku = registry.getOtaku(otakuId);
      if (!otaku) {
        logger.error(`Otaku '${otakuId}' not found.`);
        process.exit(1);
      }

      logger.blank();
      logger.gakuen(`Reflecting on session with: ${otaku.name}`);
      logger.divider();

      // Step 1: Gather session context
      spinner.start('Gathering session context...');

      const context = await gatherSessionContext(
        projectRoot,
        paths.handoff,
        otakuId,
        config.currentTask
      );

      const commitCount = context.recentCommits.length;
      const hasHandoff = context.handoffContent.length > 50;

      spinner.succeed(
        `Found ${commitCount} recent commits${hasHandoff ? ' and handoff notes' : ''}`
      );

      if (commitCount === 0 && !hasHandoff) {
        logger.warn('No session data found. Nothing to reflect on.');
        logger.info('Try running after making some commits or saving a handoff.');
        return;
      }

      // Step 2: Extract issues from session
      spinner.start('Analyzing session for issues...');

      const issues = await extractSessionIssues(context);

      if (issues.length === 0) {
        spinner.succeed('No issues found in session');
        logger.info('Either everything went smoothly, or issues are in a format I couldn\'t parse.');
        return;
      }

      spinner.succeed(`Found ${issues.length} issue(s) to analyze`);

      // Display found issues
      logger.blank();
      logger.info('Discovered Issues:');
      for (const issue of issues) {
        const severityIcon = {
          critical: '🚨',
          high: '⚠️',
          medium: '📌',
          low: '📝',
        }[issue.severity] || '📝';

        logger.info(`  ${severityIcon} ${issue.description}`);
        logger.info(`     Cause: ${issue.rootCause}`);
        logger.info(`     Fix: ${issue.fix}`);
      }

      // Step 3: Load Otaku's current knowledge
      spinner.start('Loading Otaku knowledge...');

      const knowledge = toshokan.getTrainingData(otakuId);
      const coreKnowledge = knowledge?.coreKnowledge;

      const otakuKnowledge = {
        id: otakuId,
        name: otaku.name,
        specialty: otaku.specialty,
        domains: otaku.domains || [],
        patterns: coreKnowledge?.goldenPatterns || [],
        gotchas: coreKnowledge?.criticalGotchas || [],
      };

      spinner.succeed(
        `Loaded ${otakuKnowledge.gotchas.length} existing gotchas, ${otakuKnowledge.patterns.length} patterns`
      );

      // Step 4: Detect knowledge gaps
      spinner.start('Detecting knowledge gaps...');

      const gaps = await detectKnowledgeGaps(issues, otakuKnowledge);

      if (gaps.length === 0) {
        spinner.succeed('No knowledge gaps found');
        logger.info(`${otaku.name} already knew about these issues, or they're outside their domain.`);
        return;
      }

      spinner.succeed(`Found ${gaps.length} knowledge gap(s)`);

      // Display gaps
      logger.blank();
      logger.divider();
      logger.info('Knowledge Gaps:');
      logger.blank();

      for (const gap of gaps) {
        logger.info(`📚 ${gap.issue.description}`);
        logger.info(`   → ${gap.reasoning}`);

        if (gap.suggestedGotcha) {
          logger.success(`   + New Gotcha: "${gap.suggestedGotcha.title}"`);
        }
        if (gap.suggestedPattern) {
          logger.success(`   + New Pattern: "${gap.suggestedPattern.name}"`);
        }
        logger.blank();
      }

      // Step 5: Apply updates (unless dry-run)
      if (options.dryRun) {
        logger.info('Dry run - no updates applied.');
        logger.info('Run without --dry-run to apply these updates.');
        return;
      }

      spinner.start('Applying knowledge updates...');

      const updateResult = await applyKnowledgeUpdates(
        paths.toshokan,
        otakuId,
        gaps
      );

      spinner.succeed(
        `Added ${updateResult.gotchasAdded} gotcha(s), ${updateResult.patternsAdded} pattern(s)`
      );

      // Step 6: Save report if requested
      if (options.saveReport) {
        const report = generateReflectionReport(gaps, updateResult);
        const reportPath = join(
          paths.root,
          `reflection-${otakuId}-${Date.now()}.md`
        );
        writeFileSync(reportPath, report);
        logger.info(`Report saved: ${reportPath}`);
      }

      // Summary
      logger.blank();
      logger.divider();
      logger.success(`${otaku.name} has been updated with new knowledge!`);
      logger.blank();

      if (updateResult.filesUpdated.length > 0) {
        logger.info('Updated files:');
        for (const file of updateResult.filesUpdated) {
          logger.info(`  - ${file}`);
        }
      }

      logger.blank();
      logger.info('Tip: Run `aigakuen train --refresh` to re-synthesize with new knowledge.');
      logger.blank();

    } catch (error) {
      spinner.fail('Reflection failed');
      logger.error(
        error instanceof Error ? error.message : 'Unknown error'
      );
      console.error(error);
      process.exit(1);
    }
  });
