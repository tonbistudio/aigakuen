import { z } from 'zod';

export const TaskStatusSchema = z.enum([
  'unassigned',
  'assigned',
  'in_progress',
  'blocked',
  'paused',
  'completed',
]);

export type TaskStatus = z.infer<typeof TaskStatusSchema>;

export const TaskPrioritySchema = z.enum(['low', 'medium', 'high', 'critical']);

export type TaskPriority = z.infer<typeof TaskPrioritySchema>;

export const TaskSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string().optional(),
  status: TaskStatusSchema.default('unassigned'),
  priority: TaskPrioritySchema.default('medium'),
  assignedTo: z.string().optional(),
  acceptanceCriteria: z.array(z.string()).default([]),
  blockedBy: z.string().optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  completedAt: z.string().datetime().optional(),
});

export type Task = z.infer<typeof TaskSchema>;

export const TaskboardSchema = z.object({
  version: z.string(),
  tasks: z.array(TaskSchema),
});

export type Taskboard = z.infer<typeof TaskboardSchema>;
