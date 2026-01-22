import { Command } from 'commander';
import chalk from 'chalk';
import { logger } from '../utils';
import { requireGakuenRoot, TaskboardStore, OtakuRegistryStore } from '../storage';
import { TaskStatus } from '../types';

export const tasksCommand = new Command('tasks')
  .description('List all tasks')
  .option('-s, --status <status>', 'Filter by status')
  .option('--active', 'Show only active tasks')
  .option('--unassigned', 'Show only unassigned tasks')
  .action(async (options) => {
    try {
      const projectRoot = requireGakuenRoot();
      const taskboard = new TaskboardStore(projectRoot);
      const registry = new OtakuRegistryStore(projectRoot);

      let tasks = taskboard.listTasks();

      if (options.active) {
        tasks = taskboard.getActiveTasks();
      } else if (options.unassigned) {
        tasks = taskboard.getUnassignedTasks();
      } else if (options.status) {
        tasks = tasks.filter((t) => t.status === options.status);
      }

      logger.blank();
      logger.header('📋 Tasks');
      logger.blank();

      if (tasks.length === 0) {
        logger.info('No tasks found.');
        logger.blank();
        logger.info('Run `aigakuen assign "task description"` to create a task.');
        logger.blank();
        return;
      }

      for (const task of tasks) {
        const icon = getTaskIcon(task.status);
        const priorityBadge = getPriorityBadge(task.priority);

        console.log(`  ${icon} ${chalk.bold(task.title)} ${priorityBadge}`);
        console.log(`     ID: ${chalk.gray(task.id)} | Status: ${getStatusText(task.status)}`);

        if (task.assignedTo) {
          const otaku = registry.getOtaku(task.assignedTo);
          console.log(`     Assigned: ${chalk.cyan(otaku?.name || task.assignedTo)}`);
        }

        if (task.description) {
          console.log(`     ${chalk.gray(task.description)}`);
        }

        logger.blank();
      }

      logger.divider();
      logger.info(`Total: ${tasks.length} tasks`);
      logger.blank();
    } catch (error) {
      logger.error(
        error instanceof Error ? error.message : 'Unknown error'
      );
      process.exit(1);
    }
  });

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

function getStatusText(status: TaskStatus): string {
  const colors: Record<TaskStatus, (s: string) => string> = {
    unassigned: chalk.gray,
    assigned: chalk.blue,
    in_progress: chalk.yellow,
    blocked: chalk.red,
    paused: chalk.gray,
    completed: chalk.green,
  };

  return colors[status](status.replace('_', ' '));
}

function getPriorityBadge(priority: string): string {
  switch (priority) {
    case 'critical':
      return chalk.bgRed.white(' CRITICAL ');
    case 'high':
      return chalk.red('[high]');
    case 'medium':
      return chalk.yellow('[med]');
    case 'low':
      return chalk.gray('[low]');
    default:
      return '';
  }
}
