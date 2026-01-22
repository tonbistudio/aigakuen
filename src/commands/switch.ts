import { Command } from 'commander';
import { existsSync, readFileSync, writeFileSync } from 'fs';
import { dirname, resolve } from 'path';
import { logger } from '../utils';
import { requireGakuenRoot, OtakuRegistryStore, GakuenStore, ToshokanStore } from '../storage';
import { loadClaudeMdContext, writeClaudeMd } from '../core/generator';
import { getGakuenPaths } from '../utils/paths';

function getGakuenCliPath(): string {
  const scriptPath = process.argv[1];
  if (scriptPath) {
    const srcDir = dirname(scriptPath);
    return resolve(srcDir, '..');
  }
  return 'aigakuen';
}

export const switchCommand = new Command('switch')
  .description('Switch to a different Otaku (auto-handoff from current)')
  .argument('<otaku-id>', 'ID of the Otaku to switch to')
  .option('--no-handoff', 'Skip saving handoff context from current Otaku')
  .action(async (otakuId, options) => {
    try {
      const projectRoot = requireGakuenRoot();
      const registry = new OtakuRegistryStore(projectRoot);
      const store = new GakuenStore(projectRoot);
      const toshokan = new ToshokanStore(projectRoot);
      const paths = getGakuenPaths(projectRoot);
      const config = store.getConfig();

      const currentOtaku = registry.getActiveOtaku();
      const newOtaku = registry.getOtaku(otakuId);

      if (!newOtaku) {
        logger.error(`Otaku '${otakuId}' not found.`);
        logger.info('List available Otaku with: `aigakuen roster`');
        process.exit(1);
      }

      // Check if trained
      if (!toshokan.isTrained(otakuId)) {
        logger.error(`Otaku '${otakuId}' has not been trained.`);
        logger.info(`Train first: \`aigakuen train ${otakuId}\``);
        process.exit(1);
      }

      // Already active?
      if (currentOtaku?.id === otakuId) {
        logger.info(`${newOtaku.name} is already active.`);
        return;
      }

      logger.blank();

      // Auto-handoff from current Otaku
      if (currentOtaku && options.handoff !== false) {
        logger.gakuen(`Saving handoff from ${currentOtaku.name}...`);

        // Quick handoff entry
        const timestamp = new Date().toISOString();
        const currentTask = config.currentTask || 'No specific task';

        const entry = `
## Handoff: ${timestamp}

**Otaku**: ${currentOtaku.name} (\`${currentOtaku.id}\`)
**Task**: ${currentTask}
**Status**: switched to ${newOtaku.name}

### Summary
Switched specialists mid-session.

---
`;
        // Prepend to existing handoff
        let existingNotes = '';
        if (existsSync(paths.handoff)) {
          existingNotes = readFileSync(paths.handoff, 'utf-8')
            .replace('# Handoff Notes\n\nContext preserved between sessions.\n', '')
            .replace('# Handoff Notes\n\n', '');
        }

        const handoffContent = `# Handoff Notes\n\nContext preserved between sessions.\n${entry}${existingNotes}`;
        writeFileSync(paths.handoff, handoffContent, 'utf-8');

        registry.updateOtakuStatus(currentOtaku.id, 'idle');
        logger.success('Handoff saved.');
      }

      // Activate new Otaku
      logger.gakuen(`Switching to ${newOtaku.name}...`);

      const allOtaku = registry.listOtaku();
      const gakuenCliPath = getGakuenCliPath();
      const context = loadClaudeMdContext(projectRoot, allOtaku, otakuId, gakuenCliPath);
      const claudeMdPath = writeClaudeMd(projectRoot, context);

      registry.updateOtakuStatus(otakuId, 'studying');
      store.updateConfig({
        activeOtaku: otakuId,
        gakuenCliPath,
      } as any);

      logger.blank();
      logger.success(`${newOtaku.name} is now active!`);
      logger.info(`CLAUDE.md updated: ${claudeMdPath}`);
      logger.blank();
    } catch (error) {
      logger.error(
        error instanceof Error ? error.message : 'Unknown error'
      );
      process.exit(1);
    }
  });
