import { z } from 'zod';

export const GakuenConfigSchema = z.object({
  version: z.string().default('0.1.0'),
  projectName: z.string(),
  projectDescription: z.string().default(''),
  createdAt: z.string().datetime(),
  curriculum: z.string().optional(),
  activeOtaku: z.string().optional(),
  currentTask: z.string().optional(),
  settings: z.object({
    claudeMdPath: z.string().default('CLAUDE.md'),
    autoHandoff: z.boolean().default(true),
    maxKnowledgeSize: z.number().default(15000),
  }).default({}),
});

export type GakuenConfig = z.infer<typeof GakuenConfigSchema>;

export const DEFAULT_CONFIG: Partial<GakuenConfig> = {
  version: '0.1.0',
  settings: {
    claudeMdPath: 'CLAUDE.md',
    autoHandoff: true,
    maxKnowledgeSize: 15000,
  },
};
