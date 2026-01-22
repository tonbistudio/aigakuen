import { createHash } from 'crypto';
import { existsSync, readFileSync, writeFileSync, unlinkSync, readdirSync, mkdirSync } from 'fs';
import { join } from 'path';
import type { EnrollmentCheckpoint, EnrollmentStatus, CheckpointSummary } from './types';
import type { ParsedSpec } from '../analyzer/spec-parser';
import type { ExpertiseDomain } from '../analyzer/domain-extractor';
import type { OtakuRecommendation } from '../analyzer/otaku-recommender';

const CHECKPOINT_DIR = 'checkpoints';
const CHECKPOINT_PREFIX = 'enroll-';

/**
 * Generate a unique checkpoint ID
 */
function generateCheckpointId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Hash spec content to detect changes
 */
export function hashSpec(content: string): string {
  return createHash('sha256').update(content).digest('hex').slice(0, 16);
}

/**
 * Get the checkpoint directory path
 */
function getCheckpointDir(gakuenPath: string): string {
  return join(gakuenPath, CHECKPOINT_DIR);
}

/**
 * Get checkpoint file path
 */
function getCheckpointPath(gakuenPath: string, id: string): string {
  return join(getCheckpointDir(gakuenPath), `${CHECKPOINT_PREFIX}${id}.json`);
}

/**
 * Create a new enrollment checkpoint
 */
export function createCheckpoint(
  gakuenPath: string,
  specPath: string,
  specContent: string
): EnrollmentCheckpoint {
  const now = new Date().toISOString();
  const checkpoint: EnrollmentCheckpoint = {
    id: generateCheckpointId(),
    specPath,
    specHash: hashSpec(specContent),
    createdAt: now,
    updatedAt: now,
    status: 'started',
    currentBatch: 0,
    totalBatches: 0,
    parsedSpec: null,
    domains: null,
    otakuRecommendations: null,
  };

  saveCheckpoint(gakuenPath, checkpoint);
  return checkpoint;
}

/**
 * Save checkpoint to disk
 */
export function saveCheckpoint(gakuenPath: string, checkpoint: EnrollmentCheckpoint): void {
  const checkpointDir = getCheckpointDir(gakuenPath);

  // Ensure checkpoint directory exists
  if (!existsSync(checkpointDir)) {
    mkdirSync(checkpointDir, { recursive: true });
  }

  checkpoint.updatedAt = new Date().toISOString();
  const path = getCheckpointPath(gakuenPath, checkpoint.id);
  writeFileSync(path, JSON.stringify(checkpoint, null, 2), 'utf-8');
}

/**
 * Load checkpoint from disk
 */
export function loadCheckpoint(gakuenPath: string, id: string): EnrollmentCheckpoint | null {
  const path = getCheckpointPath(gakuenPath, id);

  if (!existsSync(path)) {
    return null;
  }

  try {
    const content = readFileSync(path, 'utf-8');
    return JSON.parse(content) as EnrollmentCheckpoint;
  } catch {
    return null;
  }
}

/**
 * Delete a checkpoint
 */
export function deleteCheckpoint(gakuenPath: string, id: string): void {
  const path = getCheckpointPath(gakuenPath, id);

  if (existsSync(path)) {
    unlinkSync(path);
  }
}

/**
 * Find existing checkpoint for a spec file
 */
export function findCheckpointForSpec(
  gakuenPath: string,
  specPath: string,
  specContent: string
): EnrollmentCheckpoint | null {
  const checkpointDir = getCheckpointDir(gakuenPath);

  if (!existsSync(checkpointDir)) {
    return null;
  }

  const specHash = hashSpec(specContent);
  const files = readdirSync(checkpointDir).filter(f => f.startsWith(CHECKPOINT_PREFIX));

  for (const file of files) {
    const id = file.replace(CHECKPOINT_PREFIX, '').replace('.json', '');
    const checkpoint = loadCheckpoint(gakuenPath, id);

    if (checkpoint && checkpoint.specPath === specPath && checkpoint.specHash === specHash) {
      // Found matching checkpoint - check if it's resumable
      if (isResumable(checkpoint)) {
        return checkpoint;
      }
    }
  }

  return null;
}

/**
 * Check if a checkpoint can be resumed
 */
export function isResumable(checkpoint: EnrollmentCheckpoint): boolean {
  // Can resume if not already confirmed or failed terminally
  return !['confirmed', 'failed'].includes(checkpoint.status) ||
         (checkpoint.status === 'failed' && checkpoint.currentBatch > 0);
}

/**
 * List all checkpoints with summaries
 */
export function listCheckpoints(gakuenPath: string): CheckpointSummary[] {
  const checkpointDir = getCheckpointDir(gakuenPath);

  if (!existsSync(checkpointDir)) {
    return [];
  }

  const files = readdirSync(checkpointDir).filter(f => f.startsWith(CHECKPOINT_PREFIX));
  const summaries: CheckpointSummary[] = [];

  for (const file of files) {
    const id = file.replace(CHECKPOINT_PREFIX, '').replace('.json', '');
    const checkpoint = loadCheckpoint(gakuenPath, id);

    if (checkpoint) {
      summaries.push({
        id: checkpoint.id,
        specPath: checkpoint.specPath,
        status: checkpoint.status,
        progress: getProgressString(checkpoint),
        updatedAt: checkpoint.updatedAt,
        canResume: isResumable(checkpoint),
      });
    }
  }

  // Sort by most recent first
  return summaries.sort((a, b) =>
    new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  );
}

/**
 * Get human-readable progress string
 */
function getProgressString(checkpoint: EnrollmentCheckpoint): string {
  switch (checkpoint.status) {
    case 'started':
      return 'Starting...';
    case 'spec-parsed':
      return 'Spec parsed, extracting domains...';
    case 'domains-extracted':
      return `${checkpoint.domains?.length || 0} domains extracted`;
    case 'generating-otaku':
      return `Batch ${checkpoint.currentBatch}/${checkpoint.totalBatches} complete`;
    case 'otaku-complete':
      return `${checkpoint.otakuRecommendations?.length || 0} Otaku ready for confirmation`;
    case 'confirmed':
      return 'Enrollment complete';
    case 'failed':
      return `Failed at batch ${checkpoint.currentBatch}/${checkpoint.totalBatches}`;
    default:
      return checkpoint.status;
  }
}

/**
 * Update checkpoint with parsed spec
 */
export function updateWithParsedSpec(
  gakuenPath: string,
  checkpoint: EnrollmentCheckpoint,
  parsedSpec: ParsedSpec
): EnrollmentCheckpoint {
  checkpoint.parsedSpec = parsedSpec;
  checkpoint.status = 'spec-parsed';
  saveCheckpoint(gakuenPath, checkpoint);
  return checkpoint;
}

/**
 * Update checkpoint with extracted domains
 */
export function updateWithDomains(
  gakuenPath: string,
  checkpoint: EnrollmentCheckpoint,
  domains: ExpertiseDomain[]
): EnrollmentCheckpoint {
  checkpoint.domains = domains;
  checkpoint.status = 'domains-extracted';
  checkpoint.totalBatches = Math.ceil(domains.length / 8); // BATCH_SIZE = 8
  saveCheckpoint(gakuenPath, checkpoint);
  return checkpoint;
}

/**
 * Update checkpoint with batch progress
 */
export function updateWithBatchProgress(
  gakuenPath: string,
  checkpoint: EnrollmentCheckpoint,
  batchIndex: number,
  batchResults: OtakuRecommendation[]
): EnrollmentCheckpoint {
  checkpoint.status = 'generating-otaku';
  checkpoint.currentBatch = batchIndex + 1;

  // Append to existing recommendations
  if (!checkpoint.otakuRecommendations) {
    checkpoint.otakuRecommendations = [];
  }
  checkpoint.otakuRecommendations.push(...batchResults);

  saveCheckpoint(gakuenPath, checkpoint);
  return checkpoint;
}

/**
 * Mark Otaku generation complete
 */
export function markOtakuComplete(
  gakuenPath: string,
  checkpoint: EnrollmentCheckpoint
): EnrollmentCheckpoint {
  checkpoint.status = 'otaku-complete';
  saveCheckpoint(gakuenPath, checkpoint);
  return checkpoint;
}

/**
 * Mark checkpoint as confirmed (enrollment complete)
 */
export function markConfirmed(
  gakuenPath: string,
  checkpoint: EnrollmentCheckpoint
): EnrollmentCheckpoint {
  checkpoint.status = 'confirmed';
  saveCheckpoint(gakuenPath, checkpoint);
  return checkpoint;
}

/**
 * Mark checkpoint as failed
 */
export function markFailed(
  gakuenPath: string,
  checkpoint: EnrollmentCheckpoint,
  error: string
): EnrollmentCheckpoint {
  checkpoint.status = 'failed';
  checkpoint.error = error;
  saveCheckpoint(gakuenPath, checkpoint);
  return checkpoint;
}

/**
 * Clean up old/completed checkpoints
 */
export function cleanupCheckpoints(gakuenPath: string, keepDays: number = 7): number {
  const checkpointDir = getCheckpointDir(gakuenPath);

  if (!existsSync(checkpointDir)) {
    return 0;
  }

  const cutoff = Date.now() - (keepDays * 24 * 60 * 60 * 1000);
  const files = readdirSync(checkpointDir).filter(f => f.startsWith(CHECKPOINT_PREFIX));
  let cleaned = 0;

  for (const file of files) {
    const id = file.replace(CHECKPOINT_PREFIX, '').replace('.json', '');
    const checkpoint = loadCheckpoint(gakuenPath, id);

    if (checkpoint) {
      const updatedAt = new Date(checkpoint.updatedAt).getTime();

      // Delete if old and completed/failed
      if (updatedAt < cutoff && ['confirmed', 'failed'].includes(checkpoint.status)) {
        deleteCheckpoint(gakuenPath, id);
        cleaned++;
      }
    }
  }

  return cleaned;
}
