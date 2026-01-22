import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { dirname } from 'path';
import {
  OtakuProfile,
  OtakuProfileSchema,
  OtakuRegistry,
  OtakuRegistrySchema,
  OtakuStatus,
} from '../types';
import { getGakuenPaths, getOtakuPaths } from '../utils/paths';

export class OtakuRegistryStore {
  private projectRoot: string;
  private paths: ReturnType<typeof getGakuenPaths>;

  constructor(projectRoot: string) {
    this.projectRoot = projectRoot;
    this.paths = getGakuenPaths(projectRoot);
  }

  getRegistry(): OtakuRegistry {
    if (!existsSync(this.paths.otakuRegistry)) {
      return { version: '0.1.0', otaku: [] };
    }

    const raw = readFileSync(this.paths.otakuRegistry, 'utf-8');
    return OtakuRegistrySchema.parse(JSON.parse(raw));
  }

  saveRegistry(registry: OtakuRegistry): void {
    writeFileSync(this.paths.otakuRegistry, JSON.stringify(registry, null, 2));
  }

  listOtaku(): OtakuProfile[] {
    return this.getRegistry().otaku;
  }

  getOtaku(id: string): OtakuProfile | null {
    const registry = this.getRegistry();
    return registry.otaku.find((o) => o.id === id) ?? null;
  }

  addOtaku(profile: OtakuProfile): void {
    const registry = this.getRegistry();

    if (registry.otaku.some((o) => o.id === profile.id)) {
      throw new Error(`Otaku '${profile.id}' already exists`);
    }

    registry.otaku.push(OtakuProfileSchema.parse(profile));
    this.saveRegistry(registry);

    // Also save individual profile
    this.saveOtakuProfile(profile);
  }

  /**
   * Register a new Otaku (alias for addOtaku)
   */
  registerOtaku(profile: OtakuProfile): void {
    this.addOtaku(profile);
  }

  updateOtaku(id: string, updates: Partial<OtakuProfile>): OtakuProfile {
    const registry = this.getRegistry();
    const index = registry.otaku.findIndex((o) => o.id === id);

    if (index === -1) {
      throw new Error(`Otaku '${id}' not found`);
    }

    const updated = OtakuProfileSchema.parse({
      ...registry.otaku[index],
      ...updates,
    });

    registry.otaku[index] = updated;
    this.saveRegistry(registry);
    this.saveOtakuProfile(updated);

    return updated;
  }

  updateOtakuStatus(id: string, status: OtakuStatus): OtakuProfile {
    const updates: Partial<OtakuProfile> = { status };

    if (status === 'studying') {
      updates.meta = {
        ...this.getOtaku(id)?.meta,
        lastActive: new Date().toISOString(),
      } as OtakuProfile['meta'];
    }

    return this.updateOtaku(id, updates);
  }

  removeOtaku(id: string): void {
    const registry = this.getRegistry();
    registry.otaku = registry.otaku.filter((o) => o.id !== id);
    this.saveRegistry(registry);
  }

  getActiveOtaku(): OtakuProfile | null {
    const registry = this.getRegistry();
    return registry.otaku.find((o) => o.status === 'studying') ?? null;
  }

  private saveOtakuProfile(profile: OtakuProfile): void {
    const otakuPaths = getOtakuPaths(this.projectRoot, profile.id);

    const dir = dirname(otakuPaths.profile);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }

    writeFileSync(otakuPaths.profile, JSON.stringify(profile, null, 2));
  }

  getOtakuByStatus(status: OtakuStatus): OtakuProfile[] {
    return this.listOtaku().filter((o) => o.status === status);
  }

  getTrainedOtaku(): OtakuProfile[] {
    const trainedStatuses: OtakuStatus[] = ['idle', 'studying', 'suspended'];
    return this.listOtaku().filter((o) => trainedStatuses.includes(o.status));
  }
}
