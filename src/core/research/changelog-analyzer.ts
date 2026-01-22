/**
 * Changelog Analyzer
 *
 * Analyzes GitHub releases and changelogs to extract breaking changes,
 * deprecations, new features, and migration tips.
 */

import { prompt } from '../../claude';
import type { ChangelogKnowledge, BreakingChange, Deprecation } from './types';

interface Release {
  version: string;
  name: string;
  body: string;
  publishedAt: string;
  url: string;
}

/**
 * Analyze changelog/releases for a repository
 */
export async function analyzeChangelog(
  repoUrl: string,
  maxReleases: number = 10
): Promise<ChangelogKnowledge> {
  // Extract owner/repo from URL
  const match = repoUrl.match(/github\.com\/([^/]+)\/([^/]+)/);
  if (!match) {
    console.error('Invalid GitHub URL:', repoUrl);
    return emptyChangelogKnowledge();
  }

  const [, owner, repo] = match;

  try {
    // Fetch releases
    const releases = await fetchReleases(owner, repo, maxReleases);

    if (releases.length === 0) {
      return emptyChangelogKnowledge();
    }

    // Analyze releases for patterns
    const knowledge = await analyzeReleases(releases, `${owner}/${repo}`);
    return knowledge;
  } catch (error) {
    console.error('Error analyzing changelog:', error);
    return emptyChangelogKnowledge();
  }
}

/**
 * Fetch releases from GitHub repository
 */
async function fetchReleases(
  owner: string,
  repo: string,
  maxReleases: number
): Promise<Release[]> {
  const fetchPrompt = `Search for GitHub releases from the repository ${owner}/${repo}.

Focus on:
1. Recent major and minor releases
2. Releases with breaking changes
3. Security-related releases

For each release, extract:
- Version number
- Release name/title
- Release notes body (key changes)
- Publication date

Return as JSON array with up to ${maxReleases} releases:
[
  {
    "version": "v2.0.0",
    "name": "Version 2.0 - Major Update",
    "body": "Release notes content (truncated to 1000 chars)",
    "publishedAt": "2024-01-15",
    "url": "https://github.com/owner/repo/releases/tag/v2.0.0"
  }
]

Return ONLY the JSON array.`;

  try {
    const response = await prompt(fetchPrompt, {
      system: 'You are a GitHub release researcher. Find real releases and return structured data.',
      metricsPhase: 'changelog-fetch',
    });

    return parseReleasesResponse(response);
  } catch (error) {
    console.error('Error fetching releases:', error);
    return [];
  }
}

/**
 * Parse releases response from Claude
 */
function parseReleasesResponse(response: string): Release[] {
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
    return parsed.map(normalizeRelease).filter(Boolean) as Release[];
  } catch {
    return [];
  }
}

function normalizeRelease(release: unknown): Release | null {
  if (!release || typeof release !== 'object') {
    return null;
  }
  const r = release as Record<string, unknown>;
  return {
    version: typeof r.version === 'string' ? r.version : '',
    name: typeof r.name === 'string' ? r.name : '',
    body: typeof r.body === 'string' ? r.body : '',
    publishedAt: typeof r.publishedAt === 'string' ? r.publishedAt : '',
    url: typeof r.url === 'string' ? r.url : '',
  };
}

/**
 * Analyze releases to extract changelog knowledge
 */
async function analyzeReleases(
  releases: Release[],
  repoName: string
): Promise<ChangelogKnowledge> {
  // Build context from releases
  const releasesSummary = releases
    .map((release) => `## ${release.version} - ${release.name}
Published: ${release.publishedAt}

${release.body.slice(0, 1000)}`)
    .join('\n\n---\n\n');

  const analysisPrompt = `Analyze these release notes from ${repoName}:

${releasesSummary}

---

Extract:
1. **Breaking Changes**: API changes that require code updates
2. **Deprecations**: Features being phased out
3. **Recent Features**: New capabilities added
4. **Migration Tips**: How to upgrade between versions

Return JSON:
{
  "breakingChanges": [
    {
      "version": "v2.0.0",
      "description": "What changed",
      "migration": "How to update your code",
      "gotcha": "Easy mistakes to make when migrating"
    }
  ],
  "deprecations": [
    {
      "what": "Feature or API being deprecated",
      "replacedBy": "What to use instead",
      "removeVersion": "Version when it will be removed",
      "reason": "Why it's being deprecated"
    }
  ],
  "recentFeatures": ["Feature 1", "Feature 2"],
  "migrationTips": ["Tip 1 for upgrading", "Tip 2"]
}

Focus on:
- Changes that affect users/developers
- Clear migration paths
- Common upgrade pitfalls

Return ONLY the JSON object.`;

  try {
    const response = await prompt(analysisPrompt, {
      system: 'You are a technical analyst extracting changelog patterns.',
      metricsPhase: 'changelog-analyze',
    });

    return parseChangelogResponse(response);
  } catch (error) {
    console.error('Error analyzing releases:', error);
    return emptyChangelogKnowledge();
  }
}

/**
 * Parse changelog analysis response
 */
function parseChangelogResponse(response: string): ChangelogKnowledge {
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

    const breakingChanges: BreakingChange[] = Array.isArray(parsed.breakingChanges)
      ? parsed.breakingChanges.map((bc: Record<string, unknown>) => ({
          version: typeof bc.version === 'string' ? bc.version : '',
          description: typeof bc.description === 'string' ? bc.description : '',
          migration: typeof bc.migration === 'string' ? bc.migration : '',
          gotcha: typeof bc.gotcha === 'string' ? bc.gotcha : undefined,
        }))
      : [];

    const deprecations: Deprecation[] = Array.isArray(parsed.deprecations)
      ? parsed.deprecations.map((d: Record<string, unknown>) => ({
          what: typeof d.what === 'string' ? d.what : '',
          replacedBy: typeof d.replacedBy === 'string' ? d.replacedBy : '',
          removeVersion: typeof d.removeVersion === 'string' ? d.removeVersion : undefined,
          reason: typeof d.reason === 'string' ? d.reason : undefined,
        }))
      : [];

    return {
      breakingChanges,
      deprecations,
      recentFeatures: Array.isArray(parsed.recentFeatures)
        ? parsed.recentFeatures.map(String)
        : [],
      migrationTips: Array.isArray(parsed.migrationTips)
        ? parsed.migrationTips.map(String)
        : [],
    };
  } catch {
    return emptyChangelogKnowledge();
  }
}

function emptyChangelogKnowledge(): ChangelogKnowledge {
  return {
    breakingChanges: [],
    deprecations: [],
    recentFeatures: [],
    migrationTips: [],
  };
}

/**
 * Analyze changelog for a technology (without specific repo)
 */
export async function analyzeChangelogForTechnology(
  technology: string
): Promise<ChangelogKnowledge> {
  const searchPrompt = `Search for recent breaking changes, deprecations, and new features in "${technology}".

Look for:
1. Official changelogs and release notes
2. Major version changes
3. Deprecation notices
4. Migration guides

Return JSON:
{
  "breakingChanges": [
    {
      "version": "Version where change occurred",
      "description": "What changed",
      "migration": "How to update",
      "gotcha": "Common mistake"
    }
  ],
  "deprecations": [
    {
      "what": "Deprecated API/feature",
      "replacedBy": "Replacement",
      "removeVersion": "When removed",
      "reason": "Why deprecated"
    }
  ],
  "recentFeatures": ["New feature 1", "New feature 2"],
  "migrationTips": ["Upgrade tip 1", "Upgrade tip 2"]
}

Focus on changes from the last 1-2 years that affect developers.
Return ONLY the JSON object.`;

  try {
    const response = await prompt(searchPrompt, {
      system: `You are a ${technology} expert researching recent changes and updates.`,
      metricsPhase: 'changelog-search',
    });

    return parseChangelogResponse(response);
  } catch (error) {
    console.error('Error analyzing changelog for technology:', error);
    return emptyChangelogKnowledge();
  }
}
