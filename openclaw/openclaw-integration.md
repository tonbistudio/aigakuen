# AI Gakuen x OpenClaw Integration

Deploy your trained Otaku as hyper-specialized **OpenClaw agents** — persistent, always-on AI specialists with their own Telegram bots, isolated memory, and self-improving knowledge bases.

> **What is OpenClaw?** An open-source AI gateway that runs AI agents as always-on personal assistants, accessible via Telegram, Discord, WhatsApp, and more. [github.com/openclaw/openclaw](https://github.com/openclaw/openclaw)

---

## The Pipeline

```
aigakuen train <otaku>          # Compile domain knowledge via AI Gakuen
        ↓
build_agent.py                  # Convert toshokan → OpenClaw workspace
        ↓
openclaw agents add <name>      # Register the agent
        ↓
BotFather → bot token           # (Optional) Give the agent a Telegram bot
        ↓
openclaw gateway restart        # Agent is live
```

The result: a persistent specialist that starts every session with expert knowledge already loaded, accessible 24/7 via Telegram (or any other channel OpenClaw supports).

---

## What Gets Created

```
~/.openclaw/workspace-<name>/
├── MEMORY.md          ← auto-injected every session: domain map
├── SOUL.md            ← agent personality (terse, precise, leads with gotchas)
├── AGENTS.md          ← mandatory knowledge protocol + Reflect Protocol
├── IDENTITY.md        ← name, emoji, focus
├── USER.md            ← who the agent works for
├── memory/            ← daily session logs + [REFLECT] breadcrumbs
└── knowledge/
    ├── INDEX.md       ← quick-scan table of all domains and files
    └── <otaku-name>/
        ├── core-knowledge.md
        ├── patterns.md
        ├── gotchas.md
        ├── community.md
        ├── issues.md
        ├── docs.md
        └── source-analysis.md
```

**Key design principles:**
- `MEMORY.md` is always loaded — it's the orientation map, not a knowledge dump
- `knowledge/` is searched on demand — agent reads the right file before answering
- The agent **never answers from training memory alone** — it consults its knowledge base first

---

## Prerequisites

- OpenClaw installed and running ([docs.openclaw.ai](https://docs.openclaw.ai))
- AI Gakuen trained Otaku in `.gakuen/toshokan/`
- Python 3.8+
- `gog` CLI (optional, only needed if your toshokan is in Google Drive)

---

## Step 1: Get the Build Script

Copy `scripts/build_agent.py` from this repo to your machine.

The script takes your toshokan (local or Google Drive) and produces a complete OpenClaw workspace.

---

## Step 2: Run the Build Script

### From Google Drive (if you synced toshokan to Drive)

```bash
python build_agent.py \
  --agent-name my-specialist \
  --source drive \
  --drive-folder-id <YOUR_TOSHOKAN_FOLDER_ID>
```

### Dry run first (recommended)

```bash
python build_agent.py \
  --agent-name my-specialist \
  --source drive \
  --drive-folder-id <YOUR_TOSHOKAN_FOLDER_ID> \
  --dry-run
```

The script will:
1. Discover all Otaku in the toshokan
2. Quality-filter incomplete ones (< 1KB core-knowledge = skipped)
3. Download all knowledge files
4. Build MEMORY.md, AGENTS.md, SOUL.md, knowledge/INDEX.md
5. Print next steps

---

## Step 3: Register the Agent

```bash
openclaw agents add my-specialist \
  --workspace ~/.openclaw/workspace-my-specialist \
  --non-interactive
```

---

## Step 4: Add a Telegram Bot (Optional)

1. Open Telegram → search `@BotFather`
2. Send `/newbot` → follow prompts → copy the token

Add to your `openclaw.json`:

```json
{
  "channels": {
    "telegram": {
      "accounts": {
        "default": {
          "botToken": "YOUR_EXISTING_MAIN_TOKEN",
          "dmPolicy": "pairing",
          "allowFrom": [YOUR_TELEGRAM_USER_ID]
        },
        "my-specialist": {
          "botToken": "YOUR_NEW_BOT_TOKEN",
          "dmPolicy": "allowlist",
          "allowFrom": [YOUR_TELEGRAM_USER_ID]
        }
      }
    }
  },
  "bindings": [
    {
      "agentId": "my-specialist",
      "match": {
        "channel": "telegram",
        "accountId": "my-specialist"
      }
    }
  ]
}
```

> **Gotcha:** `bindings` must be at the **root level** of `openclaw.json`, NOT nested inside the agent entry. This causes an invalid config error if placed wrong.

---

## Step 5: Restart and Test

```bash
openclaw gateway restart
```

Open the Telegram bot you created and say hi. The specialist will respond with its domain knowledge loaded.

---

## The Reflect Protocol (Self-Improvement)

The OpenClaw integration adds an automatic self-improvement loop that AI Gakuen's `reflect` command inspired.

### How it works

During sessions, the agent writes breadcrumbs immediately when it hits and fixes a bug:

```
[REFLECT] domain: <otaku-name>
symptom: <what went wrong>
cause: <why it happened>
fix: <what solved it>
source: session YYYY-MM-DD
```

A cron job runs every 6 hours and promotes these into the knowledge base automatically:

```bash
# Add this cron via OpenClaw (or use the OpenClaw cron UI)
# It scans memory/ for [REFLECT] entries and appends to knowledge/<domain>/gotchas.md
```

The knowledge base grows from **real bugs in your actual codebase** — higher signal than training data alone.

---

## Knowledge Compilation: AI Gakuen vs Deep Research

AI Gakuen's training pipeline produces solid domain knowledge. For some domains, you can also compile knowledge directly using OpenClaw's research sub-agent approach — see `docs/RESEARCH_SPEC.md` for the spec that defines how to produce high-quality knowledge files.

**Head-to-head test result (React Hooks domain):**
The deep research approach won the comparison. However, AI Gakuen excels when you have a domain-specific curriculum (GDD, spec docs) — it structures that project-specific context in a way that web research can't replicate.

**Best of both worlds:** Use AI Gakuen to train your project-specific Otaku, then supplement with deep research for community knowledge, changelog analysis, and ecosystem patterns.

---

## Multi-Domain Agents

One OpenClaw agent can cover multiple Otaku domains. The build script merges them:

```
knowledge/
  react-native/    ← one Otaku
  expo/            ← another Otaku
  ios-process/     ← a third Otaku
```

The agent's `MEMORY.md` contains a domain map so it knows when to read which folder.

**Sizing guidance:** Each domain adds ~30-120KB to the knowledge base. This fits comfortably within OpenClaw's bootstrap limits. Keep MEMORY.md under 15KB (it's auto-injected every session).

---

## Isolation Model

Each specialist agent is fully isolated:

| | Main Agent | Specialist |
|--|--|--|
| Workspace | `~/.openclaw/workspace/` | `~/.openclaw/workspace-<name>/` |
| Sessions | Separate | Separate |
| Memory (LanceDB) | `agent:main` scope | `agent:<name>` scope |
| Telegram bot | Your main bot | Specialist's own bot |
| API key | Shared | Shared |
| Gateway process | Shared | Shared |

The specialist has no access to your main agent's conversation history, memories, or daily logs.

---

## File Reference

| File | Purpose |
|------|---------|
| `scripts/build_agent.py` | Converts toshokan → OpenClaw workspace |
| `docs/RESEARCH_SPEC.md` | Knowledge compilation spec (alternative to AI Gakuen training) |
| `docs/openclaw-integration.md` | This guide |
