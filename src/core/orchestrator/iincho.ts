/**
 * Class Pres (委員長) - Task Orchestrator
 *
 * Routes tasks to the appropriate Otaku based on their expertise.
 */

import { prompt } from '../../claude';
import type { OtakuProfile } from '../../types';

export interface RoutingResult {
  otakuId: string;
  otakuName: string;
  confidence: 'high' | 'medium' | 'low';
  reason: string;
  alternativeIds?: string[];
}

/**
 * Route a task to the most appropriate Otaku
 */
export async function routeTask(
  taskDescription: string,
  trainedOtaku: OtakuProfile[]
): Promise<RoutingResult | null> {
  // Filter to only trained Otaku
  const available = trainedOtaku.filter(
    (o) => o.status !== 'recommended'
  );

  if (available.length === 0) {
    return null;
  }

  // If only one Otaku, route to them
  if (available.length === 1) {
    return {
      otakuId: available[0].id,
      otakuName: available[0].name,
      confidence: 'high',
      reason: 'Only trained specialist available',
    };
  }

  // Build roster description for Claude
  const rosterDescription = available
    .map((o) => {
      const domains = o.expertise.domains.join(', ') || o.specialty || 'General';
      const techs = o.expertise.technologies.join(', ') || 'N/A';
      const tasks = o.expertise.taskTypes.join(', ') || 'General tasks';
      return `- **${o.name}** (${o.id}): ${domains}. Technologies: ${techs}. Task types: ${tasks}`;
    })
    .join('\n');

  const routingPrompt = `You are Class Pres (委員長), the class president who routes tasks to specialist Otaku.

TASK TO ASSIGN:
"${taskDescription}"

AVAILABLE SPECIALISTS:
${rosterDescription}

Determine which specialist should handle this task. Consider:
1. Domain match (which specialist's expertise aligns best?)
2. Technology match (which technologies does the task involve?)
3. Task type match (implementation, debugging, architecture, etc.)

Respond with JSON:
{
  "otakuId": "the-specialist-id",
  "otakuName": "The Specialist Name",
  "confidence": "high" | "medium" | "low",
  "reason": "Brief explanation of why this specialist was chosen",
  "alternativeIds": ["other-possible-specialist-ids"] // optional
}

If no specialist is a good fit, respond with:
{
  "otakuId": null,
  "reason": "Explanation of why no specialist fits"
}

Respond with ONLY the JSON object.`;

  try {
    const response = await prompt(routingPrompt, {
      system: 'You are a task router. Analyze tasks and match them to specialists. Respond with JSON only.',
    });

    const result = parseRoutingResponse(response, available);
    return result;
  } catch (error) {
    console.error('Error routing task:', error);
    // Fallback to keyword matching
    return keywordBasedRouting(taskDescription, available);
  }
}

/**
 * Parse Claude's routing response
 */
function parseRoutingResponse(
  response: string,
  available: OtakuProfile[]
): RoutingResult | null {
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

    if (!parsed.otakuId) {
      return null;
    }

    // Validate the Otaku exists
    const otaku = available.find((o) => o.id === parsed.otakuId);
    if (!otaku) {
      return null;
    }

    return {
      otakuId: parsed.otakuId,
      otakuName: parsed.otakuName || otaku.name,
      confidence: ['high', 'medium', 'low'].includes(parsed.confidence)
        ? parsed.confidence
        : 'medium',
      reason: parsed.reason || 'Matched by Class Pres',
      alternativeIds: Array.isArray(parsed.alternativeIds)
        ? parsed.alternativeIds
        : undefined,
    };
  } catch {
    return null;
  }
}

/**
 * Fallback keyword-based routing
 */
function keywordBasedRouting(
  taskDescription: string,
  available: OtakuProfile[]
): RoutingResult | null {
  const taskLower = taskDescription.toLowerCase();

  // Score each Otaku based on keyword matches
  const scores = available.map((otaku) => {
    let score = 0;

    // Check domain matches
    for (const domain of otaku.expertise.domains) {
      if (taskLower.includes(domain.toLowerCase())) {
        score += 3;
      }
    }

    // Check technology matches
    for (const tech of otaku.expertise.technologies) {
      if (taskLower.includes(tech.toLowerCase())) {
        score += 2;
      }
    }

    // Check task type matches
    for (const taskType of otaku.expertise.taskTypes) {
      if (taskLower.includes(taskType.toLowerCase())) {
        score += 1;
      }
    }

    // Check name/specialty
    if (otaku.specialty && taskLower.includes(otaku.specialty.toLowerCase())) {
      score += 2;
    }

    return { otaku, score };
  });

  // Sort by score
  scores.sort((a, b) => b.score - a.score);

  if (scores[0].score > 0) {
    const best = scores[0];
    const confidence = best.score >= 5 ? 'high' : best.score >= 2 ? 'medium' : 'low';

    return {
      otakuId: best.otaku.id,
      otakuName: best.otaku.name,
      confidence,
      reason: `Keyword match (score: ${best.score})`,
      alternativeIds: scores
        .slice(1, 3)
        .filter((s) => s.score > 0)
        .map((s) => s.otaku.id),
    };
  }

  // No good match, return first available
  return {
    otakuId: available[0].id,
    otakuName: available[0].name,
    confidence: 'low',
    reason: 'No strong keyword match, defaulting to first available specialist',
  };
}

/**
 * Suggest which Otaku should handle upcoming work based on spec analysis
 */
export async function suggestOtakuOrder(
  specSummary: string,
  trainedOtaku: OtakuProfile[]
): Promise<string[]> {
  const available = trainedOtaku.filter((o) => o.status !== 'recommended');

  if (available.length <= 1) {
    return available.map((o) => o.id);
  }

  const rosterDescription = available
    .map((o) => `- ${o.name} (${o.id}): ${o.specialty || o.expertise.domains.join(', ')}`)
    .join('\n');

  const orderPrompt = `Based on this project specification, suggest the order in which specialists should work:

SPEC SUMMARY:
${specSummary.slice(0, 1500)}

AVAILABLE SPECIALISTS:
${rosterDescription}

Consider:
1. Foundation work should come first (data models, core algorithms)
2. Integration work comes after components are ready
3. UI/presentation typically comes last

Respond with a JSON array of specialist IDs in recommended order:
["first-specialist-id", "second-specialist-id", ...]

Respond with ONLY the JSON array.`;

  try {
    const response = await prompt(orderPrompt, {
      system: 'You are a project planner. Suggest optimal specialist ordering.',
    });

    // Parse response
    let jsonStr = response.trim();
    if (jsonStr.startsWith('```')) {
      jsonStr = jsonStr.replace(/```json?\n?/g, '').replace(/```/g, '').trim();
    }

    const order = JSON.parse(jsonStr);
    if (Array.isArray(order)) {
      // Validate all IDs exist
      return order.filter((id) => available.some((o) => o.id === id));
    }
  } catch (error) {
    console.error('Error suggesting order:', error);
  }

  // Fallback to original order
  return available.map((o) => o.id);
}
