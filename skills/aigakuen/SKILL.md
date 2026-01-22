---
name: aigakuen
description: Create hyper-specialized Otaku agents with deep domain expertise for Claude Code
license: MIT
metadata:
  author: ntombisol
  version: "0.1.0"
  requires: aigakuen CLI (npm install -g aigakuen)
---

# AI Gakuen (AI学園)

AI Gakuen creates hyper-specialized "Otaku" agents - obsessive experts with deep knowledge in narrow domains. Unlike generic AI, Otaku have compiled documentation, patterns, gotchas, and mental models for their specific area.

## Prerequisites

The `aigakuen` CLI must be installed:
```bash
npm install -g aigakuen
```

You also need an Anthropic API key set as `ANTHROPIC_API_KEY` environment variable.

## When to Use

- Starting a new project that needs specialized expertise
- User mentions `/gakuen` or asks about Otaku/specialists
- Switching between different technical domains in a codebase
- Need deep knowledge about a specific library, framework, or pattern
- Want consistent expert guidance across sessions

## Core Concepts

| Term | Role | Description |
|------|------|-------------|
| **Otaku** (オタク) | Expert Agent | Obsessive specialist with deep knowledge in ONE narrow domain |
| **Toshokan** (図書館) | Library | Compiled knowledge base for each Otaku |
| **Sensei** (先生) | User | Provides curriculum (specs), guides learning |
| **Iincho** (委員長) | Class President | Routes tasks to appropriate Otaku |

## Commands

### Initialize a Project

```bash
aigakuen init
```

Run this first in any project. Creates `.gakuen/` directory structure.

### Enroll - Analyze Spec & Recommend Otaku

```bash
aigakuen enroll <path-to-spec.md>
```

Analyzes a specification/PRD and recommends specialized Otaku. The spec should describe what you're building - tech stack, features, architecture.

Example:
```bash
aigakuen enroll ./docs/product-spec.md
```

### Train - Create an Otaku with Deep Knowledge

```bash
aigakuen train <otaku-id>
```

Researches and compiles knowledge for an Otaku. This:
1. Fetches official documentation
2. Mines GitHub issues for common problems
3. Analyzes changelogs for gotchas
4. Searches community knowledge
5. Synthesizes into patterns, gotchas, mental models

Example:
```bash
aigakuen train supabase-auth-otaku
```

### Study - Activate an Otaku

```bash
aigakuen study <otaku-id>
```

Activates an Otaku and updates CLAUDE.md with their knowledge. Use this to switch to a specific specialist.

### Assign - Route a Task to the Right Otaku

```bash
aigakuen assign "<task description>"
```

Automatically routes a task to the most appropriate Otaku and activates them. This is the main command for daily use.

Options:
- `--to <otaku-id>` - Manually assign to specific Otaku
- `--no-activate` - Queue task without switching Otaku
- `--dry-run` - Show routing decision without creating task

Example:
```bash
aigakuen assign "fix the authentication token refresh bug"
```

### Switch - Change Active Otaku with Handoff

```bash
aigakuen switch <otaku-id>
```

Switches to a different Otaku, automatically saving handoff context from the current one.

Options:
- `--no-handoff` - Skip saving handoff context

### Handoff - Save Session Context

```bash
aigakuen handoff
```

Saves current session state for continuity. Run this before ending a session to preserve context.

Options:
- `-m, --message <msg>` - Add a handoff message
- `--auto` - Auto-generate summary from recent work

### Roster - List All Otaku

```bash
aigakuen roster
```

Shows all Otaku with their status (trained, studying, idle, recommended).

Options:
- `--trained` - Only show trained Otaku
- `--available` - Only show available (not busy) Otaku

### Homeroom - Status Dashboard

```bash
aigakuen homeroom
```

Shows project status: active Otaku, pending tasks, recent activity.

### Reflect - Self-Evaluate and Improve

```bash
aigakuen reflect
```

Analyzes the session to find knowledge gaps in the active Otaku. Looks at:
- Handoff notes for bug descriptions
- Git commits for "fix" patterns
- Issues that were discovered and resolved

If it finds bugs the Otaku should have warned about, it generates new gotchas and adds them to the Otaku's training data.

Options:
- `--otaku <id>` - Analyze for specific Otaku (defaults to active)
- `--dry-run` - Show gaps without applying updates
- `--save-report` - Save reflection report to .gakuen/

**Run this after development sessions to make Otaku smarter over time.**

## Workflow Example

```bash
# 1. Initialize project
aigakuen init

# 2. Analyze your spec to get Otaku recommendations
aigakuen enroll ./my-project-spec.md

# 3. Train the recommended Otaku
aigakuen train react-hooks-otaku
aigakuen train supabase-auth-otaku

# 4. Start working - assign tasks and let Iincho route them
aigakuen assign "implement user login with magic link"

# 5. The CLAUDE.md is now updated with the specialist's knowledge
# Continue working with Claude Code as normal

# 6. Before ending session, save handoff
aigakuen handoff --auto

# 7. After fixing bugs, reflect to improve Otaku
aigakuen reflect
```

## How It Works

1. **Enrollment**: Analyzes your spec to identify required expertise domains
2. **Training**: Researches each domain deeply - docs, issues, patterns, gotchas
3. **Activation**: Compiles knowledge into CLAUDE.md for the active Otaku
4. **Routing**: Iincho analyzes tasks and picks the best specialist
5. **Handoff**: Preserves context between sessions in `handoff.md`

## File Structure

```
.gakuen/
├── config.json           # Project configuration
├── handoff.md            # Session continuity notes
├── curriculum/           # Saved specs/PRDs
├── otaku/
│   ├── registry.json     # All Otaku metadata
│   └── profiles/         # Individual Otaku profiles
├── toshokan/             # Knowledge libraries
│   └── <otaku-id>/
│       ├── core-knowledge.md
│       ├── patterns.md
│       ├── gotchas.md
│       └── ...
└── taskboard.json        # Task assignments
```

## Tips

- **Be specific in specs**: The more detail in your spec, the more specialized the Otaku
- **Train incrementally**: Train Otaku as you need them, not all at once
- **Use assign for routing**: Let Iincho pick the specialist instead of manually switching
- **Handoff before breaks**: Run `aigakuen handoff --auto` to preserve context
- **Check homeroom**: Use `aigakuen homeroom` to see project status at a glance
