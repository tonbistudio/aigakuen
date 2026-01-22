/**
 * CLAUDE.md Generator
 *
 * Composes a unified CLAUDE.md that includes:
 * - Project context (from spec)
 * - Iincho orchestration instructions
 * - Trained Otaku roster
 * - Current assignment (active Otaku + knowledge)
 * - Handoff context
 */

import { readFileSync, existsSync, readdirSync, writeFileSync } from 'fs';
import { join } from 'path';
import { getGakuenPaths, getOtakuPaths } from '../../utils/paths';
import type { OtakuProfile } from '../../types';
import type { CoreKnowledge } from '../research/types';

export interface ClaudeMdContext {
  projectName: string;
  projectDescription: string;
  specSummary: string;
  trainedOtaku: OtakuProfile[];
  activeOtaku: OtakuProfile | null;
  activeKnowledge: CoreKnowledge | null;
  currentTask: string | null;
  handoffNotes: string;
  gakuenCliPath: string; // Path to aigakuen CLI for commands
}

/**
 * Generate the unified CLAUDE.md content
 */
export function generateClaudeMd(context: ClaudeMdContext): string {
  const sections: string[] = [];

  // Header
  sections.push(`# ${context.projectName}

${context.projectDescription}
`);

  // Project Context
  if (context.specSummary) {
    sections.push(`## Project Context

${context.specSummary}
`);
  }

  // Iincho Instructions
  const trainedCount = context.trainedOtaku.filter(o => o.status !== 'recommended').length;
  sections.push(generateIinchoSection(trainedCount, context.gakuenCliPath));

  // Otaku Roster
  sections.push(generateRosterSection(context.trainedOtaku, context.activeOtaku?.id || null));

  // Current Assignment (if active)
  if (context.activeOtaku && context.activeKnowledge) {
    sections.push(generateAssignmentSection(
      context.activeOtaku,
      context.activeKnowledge,
      context.currentTask
    ));
  }

  // Handoff Context
  if (context.handoffNotes) {
    sections.push(`## Handoff Context

${context.handoffNotes}
`);
  }

  return sections.join('\n');
}

/**
 * Generate Iincho orchestration section with actionable commands
 */
function generateIinchoSection(trainedCount: number, gakuenPath: string): string {
  return `## Class Pres (委員長) - Task Orchestration

You are working with a team of **${trainedCount} specialized Otaku**. You CAN and SHOULD manage specialist switching automatically.

### Active Specialist
Use the active Otaku's patterns and avoid their gotchas (see knowledge below).

### Switching Specialists
When a task belongs to a different domain, switch specialists by running:
\`\`\`bash
npx tsx "${gakuenPath}/src/index.ts" assign "<task description>"
\`\`\`
This will auto-route to the best specialist and update this CLAUDE.md.

Or switch directly:
\`\`\`bash
npx tsx "${gakuenPath}/src/index.ts" switch <otaku-id>
\`\`\`

### When to Switch
- Task involves a different technology domain than current specialist
- You need expertise the current Otaku doesn't have
- User explicitly asks for a different specialist

### End of Session
Before ending, save context for continuity:
\`\`\`bash
npx tsx "${gakuenPath}/src/index.ts" handoff
\`\`\`

*After running switch/assign, re-read this CLAUDE.md to load the new specialist's knowledge.*
`;
}

/**
 * Generate roster section with all trained Otaku (abbreviated for size)
 */
function generateRosterSection(otaku: OtakuProfile[], activeOtakuId: string | null): string {
  const trained = otaku.filter((o) => o.status !== 'recommended');

  if (trained.length === 0) {
    return `## Otaku Roster

No Otaku have been trained yet. Run \`aigakuen train <otaku-id>\` to train specialists.
`;
  }

  // Compact roster: just name, specialty, and status indicator
  const roster = trained.map((o) => {
    const isActive = o.id === activeOtakuId;
    const statusIcon = isActive ? '▶' : '○';
    const patternCount = o.knowledge.patterns.length;
    const gotchaCount = o.knowledge.gotchas.length;
    return `| ${statusIcon} | \`${o.id}\` | ${o.specialty || o.name} | ${patternCount}P/${gotchaCount}G |`;
  }).join('\n');

  return `## Otaku Roster

| | ID | Specialty | Knowledge |
|---|---|---|---|
${roster}

*Run \`aigakuen study <id>\` to switch specialists. Full knowledge loaded for active Otaku below.*
`;
}

/**
 * Generate current assignment section with full Otaku knowledge
 */
function generateAssignmentSection(
  otaku: OtakuProfile,
  knowledge: CoreKnowledge,
  currentTask: string | null
): string {
  const taskSection = currentTask
    ? `### Current Task
${currentTask}

`
    : '';

  // Format patterns with system-focused fields
  const patternsSection = knowledge.goldenPatterns.length > 0
    ? `### Golden Patterns

${knowledge.goldenPatterns.map((p) => {
  let patternMd = `#### ${p.name}
**When to use**: ${p.whenToUse || 'See pattern details'}
**Implementation**: ${p.implementation || 'Apply as needed'}
**Why it works**: ${p.whyItWorks || 'Proven approach'}
**Watch out for**: ${p.watchOutFor || 'See gotchas'}`;

  // Add system-focused fields if present
  if (p.conflictsWith?.length) {
    patternMd += `\n**Conflicts with**: ${p.conflictsWith.join(', ')}`;
  }
  if (p.synergiesWith?.length) {
    patternMd += `\n**Works well with**: ${p.synergiesWith.join(', ')}`;
  }
  if (p.contracts) {
    if (p.contracts.requires?.length) {
      patternMd += `\n**Requires**: ${p.contracts.requires.join('; ')}`;
    }
    if (p.contracts.guarantees?.length) {
      patternMd += `\n**Guarantees**: ${p.contracts.guarantees.join('; ')}`;
    }
  }
  if (p.crossLayerConcerns?.length) {
    patternMd += `\n**Cross-layer concerns**: ${p.crossLayerConcerns.join('; ')}`;
  }

  return patternMd + '\n';
}).join('\n')}`
    : '';

  // Format gotchas with system-focused fields
  const gotchasSection = knowledge.criticalGotchas.length > 0
    ? `### Critical Gotchas

${knowledge.criticalGotchas.map((g) => {
  const emoji = { critical: '🚨', high: '⚠️', medium: '📌' }[g.severity];
  const categoryTag = g.category ? ` [${g.category}]` : '';
  let gotchaMd = `${emoji} **${g.title}** (${g.severity}${categoryTag})
- Trap: ${g.trap}
- Consequence: ${g.consequence}
- Fix: ${g.fix}`;

  // Add system-focused fields if present
  if (g.emergentFrom?.length) {
    gotchaMd += `\n- Emerges from: ${g.emergentFrom.join(' + ')}`;
  }
  if (g.detectionStrategy) {
    gotchaMd += `\n- Detection: ${g.detectionStrategy}`;
  }

  return gotchaMd + '\n';
}).join('\n')}`
    : '';

  // Format integration hazards
  const hazardsSection = knowledge.integrationHazards?.length
    ? `### Integration Hazards

${knowledge.integrationHazards.map((h) => `#### ${h.name}
**Components**: ${h.components.join(' + ')}
**Hazard**: ${h.hazard}
**Symptoms**: ${h.symptoms.join(', ')}
**Detection**: ${h.detection}
**Prevention**: ${h.prevention}
`).join('\n')}`
    : '';

  // Format contracts
  const contractsSection = knowledge.contractDefinitions?.length
    ? `### Contracts

${knowledge.contractDefinitions.map((c) => `#### ${c.provider}
**Requires**: ${c.requires.join(', ') || 'None'}
**Guarantees**: ${c.guarantees.join(', ')}
**Violations**: ${c.violations.join(', ')}
**Enforcement**: ${c.enforcement}
`).join('\n')}`
    : '';

  // Format state flow rules
  const stateFlowSection = knowledge.stateFlowRules?.length
    ? `### State Flow Rules

${knowledge.stateFlowRules.map((r) => `#### ${r.name}
**Rule**: ${r.rule}
**Violation**: ${r.violation}
**Common causes**: ${r.commonCauses.join(', ')}
**Detection**: ${r.detection}
`).join('\n')}`
    : '';

  // Format timing coordination
  const timingSection = knowledge.timingCoordination?.length
    ? `### Timing Coordination

${knowledge.timingCoordination.map((t) => `#### ${t.name}
**Layers**: ${t.layers.join(' ↔ ')}
**Coordination**: ${t.coordination}
**Mismatch symptoms**: ${t.mismatchSymptoms.join(', ')}
**Solution**: ${t.solution}
`).join('\n')}`
    : '';

  return `## Current Assignment: ${otaku.name}

**Specialist**: ${otaku.name} (\`${otaku.id}\`)
**Expertise**: ${otaku.specialty}

${taskSection}### Mental Model

${knowledge.mentalModel}

### Decision Framework

${knowledge.decisionFramework}

${patternsSection}
${gotchasSection}
${hazardsSection}
${contractsSection}
${stateFlowSection}
${timingSection}
---

*Use this specialist's knowledge to guide implementation. Follow their patterns, avoid their gotchas.*
`;
}

/**
 * Load context from project files
 */
export function loadClaudeMdContext(
  projectRoot: string,
  otakuList: OtakuProfile[],
  activeOtakuId: string | null = null,
  gakuenCliPath: string | null = null
): ClaudeMdContext {
  const paths = getGakuenPaths(projectRoot);

  // Load config
  let projectName = 'Project';
  let projectDescription = '';
  let storedCliPath = '';
  if (existsSync(paths.config)) {
    const config = JSON.parse(readFileSync(paths.config, 'utf-8'));
    projectName = config.projectName || 'Project';
    projectDescription = config.projectDescription || '';
    storedCliPath = config.gakuenCliPath || '';
  }

  // Use provided path, or stored path, or default
  const cliPath = gakuenCliPath || storedCliPath || 'aigakuen';

  // Load spec summary (first 2000 chars of spec)
  let specSummary = '';
  const curriculumFiles = existsSync(paths.curriculum)
    ? readdirSync(paths.curriculum)
    : [];
  if (curriculumFiles.length > 0) {
    const specPath = join(paths.curriculum, curriculumFiles[0]);
    const specContent = readFileSync(specPath, 'utf-8');
    specSummary = specContent.slice(0, 2000);
    if (specContent.length > 2000) {
      specSummary += '\n\n*[Spec truncated for context. See full spec in curriculum.]*';
    }
  }

  // Load handoff notes
  let handoffNotes = '';
  if (existsSync(paths.handoff)) {
    handoffNotes = readFileSync(paths.handoff, 'utf-8');
    // Skip if it's just the placeholder
    if (handoffNotes.includes('No sessions recorded yet')) {
      handoffNotes = '';
    }
  }

  // Load active Otaku knowledge if specified
  let activeOtaku: OtakuProfile | null = null;
  let activeKnowledge: CoreKnowledge | null = null;

  if (activeOtakuId) {
    activeOtaku = otakuList.find((o) => o.id === activeOtakuId) || null;

    if (activeOtaku) {
      const otakuPaths = getOtakuPaths(projectRoot, activeOtakuId);
      const knowledgePath = join(otakuPaths.toshokan, 'core-knowledge.json');

      if (existsSync(knowledgePath)) {
        activeKnowledge = JSON.parse(readFileSync(knowledgePath, 'utf-8'));
      }
    }
  }

  return {
    projectName,
    projectDescription,
    specSummary,
    trainedOtaku: otakuList,
    activeOtaku,
    activeKnowledge,
    currentTask: null,
    handoffNotes,
    gakuenCliPath: cliPath,
  };
}

/**
 * Generate and save CLAUDE.md
 */
export function writeClaudeMd(
  projectRoot: string,
  context: ClaudeMdContext
): string {
  const paths = getGakuenPaths(projectRoot);
  const content = generateClaudeMd(context);

  writeFileSync(paths.claudeMd, content, 'utf-8');

  return paths.claudeMd;
}
