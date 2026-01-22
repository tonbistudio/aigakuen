/**
 * Training metrics tracker for measuring API usage and performance
 */

export interface APICallMetrics {
  timestamp: string;
  phase: string;
  inputChars: number;
  outputChars: number;
  estimatedInputTokens: number;
  estimatedOutputTokens: number;
  durationMs: number;
}

export interface TrainingMetrics {
  otakuId: string;
  otakuName: string;
  startTime: string;
  endTime: string;
  totalDurationMs: number;
  totalDurationFormatted: string;
  apiCalls: APICallMetrics[];
  totals: {
    callCount: number;
    inputChars: number;
    outputChars: number;
    estimatedInputTokens: number;
    estimatedOutputTokens: number;
    estimatedTotalTokens: number;
  };
  averages: {
    msPerCall: number;
    tokensPerCall: number;
  };
}

// Global metrics collector for current training session
let currentMetrics: TrainingMetrics | null = null;

/**
 * Start metrics collection for a training session
 */
export function startMetricsCollection(otakuId: string, otakuName: string): void {
  currentMetrics = {
    otakuId,
    otakuName,
    startTime: new Date().toISOString(),
    endTime: '',
    totalDurationMs: 0,
    totalDurationFormatted: '',
    apiCalls: [],
    totals: {
      callCount: 0,
      inputChars: 0,
      outputChars: 0,
      estimatedInputTokens: 0,
      estimatedOutputTokens: 0,
      estimatedTotalTokens: 0,
    },
    averages: {
      msPerCall: 0,
      tokensPerCall: 0,
    },
  };
}

/**
 * Record an API call
 */
export function recordAPICall(
  phase: string,
  inputChars: number,
  outputChars: number,
  durationMs: number
): void {
  if (!currentMetrics) return;

  // Rough token estimation: ~4 characters per token
  const estimatedInputTokens = Math.ceil(inputChars / 4);
  const estimatedOutputTokens = Math.ceil(outputChars / 4);

  currentMetrics.apiCalls.push({
    timestamp: new Date().toISOString(),
    phase,
    inputChars,
    outputChars,
    estimatedInputTokens,
    estimatedOutputTokens,
    durationMs,
  });

  // Update totals
  currentMetrics.totals.callCount++;
  currentMetrics.totals.inputChars += inputChars;
  currentMetrics.totals.outputChars += outputChars;
  currentMetrics.totals.estimatedInputTokens += estimatedInputTokens;
  currentMetrics.totals.estimatedOutputTokens += estimatedOutputTokens;
  currentMetrics.totals.estimatedTotalTokens =
    currentMetrics.totals.estimatedInputTokens +
    currentMetrics.totals.estimatedOutputTokens;
}

/**
 * Finalize metrics collection and return results
 */
export function finalizeMetrics(): TrainingMetrics | null {
  if (!currentMetrics) return null;

  currentMetrics.endTime = new Date().toISOString();
  currentMetrics.totalDurationMs =
    new Date(currentMetrics.endTime).getTime() -
    new Date(currentMetrics.startTime).getTime();

  // Format duration
  const seconds = Math.floor(currentMetrics.totalDurationMs / 1000);
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  currentMetrics.totalDurationFormatted =
    minutes > 0
      ? `${minutes}m ${remainingSeconds}s`
      : `${seconds}s`;

  // Calculate averages
  if (currentMetrics.totals.callCount > 0) {
    currentMetrics.averages.msPerCall = Math.round(
      currentMetrics.totalDurationMs / currentMetrics.totals.callCount
    );
    currentMetrics.averages.tokensPerCall = Math.round(
      currentMetrics.totals.estimatedTotalTokens / currentMetrics.totals.callCount
    );
  }

  const result = currentMetrics;
  currentMetrics = null;
  return result;
}

/**
 * Get current metrics without finalizing
 */
export function getCurrentMetrics(): TrainingMetrics | null {
  return currentMetrics;
}

/**
 * Format metrics for display
 */
export function formatMetricsReport(metrics: TrainingMetrics): string {
  const lines: string[] = [
    '═══════════════════════════════════════════════════════════════',
    `  TRAINING METRICS: ${metrics.otakuName}`,
    '═══════════════════════════════════════════════════════════════',
    '',
    `  Duration:           ${metrics.totalDurationFormatted}`,
    `  API Calls:          ${metrics.totals.callCount}`,
    '',
    '  Token Usage (estimated):',
    `    Input tokens:     ${metrics.totals.estimatedInputTokens.toLocaleString()}`,
    `    Output tokens:    ${metrics.totals.estimatedOutputTokens.toLocaleString()}`,
    `    Total tokens:     ${metrics.totals.estimatedTotalTokens.toLocaleString()}`,
    '',
    '  Averages:',
    `    Time per call:    ${(metrics.averages.msPerCall / 1000).toFixed(1)}s`,
    `    Tokens per call:  ${metrics.averages.tokensPerCall.toLocaleString()}`,
    '',
    '═══════════════════════════════════════════════════════════════',
  ];

  return lines.join('\n');
}

/**
 * Format metrics as JSON for storage
 */
export function metricsToJSON(metrics: TrainingMetrics): string {
  return JSON.stringify(metrics, null, 2);
}
