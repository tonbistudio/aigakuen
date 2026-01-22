import type { ParsedSpec } from '../analyzer/spec-parser';
import type { ExpertiseDomain } from '../analyzer/domain-extractor';
import type { OtakuRecommendation } from '../analyzer/otaku-recommender';

export type EnrollmentStatus =
  | 'started'
  | 'spec-parsed'
  | 'domains-extracted'
  | 'generating-otaku'
  | 'otaku-complete'
  | 'confirmed'
  | 'failed';

export interface EnrollmentCheckpoint {
  // Identification
  id: string;
  specPath: string;
  specHash: string; // SHA-256 of spec content to detect changes
  createdAt: string;
  updatedAt: string;

  // Progress tracking
  status: EnrollmentStatus;
  currentBatch: number;
  totalBatches: number;
  error?: string;

  // Cached results (null if step not completed)
  parsedSpec: ParsedSpec | null;
  domains: ExpertiseDomain[] | null;
  otakuRecommendations: OtakuRecommendation[] | null;
}

export interface CheckpointSummary {
  id: string;
  specPath: string;
  status: EnrollmentStatus;
  progress: string; // e.g., "3/5 batches complete"
  updatedAt: string;
  canResume: boolean;
}
