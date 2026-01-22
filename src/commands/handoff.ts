import { Command } from 'commander';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { logger } from '../utils';
import { requireGakuenRoot, OtakuRegistryStore, GakuenStore } from '../storage';
import { getGakuenPaths } from '../utils/paths';
import { prompt } from '../claude';

export const handoffCommand = new Command('handoff')
  .description('Save session state for continuity')
  .option('-m, --message <message>', 'Handoff summary message')
  .option('--completed', 'Mark current task as completed')
  .option('--blocked <reason>', 'Mark as blocked with reason')
  .option('--next <task>', 'Specify the next task')
  .option('--auto', 'Auto-generate handoff summary using Claude')
  .action(async (options) => {
    try {
      const projectRoot = requireGakuenRoot();
      const registry = new OtakuRegistryStore(projectRoot);
      const store = new GakuenStore(projectRoot);
      const paths = getGakuenPaths(projectRoot);
      const config = store.getConfig();

      const activeOtaku = registry.getActiveOtaku();

      if (!activeOtaku) {
        logger.warn('No active Otaku to hand off.');
        logger.info('Run `aigakuen study <otaku-id>` to activate an Otaku.');
        return;
      }

      logger.blank();
      logger.gakuen(`Creating handoff from ${activeOtaku.name}...`);

      // Build handoff content
      const timestamp = new Date().toISOString();
      const currentTask = config.currentTask || 'No specific task assigned';

      let handoffContent = '';

      // Read existing handoff notes
      let existingNotes = '';
      if (existsSync(paths.handoff)) {
        existingNotes = readFileSync(paths.handoff, 'utf-8');
        // Skip placeholder content
        if (existingNotes.includes('No sessions recorded yet')) {
          existingNotes = '';
        }
      }

      // Auto-generate summary if requested
      let summary = options.message || '';
      if (options.auto && !summary) {
        logger.info('Generating handoff summary...');
        try {
          summary = await generateHandoffSummary(activeOtaku.name, currentTask);
        } catch (error) {
          logger.warn('Could not auto-generate summary. Using manual input.');
        }
      }

      // Determine status
      let status = 'paused';
      if (options.completed) {
        status = 'completed';
      } else if (options.blocked) {
        status = `blocked: ${options.blocked}`;
      }

      // Build the handoff entry
      const entry = `
## Handoff: ${timestamp}

**Otaku**: ${activeOtaku.name} (\`${activeOtaku.id}\`)
**Task**: ${currentTask}
**Status**: ${status}

### Summary
${summary || 'No summary provided.'}

${options.next ? `### Next Steps\n${options.next}\n` : ''}
---
`;

      // Prepend new entry to existing notes (most recent first)
      handoffContent = `# Handoff Notes\n\nContext preserved between sessions.\n${entry}${existingNotes.replace('# Handoff Notes\n\nContext preserved between sessions.\n', '').replace('# Handoff Notes\n\n', '')}`;

      // Write handoff file
      writeFileSync(paths.handoff, handoffContent, 'utf-8');

      // Update Otaku status
      if (options.completed) {
        registry.updateOtakuStatus(activeOtaku.id, 'idle');
        // Clear current task
        store.updateConfig({ currentTask: undefined } as any);
      } else {
        registry.updateOtakuStatus(activeOtaku.id, 'suspended');
      }

      logger.blank();
      logger.success('Handoff saved!');
      logger.divider();
      logger.info(`Otaku: ${activeOtaku.name}`);
      logger.info(`Status: ${status}`);
      if (summary) {
        logger.info(`Summary: ${summary.slice(0, 100)}${summary.length > 100 ? '...' : ''}`);
      }
      logger.blank();
      logger.info(`Handoff notes saved to: ${paths.handoff}`);

      if (options.next) {
        logger.blank();
        logger.info('Next steps recorded. Use `aigakuen assign` to route to the right specialist.');
      }

      logger.blank();
    } catch (error) {
      logger.error(
        error instanceof Error ? error.message : 'Unknown error'
      );
      console.error(error);
      process.exit(1);
    }
  });

/**
 * Auto-generate a handoff summary using Claude
 */
async function generateHandoffSummary(
  otakuName: string,
  currentTask: string
): Promise<string> {
  const summaryPrompt = `You are ${otakuName}, an AI specialist who just finished working on a task.

Task: ${currentTask}

Generate a brief handoff summary (2-3 sentences) that captures:
1. What was accomplished or attempted
2. Any key decisions made
3. What remains to be done

Be concise and specific. Respond with just the summary text.`;

  const response = await prompt(summaryPrompt, {
    system: 'You are generating a brief work handoff summary. Be concise.',
  });

  return response.trim();
}
