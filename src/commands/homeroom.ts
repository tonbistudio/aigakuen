import { Command } from 'commander';
import chalk from 'chalk';
import {
  GakuenStore,
  OtakuRegistryStore,
  TaskboardStore,
  requireGakuenRoot,
} from '../storage';
import { OtakuStatus, TaskStatus } from '../types';
import { logger } from '../utils';

export const homeroomCommand = new Command('homeroom')
  .description('View the AI Gakuen status dashboard')
  .action(async () => {
    try {
      const projectRoot = requireGakuenRoot();
      const store = new GakuenStore(projectRoot);
      const registry = new OtakuRegistryStore(projectRoot);
      const taskboard = new TaskboardStore(projectRoot);

      const config = store.getConfig();
      const otakuList = registry.listOtaku();
      const tasks = taskboard.listTasks();

      logger.blank();
      console.log(chalk.bold.magenta('🏫 AI Gakuen Homeroom'));
      console.log(chalk.gray(`   Project: ${config.projectName}`));
      logger.blank();
      logger.divider();

      // Active Otaku section
      logger.blank();
      console.log(chalk.bold('Active Otaku:'));
      logger.blank();

      const activeOtaku = registry.getActiveOtaku();
      const trainedOtaku = registry.getTrainedOtaku();

      if (trainedOtaku.length === 0) {
        console.log(chalk.gray('   No Otaku trained yet.'));
        console.log(
          chalk.gray('   Run `aigakuen enroll <spec>` to get started.')
        );
      } else {
        for (const otaku of trainedOtaku) {
          const isActive = otaku.status === 'studying';
          const statusIcon = getOtakuStatusIcon(otaku.status);
          const statusText = isActive
            ? chalk.green('(studying)')
            : chalk.gray(`(${otaku.status})`);

          console.log(`   ${statusIcon} ${chalk.bold(otaku.name)} ${statusText}`);

          if (isActive) {
            const otakuTasks = taskboard.getTasksForOtaku(otaku.id);
            const currentTask = otakuTasks.find(
              (t) => t.status === 'in_progress'
            );

            if (currentTask) {
              console.log(chalk.cyan(`      Current: "${currentTask.title}"`));
              console.log(
                chalk.gray(`      Status: ${getTaskStatusText(currentTask.status)}`)
              );
            }
          }
        }
      }

      logger.blank();
      logger.divider();

      // Taskboard section
      logger.blank();
      console.log(chalk.bold('Taskboard:'));
      logger.blank();

      const completed = tasks.filter((t) => t.status === 'completed');
      const total = tasks.length;

      if (total === 0) {
        console.log(chalk.gray('   No tasks yet.'));
        console.log(
          chalk.gray('   Run `aigakuen assign "task description"` to add tasks.')
        );
      } else {
        // Progress bar
        const progress = total > 0 ? Math.round((completed.length / total) * 5) : 0;
        const progressBar = '■'.repeat(progress) + '□'.repeat(5 - progress);
        console.log(
          `   [${progressBar}] ${completed.length}/${total} tasks complete`
        );
        logger.blank();

        // Task list
        for (const task of tasks) {
          const icon = getTaskIcon(task.status);
          const text =
            task.status === 'completed'
              ? chalk.strikethrough.gray(task.title)
              : task.title;
          const assignee = task.assignedTo
            ? chalk.cyan(` (${task.assignedTo})`)
            : chalk.gray(' (unassigned)');

          console.log(`   ${icon} ${text}${task.status !== 'completed' ? assignee : ''}`);
        }
      }

      logger.blank();
      logger.divider();

      // Quick stats
      logger.blank();
      const recommendedCount = otakuList.filter(
        (o) => o.status === 'recommended'
      ).length;

      if (recommendedCount > 0) {
        logger.info(
          `${recommendedCount} Otaku recommended but not yet trained.`
        );
        logger.info('Run `aigakuen train <otaku-id>` to train them.');
      }

      if (activeOtaku) {
        logger.info(`Active: ${activeOtaku.name}`);
        logger.info(
          'Run `aigakuen handoff` before ending your session.'
        );
      }

      logger.blank();
    } catch (error) {
      logger.error(
        error instanceof Error ? error.message : 'Unknown error'
      );
      process.exit(1);
    }
  });

function getOtakuStatusIcon(status: OtakuStatus): string {
  switch (status) {
    case 'studying':
      return '📖';
    case 'idle':
      return '💤';
    case 'suspended':
      return '⏸️';
    default:
      return '❓';
  }
}

function getTaskIcon(status: TaskStatus): string {
  switch (status) {
    case 'completed':
      return '✅';
    case 'in_progress':
      return '🔄';
    case 'blocked':
      return '🚫';
    case 'assigned':
      return '📋';
    case 'paused':
      return '⏸️';
    default:
      return '⬜';
  }
}

function getTaskStatusText(status: TaskStatus): string {
  switch (status) {
    case 'in_progress':
      return 'In progress';
    case 'blocked':
      return 'Blocked';
    case 'assigned':
      return 'Assigned';
    case 'paused':
      return 'Paused';
    default:
      return status;
  }
}
