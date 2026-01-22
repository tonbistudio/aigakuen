import { Command } from 'commander';
import { existsSync, readFileSync, writeFileSync } from 'fs';
import { dirname, resolve } from 'path';
import { logger } from '../utils';
import { requireGakuenRoot, OtakuRegistryStore, GakuenStore, ToshokanStore } from '../storage';
import { loadClaudeMdContext, writeClaudeMd } from '../core/generator';
import { getGakuenPaths } from '../utils/paths';

/**
 * Get the path to the aigakuen CLI installation
 */
function getGakuenCliPath(): string {
  // Get the directory of the current script (src/commands/study.ts)
  // Go up two levels to get the aigakuen root
  const scriptPath = process.argv[1];
  if (scriptPath) {
    // Handle both direct execution and tsx execution
    const srcDir = dirname(scriptPath);
    const aigakuenRoot = resolve(srcDir, '..');
    return aigakuenRoot;
  }
  return 'aigakuen';
}

export const studyCommand = new Command('study')
  .description('Activate an Otaku for development (generates CLAUDE.md)')
  .argument('<otaku-id>', 'ID of the Otaku to activate')
  .option('--task <description>', 'Set the current task for this Otaku')
  .option('--no-backup', 'Skip backing up existing CLAUDE.md')
  .action(async (otakuId, options) => {
    try {
      const projectRoot = requireGakuenRoot();
      const registry = new OtakuRegistryStore(projectRoot);
      const store = new GakuenStore(projectRoot);
      const toshokan = new ToshokanStore(projectRoot);
      const paths = getGakuenPaths(projectRoot);

      const otaku = registry.getOtaku(otakuId);

      if (!otaku) {
        logger.error(`Otaku '${otakuId}' not found.`);
        logger.info('Run `aigakuen roster` to see available Otaku.');
        process.exit(1);
      }

      if (otaku.status === 'recommended') {
        logger.error(`Otaku '${otakuId}' has not been trained yet.`);
        logger.info(`Run \`aigakuen train ${otakuId}\` first.`);
        process.exit(1);
      }

      // Check if trained
      if (!toshokan.isTrained(otakuId)) {
        logger.error(`Otaku '${otakuId}' has no knowledge in toshokan.`);
        logger.info(`Run \`aigakuen train ${otakuId}\` first.`);
        process.exit(1);
      }

      logger.blank();
      logger.gakuen(`Activating ${otaku.name}...`);

      // Backup existing CLAUDE.md if it exists and backup is enabled
      if (options.backup !== false && existsSync(paths.claudeMd)) {
        const backupPath = `${paths.claudeMd}.backup`;
        const existingContent = readFileSync(paths.claudeMd, 'utf-8');
        writeFileSync(backupPath, existingContent);
        logger.info(`Backed up existing CLAUDE.md to ${backupPath}`);
      }

      // Deactivate any currently active Otaku
      const currentlyActive = registry.getActiveOtaku();
      if (currentlyActive && currentlyActive.id !== otakuId) {
        registry.updateOtakuStatus(currentlyActive.id, 'idle');
        logger.info(`Deactivated ${currentlyActive.name}`);
      }

      // Load context and generate CLAUDE.md
      const allOtaku = registry.listOtaku();
      const gakuenCliPath = getGakuenCliPath();
      const context = loadClaudeMdContext(projectRoot, allOtaku, otakuId, gakuenCliPath);

      // Store the CLI path in config for future use
      store.updateConfig({ gakuenCliPath } as any);

      // Set current task if provided
      if (options.task) {
        context.currentTask = options.task;
      }

      // Generate and write CLAUDE.md
      const claudeMdPath = writeClaudeMd(projectRoot, context);

      // Update Otaku status
      registry.updateOtakuStatus(otakuId, 'studying');

      // Update config with active Otaku
      store.updateConfig({ activeOtaku: otakuId } as any);

      logger.blank();
      logger.success(`${otaku.name} is now active!`);
      logger.divider();

      // Show what's loaded
      const knowledge = toshokan.loadCoreKnowledge(otakuId);
      if (knowledge) {
        logger.info(`Mental model: ${knowledge.mentalModel.split(' ').length} words`);
        logger.info(`Patterns loaded: ${knowledge.goldenPatterns.length}`);
        logger.info(`Gotchas loaded: ${knowledge.criticalGotchas.length}`);
      }

      logger.blank();
      logger.info(`CLAUDE.md generated at: ${claudeMdPath}`);

      if (options.task) {
        logger.blank();
        logger.task(`Current task: ${options.task}`);
      }

      logger.blank();
      logger.info('Claude Code will now use this specialist\'s knowledge.');
      logger.info('When done, run `aigakuen handoff` to save context.');
      logger.blank();
    } catch (error) {
      logger.error(
        error instanceof Error ? error.message : 'Unknown error'
      );
      console.error(error);
      process.exit(1);
    }
  });
