/**
 * Context7 Documentation Fetcher
 *
 * Uses Claude Code's Context7 MCP integration to fetch official documentation
 */

import { prompt } from '../../claude';
import type { DomainInfo, DocumentationKnowledge } from './types';

/**
 * Fetch documentation for a domain using Context7
 */
export async function fetchDocumentation(
  domain: DomainInfo
): Promise<DocumentationKnowledge> {
  // Build a search query from domain info
  const searchTerms = [
    domain.name,
    ...domain.technologies.slice(0, 3),
    ...domain.keywords.slice(0, 3),
  ].join(' ');

  // Use Claude to fetch and analyze documentation via Context7
  const documentationPrompt = `You have access to Context7 MCP for fetching up-to-date documentation.

TASK: Research and compile documentation for: "${domain.name}"

Domain description: ${domain.description}
Related technologies: ${domain.technologies.join(', ')}
Keywords: ${domain.keywords.join(', ')}

INSTRUCTIONS:
1. Use the Context7 tools (resolve-library-id, then query-docs) to find relevant documentation
2. If the domain relates to a specific library (like Supabase, React, etc.), look up that library
3. If it's a concept (like SM-2 algorithm), search for relevant technical documentation

After researching, provide a comprehensive summary in this exact JSON format:
{
  "concepts": ["array of key concepts explained concisely"],
  "apiReference": "string summarizing the most important APIs, functions, or interfaces",
  "patterns": ["array of recommended patterns from the docs"],
  "warnings": ["array of warnings, caveats, or limitations mentioned in docs"],
  "rawContent": "the most important documentation content (up to 2000 words)",
  "source": "where this documentation came from"
}

Focus on:
- Core concepts and how they work
- API signatures and parameters
- Recommended patterns
- Warnings and limitations
- Getting started essentials

Respond with ONLY the JSON object.`;

  try {
    const response = await prompt(documentationPrompt, {
      system: 'You are a documentation researcher with access to Context7 MCP. Use it to fetch real documentation, then summarize the findings as JSON.',
      metricsPhase: 'context7-docs',
    });

    // Parse the JSON response
    const knowledge = parseDocumentationResponse(response);
    return knowledge;
  } catch (error) {
    console.error('Error fetching documentation:', error);
    // Return empty knowledge on failure
    return {
      concepts: [],
      apiReference: '',
      patterns: [],
      warnings: [],
      rawContent: `Failed to fetch documentation: ${error}`,
      source: 'error',
    };
  }
}

/**
 * Parse Claude's documentation response into structured knowledge
 */
function parseDocumentationResponse(response: string): DocumentationKnowledge {
  // Try to extract JSON from response
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

  // Try to find JSON object
  const jsonMatch = jsonStr.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    jsonStr = jsonMatch[0];
  }

  try {
    const parsed = JSON.parse(jsonStr);
    return {
      concepts: Array.isArray(parsed.concepts) ? parsed.concepts : [],
      apiReference: typeof parsed.apiReference === 'string' ? parsed.apiReference : '',
      patterns: Array.isArray(parsed.patterns) ? parsed.patterns : [],
      warnings: Array.isArray(parsed.warnings) ? parsed.warnings : [],
      rawContent: typeof parsed.rawContent === 'string' ? parsed.rawContent : '',
      source: typeof parsed.source === 'string' ? parsed.source : 'context7',
    };
  } catch {
    // If JSON parsing fails, treat the whole response as raw content
    return {
      concepts: [],
      apiReference: '',
      patterns: [],
      warnings: [],
      rawContent: response.slice(0, 5000),
      source: 'context7 (parse error)',
    };
  }
}

/**
 * Fetch documentation for multiple related technologies
 */
export async function fetchMultipleDocumentation(
  technologies: string[]
): Promise<Map<string, DocumentationKnowledge>> {
  const results = new Map<string, DocumentationKnowledge>();

  for (const tech of technologies) {
    const domain: DomainInfo = {
      id: tech.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
      name: tech,
      description: `Documentation for ${tech}`,
      technologies: [tech],
      keywords: [tech],
    };

    const knowledge = await fetchDocumentation(domain);
    results.set(tech, knowledge);
  }

  return results;
}
