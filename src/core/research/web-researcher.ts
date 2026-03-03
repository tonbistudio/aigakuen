/**
 * Web Researcher
 *
 * Uses Claude web search to gather community knowledge from blogs,
 * Stack Overflow, tutorials, and other sources.
 */

import { prompt } from '../../claude';
import type { CommunityKnowledge, DomainType } from './types';

/**
 * Research community knowledge for a domain
 */
export async function researchCommunity(
  domainName: string,
  technologies: string[],
  keywords: string[],
  maxResults: number = 20,
  domainType: DomainType = 'technical'
): Promise<CommunityKnowledge> {
  // Build search terms from domain info
  const searchTerms = [
    domainName,
    ...technologies.slice(0, 3),
    ...keywords.slice(0, 3),
  ];

  try {
    if (domainType === 'non-technical') {
      // Non-technical: use domain-appropriate search categories
      const [articles, discussions, bestPractices, lessons] = await Promise.all([
        searchArticlesAndCaseStudies(searchTerms, Math.floor(maxResults / 4)),
        searchCommunityDiscussions(searchTerms, Math.floor(maxResults / 4)),
        searchBestPractices(searchTerms, Math.floor(maxResults / 4)),
        searchLessonsLearned(searchTerms, Math.floor(maxResults / 4)),
      ]);

      return {
        blogInsights: articles,
        // stackOverflowSolutions field reused for community discussions
        stackOverflowSolutions: discussions,
        bestPractices,
        ahaMoments: lessons,
      };
    }

    // Technical: existing search categories
    const [blogInsights, stackOverflow, bestPractices, ahaMoments] = await Promise.all([
      searchBlogs(searchTerms, Math.floor(maxResults / 4)),
      searchStackOverflow(searchTerms, Math.floor(maxResults / 4)),
      searchBestPractices(searchTerms, Math.floor(maxResults / 4)),
      searchAhaMoments(searchTerms, Math.floor(maxResults / 4)),
    ]);

    return {
      blogInsights,
      stackOverflowSolutions: stackOverflow,
      bestPractices,
      ahaMoments,
    };
  } catch (error) {
    console.error('Error researching community:', error);
    return emptyCommunityKnowledge();
  }
}

/**
 * Search for blog insights and tutorials
 */
async function searchBlogs(
  searchTerms: string[],
  maxResults: number
): Promise<string[]> {
  const searchPrompt = `Search the web for the best blog posts, tutorials, and articles about: ${searchTerms.join(' ')}

Focus on:
1. In-depth technical articles
2. Real-world case studies
3. Tutorial content with practical examples
4. Architecture discussions

For each result, extract the key insight or technique explained.

Return JSON array of up to ${maxResults} insights:
["Insight 1: explanation", "Insight 2: explanation", ...]

Each insight should be 1-2 sentences capturing the key takeaway.
Return ONLY the JSON array.`;

  try {
    const response = await prompt(searchPrompt, {
      system: 'You are a technical researcher finding valuable blog content.',
      metricsPhase: 'web-blogs',
    });

    return parseStringArrayResponse(response);
  } catch (error) {
    console.error('Error searching blogs:', error);
    return [];
  }
}

/**
 * Search Stack Overflow for solutions
 */
async function searchStackOverflow(
  searchTerms: string[],
  maxResults: number
): Promise<string[]> {
  const searchPrompt = `Search Stack Overflow for the most helpful Q&A about: ${searchTerms.join(' ')}

Focus on:
1. Questions with accepted answers
2. Highly upvoted solutions
3. Common problems developers face
4. Tricky edge cases with solutions

For each result, extract the problem and its solution.

Return JSON array of up to ${maxResults} problem-solution pairs:
["Problem: X -> Solution: Y", "Problem: A -> Solution: B", ...]

Each entry should capture both the problem and how to solve it.
Return ONLY the JSON array.`;

  try {
    const response = await prompt(searchPrompt, {
      system: 'You are a Stack Overflow researcher finding the best Q&A.',
      metricsPhase: 'web-stackoverflow',
    });

    return parseStringArrayResponse(response);
  } catch (error) {
    console.error('Error searching Stack Overflow:', error);
    return [];
  }
}

/**
 * Search for best practices and guidelines
 */
async function searchBestPractices(
  searchTerms: string[],
  maxResults: number
): Promise<string[]> {
  const searchPrompt = `Search for best practices, guidelines, and recommendations about: ${searchTerms.join(' ')}

Focus on:
1. Official recommendations
2. Industry-accepted patterns
3. Performance best practices
4. Security guidelines
5. Testing recommendations

For each result, extract the best practice as an actionable guideline.

Return JSON array of up to ${maxResults} best practices:
["Best practice 1", "Best practice 2", ...]

Each practice should be actionable and specific.
Return ONLY the JSON array.`;

  try {
    const response = await prompt(searchPrompt, {
      system: 'You are a best practices researcher finding authoritative guidelines.',
      metricsPhase: 'web-bestpractices',
    });

    return parseStringArrayResponse(response);
  } catch (error) {
    console.error('Error searching best practices:', error);
    return [];
  }
}

/**
 * Search for "aha moments" and non-obvious insights
 */
async function searchAhaMoments(
  searchTerms: string[],
  maxResults: number
): Promise<string[]> {
  const searchPrompt = `Search for non-obvious insights, "aha moments", and surprising discoveries about: ${searchTerms.join(' ')}

Focus on:
1. Things that aren't in the official docs
2. Counter-intuitive behaviors
3. "I wish I knew this earlier" tips
4. Hidden features or capabilities
5. Common misconceptions debunked

For each result, extract the insight that surprised developers.

Return JSON array of up to ${maxResults} aha moments:
["Aha: insight about X", "Aha: counter-intuitive behavior Y", ...]

Each entry should reveal something not immediately obvious.
Return ONLY the JSON array.`;

  try {
    const response = await prompt(searchPrompt, {
      system: 'You are a researcher finding non-obvious insights and surprises.',
      metricsPhase: 'web-aha',
    });

    return parseStringArrayResponse(response);
  } catch (error) {
    console.error('Error searching aha moments:', error);
    return [];
  }
}

// ═══════════════════════════════════════════════════════════
// NON-TECHNICAL DOMAIN SEARCH FUNCTIONS
// ═══════════════════════════════════════════════════════════

/**
 * Search for articles, case studies, and expert analysis (non-technical domains)
 */
async function searchArticlesAndCaseStudies(
  searchTerms: string[],
  maxResults: number
): Promise<string[]> {
  const searchPrompt = `Search the web for the best articles, case studies, and expert analysis about: ${searchTerms.join(' ')}

Focus on:
1. Data-driven case studies with measurable results
2. Expert analysis from recognized thought leaders
3. Industry reports and market research findings
4. Step-by-step breakdowns of successful strategies

For each result, extract the key insight or strategy explained.

Return JSON array of up to ${maxResults} insights:
["Insight 1: explanation", "Insight 2: explanation", ...]

Each insight should be 1-2 sentences capturing the key takeaway.
Return ONLY the JSON array.`;

  try {
    const response = await prompt(searchPrompt, {
      system: 'You are a domain researcher finding valuable articles, case studies, and expert analysis.',
      metricsPhase: 'web-articles',
    });

    return parseStringArrayResponse(response);
  } catch (error) {
    console.error('Error searching articles and case studies:', error);
    return [];
  }
}

/**
 * Search for community discussions on Reddit, Quora, forums, YouTube (non-technical domains)
 */
async function searchCommunityDiscussions(
  searchTerms: string[],
  maxResults: number
): Promise<string[]> {
  const searchPrompt = `Search Reddit, Quora, forums, and YouTube for the most insightful community discussions about: ${searchTerms.join(' ')}

Focus on:
1. Reddit threads with highly upvoted advice from practitioners
2. Quora answers from verified experts
3. YouTube expert breakdowns and tutorials
4. Forum discussions with real-world experience sharing

For each result, extract the practical advice or experience shared.

Return JSON array of up to ${maxResults} discussion insights:
["Discussion: practical advice about X", "Discussion: experienced practitioner shares Y", ...]

Each entry should capture actionable advice from real practitioners.
Return ONLY the JSON array.`;

  try {
    const response = await prompt(searchPrompt, {
      system: 'You are a researcher finding valuable community discussions and practitioner advice.',
      metricsPhase: 'web-discussions',
    });

    return parseStringArrayResponse(response);
  } catch (error) {
    console.error('Error searching community discussions:', error);
    return [];
  }
}

/**
 * Search for lessons learned, common mistakes, and myths debunked (non-technical domains)
 */
async function searchLessonsLearned(
  searchTerms: string[],
  maxResults: number
): Promise<string[]> {
  const searchPrompt = `Search for lessons learned, common mistakes, and myths debunked about: ${searchTerms.join(' ')}

Focus on:
1. Expensive mistakes practitioners wish they avoided
2. Popular myths and misconceptions debunked with evidence
3. "What I wish I knew before starting" retrospectives
4. Counter-intuitive findings that contradict common advice

For each result, extract the lesson or debunked myth.

Return JSON array of up to ${maxResults} lessons:
["Lesson: what went wrong and why", "Myth debunked: common belief vs reality", ...]

Each entry should reveal something that saves time, money, or effort.
Return ONLY the JSON array.`;

  try {
    const response = await prompt(searchPrompt, {
      system: 'You are a researcher finding hard-won lessons and debunking myths.',
      metricsPhase: 'web-lessons',
    });

    return parseStringArrayResponse(response);
  } catch (error) {
    console.error('Error searching lessons learned:', error);
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

function emptyCommunityKnowledge(): CommunityKnowledge {
  return {
    blogInsights: [],
    stackOverflowSolutions: [],
    bestPractices: [],
    ahaMoments: [],
  };
}

/**
 * Deep dive research on a specific topic
 */
export async function deepDiveResearch(
  topic: string,
  context: string
): Promise<string> {
  const researchPrompt = `Conduct deep research on: "${topic}"

Context: ${context}

Search for:
1. Official documentation and specifications
2. Technical blog posts and tutorials
3. Stack Overflow discussions
4. GitHub issues and discussions
5. Academic papers or RFCs if applicable

Compile a comprehensive summary covering:
- How it works (the core mechanism)
- Why it matters (implications)
- Common use cases
- Edge cases and gotchas
- Best practices

Provide a detailed, technical summary (500-1000 words).`;

  try {
    const response = await prompt(researchPrompt, {
      system: 'You are a technical researcher conducting deep research.',
      metricsPhase: 'web-deepdive',
    });

    return response.trim();
  } catch (error) {
    console.error('Error in deep dive research:', error);
    return `Failed to research: ${topic}`;
  }
}
