import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { dirname } from 'path';
import { GakuenConfig, GakuenConfigSchema, DEFAULT_CONFIG } from '../types';
import { getGakuenPaths, GAKUEN_DIR } from '../utils/paths';

export class GakuenStore {
  private projectRoot: string;
  private paths: ReturnType<typeof getGakuenPaths>;

  constructor(projectRoot: string = process.cwd()) {
    this.projectRoot = projectRoot;
    this.paths = getGakuenPaths(projectRoot);
  }

  /**
   * Get the .gakuen directory path
   */
  getGakuenPath(): string {
    return this.paths.root;
  }

  isInitialized(): boolean {
    return existsSync(this.paths.root) && existsSync(this.paths.config);
  }

  initialize(projectName: string): GakuenConfig {
    if (this.isInitialized()) {
      throw new Error(`AI Gakuen already initialized in ${this.projectRoot}`);
    }

    // Create directory structure
    const directories = [
      this.paths.root,
      this.paths.curriculum,
      this.paths.otaku,
      this.paths.otakuProfiles,
      this.paths.toshokan,
    ];

    for (const dir of directories) {
      if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true });
      }
    }

    // Create config
    const config: GakuenConfig = GakuenConfigSchema.parse({
      ...DEFAULT_CONFIG,
      projectName,
      createdAt: new Date().toISOString(),
    });

    this.saveConfig(config);

    // Create empty registry
    this.writeJson(this.paths.otakuRegistry, {
      version: '0.1.0',
      otaku: [],
    });

    // Create empty taskboard
    this.writeJson(this.paths.taskboard, {
      version: '0.1.0',
      tasks: [],
    });

    // Create handoff placeholder
    writeFileSync(
      this.paths.handoff,
      '# Handoff Notes\n\nNo sessions recorded yet.\n'
    );

    return config;
  }

  getConfig(): GakuenConfig {
    if (!this.isInitialized()) {
      throw new Error(
        `AI Gakuen not initialized. Run 'aigakuen init' first.`
      );
    }

    const raw = readFileSync(this.paths.config, 'utf-8');
    return GakuenConfigSchema.parse(JSON.parse(raw));
  }

  saveConfig(config: GakuenConfig): void {
    this.writeJson(this.paths.config, config);
  }

  updateConfig(updates: Partial<GakuenConfig>): GakuenConfig {
    const current = this.getConfig();
    const updated = GakuenConfigSchema.parse({ ...current, ...updates });
    this.saveConfig(updated);
    return updated;
  }

  getProjectRoot(): string {
    return this.projectRoot;
  }

  getPaths(): ReturnType<typeof getGakuenPaths> {
    return this.paths;
  }

  /**
   * Save a curriculum (spec/PRD) to the curriculum directory
   */
  saveCurriculum(specPath: string, content: string): string {
    const filename = specPath.split(/[/\\]/).pop() || 'spec.md';
    const targetPath = `${this.paths.curriculum}/${filename}`;
    writeFileSync(targetPath, content);
    return targetPath;
  }

  private writeJson(path: string, data: unknown): void {
    const dir = dirname(path);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
    writeFileSync(path, JSON.stringify(data, null, 2));
  }
}

export function findGakuenRoot(startDir: string = process.cwd()): string | null {
  let currentDir = startDir;

  while (currentDir !== dirname(currentDir)) {
    if (existsSync(`${currentDir}/${GAKUEN_DIR}/config.json`)) {
      return currentDir;
    }
    currentDir = dirname(currentDir);
  }

  return null;
}

export function requireGakuenRoot(): string {
  const root = findGakuenRoot();
  if (!root) {
    throw new Error(
      `Not in an AI Gakuen project. Run 'aigakuen init' to initialize.`
    );
  }
  return root;
}
