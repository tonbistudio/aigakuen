import { readFile } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';

export interface ParsedSpec {
  title: string;
  rawContent: string;
  sections: SpecSection[];
  techStack: string[];
  features: string[];
}

export interface SpecSection {
  heading: string;
  level: number;
  content: string;
}

/**
 * Parse a markdown spec/PRD file into structured data
 */
export async function parseSpec(specPath: string): Promise<ParsedSpec> {
  const absolutePath = path.isAbsolute(specPath)
    ? specPath
    : path.resolve(process.cwd(), specPath);

  if (!existsSync(absolutePath)) {
    throw new Error(`Spec file not found: ${absolutePath}`);
  }

  const content = await readFile(absolutePath, 'utf-8');

  return parseMarkdownSpec(content);
}

/**
 * Parse markdown content into structured spec
 */
export function parseMarkdownSpec(content: string): ParsedSpec {
  const lines = content.split('\n');
  const sections: SpecSection[] = [];
  let title = '';
  let currentSection: SpecSection | null = null;
  let contentBuffer: string[] = [];

  for (const line of lines) {
    const headingMatch = line.match(/^(#{1,6})\s+(.+)$/);

    if (headingMatch) {
      // Save previous section
      if (currentSection) {
        currentSection.content = contentBuffer.join('\n').trim();
        sections.push(currentSection);
      }

      const level = headingMatch[1].length;
      const heading = headingMatch[2].trim();

      // First h1 is the title
      if (level === 1 && !title) {
        title = heading;
      }

      currentSection = {
        heading,
        level,
        content: '',
      };
      contentBuffer = [];
    } else if (currentSection) {
      contentBuffer.push(line);
    }
  }

  // Don't forget the last section
  if (currentSection) {
    currentSection.content = contentBuffer.join('\n').trim();
    sections.push(currentSection);
  }

  // Extract tech stack mentions
  const techStack = extractTechStack(content);

  // Extract feature mentions
  const features = extractFeatures(sections);

  return {
    title: title || 'Untitled Spec',
    rawContent: content,
    sections,
    techStack,
    features,
  };
}

/**
 * Extract technology/framework mentions from content
 */
function extractTechStack(content: string): string[] {
  const techPatterns = [
    // Frontend
    /\b(React|Vue|Angular|Svelte|Next\.js|Nuxt|Remix|Astro)\b/gi,
    /\b(TypeScript|JavaScript|HTML|CSS|Tailwind|Sass|SCSS)\b/gi,
    /\b(Vite|Webpack|Rollup|esbuild|Parcel)\b/gi,
    // Backend
    /\b(Node\.js|Express|Fastify|Hono|Bun|Deno)\b/gi,
    /\b(Python|Django|Flask|FastAPI)\b/gi,
    /\b(Go|Rust|Java|Kotlin)\b/gi,
    // Database
    /\b(PostgreSQL|MySQL|SQLite|MongoDB|Redis)\b/gi,
    /\b(Supabase|Firebase|PlanetScale|Neon)\b/gi,
    /\b(Prisma|Drizzle|TypeORM|Sequelize)\b/gi,
    // Cloud/Infra
    /\b(AWS|GCP|Azure|Vercel|Netlify|Cloudflare)\b/gi,
    /\b(Docker|Kubernetes|Terraform)\b/gi,
    // Mobile/PWA
    /\b(PWA|Service Worker|React Native|Flutter|Expo)\b/gi,
    // Blockchain
    /\b(Solana|Ethereum|Web3|Anchor|Hardhat)\b/gi,
    // Auth
    /\b(OAuth|JWT|Auth0|Clerk|NextAuth)\b/gi,
    // Testing
    /\b(Jest|Vitest|Playwright|Cypress|Testing Library)\b/gi,
  ];

  const found = new Set<string>();

  for (const pattern of techPatterns) {
    const matches = content.match(pattern);
    if (matches) {
      for (const match of matches) {
        // Normalize casing
        found.add(normalizetech(match));
      }
    }
  }

  return Array.from(found).sort();
}

function normalizetech(tech: string): string {
  const normalizations: Record<string, string> = {
    'react': 'React',
    'vue': 'Vue',
    'angular': 'Angular',
    'typescript': 'TypeScript',
    'javascript': 'JavaScript',
    'next.js': 'Next.js',
    'node.js': 'Node.js',
    'postgresql': 'PostgreSQL',
    'mysql': 'MySQL',
    'sqlite': 'SQLite',
    'mongodb': 'MongoDB',
    'supabase': 'Supabase',
    'firebase': 'Firebase',
    'tailwind': 'Tailwind CSS',
    'pwa': 'PWA',
    'service worker': 'Service Worker',
    'oauth': 'OAuth',
    'jwt': 'JWT',
  };

  const lower = tech.toLowerCase();
  return normalizations[lower] || tech;
}

/**
 * Extract features from section headings and content
 */
function extractFeatures(sections: SpecSection[]): string[] {
  const features: string[] = [];

  for (const section of sections) {
    // Look for "Features" or "Core Features" sections
    if (section.heading.toLowerCase().includes('feature')) {
      // Extract list items
      const listItems = section.content.match(/^[-*]\s+(.+)$/gm);
      if (listItems) {
        for (const item of listItems) {
          const cleaned = item.replace(/^[-*]\s+/, '').trim();
          if (cleaned.length > 0 && cleaned.length < 100) {
            features.push(cleaned);
          }
        }
      }
    }

    // Also look for numbered sections like "### 1. Feature Name"
    const numberedMatch = section.heading.match(/^\d+\.\s+(.+)$/);
    if (numberedMatch && section.level >= 3) {
      features.push(numberedMatch[1]);
    }
  }

  return features;
}
