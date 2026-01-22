import { z } from 'zod';

export const OtakuStatusSchema = z.enum([
  'recommended',
  'training',
  'idle',
  'studying',
  'suspended',
  'retired',
]);

export type OtakuStatus = z.infer<typeof OtakuStatusSchema>;

export const OtakuExpertiseSchema = z.object({
  domains: z.array(z.string()),
  technologies: z.array(z.string()),
  taskTypes: z.array(z.string()),
});

export const OtakuKnowledgeSchema = z.object({
  documentation: z.array(z.string()).default([]),
  patterns: z.array(z.string()).default([]),
  examples: z.array(z.string()).default([]),
  gotchas: z.array(z.string()).default([]),
});

export const OtakuMetaSchema = z.object({
  createdAt: z.string(),
  lastTrained: z.string().nullable().optional(),
  lastActive: z.string().nullable().optional(),
  trainingSources: z.array(z.string()).default([]),
});

export const OtakuProfileSchema = z.object({
  id: z.string(),
  name: z.string(),
  specialty: z.string().default(''),
  personality: z.string().default(''),
  catchphrase: z.string().default(''),
  status: OtakuStatusSchema.default('recommended'),
  expertise: OtakuExpertiseSchema,
  knowledge: OtakuKnowledgeSchema.default({}),
  qualityGates: z.array(z.string()).default([]),
  weaknesses: z.array(z.string()).default([]),
  meta: OtakuMetaSchema,
});

export type OtakuProfile = z.infer<typeof OtakuProfileSchema>;
export type OtakuExpertise = z.infer<typeof OtakuExpertiseSchema>;
export type OtakuKnowledge = z.infer<typeof OtakuKnowledgeSchema>;
export type OtakuMeta = z.infer<typeof OtakuMetaSchema>;

export const OtakuRegistrySchema = z.object({
  version: z.string(),
  otaku: z.array(OtakuProfileSchema),
});

export type OtakuRegistry = z.infer<typeof OtakuRegistrySchema>;
