# AI Gakuen (AI学園)

<p align="center">
  <img src="gakuen.png" alt="AI Gakuen - Your Otaku Development Team" width="600">
</p>

<p align="center">
  <strong>Create hyper-specialized "Otaku" agents with deep domain expertise for Claude Code.</strong>
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/aigakuen"><img src="https://img.shields.io/npm/v/aigakuen.svg" alt="npm version"></a>
  <a href="https://github.com/ntombisol/aigakuen/blob/main/LICENSE"><img src="https://img.shields.io/npm/l/aigakuen.svg" alt="license"></a>
  <a href="https://www.npmjs.com/package/aigakuen"><img src="https://img.shields.io/node/v/aigakuen.svg" alt="node version"></a>
</p>

<p align="center">
  <em>Philosophy: Generic AI is jack-of-all-trades. Otaku are obsessive specialists.</em>
</p>

---

## Table of Contents

- [What It Does](#what-it-does)
- [Installation](#installation)
- [Quick Start](#quick-start)
- [Core Concepts](#core-concepts)
- [Commands](#commands)
- [How Training Works](#how-training-works)
- [Self-Improvement with Reflect](#self-improvement-with-reflect)
- [Deploy to OpenClaw](#deploy-to-openclaw)
- [Example Otaku](#example-otaku)
- [File Structure](#file-structure)
- [Environment Variables](#environment-variables)
- [Troubleshooting](#troubleshooting)
- [Contributing](#contributing)
- [Development](#development)
- [License](#license)
- [Credits](#credits)

---

## What It Does

AI Gakuen analyzes your project specs, identifies required expertise domains, and generates specialized agents with:

- **Compiled documentation** - Distilled from official sources
- **Proven patterns** - Battle-tested solutions
- **Common gotchas** - Pitfalls others have hit
- **Mental models** - How experts think about the domain
- **Project-specific context** - Tailored to your codebase

Instead of Claude being a generalist, you get laser-focused specialists that deeply understand their domain.

## Installation

### Option 1: npm (Recommended)

```bash
npm install -g aigakuen
```

### Option 2: From Source

```bash
git clone https://github.com/ntombisol/aigakuen
cd aigakuen
bun install
bun run build
npm link
```

### Add the Claude Code Skill (Optional)

```bash
npx add-skill ntombisol/aigakuen
```

## Requirements

- **Node.js 18+** or **Bun**
- **Anthropic API key** - Set as `ANTHROPIC_API_KEY` environment variable
- **Claude Code** - The Otaku are designed to work with Claude Code's CLAUDE.md system

## Quick Start

```bash
# 1. Initialize in your project
aigakuen init

# 2. Analyze your spec to get Otaku recommendations
aigakuen enroll ./docs/spec.md

# 3. Train recommended specialists
aigakuen train supabase-auth-otaku
aigakuen train react-hooks-otaku

# 4. Assign a task (auto-routes to best Otaku)
aigakuen assign "implement magic link authentication"

# 5. Use Claude Code normally - CLAUDE.md is now supercharged
```

## Core Concepts

| Term | Japanese | Role |
|------|----------|------|
| **Otaku** | オタク | Obsessive expert in ONE narrow domain |
| **Toshokan** | 図書館 | Compiled knowledge library |
| **Sensei** | 先生 | You - provides specs, guides learning |
| **Iincho** | 委員長 | Class President - routes tasks to specialists |

## Commands

| Command | Description |
|---------|-------------|
| `aigakuen init` | Initialize `.gakuen/` in project |
| `aigakuen enroll <spec>` | Analyze spec, recommend Otaku |
| `aigakuen train <otaku>` | Train Otaku with deep research |
| `aigakuen train-batch --all` | Train all untrained Otaku in parallel |
| `aigakuen retrain <otaku>` | Re-train an Otaku (clears existing knowledge) |
| `aigakuen study <otaku>` | Activate an Otaku |
| `aigakuen assign <task>` | Route task to best Otaku |
| `aigakuen switch <otaku>` | Switch Otaku with handoff |
| `aigakuen handoff` | Save session context |
| `aigakuen reflect` | Self-evaluate and improve Otaku knowledge |
| `aigakuen roster` | List all Otaku |
| `aigakuen homeroom` | Status dashboard |

## How Training Works

When you train an Otaku, AI Gakuen:

1. **Fetches Documentation** - Official docs via Context7 MCP
2. **Mines GitHub Issues** - Common problems and solutions
3. **Analyzes Changelogs** - Breaking changes, migration gotchas
4. **Searches Community** - Stack Overflow, blog posts, discussions
5. **Synthesizes Knowledge** - Patterns, gotchas, mental models via Claude

The result is a specialist who knows not just the API, but the *pitfalls* and *best practices*.

### Training Modes

```bash
aigakuen train <otaku>           # Standard training
aigakuen train <otaku> --quick   # Faster, fewer sources
aigakuen train <otaku> --deep    # More thorough, takes longer
```

## Self-Improvement with Reflect

After a development session, run:

```bash
aigakuen reflect
```

This analyzes your session to find knowledge gaps:

1. **Reads session context** - handoff notes, git commits
2. **Identifies bugs that were fixed** - "tried X, didn't work, fixed with Y"
3. **Compares against Otaku knowledge** - "Should they have known this?"
4. **Generates new gotchas** - adds to their training data

Example output:
```
Reflecting on session with: Furi-senpai
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Discovered Issues:
  ⚠️ Safari backface-visibility requires -webkit- prefix
     Cause: Safari doesn't support unprefixed property
     Fix: Add -webkit-backface-visibility: hidden

Knowledge Gaps:
  📚 Safari backface-visibility requires -webkit- prefix
     → This is within Furi-senpai's domain (CSS 3D transforms)
     + New Gotcha: "Safari Requires -webkit-backface-visibility"

Added 1 gotcha(s), 0 pattern(s)
```

The Otaku learns from real bugs, making them smarter over time.

## Deploy to OpenClaw

You can deploy trained Otaku as **persistent, always-on agents** via [OpenClaw](https://github.com/openclaw/openclaw) — accessible 24/7 through Telegram, Discord, or WhatsApp.

```
aigakuen train <otaku>          # Compile domain knowledge
        |
build_agent.py                  # Convert toshokan -> OpenClaw workspace
        |
openclaw agents add <name>      # Register the agent
        |
openclaw gateway restart        # Agent is live on Telegram
```

Each deployed agent gets:

- **Isolated workspace** — separate memory, knowledge base, and conversation history
- **Knowledge protocol** — the agent always consults its compiled knowledge before answering (never from training memory alone)
- **Reflect protocol** — a self-improvement loop that captures bugs fixed during sessions and promotes them into the knowledge base automatically
- **Multi-domain support** — one OpenClaw agent can cover multiple Otaku domains, with a domain map in `MEMORY.md` for routing

The build script (`openclaw/build_agent.py`) takes your `.gakuen/toshokan` output (local or Google Drive) and produces a complete OpenClaw workspace with MEMORY.md, SOUL.md, AGENTS.md, and a `knowledge/` directory with all compiled files.

See [`openclaw/openclaw-integration.md`](openclaw/openclaw-integration.md) for the full setup guide, and [`openclaw/RESEARCH_SPEC.md`](openclaw/RESEARCH_SPEC.md) for the knowledge compilation spec that defines quality standards for agent knowledge bases.

## Example Otaku

After analyzing a flashcard app spec, AI Gakuen might recommend:

- **sm2-otaku** - SM-2 spaced repetition algorithm specialist
- **supabase-auth-otaku** - Supabase Auth & RLS policies expert
- **service-worker-otaku** - PWA caching strategies specialist
- **indexeddb-sync-otaku** - Offline storage & sync expert

Each has deep, compiled knowledge in their narrow domain.

## File Structure

```
.gakuen/
├── config.json           # Project config
├── handoff.md            # Session continuity
├── curriculum/           # Your specs
├── otaku/
│   ├── registry.json     # Otaku metadata
│   └── profiles/         # Individual profiles
├── toshokan/             # Knowledge libraries
│   └── <otaku-id>/
│       ├── core-knowledge.json
│       ├── patterns/
│       ├── gotchas/
│       └── ...
└── taskboard.json        # Task tracking
```

## Environment Variables

```bash
ANTHROPIC_API_KEY=sk-ant-...   # Required - for Claude API calls
GITHUB_TOKEN=ghp_...            # Optional - improves GitHub research quality
```

## Troubleshooting

### "ANTHROPIC_API_KEY not set"

Make sure you've exported the environment variable:

```bash
export ANTHROPIC_API_KEY=sk-ant-your-key-here
```

Or add it to your `.bashrc` / `.zshrc` for persistence.

### Training fails with "rate limit"

Training makes many API calls. If you hit rate limits:

1. Wait a few minutes and retry
2. Use `--quick` mode for faster training with fewer sources
3. Train Otaku one at a time instead of batch

### "Context7 not available"

Context7 MCP is used for documentation fetching. If unavailable:

1. Training will fall back to web search
2. Results may be less comprehensive
3. Consider installing Context7 MCP for better results

### Otaku knowledge seems outdated

Re-train the Otaku to fetch fresh documentation:

```bash
aigakuen retrain <otaku-id>
```

### CLAUDE.md is too large

If your CLAUDE.md becomes unwieldy with many Otaku:

1. Only keep 1-3 Otaku active at a time
2. Use `aigakuen switch` to change specialists as needed
3. The roster table is compact; full knowledge only loads for active Otaku

## Contributing

Contributions are welcome! Here's how to help:

### Reporting Issues

- Use the [GitHub Issues](https://github.com/ntombisol/aigakuen/issues) page
- Include your Node.js version, OS, and steps to reproduce

### Submitting Changes

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Make your changes
4. Run tests (`bun test`)
5. Commit with a descriptive message
6. Push to your fork
7. Open a Pull Request

### Development Setup

```bash
git clone https://github.com/ntombisol/aigakuen
cd aigakuen
bun install
bun run dev  # Run CLI in development mode
```

### Code Style

- TypeScript with strict mode
- Prefer async/await over callbacks
- Use Zod for runtime validation
- Keep commands thin, logic in `src/core/`

## Development

```bash
bun install          # Install dependencies
bun run dev          # Run in development mode
bun test             # Run tests
bun run build        # Build for distribution
bun run typecheck    # Type check without emitting
```

## License

[MIT](LICENSE) - Tonbi Studio

## Credits

- Inspired by Steve Yegge's [Gas Town](https://www.linkedin.com/pulse/why-ai-assistants-suck-steve-yegge-lmvac/) multi-agent architecture
- Built for [Claude Code](https://claude.ai/code) by Anthropic
- Documentation powered by [Context7](https://context7.com)

---

<p align="center">
  <strong>先生、今日も頑張りましょう！</strong><br>
  <em>(Sensei, let's do our best today!)</em>
</p>
