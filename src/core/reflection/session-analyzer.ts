/**
 * Session Analyzer
 *
 * Parses handoff notes, git history, and other session artifacts
 * to identify bugs and issues encountered during development.
 */

import { readFileSync, existsSync } from 'fs';
import { execSync } from 'child_process';
import { analyzeWithSchema } from '../../claude';
import type { SessionContext, SessionIssue, CommitInfo } from './types';

const ISSUE_EXTRACTION_SCHEMA = `{
  "issues": [
    {
      "description": "string - brief description of the issue",
      "symptoms": "string - what went wrong / how it manifested",
      "rootCause": "string - the underlying cause",
      "fix": "string - how it was resolved",
      "category": "'bug' | 'gotcha' | 'pattern-gap' | 'missing-knowledge'",
      "severity": "'critical' | 'high' | 'medium' | 'low'",
      "relatedDomains": ["string - technical domains this relates to"]
    }
  ]
}`;

const ISSUE_EXTRACTION_PROMPT = `You are analyzing a development session to identify bugs, issues, and gotchas that were encountered and fixed.

Look for patterns like:
- "X didn't work, had to do Y instead"
- "Fixed by adding/changing..."
- "The problem was..."
- "Safari/iOS/mobile required..."
- Commits with "fix", "bug", "issue" in the message
- Any trial-and-error problem solving

Focus on IMPLEMENTATION issues - real bugs discovered during development, not test failures or lint errors.

Examples of what to extract:
- "Safari needed -webkit-backface-visibility prefix" → browser compatibility gotcha
- "overflow:hidden broke 3D transforms on iOS" → CSS interaction bug
- "Session was null during SSR" → timing/lifecycle issue
- "Touch and click both fired on mobile" → event handling gotcha

HANDOFF NOTES:
{{handoff}}

RECENT COMMITS:
{{commits}}

CURRENT TASK:
{{task}}

Extract all issues/bugs that were encountered and fixed. Be thorough - these will be used to improve an AI agent's knowledge base.`;

/**
 * Gather session context from handoff notes and git history
 */
export async function gatherSessionContext(
  projectRoot: string,
  handoffPath: string,
  activeOtakuId: string,
  currentTask?: string
): Promise<SessionContext> {
  // Read handoff notes
  let handoffContent = '';
  if (existsSync(handoffPath)) {
    handoffContent = readFileSync(handoffPath, 'utf-8');
  }

  // Get recent git commits
  const recentCommits = getRecentCommits(projectRoot, 20);

  return {
    handoffContent,
    recentCommits,
    activeOtakuId,
    currentTask,
  };
}

/**
 * Get recent git commits with their messages and changed files
 */
function getRecentCommits(projectRoot: string, count: number = 20): CommitInfo[] {
  try {
    // Check if it's a git repo
    execSync('git rev-parse --git-dir', { cwd: projectRoot, stdio: 'pipe' });

    // Get recent commits
    const logOutput = execSync(
      `git log --oneline -${count} --format="%H|%s|%ci"`,
      { cwd: projectRoot, encoding: 'utf-8', stdio: 'pipe' }
    ).trim();

    if (!logOutput) return [];

    const commits: CommitInfo[] = [];

    for (const line of logOutput.split('\n')) {
      const [hash, message, date] = line.split('|');
      if (!hash || !message) continue;

      // Get files changed in this commit
      let filesChanged: string[] = [];
      try {
        const filesOutput = execSync(
          `git diff-tree --no-commit-id --name-only -r ${hash}`,
          { cwd: projectRoot, encoding: 'utf-8', stdio: 'pipe' }
        ).trim();
        filesChanged = filesOutput ? filesOutput.split('\n') : [];
      } catch {
        // Ignore errors getting file list
      }

      commits.push({
        hash: hash.slice(0, 7),
        message,
        date,
        filesChanged,
      });
    }

    return commits;
  } catch {
    // Not a git repo or git not available
    return [];
  }
}

/**
 * Analyze session context to extract issues
 */
export async function extractSessionIssues(
  context: SessionContext
): Promise<SessionIssue[]> {
  // Format commits for prompt
  const commitsText = context.recentCommits
    .map(c => `- ${c.hash}: ${c.message}`)
    .join('\n') || 'No recent commits found';

  const prompt = ISSUE_EXTRACTION_PROMPT
    .replace('{{handoff}}', context.handoffContent || 'No handoff notes found')
    .replace('{{commits}}', commitsText)
    .replace('{{task}}', context.currentTask || 'No specific task');

  const result = await analyzeWithSchema<{ issues: SessionIssue[] }>(
    prompt,
    ISSUE_EXTRACTION_SCHEMA
  );

  return result?.issues || [];
}

/**
 * Filter commits to find likely bug fixes
 */
export function filterBugFixCommits(commits: CommitInfo[]): CommitInfo[] {
  const bugPatterns = [
    /fix/i,
    /bug/i,
    /issue/i,
    /resolve/i,
    /patch/i,
    /hotfix/i,
    /workaround/i,
    /safari/i,
    /ios/i,
    /mobile/i,
    /browser/i,
  ];

  return commits.filter(commit =>
    bugPatterns.some(pattern => pattern.test(commit.message))
  );
}
