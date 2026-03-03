import { analyzeWithSchemaRetry } from '../../claude';
import type { ExpertiseDomain, DomainExtractionResult } from './domain-extractor';
import type { OtakuProfile } from '../../types';

export interface OtakuRecommendation {
  profile: Omit<OtakuProfile, 'meta'>;
  domain: ExpertiseDomain;
}

const OTAKU_GENERATION_SCHEMA = `{
  "otaku": [
    {
      "id": "string - kebab-case (e.g., 'supabase-realtime-otaku')",
      "name": "string - fun character name (e.g., 'Supa-chan', 'React-senpai')",
      "specialty": "string - one-line specialty description",
      "personality": "string - 2-3 sentence personality description, make it memorable and fun",
      "catchphrase": "string - signature phrase the Otaku would say",
      "expertise": {
        "domains": ["array of domain keywords"],
        "technologies": ["array of specific technologies"],
        "taskTypes": ["array of task types they handle"]
      },
      "qualityGates": ["array of checklist items for work readiness"],
      "weaknesses": ["array of things to hand off to other Otaku"]
    }
  ]
}`;

const OTAKU_GENERATION_PROMPT = `OUTPUT: JSON ONLY. No text, no explanation, no markdown. Start with { end with }.

Create {{domainCount}} "Otaku" characters for AI Gakuen - specialized AI expert agents.

Requirements for each Otaku:
- Obsessively focused on their domain
- Memorable personality with a fun catchphrase
- Japanese-style name with honorific (e.g., "Sync-kun", "React-senpai", "Senryaku-chan", "Trend-senpai")
- Practical quality gates (5-8 checklist items for work readiness)
- Known weaknesses (what to hand off to others)
- Note: technologies may be empty for non-technical domains — that's fine

PROJECT: {{projectName}}
{{projectDescription}}

DOMAINS:
{{domains}}`;

interface OtakuGenerationResult {
  otaku: Array<{
    id: string;
    name: string;
    specialty: string;
    personality: string;
    catchphrase: string;
    expertise: {
      domains: string[];
      technologies: string[];
      taskTypes: string[];
    };
    qualityGates: string[];
    weaknesses: string[];
  }>;
}

const BATCH_SIZE = 8; // Generate Otaku in batches to avoid Claude output limits

/**
 * Recursively search for an array that looks like Otaku data
 * Claude uses many different key names, so we search for any array of objects
 * that contains character-like fields (name, personality, etc.)
 */
function findOtakuArray(obj: any, depth: number = 0): any[] | null {
  if (depth > 5) return null; // Prevent infinite recursion

  if (!obj || typeof obj !== 'object') return null;

  // If it's an array, check if it looks like Otaku data
  if (Array.isArray(obj)) {
    if (obj.length > 0 && looksLikeOtakuArray(obj)) {
      return obj;
    }
    return null;
  }

  // Common direct key names
  const directKeys = [
    'otaku', 'otakus', 'otaku_characters', 'characters',
    'specialists', 'agents', 'roster', 'team'
  ];

  for (const key of directKeys) {
    const value = obj[key];
    if (value) {
      // If it's an array, check if it looks like Otaku data
      if (Array.isArray(value) && looksLikeOtakuArray(value)) {
        return value;
      }
      // If it's a single object that looks like an Otaku, wrap it in an array
      if (typeof value === 'object' && !Array.isArray(value) && looksLikeOtaku(value)) {
        return [value];
      }
    }
  }

  // Search nested objects (common patterns like ai_gakuen.characters)
  for (const key of Object.keys(obj)) {
    const value = obj[key];
    if (value && typeof value === 'object') {
      const found = findOtakuArray(value, depth + 1);
      if (found) return found;
    }
  }

  // Fallback: the root object itself is an Otaku (Claude returned a bare object)
  if (depth === 0 && looksLikeOtaku(obj)) {
    return [obj];
  }

  return null;
}

/**
 * Check if a single object looks like an Otaku
 */
function looksLikeOtaku(item: any): boolean {
  if (!item || typeof item !== 'object') return false;

  // Direct fields
  const hasDirectFields = item.name || item.personality || item.catchphrase || item.specialty;

  // Nested character object
  const hasNestedCharacter = item.character && (
    item.character.name || item.character.personality || item.character.catchphrase
  );

  // Nested otaku object (but not the key 'otaku' itself pointing to another otaku)
  const hasNestedOtaku = item.otaku && typeof item.otaku === 'object' && !Array.isArray(item.otaku) && (
    item.otaku.name || item.otaku.personality || item.otaku.catchphrase
  );

  return hasDirectFields || hasNestedCharacter || hasNestedOtaku;
}

/**
 * Check if an array looks like Otaku data
 * Looking for objects with name/personality/character fields
 */
function looksLikeOtakuArray(arr: any[]): boolean {
  if (arr.length === 0) return false;
  return looksLikeOtaku(arr[0]);
}

export type BatchProgressCallback = (
  batchIndex: number,
  batchResults: OtakuRecommendation[],
  totalBatches: number
) => void;

/**
 * Generate Otaku recommendations from extracted domains
 * Batches large domain sets to avoid Claude output limits
 */
export async function recommendOtaku(
  extraction: DomainExtractionResult
): Promise<OtakuRecommendation[]> {
  return recommendOtakuWithProgress(extraction, 0, [], () => {});
}

/**
 * Generate Otaku recommendations with progress callback for checkpointing
 * Supports resuming from a specific batch
 */
export async function recommendOtakuWithProgress(
  extraction: DomainExtractionResult,
  startBatch: number = 0,
  existingRecommendations: OtakuRecommendation[] = [],
  onBatchComplete?: BatchProgressCallback
): Promise<OtakuRecommendation[]> {
  const allRecommendations: OtakuRecommendation[] = [...existingRecommendations];
  const domains = extraction.domains;
  const totalBatches = Math.ceil(domains.length / BATCH_SIZE);

  // Process domains in batches, starting from startBatch
  for (let batchIndex = startBatch; batchIndex < totalBatches; batchIndex++) {
    const batchStart = batchIndex * BATCH_SIZE;
    const batchDomains = domains.slice(batchStart, batchStart + BATCH_SIZE);

    if (totalBatches > 1) {
      console.log(`  Processing batch ${batchIndex + 1}/${totalBatches} (${batchDomains.length} domains)...`);
    }

    const domainsText = batchDomains
      .map(
        (d, i) =>
          `${batchStart + i + 1}. **${d.name}** (${d.specificity} specificity)
   - Description: ${d.description}
   - Technologies: ${d.technologies.join(', ')}
   - Task Types: ${d.taskTypes.join(', ')}
   - Rationale: ${d.rationale}`
      )
      .join('\n\n');

    const prompt = OTAKU_GENERATION_PROMPT
      .replace('{{projectName}}', extraction.projectName)
      .replace('{{projectDescription}}', extraction.projectDescription)
      .replace('{{domainCount}}', String(batchDomains.length))
      .replace('{{domains}}', domainsText);

    const result = await analyzeWithSchemaRetry<OtakuGenerationResult>(
      prompt,
      OTAKU_GENERATION_SCHEMA,
      {},
      2 // retry up to 2 times on JSON parse failure
    );

    const batchRecommendations = processOtakuResult(result, batchDomains);
    allRecommendations.push(...batchRecommendations);

    // Call progress callback after each batch
    if (onBatchComplete) {
      onBatchComplete(batchIndex, batchRecommendations, totalBatches);
    }
  }

  return allRecommendations;
}

const CREATE_FROM_PROMPT_PROMPT = `OUTPUT: JSON ONLY. No text, no explanation, no markdown. Start with { end with }.

Create exactly 1 "Otaku" character for AI Gakuen - a specialized AI expert agent.

Requirements:
- Obsessively focused on the domain described below
- Memorable personality with a fun catchphrase
- Japanese-style name with honorific (e.g., "Sync-kun", "React-senpai", "Senryaku-chan", "Trend-senpai")
- Practical quality gates (5-8 checklist items for work readiness)
- Known weaknesses (what to hand off to others)
- Note: technologies may be empty for non-technical domains — that's fine

USER REQUEST:
{{promptText}}`;

/**
 * Create a single Otaku profile directly from a text prompt
 * Bypasses the spec → domains → recommendations pipeline
 */
export async function createOtakuFromPrompt(
  promptText: string
): Promise<Omit<OtakuProfile, 'meta'>> {
  const prompt = CREATE_FROM_PROMPT_PROMPT.replace('{{promptText}}', promptText);

  const result = await analyzeWithSchemaRetry<OtakuGenerationResult>(
    prompt,
    OTAKU_GENERATION_SCHEMA,
    {},
    2
  );

  // Build a synthetic domain as fallback for processOtakuResult
  const syntheticDomain: ExpertiseDomain = {
    id: 'prompt-created',
    name: promptText.slice(0, 60),
    description: promptText,
    specificity: 'high',
    technologies: [],
    taskTypes: [],
    keywords: [],
    rationale: 'Created from direct prompt',
  };

  const recommendations = processOtakuResult(result, [syntheticDomain]);

  if (recommendations.length === 0) {
    throw new Error('Failed to generate Otaku from prompt. Claude returned no results.');
  }

  return recommendations[0].profile;
}

/**
 * Process Claude's response and extract Otaku recommendations
 */
function processOtakuResult(
  result: OtakuGenerationResult,
  domains: ExpertiseDomain[]
): OtakuRecommendation[] {

  // Validate result - handle different key names Claude might use
  if (!result || typeof result !== 'object') {
    console.error('Invalid Claude response (not an object):', JSON.stringify(result, null, 2));
    throw new Error('Failed to generate Otaku recommendations. Claude response was not a valid object.');
  }

  // Claude uses many different key names - use flexible extraction
  const otakuArray = findOtakuArray(result);

  if (!otakuArray || !Array.isArray(otakuArray)) {
    console.error('Invalid Claude response (no otaku array found):', JSON.stringify(result, null, 2));
    throw new Error('Failed to generate Otaku recommendations. Could not find otaku array in response.');
  }

  // Replace result.otaku with the found array for the rest of the function
  (result as any).otaku = otakuArray;

  // Map generated Otaku to domains
  const recommendations: OtakuRecommendation[] = [];

  for (let i = 0; i < result.otaku.length && i < domains.length; i++) {
    let otaku = result.otaku[i] as any; // Allow flexible field access
    const domain = domains[i];

    // Handle nested structures where character data is inside a sub-object
    // Pattern 1: { domain: {...}, character: {...} }
    // Pattern 2: { domain_name: "...", otaku: {...} }
    // Pattern 3: { domain: {...}, otaku: {...} }
    if (otaku.character && typeof otaku.character === 'object') {
      const charData = otaku.character;
      const domainData = otaku.domain || otaku.domain_details;
      otaku = {
        ...charData,
        domainInfo: domainData,
      };
    } else if (otaku.otaku && typeof otaku.otaku === 'object') {
      const charData = otaku.otaku;
      const domainData = otaku.domain || otaku.domain_details || {
        name: otaku.domain_name,
        technologies: otaku.technologies,
        task_types: otaku.task_types,
      };
      otaku = {
        ...charData,
        domainInfo: domainData,
      };
    }

    // Safely extract string fields (Claude sometimes returns objects)
    const personality = typeof otaku.personality === 'string'
      ? otaku.personality
      : (otaku.personality as any)?.description || '';

    // Handle both camelCase and snake_case field names
    const qualityGatesRaw = otaku.qualityGates || otaku.quality_gates || [];
    // Handle weaknesses that might be an object with keys like { ui_flows: "...", infrastructure: "..." }
    let weaknessesRaw = otaku.weaknesses || otaku.known_weaknesses || otaku.weaknesses_handoff || [];
    if (weaknessesRaw && typeof weaknessesRaw === 'object' && !Array.isArray(weaknessesRaw)) {
      // Convert object to array of strings
      weaknessesRaw = Object.values(weaknessesRaw);
    }
    const taskTypesRaw = otaku.expertise?.taskTypes || otaku.expertise?.task_types || otaku.task_types || otaku.domainInfo?.task_types || [];
    const technologiesRaw = otaku.expertise?.technologies || otaku.technologies || otaku.domainInfo?.technologies || [];
    const domainsRaw = otaku.expertise?.domains || otaku.domains || [];

    // Flatten arrays that might contain objects
    const qualityGates = qualityGatesRaw.map((g: any) =>
      typeof g === 'string' ? g : g?.text || g?.description || g?.gate || JSON.stringify(g)
    );
    const weaknesses = weaknessesRaw.map((w: any) =>
      typeof w === 'string' ? w : w?.text || w?.description || JSON.stringify(w)
    );

    // Use domain data as fallback if Claude returns empty arrays
    const expertiseDomains = domainsRaw.length > 0
      ? domainsRaw
      : domain.keywords?.length > 0
        ? domain.keywords
        : [domain.name];

    const expertiseTechnologies = technologiesRaw.length > 0
      ? technologiesRaw
      : domain.technologies?.length > 0
        ? domain.technologies
        : [];

    const expertiseTaskTypes = taskTypesRaw.length > 0
      ? taskTypesRaw
      : domain.taskTypes?.length > 0
        ? domain.taskTypes
        : [];

    // Use domain description as fallback for specialty
    // Also check for 'domain' field which Claude sometimes uses for specialty
    const specialty = otaku.specialty?.trim()
      ? otaku.specialty
      : otaku.domain?.trim()
        ? otaku.domain
        : domain.description?.trim()
          ? domain.description
          : `Expert in ${domain.name}`;

    // Generate ID from name if not provided
    // Include domain ID suffix to ensure uniqueness when Claude generates duplicate names
    // Always ensure ID is a string (Claude sometimes returns numbers)
    const nameBasedId = otaku.name
      ? otaku.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/-+$/, '')
      : null;
    let generatedId = otaku.id
      ? String(otaku.id)
      : (nameBasedId ? `${nameBasedId}-${domain.id}` : `${domain.id}-otaku`);
    // Ensure ID is valid (no leading numbers, kebab-case)
    if (/^\d/.test(generatedId)) {
      generatedId = `otaku-${generatedId}`;
    }

    recommendations.push({
      profile: {
        id: generatedId,
        name: otaku.name || `${domain.name} Otaku`,
        specialty,
        personality,
        catchphrase: otaku.catchphrase || '',
        status: 'recommended',
        expertise: {
          domains: expertiseDomains,
          technologies: expertiseTechnologies,
          taskTypes: expertiseTaskTypes,
        },
        knowledge: {
          documentation: [],
          patterns: [],
          examples: [],
          gotchas: [],
        },
        qualityGates,
        weaknesses,
      },
      domain,
    });
  }

  return recommendations;
}

/**
 * Format recommendations for display
 */
export function formatRecommendations(
  recommendations: OtakuRecommendation[]
): string {
  const lines: string[] = [];

  for (const rec of recommendations) {
    const specificityIcon =
      rec.domain.specificity === 'high'
        ? '🎯'
        : rec.domain.specificity === 'medium'
          ? '📍'
          : '📌';

    lines.push(`${specificityIcon} **${rec.profile.name}** (${rec.profile.id})`);
    lines.push(`   "${rec.profile.catchphrase}"`);
    lines.push(`   Specialty: ${rec.profile.specialty}`);
    lines.push(`   Technologies: ${rec.profile.expertise.technologies.slice(0, 5).join(', ')}`);
    lines.push('');
  }

  return lines.join('\n');
}
