import { describe, expect, it, beforeEach, afterEach } from 'bun:test';
import { GakuenStore, findGakuenRoot } from '../../src/storage/gakuen-store';
import { mkdirSync, rmSync, existsSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

describe('GakuenStore', () => {
  let testDir: string;
  let store: GakuenStore;

  beforeEach(() => {
    // Create a unique temp directory for each test
    testDir = join(tmpdir(), `aigakuen-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    mkdirSync(testDir, { recursive: true });
    store = new GakuenStore(testDir);
  });

  afterEach(() => {
    // Clean up temp directory
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true });
    }
  });

  describe('isInitialized', () => {
    it('returns false for uninitialized directory', () => {
      expect(store.isInitialized()).toBe(false);
    });

    it('returns true after initialization', () => {
      store.initialize('Test Project');
      expect(store.isInitialized()).toBe(true);
    });
  });

  describe('initialize', () => {
    it('creates .gakuen directory structure', () => {
      store.initialize('Test Project');

      const paths = store.getPaths();
      expect(existsSync(paths.root)).toBe(true);
      expect(existsSync(paths.config)).toBe(true);
      expect(existsSync(paths.curriculum)).toBe(true);
      expect(existsSync(paths.otaku)).toBe(true);
      expect(existsSync(paths.toshokan)).toBe(true);
      expect(existsSync(paths.handoff)).toBe(true);
    });

    it('creates config with project name', () => {
      const config = store.initialize('My Cool Project');

      expect(config.projectName).toBe('My Cool Project');
      expect(config.version).toBe('0.1.0');
      expect(config.createdAt).toBeDefined();
    });

    it('throws error if already initialized', () => {
      store.initialize('First');

      expect(() => store.initialize('Second')).toThrow('already initialized');
    });
  });

  describe('getConfig', () => {
    it('returns saved config', () => {
      store.initialize('Test Project');
      const config = store.getConfig();

      expect(config.projectName).toBe('Test Project');
    });

    it('throws error if not initialized', () => {
      expect(() => store.getConfig()).toThrow('not initialized');
    });
  });

  describe('updateConfig', () => {
    it('merges updates with existing config', () => {
      store.initialize('Test Project');
      const updated = store.updateConfig({ activeOtaku: 'test-otaku' });

      expect(updated.projectName).toBe('Test Project');
      expect(updated.activeOtaku).toBe('test-otaku');
    });

    it('persists updates to disk', () => {
      store.initialize('Test Project');
      store.updateConfig({ activeOtaku: 'test-otaku' });

      // Create new store instance to verify persistence
      const freshStore = new GakuenStore(testDir);
      const config = freshStore.getConfig();

      expect(config.activeOtaku).toBe('test-otaku');
    });
  });

  describe('saveCurriculum', () => {
    it('saves spec content to curriculum directory', () => {
      store.initialize('Test Project');
      const content = '# My Spec\n\nContent here';
      const savedPath = store.saveCurriculum('project-spec.md', content);

      expect(existsSync(savedPath)).toBe(true);
      expect(savedPath).toContain('project-spec.md');
    });
  });
});

describe('findGakuenRoot', () => {
  let testDir: string;

  beforeEach(() => {
    testDir = join(tmpdir(), `aigakuen-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    mkdirSync(testDir, { recursive: true });
  });

  afterEach(() => {
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true });
    }
  });

  it('returns null when no .gakuen found', () => {
    const result = findGakuenRoot(testDir);
    expect(result).toBeNull();
  });

  it('finds .gakuen in current directory', () => {
    const store = new GakuenStore(testDir);
    store.initialize('Test');

    const result = findGakuenRoot(testDir);
    expect(result).toBe(testDir);
  });

  it('finds .gakuen in parent directory', () => {
    const store = new GakuenStore(testDir);
    store.initialize('Test');

    const subDir = join(testDir, 'src', 'components');
    mkdirSync(subDir, { recursive: true });

    const result = findGakuenRoot(subDir);
    expect(result).toBe(testDir);
  });
});
