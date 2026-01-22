import { join } from 'path';

export const GAKUEN_DIR = '.gakuen';

export function getGakuenPaths(projectRoot: string) {
  const gakuenDir = join(projectRoot, GAKUEN_DIR);

  return {
    root: gakuenDir,
    config: join(gakuenDir, 'config.json'),
    curriculum: join(gakuenDir, 'curriculum'),
    otaku: join(gakuenDir, 'otaku'),
    otakuRegistry: join(gakuenDir, 'otaku', 'registry.json'),
    otakuProfiles: join(gakuenDir, 'otaku', 'profiles'),
    toshokan: join(gakuenDir, 'toshokan'),
    taskboard: join(gakuenDir, 'taskboard.json'),
    taskboardMd: join(gakuenDir, 'taskboard.md'),
    handoff: join(gakuenDir, 'handoff.md'),
    claudeMd: join(projectRoot, 'CLAUDE.md'),
  };
}

export function getOtakuPaths(projectRoot: string, otakuId: string) {
  const paths = getGakuenPaths(projectRoot);

  return {
    profile: join(paths.otakuProfiles, `${otakuId}.json`),
    profileMd: join(paths.otakuProfiles, `${otakuId}.md`),
    toshokan: join(paths.toshokan, otakuId),
    docs: join(paths.toshokan, otakuId, 'docs.md'),
    patterns: join(paths.toshokan, otakuId, 'patterns.md'),
    gotchas: join(paths.toshokan, otakuId, 'gotchas.md'),
    api: join(paths.toshokan, otakuId, 'api.md'),
    examples: join(paths.toshokan, otakuId, 'examples'),
    sources: join(paths.toshokan, otakuId, 'sources.json'),
  };
}
