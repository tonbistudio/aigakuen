/**
 * GitHub Issues Miner
 *
 * Fetches and analyzes GitHub issues to extract problem-solution pairs,
 * common problems, and workarounds.
 */

import { prompt } from '../../claude';
import type { IssueKnowledge, ProblemSolution } from './types';

interface GitHubIssue {
  number: number;
  title: string;
  body: string;
  state: 'open' | 'closed';
  labels: string[];
  comments: number;
  reactions: number;
  url: string;
  created_at: string;
  closed_at: string | null;
}

interface IssueWithComments extends GitHubIssue {
  topComments: string[];
}

/**
 * Mine GitHub issues for a repository
 */
export async function mineGitHubIssues(
  repoUrl: string,
  maxIssues: number = 50
): Promise<IssueKnowledge> {
  // Extract owner/repo from URL
  const match = repoUrl.match(/github\.com\/([^/]+)\/([^/]+)/);
  if (!match) {
    console.error('Invalid GitHub URL:', repoUrl);
    return emptyIssueKnowledge();
  }

  const [, owner, repo] = match;

  try {
    // Fetch issues using GitHub API via Claude web search
    const issues = await fetchIssues(owner, repo, maxIssues);

    if (issues.length === 0) {
      return emptyIssueKnowledge();
    }

    // Analyze issues for patterns
    const knowledge = await analyzeIssues(issues, `${owner}/${repo}`);
    return knowledge;
  } catch (error) {
    console.error('Error mining GitHub issues:', error);
    return emptyIssueKnowledge();
  }
}

/**
 * Fetch issues from GitHub repository
 */
async function fetchIssues(
  owner: string,
  repo: string,
  maxIssues: number
): Promise<IssueWithComments[]> {
  // Use Claude to fetch issues via web search
  const fetchPrompt = `Search GitHub for issues in the repository ${owner}/${repo}.

Focus on:
1. Issues with the most reactions/comments (most impactful)
2. Closed issues with clear solutions
3. Issues labeled as "bug", "help wanted", or "good first issue"
4. Recent issues (last 6 months)

For each issue found, extract:
- Issue number and title
- Problem description (from body)
- Key comments that provide solutions
- Labels
- Whether it's open or closed

Return as JSON array with up to ${maxIssues} issues:
[
  {
    "number": 123,
    "title": "Issue title",
    "body": "Problem description (truncated to 500 chars)",
    "state": "open" | "closed",
    "labels": ["bug", "enhancement"],
    "comments": 5,
    "reactions": 10,
    "url": "https://github.com/owner/repo/issues/123",
    "topComments": ["Most helpful comment 1", "Solution comment 2"]
  }
]

Return ONLY the JSON array.`;

  try {
    const response = await prompt(fetchPrompt, {
      system: 'You are a GitHub issue researcher. Search for real issues and return structured data.',
      metricsPhase: 'github-fetch',
    });

    // Parse JSON response
    const issues = parseIssuesResponse(response);
    return issues;
  } catch (error) {
    console.error('Error fetching issues:', error);
    return [];
  }
}

/**
 * Parse issues response from Claude
 */
function parseIssuesResponse(response: string): IssueWithComments[] {
  let jsonStr = response.trim();

  // Remove markdown code blocks if present
  if (jsonStr.startsWith('```json')) {
    jsonStr = jsonStr.slice(7);
  } else if (jsonStr.startsWith('```')) {
    jsonStr = jsonStr.slice(3);
  }
  if (jsonStr.endsWith('```')) {
    jsonStr = jsonStr.slice(0, -3);
  }
  jsonStr = jsonStr.trim();

  // Find JSON array
  const jsonMatch = jsonStr.match(/\[[\s\S]*\]/);
  if (jsonMatch) {
    jsonStr = jsonMatch[0];
  }

  try {
    const parsed = JSON.parse(jsonStr);
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed.map(normalizeIssue).filter(Boolean) as IssueWithComments[];
  } catch {
    return [];
  }
}

function normalizeIssue(issue: unknown): IssueWithComments | null {
  if (!issue || typeof issue !== 'object') {
    return null;
  }
  const i = issue as Record<string, unknown>;
  return {
    number: typeof i.number === 'number' ? i.number : 0,
    title: typeof i.title === 'string' ? i.title : '',
    body: typeof i.body === 'string' ? i.body : '',
    state: i.state === 'closed' ? 'closed' : 'open',
    labels: Array.isArray(i.labels) ? i.labels.map(String) : [],
    comments: typeof i.comments === 'number' ? i.comments : 0,
    reactions: typeof i.reactions === 'number' ? i.reactions : 0,
    url: typeof i.url === 'string' ? i.url : '',
    created_at: typeof i.created_at === 'string' ? i.created_at : '',
    closed_at: typeof i.closed_at === 'string' ? i.closed_at : null,
    topComments: Array.isArray(i.topComments) ? i.topComments.map(String) : [],
  };
}

/**
 * Analyze issues to extract knowledge
 */
async function analyzeIssues(
  issues: IssueWithComments[],
  repoName: string
): Promise<IssueKnowledge> {
  // Build context from issues
  const issuesSummary = issues
    .map((issue) => {
      const comments = issue.topComments.length > 0
        ? `\nSolutions/Comments:\n${issue.topComments.map((c) => `  - ${c}`).join('\n')}`
        : '';
      return `[#${issue.number}] ${issue.title} (${issue.state}, ${issue.reactions} reactions)
${issue.body.slice(0, 300)}${comments}`;
    })
    .join('\n\n---\n\n');

  const analysisPrompt = `Analyze these GitHub issues from ${repoName} and extract knowledge:

${issuesSummary}

---

Create a knowledge summary with:
1. **Problem-Solution Pairs**: Clear pairs where a problem was resolved
2. **Common Problems**: Frequently occurring issues
3. **Workarounds**: Temporary fixes or alternatives mentioned

Return JSON:
{
  "problemSolutions": [
    {
      "symptom": "What the user experienced",
      "rootCause": "The underlying cause",
      "solution": "How to fix it",
      "prevention": "How to avoid this in the future",
      "issueNumber": 123,
      "reactions": 10
    }
  ],
  "commonProblems": ["Problem 1", "Problem 2"],
  "workarounds": ["Workaround 1", "Workaround 2"]
}

Focus on:
- Most impactful issues (high reactions/comments)
- Clear cause-effect relationships
- Actionable solutions
- Patterns that repeat across issues

Return ONLY the JSON object.`;

  try {
    const response = await prompt(analysisPrompt, {
      system: 'You are a technical analyst extracting patterns from GitHub issues.',
      metricsPhase: 'github-analyze',
    });

    return parseAnalysisResponse(response, issues.length);
  } catch (error) {
    console.error('Error analyzing issues:', error);
    return {
      problemSolutions: [],
      commonProblems: [],
      workarounds: [],
      totalAnalyzed: issues.length,
    };
  }
}

/**
 * Parse analysis response into IssueKnowledge
 */
function parseAnalysisResponse(
  response: string,
  totalAnalyzed: number
): IssueKnowledge {
  let jsonStr = response.trim();

  // Remove markdown code blocks
  if (jsonStr.startsWith('```json')) {
    jsonStr = jsonStr.slice(7);
  } else if (jsonStr.startsWith('```')) {
    jsonStr = jsonStr.slice(3);
  }
  if (jsonStr.endsWith('```')) {
    jsonStr = jsonStr.slice(0, -3);
  }
  jsonStr = jsonStr.trim();

  // Find JSON object
  const jsonMatch = jsonStr.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    jsonStr = jsonMatch[0];
  }

  try {
    const parsed = JSON.parse(jsonStr);

    const problemSolutions: ProblemSolution[] = Array.isArray(parsed.problemSolutions)
      ? parsed.problemSolutions.map((ps: Record<string, unknown>) => ({
          symptom: typeof ps.symptom === 'string' ? ps.symptom : '',
          rootCause: typeof ps.rootCause === 'string' ? ps.rootCause : '',
          solution: typeof ps.solution === 'string' ? ps.solution : '',
          prevention: typeof ps.prevention === 'string' ? ps.prevention : '',
          issueUrl: typeof ps.issueNumber === 'number'
            ? `#${ps.issueNumber}`
            : undefined,
          reactions: typeof ps.reactions === 'number' ? ps.reactions : undefined,
        }))
      : [];

    return {
      problemSolutions,
      commonProblems: Array.isArray(parsed.commonProblems)
        ? parsed.commonProblems.map(String)
        : [],
      workarounds: Array.isArray(parsed.workarounds)
        ? parsed.workarounds.map(String)
        : [],
      totalAnalyzed,
    };
  } catch {
    return {
      problemSolutions: [],
      commonProblems: [],
      workarounds: [],
      totalAnalyzed,
    };
  }
}

function emptyIssueKnowledge(): IssueKnowledge {
  return {
    problemSolutions: [],
    commonProblems: [],
    workarounds: [],
    totalAnalyzed: 0,
  };
}

/**
 * Mine issues for a technology (without specific repo)
 */
export async function mineIssuesForTechnology(
  technology: string,
  maxIssues: number = 30
): Promise<IssueKnowledge> {
  const searchPrompt = `Search GitHub for common issues related to "${technology}".

Look for:
1. Popular repositories using ${technology}
2. Common error messages and their solutions
3. Frequently asked questions in issues
4. Integration problems and fixes

Return JSON with problem-solution pairs:
{
  "problemSolutions": [
    {
      "symptom": "Error message or problem description",
      "rootCause": "Why this happens",
      "solution": "How to fix it",
      "prevention": "How to avoid",
      "issueUrl": "URL if available"
    }
  ],
  "commonProblems": ["List of common problems"],
  "workarounds": ["Known workarounds"]
}

Focus on the most impactful and commonly encountered issues.
Return ONLY the JSON object.`;

  try {
    const response = await prompt(searchPrompt, {
      system: `You are a ${technology} expert researching common issues and solutions.`,
      metricsPhase: 'github-search',
    });

    return parseAnalysisResponse(response, maxIssues);
  } catch (error) {
    console.error('Error mining issues for technology:', error);
    return emptyIssueKnowledge();
  }
}
