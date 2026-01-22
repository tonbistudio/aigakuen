import { existsSync, readFileSync, writeFileSync } from 'fs';
import { randomUUID } from 'crypto';
import {
  Task,
  TaskSchema,
  Taskboard,
  TaskboardSchema,
  TaskStatus,
  TaskPriority,
} from '../types';
import { getGakuenPaths } from '../utils/paths';

export class TaskboardStore {
  private projectRoot: string;
  private paths: ReturnType<typeof getGakuenPaths>;

  constructor(projectRoot: string) {
    this.projectRoot = projectRoot;
    this.paths = getGakuenPaths(projectRoot);
  }

  getTaskboard(): Taskboard {
    if (!existsSync(this.paths.taskboard)) {
      return { version: '0.1.0', tasks: [] };
    }

    const raw = readFileSync(this.paths.taskboard, 'utf-8');
    return TaskboardSchema.parse(JSON.parse(raw));
  }

  saveTaskboard(taskboard: Taskboard): void {
    writeFileSync(this.paths.taskboard, JSON.stringify(taskboard, null, 2));
    this.updateTaskboardMarkdown(taskboard);
  }

  listTasks(): Task[] {
    return this.getTaskboard().tasks;
  }

  getTask(id: string): Task | null {
    return this.listTasks().find((t) => t.id === id) ?? null;
  }

  createTask(
    title: string,
    options: {
      description?: string;
      priority?: TaskPriority;
      assignedTo?: string;
      acceptanceCriteria?: string[];
    } = {}
  ): Task {
    const taskboard = this.getTaskboard();
    const now = new Date().toISOString();

    const task = TaskSchema.parse({
      id: randomUUID().slice(0, 8),
      title,
      description: options.description,
      priority: options.priority ?? 'medium',
      assignedTo: options.assignedTo,
      acceptanceCriteria: options.acceptanceCriteria ?? [],
      status: options.assignedTo ? 'assigned' : 'unassigned',
      createdAt: now,
      updatedAt: now,
    });

    taskboard.tasks.push(task);
    this.saveTaskboard(taskboard);

    return task;
  }

  updateTask(id: string, updates: Partial<Task>): Task {
    const taskboard = this.getTaskboard();
    const index = taskboard.tasks.findIndex((t) => t.id === id);

    if (index === -1) {
      throw new Error(`Task '${id}' not found`);
    }

    const updated = TaskSchema.parse({
      ...taskboard.tasks[index],
      ...updates,
      updatedAt: new Date().toISOString(),
    });

    taskboard.tasks[index] = updated;
    this.saveTaskboard(taskboard);

    return updated;
  }

  updateTaskStatus(id: string, status: TaskStatus): Task {
    const updates: Partial<Task> = { status };

    if (status === 'completed') {
      updates.completedAt = new Date().toISOString();
    }

    return this.updateTask(id, updates);
  }

  assignTask(id: string, otakuId: string): Task {
    return this.updateTask(id, {
      assignedTo: otakuId,
      status: 'assigned',
    });
  }

  getTasksForOtaku(otakuId: string): Task[] {
    return this.listTasks().filter((t) => t.assignedTo === otakuId);
  }

  getUnassignedTasks(): Task[] {
    return this.listTasks().filter((t) => t.status === 'unassigned');
  }

  getActiveTasks(): Task[] {
    const activeStatuses: TaskStatus[] = ['assigned', 'in_progress', 'blocked'];
    return this.listTasks().filter((t) => activeStatuses.includes(t.status));
  }

  getCompletedTasks(): Task[] {
    return this.listTasks().filter((t) => t.status === 'completed');
  }

  deleteTask(id: string): void {
    const taskboard = this.getTaskboard();
    taskboard.tasks = taskboard.tasks.filter((t) => t.id !== id);
    this.saveTaskboard(taskboard);
  }

  private updateTaskboardMarkdown(taskboard: Taskboard): void {
    const completed = taskboard.tasks.filter((t) => t.status === 'completed');
    const active = taskboard.tasks.filter((t) => t.status !== 'completed');

    const lines: string[] = [
      '# Taskboard',
      '',
      `**Progress:** ${completed.length}/${taskboard.tasks.length} tasks complete`,
      '',
    ];

    if (active.length > 0) {
      lines.push('## Active Tasks', '');
      for (const task of active) {
        const statusIcon = this.getStatusIcon(task.status);
        const assignee = task.assignedTo ? ` (${task.assignedTo})` : '';
        lines.push(`- ${statusIcon} **${task.title}**${assignee}`);
        if (task.description) {
          lines.push(`  ${task.description}`);
        }
      }
      lines.push('');
    }

    if (completed.length > 0) {
      lines.push('## Completed', '');
      for (const task of completed) {
        lines.push(`- ✅ ~~${task.title}~~`);
      }
      lines.push('');
    }

    writeFileSync(this.paths.taskboardMd, lines.join('\n'));
  }

  private getStatusIcon(status: TaskStatus): string {
    switch (status) {
      case 'unassigned':
        return '⬜';
      case 'assigned':
        return '📋';
      case 'in_progress':
        return '🔄';
      case 'blocked':
        return '🚫';
      case 'paused':
        return '⏸️';
      case 'completed':
        return '✅';
      default:
        return '⬜';
    }
  }
}
