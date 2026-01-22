import { describe, expect, it } from 'bun:test';
import { parseMarkdownSpec, parseSpec } from '../../../src/core/analyzer/spec-parser';
import { join } from 'path';

describe('spec-parser', () => {
  describe('parseMarkdownSpec', () => {
    it('extracts title from first h1', () => {
      const content = '# My Project\n\nSome content';
      const result = parseMarkdownSpec(content);
      expect(result.title).toBe('My Project');
    });

    it('defaults to "Untitled Spec" when no h1 exists', () => {
      const content = '## Section\n\nNo title here';
      const result = parseMarkdownSpec(content);
      expect(result.title).toBe('Untitled Spec');
    });

    it('parses sections with correct levels', () => {
      const content = `# Title

## Section One

Content one

### Subsection

Nested content

## Section Two

Content two`;

      const result = parseMarkdownSpec(content);

      expect(result.sections).toHaveLength(4);
      expect(result.sections[0]).toEqual({
        heading: 'Title',
        level: 1,
        content: '',
      });
      expect(result.sections[1]).toEqual({
        heading: 'Section One',
        level: 2,
        content: 'Content one',
      });
      expect(result.sections[2]).toEqual({
        heading: 'Subsection',
        level: 3,
        content: 'Nested content',
      });
      expect(result.sections[3]).toEqual({
        heading: 'Section Two',
        level: 2,
        content: 'Content two',
      });
    });

    it('extracts tech stack mentions', () => {
      const content = `# Project

Uses React and TypeScript with Supabase for the backend.
PostgreSQL database with Prisma ORM.`;

      const result = parseMarkdownSpec(content);

      expect(result.techStack).toContain('React');
      expect(result.techStack).toContain('TypeScript');
      expect(result.techStack).toContain('Supabase');
      expect(result.techStack).toContain('PostgreSQL');
      expect(result.techStack).toContain('Prisma');
    });

    it('extracts features from feature sections', () => {
      const content = `# App

## Core Features

- User authentication
- Real-time sync
- Offline mode

## Other Section

Not a feature list`;

      const result = parseMarkdownSpec(content);

      expect(result.features).toContain('User authentication');
      expect(result.features).toContain('Real-time sync');
      expect(result.features).toContain('Offline mode');
    });

    it('extracts numbered features from headings', () => {
      const content = `# App

## Features

### 1. Authentication

Auth content

### 2. Data Sync

Sync content`;

      const result = parseMarkdownSpec(content);

      expect(result.features).toContain('Authentication');
      expect(result.features).toContain('Data Sync');
    });

    it('preserves raw content', () => {
      const content = '# Test\n\nRaw content here';
      const result = parseMarkdownSpec(content);
      expect(result.rawContent).toBe(content);
    });
  });

  describe('parseSpec', () => {
    it('parses a spec file from disk', async () => {
      const fixturePath = join(import.meta.dir, '../../fixtures/sample-spec.md');
      const result = await parseSpec(fixturePath);

      expect(result.title).toBe('Sample Project');
      expect(result.techStack).toContain('React');
      expect(result.techStack).toContain('TypeScript');
      expect(result.techStack).toContain('Supabase');
      expect(result.features.length).toBeGreaterThan(0);
    });

    it('throws error for non-existent file', async () => {
      await expect(parseSpec('/nonexistent/path.md')).rejects.toThrow('Spec file not found');
    });
  });
});
