import { z } from 'zod';

export const KnowledgeSourceSchema = z.object({
  url: z.string(),
  type: z.enum(['web', 'context7', 'github', 'local']),
  fetchedAt: z.string().datetime(),
  title: z.string().optional(),
});

export type KnowledgeSource = z.infer<typeof KnowledgeSourceSchema>;

export const PatternSchema = z.object({
  name: z.string(),
  description: z.string(),
  example: z.string().optional(),
  whenToUse: z.string().optional(),
  whenNotToUse: z.string().optional(),
});

export type Pattern = z.infer<typeof PatternSchema>;

export const GotchaSchema = z.object({
  title: z.string(),
  description: z.string(),
  solution: z.string().optional(),
  severity: z.enum(['minor', 'moderate', 'critical']).default('moderate'),
});

export type Gotcha = z.infer<typeof GotchaSchema>;

export const CompiledKnowledgeSchema = z.object({
  otakuId: z.string(),
  compiledAt: z.string().datetime(),
  sources: z.array(KnowledgeSourceSchema),
  coreSummary: z.string(),
  fullDocumentation: z.string(),
  patterns: z.array(PatternSchema),
  gotchas: z.array(GotchaSchema),
  apiReference: z.string().optional(),
  examples: z.array(z.object({
    name: z.string(),
    description: z.string(),
    code: z.string(),
    source: z.string().optional(),
  })).default([]),
});

export type CompiledKnowledge = z.infer<typeof CompiledKnowledgeSchema>;
