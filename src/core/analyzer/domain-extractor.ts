import { analyzeWithSchema } from '../../claude';
import type { ParsedSpec } from './spec-parser';

export interface ExpertiseDomain {
  id: string;
  name: string;
  description: string;
  specificity: 'high' | 'medium' | 'low';
  technologies: string[];
  taskTypes: string[];
  keywords: string[];
  rationale: string;
}

export interface DomainExtractionResult {
  projectName: string;
  projectDescription: string;
  domains: ExpertiseDomain[];
}

const DOMAIN_EXTRACTION_SCHEMA = `{
  "projectName": "string - concise project name",
  "projectDescription": "string - one sentence description",
  "domains": [
    {
      "id": "string - kebab-case identifier (e.g., 'react-pwa', 'supabase-auth')",
      "name": "string - human readable name",
      "description": "string - what this domain covers",
      "specificity": "'high' | 'medium' | 'low' - how specialized this domain is",
      "technologies": ["array of specific technologies/libraries"],
      "taskTypes": ["array of task types this domain handles"],
      "keywords": ["array of keywords for matching tasks to this domain"],
      "rationale": "string - why this domain is needed for the project"
    }
  ]
}`;

const DOMAIN_EXTRACTION_PROMPT = `You are an expert software architect identifying hyper-specialized expertise domains for "Otaku" agents - obsessive specialists with deep knowledge in ONE narrow area.

CRITICAL: Each Otaku should be an OBSESSIVE SPECIALIST, not a generalist. Split broad domains into specific sub-domains.

BAD (too broad):
- "Supabase Integration" - covers auth, database, realtime, edge functions
- "React PWA" - covers components, service workers, offline storage
- "Frontend Development" - way too general

GOOD (obsessively specific):
- "Supabase Auth & RLS Policies" - just authentication and row-level security
- "Service Worker Caching Strategies" - just PWA caching, not React
- "IndexedDB Offline Sync" - just offline storage and sync queues
- "SM-2 Spaced Repetition Algorithm" - just the algorithm math

Identify as many domains as the project genuinely requires. A simple project might need 2-3, a complex one might need 8+. Let the spec's complexity determine the count.

Each domain should pass this test: "Could someone spend years becoming an obsessive expert in JUST this?"

Specificity levels:
- **high**: Niche algorithm, specific API, narrow pattern (PREFERRED)
- **medium**: Specific framework feature or integration point
- **low**: General category - NEVER USE THIS

---
SPEC TITLE: {{title}}

DETECTED TECHNOLOGIES: {{techStack}}

DETECTED FEATURES: {{features}}

FULL SPECIFICATION:
{{content}}
---

CRITICAL INSTRUCTION: Your response must be ONLY a valid JSON object. Do not include ANY text before or after the JSON. Do not explain, summarize, or describe. Do not use markdown code blocks. Start your response with { and end with }. Nothing else.

Be aggressive about splitting broad areas into narrow specialties.`;

/**
 * Extract expertise domains from a parsed spec using Claude
 */
export async function extractDomains(
  spec: ParsedSpec
): Promise<DomainExtractionResult> {
  const prompt = DOMAIN_EXTRACTION_PROMPT
    .replace('{{title}}', spec.title)
    .replace('{{techStack}}', spec.techStack.join(', ') || 'None detected')
    .replace('{{features}}', spec.features.join('\n- ') || 'None detected')
    .replace('{{content}}', truncateContent(spec.rawContent, 8000));

  const result = await analyzeWithSchema<DomainExtractionResult>(
    prompt,
    DOMAIN_EXTRACTION_SCHEMA
  );

  // Validate the result structure
  if (!result || typeof result !== 'object') {
    throw new Error(`Invalid response from Claude: ${JSON.stringify(result)}`);
  }

  // Handle different key names Claude might use for the domains array
  const domainsArray = (result as any).domains ||
                       (result as any).expertise_domains ||
                       (result as any).expertiseDomains ||
                       (result as any).specialties ||
                       (result as any).areas;

  const domains = Array.isArray(domainsArray) ? domainsArray : [];

  if (domains.length === 0) {
    console.error('Claude response structure:', JSON.stringify(result, null, 2));
    throw new Error('No domains extracted from spec. Claude response may be malformed.');
  }

  // Validate and normalize the result (handle both camelCase and snake_case)
  return {
    projectName: result.projectName || (result as any).project_name || spec.title,
    projectDescription: result.projectDescription || (result as any).project_description || '',
    domains: domains.map((d, i) => normalizeDomain(d, i)),
  };
}

function normalizeDomain(domain: any, index: number): ExpertiseDomain {
  // Handle potentially malformed domain objects
  if (!domain || typeof domain !== 'object') {
    throw new Error(`Invalid domain at index ${index}: ${JSON.stringify(domain)}`);
  }

  const id = domain.id || domain.name?.toLowerCase().replace(/[^a-z0-9]+/g, '-') || `domain-${index}`;

  // Handle both camelCase and snake_case field names from Claude
  const technologies = domain.technologies || domain.tech_stack || [];
  const taskTypes = domain.taskTypes || domain.task_types || [];
  const keywords = domain.keywords || domain.key_words || [];

  return {
    id: id.toLowerCase().replace(/[^a-z0-9-]/g, '-'),
    name: domain.name || `Domain ${index + 1}`,
    description: domain.description || '',
    specificity: validateSpecificity(domain.specificity),
    technologies: Array.isArray(technologies) ? technologies : [],
    taskTypes: Array.isArray(taskTypes) ? taskTypes : [],
    keywords: Array.isArray(keywords) ? keywords : [],
    rationale: domain.rationale || '',
  };
}

function validateSpecificity(
  specificity: string
): 'high' | 'medium' | 'low' {
  if (['high', 'medium', 'low'].includes(specificity)) {
    return specificity as 'high' | 'medium' | 'low';
  }
  return 'medium';
}

function truncateContent(content: string, maxChars: number): string {
  if (content.length <= maxChars) {
    return content;
  }
  return content.slice(0, maxChars) + '\n\n[...truncated...]';
}
