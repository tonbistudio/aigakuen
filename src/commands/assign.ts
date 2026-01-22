import { Command } from 'commander';
import { dirname, resolve } from 'path';
import { logger } from '../utils';
import { requireGakuenRoot, TaskboardStore, OtakuRegistryStore, GakuenStore, ToshokanStore } from '../storage';
import { routeTask } from '../core/orchestrator';
import { loadClaudeMdContext, writeClaudeMd } from '../core/generator';

function getGakuenCliPath(): string {
  const scriptPath = process.argv[1];
  if (scriptPath) {
    const srcDir = dirname(scriptPath);
    return resolve(srcDir, '..');
  }
  return 'aigakuen';
}

export const assignCommand = new Command('assign')
  .description('Assign a task to an Otaku (auto-routes and activates by default)')
  .argument('<task>', 'Task description')
  .option('--to <otaku-id>', 'Assign to specific Otaku (skips auto-routing)')
  .option('-p, --priority <priority>', 'Task priority (low, medium, high, critical)', 'medium')
  .option('--no-activate', 'Queue task without switching to the assigned Otaku')
  .option('--dry-run', 'Show routing decision without creating task')
  .action(async (taskDescription, options) => {
    try {
      const projectRoot = requireGakuenRoot();
      const taskboard = new TaskboardStore(projectRoot);
      const registry = new OtakuRegistryStore(projectRoot);
      const store = new GakuenStore(projectRoot);
      const toshokan = new ToshokanStore(projectRoot);

      const allOtaku = registry.listOtaku();
      const trainedOtaku = allOtaku.filter((o) => o.status !== 'recommended');

      if (trainedOtaku.length === 0) {
        logger.error('No trained Otaku available.');
        logger.info('Train an Otaku first: `aigakuen train <otaku-id>`');
        process.exit(1);
      }

      let assignedOtakuId: string | undefined = options.to;
      let routingReason = 'Manually assigned';

      // Auto-route if no specific Otaku specified
      if (!assignedOtakuId) {
        logger.blank();
        logger.gakuen('Class Pres is analyzing the task...');

        const routing = await routeTask(taskDescription, trainedOtaku);

        if (routing) {
          assignedOtakuId = routing.otakuId;
          routingReason = routing.reason;

          logger.blank();
          logger.info(`Routing decision: ${routing.otakuName}`);
          logger.info(`Confidence: ${routing.confidence}`);
          logger.info(`Reason: ${routing.reason}`);

          if (routing.alternativeIds && routing.alternativeIds.length > 0) {
            const altNames = routing.alternativeIds
              .map((id) => registry.getOtaku(id)?.name || id)
              .join(', ');
            logger.info(`Alternatives: ${altNames}`);
          }
        } else {
          logger.warn('Could not determine appropriate Otaku.');
          logger.info('Use --to <otaku-id> to manually assign.');
          process.exit(1);
        }
      }

      // Validate Otaku exists
      const otaku = registry.getOtaku(assignedOtakuId!);
      if (!otaku) {
        logger.error(`Otaku '${assignedOtakuId}' not found.`);
        process.exit(1);
      }

      // Check if trained
      if (!toshokan.isTrained(assignedOtakuId!)) {
        logger.error(`Otaku '${assignedOtakuId}' has not been trained.`);
        logger.info(`Train first: \`aigakuen train ${assignedOtakuId}\``);
        process.exit(1);
      }

      if (options.dryRun) {
        logger.blank();
        logger.info('Dry run - no task created.');
        logger.info(`Would assign to: ${otaku.name} (${otaku.id})`);
        return;
      }

      // Create the task
      const task = taskboard.createTask(taskDescription, {
        assignedTo: assignedOtakuId,
        priority: options.priority,
      });

      logger.blank();
      logger.success('Task assigned!');
      logger.divider();
      logger.info(`Task: ${task.title}`);
      logger.info(`ID: ${task.id}`);
      logger.info(`Priority: ${task.priority}`);
      logger.info(`Assigned to: ${otaku.name} (${otaku.id})`);
      logger.info(`Routing: ${routingReason}`);

      // Auto-activate by default (unless --no-activate is passed)
      if (options.activate !== false) {
        logger.blank();
        logger.gakuen(`Activating ${otaku.name}...`);

        // Deactivate current Otaku if any
        const currentlyActive = registry.getActiveOtaku();
        if (currentlyActive && currentlyActive.id !== assignedOtakuId) {
          registry.updateOtakuStatus(currentlyActive.id, 'idle');
        }

        // Load context and generate CLAUDE.md
        const gakuenCliPath = getGakuenCliPath();
        const context = loadClaudeMdContext(projectRoot, allOtaku, assignedOtakuId, gakuenCliPath);
        context.currentTask = taskDescription;

        const claudeMdPath = writeClaudeMd(projectRoot, context);

        // Update Otaku status
        registry.updateOtakuStatus(assignedOtakuId!, 'studying');

        // Update config
        store.updateConfig({
          activeOtaku: assignedOtakuId,
          currentTask: taskDescription,
          gakuenCliPath,
        } as any);

        logger.success(`${otaku.name} is now active!`);
        logger.info(`CLAUDE.md updated: ${claudeMdPath}`);
      } else {
        logger.blank();
        logger.info('Task queued (use `aigakuen study` to activate later).');
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
