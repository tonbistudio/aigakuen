import { spawn } from 'child_process';
import { recordAPICall } from '../core/metrics';

export interface ClaudeMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface ClaudeOptions {
  maxTokens?: number;
  system?: string;
  metricsPhase?: string; // Phase name for metrics tracking
}

/**
 * Execute a prompt using Claude Code CLI (--print mode)
 * This uses the user's existing Claude Code subscription
 * Writes prompt to stdin to avoid Windows shell parsing issues
 */
export async function prompt(
  userPrompt: string,
  options: ClaudeOptions = {}
): Promise<string> {
  const startTime = Date.now();

  try {

    const result = await new Promise<string>((resolve, reject) => {
      const args = ['--print'];

      // Add system prompt if provided
      if (options.system) {
        // Escape special characters for Windows shell
        let systemPrompt = options.system;
        if (process.platform === 'win32') {
          // Escape & with ^& for Windows cmd.exe
          systemPrompt = systemPrompt.replace(/&/g, '^&');
          // Escape | with ^| for Windows cmd.exe
          systemPrompt = systemPrompt.replace(/\|/g, '^|');
        }
        args.push('--system-prompt', systemPrompt);
      }

      // Spawn claude directly and write prompt to stdin
      // This avoids Windows shell parsing issues with special characters in prompt body
      const claude = spawn('claude', args, {
        shell: true,
        stdio: ['pipe', 'pipe', 'pipe'],
      });

      let stdout = '';
      let stderr = '';

      claude.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      claude.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      claude.on('close', (code) => {
        if (code !== 0) {
          reject(new Error(`Claude Code failed (exit ${code}): ${stderr || stdout}`));
        } else {
          resolve(stdout.trim());
        }
      });

      claude.on('error', (err) => {
        reject(new Error(`Failed to spawn Claude Code: ${err.message}. Is 'claude' in your PATH?`));
      });

      // Write prompt to stdin and close it
      claude.stdin.write(userPrompt);
      claude.stdin.end();
    });

    // Record metrics for this call
    const durationMs = Date.now() - startTime;
    const inputChars = userPrompt.length + (options.system?.length || 0);
    const outputChars = result.length;
    recordAPICall(options.metricsPhase || 'unknown', inputChars, outputChars, durationMs);

    return result;
  } catch (error) {
    throw error;
  }
}

/**
 * Execute a prompt and parse the response as JSON
 */
export async function analyzeWithSchema<T>(
  userPrompt: string,
  schema: string,
  options: ClaudeOptions = {}
): Promise<T> {
  const systemPrompt = `You are a JSON API. Your ONLY output is valid JSON matching the schema below. NEVER include explanatory text, summaries, markdown, or commentary. Output MUST start with { and end with }. Any non-JSON output is a critical error.

Schema:
${schema}`;

  const response = await prompt(userPrompt, {
    ...options,
    system: systemPrompt
  });

  // Extract JSON from response (handle various formats Claude might return)
  let jsonStr = response.trim();

  // Remove markdown code blocks if present
  if (jsonStr.includes('```json')) {
    const start = jsonStr.indexOf('```json') + 7;
    const end = jsonStr.indexOf('```', start);
    if (end > start) {
      jsonStr = jsonStr.slice(start, end).trim();
    }
  } else if (jsonStr.includes('```')) {
    const start = jsonStr.indexOf('```') + 3;
    const end = jsonStr.indexOf('```', start);
    if (end > start) {
      jsonStr = jsonStr.slice(start, end).trim();
    }
  }

  // Try to find the outermost JSON object in the response
  // This handles cases where Claude adds preamble text like "Here's the JSON:"
  // Uses a state machine to properly handle strings containing braces
  let braceCount = 0;
  let jsonStart = -1;
  let jsonEnd = -1;
  let inString = false;
  let escapeNext = false;

  for (let i = 0; i < jsonStr.length; i++) {
    const char = jsonStr[i];

    if (escapeNext) {
      escapeNext = false;
      continue;
    }

    if (char === '\\' && inString) {
      escapeNext = true;
      continue;
    }

    if (char === '"' && !escapeNext) {
      inString = !inString;
      continue;
    }

    // Only count braces when not inside a string
    if (!inString) {
      if (char === '{') {
        if (jsonStart === -1) jsonStart = i;
        braceCount++;
      } else if (char === '}') {
        braceCount--;
        if (braceCount === 0 && jsonStart !== -1) {
          jsonEnd = i + 1;
          break;
        }
      }
    }
  }

  if (jsonStart !== -1 && jsonEnd !== -1) {
    jsonStr = jsonStr.slice(jsonStart, jsonEnd);
  }

  try {
    return JSON.parse(jsonStr) as T;
  } catch (error) {
    // Provide more context about what went wrong
    const preview = response.length > 500 ? response.slice(0, 500) + '...' : response;
    throw new Error(
      `Failed to parse Claude response as JSON: ${error}\n\nResponse preview: ${preview}`
    );
  }
}

/**
 * Analyze with schema and automatic retry on JSON parse failure
 */
export async function analyzeWithSchemaRetry<T>(
  userPrompt: string,
  schema: string,
  options: ClaudeOptions = {},
  maxRetries: number = 1
): Promise<T> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      // On retry, add even more emphatic JSON instruction
      const promptToUse = attempt > 0
        ? `RETRY - PREVIOUS RESPONSE WAS INVALID. OUTPUT PURE JSON ONLY.\n\n${userPrompt}`
        : userPrompt;

      return await analyzeWithSchema<T>(promptToUse, schema, options);
    } catch (error) {
      lastError = error as Error;
      if (attempt < maxRetries) {
        console.log(`  JSON parse failed, retrying (${attempt + 1}/${maxRetries})...`);
      }
    }
  }

  throw lastError;
}

/**
 * Simple chat interface (for future use)
 */
export async function chat(
  messages: ClaudeMessage[],
  options: ClaudeOptions = {}
): Promise<string> {
  // For now, concatenate messages into a single prompt
  // Claude Code --print doesn't support multi-turn directly
  const combinedPrompt = messages
    .map((m) => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`)
    .join('\n\n');

  return prompt(combinedPrompt, options);
}
