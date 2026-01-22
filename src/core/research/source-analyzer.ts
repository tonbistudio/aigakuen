/**
 * Source Code Analyzer
 *
 * Analyzes GitHub repositories to extract architecture patterns,
 * undocumented behaviors, internal patterns, and edge cases.
 */

import { prompt } from '../../claude';
import type { SourceCodeKnowledge } from './types';

/**
 * Analyze source code from a GitHub repository
 */
export async function analyzeSourceCode(
  repoUrl: string,
  focusAreas: string[] = []
): Promise<SourceCodeKnowledge> {
  // Extract owner/repo from URL
  const match = repoUrl.match(/github\.com\/([^/]+)\/([^/]+)/);
  if (!match) {
    console.error('Invalid GitHub URL:', repoUrl);
    return emptySourceKnowledge(repoUrl);
  }

  const [, owner, repo] = match;

  try {
    // Analyze different aspects of the codebase
    const [architecture, behaviors, patterns, comments, edgeCases] = await Promise.all([
      analyzeArchitecture(owner, repo),
      findUndocumentedBehaviors(owner, repo, focusAreas),
      findInternalPatterns(owner, repo, focusAreas),
      extractCodeCommentInsights(owner, repo),
      findEdgeCases(owner, repo, focusAreas),
    ]);

    return {
      architecture,
      undocumentedBehaviors: behaviors,
      internalPatterns: patterns,
      codeCommentInsights: comments,
      edgeCases,
      repoUrl,
    };
  } catch (error) {
    console.error('Error analyzing source code:', error);
    return emptySourceKnowledge(repoUrl);
  }
}

/**
 * Analyze repository architecture
 */
async function analyzeArchitecture(
  owner: string,
  repo: string
): Promise<string> {
  const analysisPrompt = `Search for and analyze the architecture of the GitHub repository ${owner}/${repo}.

Look for:
1. Directory structure and organization
2. Main entry points and core modules
3. Key abstractions and interfaces
4. Design patterns used (MVC, Clean Architecture, etc.)
5. Dependency structure

Provide a concise architecture summary (200-400 words) that explains:
- How the codebase is organized
- Key components and their responsibilities
- How data flows through the system
- Notable architectural decisions`;

  try {
    const response = await prompt(analysisPrompt, {
      system: 'You are a software architect analyzing repository structure.',
      metricsPhase: 'source-architecture',
    });

    return response.trim();
  } catch (error) {
    console.error('Error analyzing architecture:', error);
    return 'Architecture analysis failed';
  }
}

/**
 * Find undocumented behaviors in the codebase
 */
async function findUndocumentedBehaviors(
  owner: string,
  repo: string,
  focusAreas: string[]
): Promise<string[]> {
  const focus = focusAreas.length > 0
    ? `Focus on: ${focusAreas.join(', ')}`
    : '';

  const searchPrompt = `Search the ${owner}/${repo} repository for behaviors that aren't well documented.

${focus}

Look for:
1. Default values that aren't documented
2. Implicit behaviors (auto-retry, caching, etc.)
3. Side effects that aren't mentioned in docs
4. Environmental dependencies
5. Initialization requirements

Return JSON array of undocumented behaviors:
["Behavior 1: explanation", "Behavior 2: explanation", ...]

Each entry should explain a behavior developers might not expect.
Return ONLY the JSON array.`;

  try {
    const response = await prompt(searchPrompt, {
      system: 'You are a code analyst finding hidden behaviors.',
      metricsPhase: 'source-behaviors',
    });

    return parseStringArrayResponse(response);
  } catch (error) {
    console.error('Error finding undocumented behaviors:', error);
    return [];
  }
}

/**
 * Find internal patterns used in the codebase
 */
async function findInternalPatterns(
  owner: string,
  repo: string,
  focusAreas: string[]
): Promise<string[]> {
  const focus = focusAreas.length > 0
    ? `Focus on: ${focusAreas.join(', ')}`
    : '';

  const searchPrompt = `Search the ${owner}/${repo} repository for internal patterns and conventions.

${focus}

Look for:
1. Error handling patterns
2. Naming conventions
3. Common utilities and helpers
4. Testing patterns
5. Configuration patterns
6. Logging/observability patterns

Return JSON array of patterns:
["Pattern: name - description", "Pattern: name - description", ...]

Each entry should describe a reusable pattern from the codebase.
Return ONLY the JSON array.`;

  try {
    const response = await prompt(searchPrompt, {
      system: 'You are a pattern analyst studying code conventions.',
      metricsPhase: 'source-patterns',
    });

    return parseStringArrayResponse(response);
  } catch (error) {
    console.error('Error finding internal patterns:', error);
    return [];
  }
}

/**
 * Extract insights from code comments
 */
async function extractCodeCommentInsights(
  owner: string,
  repo: string
): Promise<string[]> {
  const searchPrompt = `Search the ${owner}/${repo} repository for insightful code comments.

Look for:
1. TODO/FIXME/HACK comments explaining workarounds
2. "NOTE" or "IMPORTANT" comments
3. Comments explaining "why" not "what"
4. Comments about edge cases
5. Comments about performance considerations
6. Comments with links to related issues or discussions

Return JSON array of comment insights:
["Comment insight 1", "Comment insight 2", ...]

Each entry should capture wisdom hidden in code comments.
Return ONLY the JSON array.`;

  try {
    const response = await prompt(searchPrompt, {
      system: 'You are a code archaeologist finding wisdom in comments.',
      metricsPhase: 'source-comments',
    });

    return parseStringArrayResponse(response);
  } catch (error) {
    console.error('Error extracting comment insights:', error);
    return [];
  }
}

/**
 * Find edge cases handled in the code
 */
async function findEdgeCases(
  owner: string,
  repo: string,
  focusAreas: string[]
): Promise<string[]> {
  const focus = focusAreas.length > 0
    ? `Focus on: ${focusAreas.join(', ')}`
    : '';

  const searchPrompt = `Search the ${owner}/${repo} repository for edge cases and boundary conditions.

${focus}

Look for:
1. Special case handling in conditionals
2. Null/undefined checks
3. Empty array/object handling
4. Boundary value checks
5. Race condition handling
6. Error recovery logic

Return JSON array of edge cases:
["Edge case: description and how it's handled", ...]

Each entry should describe a tricky case and its solution.
Return ONLY the JSON array.`;

  try {
    const response = await prompt(searchPrompt, {
      system: 'You are a QA expert finding edge cases in code.',
      metricsPhase: 'source-edgecases',
    });

    return parseStringArrayResponse(response);
  } catch (error) {
    console.error('Error finding edge cases:', error);
    return [];
  }
}

/**
 * Parse a string array response from Claude
 */
function parseStringArrayResponse(response: string): string[] {
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
    return parsed.filter((item) => typeof item === 'string');
  } catch {
    return [];
  }
}

function emptySourceKnowledge(repoUrl: string): SourceCodeKnowledge {
  return {
    architecture: '',
    undocumentedBehaviors: [],
    internalPatterns: [],
    codeCommentInsights: [],
    edgeCases: [],
    repoUrl,
  };
}

/**
 * Analyze source code for a technology (find popular repos first)
 */
export async function analyzeSourceForTechnology(
  technology: string,
  focusAreas: string[] = []
): Promise<SourceCodeKnowledge | null> {
  const searchPrompt = `Find the most authoritative GitHub repository for ${technology}.

Consider:
1. Official repository (if exists)
2. Most starred/popular implementation
3. Reference implementation

Return the GitHub URL of the best repository to analyze.
Return ONLY the URL, nothing else.`;

  try {
    const response = await prompt(searchPrompt, {
      system: 'You are finding authoritative source code repositories.',
      metricsPhase: 'source-findrepo',
    });

    const url = response.trim();
    if (url.includes('github.com')) {
      return analyzeSourceCode(url, focusAreas);
    }
    return null;
  } catch (error) {
    console.error('Error finding repository:', error);
    return null;
  }
}
