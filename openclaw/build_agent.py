#!/usr/bin/env python3
"""
build_agent.py â€” Convert a .gakuen toshokan into an OpenClaw specialized agent workspace.

Usage:
  python build_agent.py --source drive --drive-folder-id <id> --agent-name <name>
  python build_agent.py --source local --toshokan-path /path/to/.gakuen/toshokan --agent-name <name>

Outputs a fully structured workspace ready for: openclaw agents add <name> --workspace <path>
"""

import argparse
import json
import os
import subprocess
import sys
from pathlib import Path

# â”€â”€ Config â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

WORKSPACE_ROOT = Path(r"C:\Users\jrr90\.openclaw")
GOG_ACCOUNT = "jrr9090@gmail.com"

# Minimum core-knowledge.md size to consider an Otaku "trained" (bytes)
MIN_QUALITY_THRESHOLD = 1000

# Files to download per Otaku (in priority order)
KNOWLEDGE_FILES = [
    "core-knowledge.md",
    "patterns.md",
    "gotchas.md",
    "community.md",
    "issues.md",
    "docs.md",
    "source-analysis.md",
    "changelog.md",
]

# Files to skip (raw data, not useful in agent workspace)
SKIP_FILES = {"raw-knowledge.json", "core-knowledge.json", "sources.json", "training-report.md"}


# â”€â”€ Drive helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

def gog_ls(folder_id):
    """List files in a Drive folder. Returns list of {id, name, size, type}."""
    result = subprocess.run(
        ["gog", "drive", "ls", "--parent", folder_id, "--json", "--max", "50"],
        capture_output=True, text=True,
        env={**os.environ, "GOG_ACCOUNT": GOG_ACCOUNT}
    )
    if result.returncode != 0:
        print(f"  ERROR listing folder {folder_id}: {result.stderr.strip()}")
        return []
    try:
        data = json.loads(result.stdout)
        return data.get("files", [])
    except json.JSONDecodeError:
        return []


def gog_download(file_id, dest_path):
    """Download a Drive file to dest_path. Returns True on success."""
    result = subprocess.run(
        ["gog", "drive", "download", file_id, "--out", str(dest_path)],
        capture_output=True, text=True,
        env={**os.environ, "GOG_ACCOUNT": GOG_ACCOUNT}
    )
    return result.returncode == 0


# â”€â”€ Toshokan discovery â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

def discover_otaku_from_drive(toshokan_folder_id):
    """Return list of {name, files: {filename: drive_id}} for each Otaku subfolder."""
    print(f"\nDiscovering Otaku in toshokan ({toshokan_folder_id})...")
    subfolders = gog_ls(toshokan_folder_id)
    otaku_list = []

    for folder in subfolders:
        if folder.get("mimeType") != "application/vnd.google-apps.folder":
            continue
        name = folder["name"]
        folder_id = folder["id"]
        print(f"  Found: {name}")

        files = gog_ls(folder_id)
        file_map = {}
        for f in files:
            if f.get("mimeType") != "application/vnd.google-apps.folder":
                fname = f["name"]
                if fname not in SKIP_FILES:
                    size = int(f.get("size", 0))
                    file_map[fname] = {"id": f["id"], "size": size}

        otaku_list.append({"name": name, "files": file_map})

    return otaku_list


def assess_quality(otaku):
    """Return True if Otaku has meaningful trained knowledge."""
    core = otaku["files"].get("core-knowledge.md", {})
    size = core.get("size", 0)
    if size < MIN_QUALITY_THRESHOLD:
        print(f"  SKIP {otaku['name']} -- core-knowledge.md only {size}B (incomplete training)")
        return False
    return True


# â”€â”€ Workspace builder â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

def download_otaku_files(otaku, knowledge_dir):
    """Download all knowledge files for one Otaku into knowledge_dir/<name>/."""
    otaku_dir = knowledge_dir / otaku["name"]
    otaku_dir.mkdir(parents=True, exist_ok=True)

    for fname in KNOWLEDGE_FILES:
        if fname not in otaku["files"]:
            continue
        file_info = otaku["files"][fname]
        dest = otaku_dir / fname
        print(f"    Downloading {fname} ({file_info['size']} bytes)...")
        if not gog_download(file_info["id"], dest):
            print(f"    âœ— Failed: {fname}")
        else:
            print(f"    âœ“ {fname}")


def build_index(qualified_otaku, knowledge_dir):
    """Build knowledge/INDEX.md â€” a quick-scan table of all domains + key topics."""
    lines = ["# Knowledge Index\n",
             "Quick reference â€” scan this first to find what you need.\n\n",
             "| Domain | Specialty | Key Files |\n",
             "|--------|-----------|----------|\n"]

    for otaku in qualified_otaku:
        name = otaku["name"]
        files_present = [f for f in KNOWLEDGE_FILES if (knowledge_dir / name / f).exists()]
        files_str = ", ".join(f.replace(".md", "") for f in files_present[:4])
        lines.append(f"| **{name}** | *(see {name}/core-knowledge.md)* | {files_str} |\n")

    lines.append("\n## How to use\n")
    lines.append("1. Identify the domain from the table above\n")
    lines.append("2. Read `knowledge/<domain>/core-knowledge.md` first\n")
    lines.append("3. Then `gotchas.md` and `patterns.md` for the specific issue\n")
    lines.append("4. `issues.md` for real-world bug examples\n")
    lines.append("5. `source-analysis.md` for deep implementation detail\n")

    index_path = knowledge_dir / "INDEX.md"
    index_path.write_text("".join(lines), encoding="utf-8")
    print(f"  âœ“ Built INDEX.md")


def build_memory_md(agent_name, qualified_otaku, knowledge_dir):
    """Build MEMORY.md â€” auto-injected domain map, always available."""
    lines = [f"# MEMORY.md â€” {agent_name} Specialist Agent\n\n"]
    lines.append("## What I Know\n\n")
    lines.append("I am a specialized agent with deep compiled knowledge in the following domains.\n")
    lines.append("**Always consult `knowledge/` before answering technical questions.**\n\n")
    lines.append("## Domain Map\n\n")
    lines.append("| Domain | Specialty | Deep Dive |\n")
    lines.append("|--------|-----------|----------|\n")

    for otaku in qualified_otaku:
        name = otaku["name"]
        # Try to extract a one-liner from core-knowledge.md
        core_path = knowledge_dir / name / "core-knowledge.md"
        specialty = "(see core-knowledge.md)"
        if core_path.exists():
            content = core_path.read_text(encoding="utf-8")
            # Grab first non-empty, non-header line as description
            for line in content.splitlines():
                line = line.strip()
                if line and not line.startswith("#") and len(line) > 20:
                    specialty = line[:100]
                    break
        lines.append(f"| **{name}** | {specialty} | `knowledge/{name}/` |\n")

    lines.append("\n## Knowledge Protocol\n\n")
    lines.append("Before answering ANY technical question:\n")
    lines.append("1. Identify the domain from the table above\n")
    lines.append("2. READ `knowledge/INDEX.md` to locate the right file\n")
    lines.append("3. READ the relevant `knowledge/<domain>/` files\n")
    lines.append("4. THEN answer â€” never from training memory alone\n")

    return "".join(lines)


def build_soul_md(agent_name):
    return f"""# SOUL.md â€” {agent_name} Specialist

You are a hyper-specialized technical agent. You know one stack deeply.

**Core traits:**
- Precise over friendly â€” no fluff, no padding
- Always consult your knowledge base before answering
- Lead with gotchas and warnings when relevant
- If you don't know something, say so and point to the right knowledge file
- You are a specialist, not a generalist â€” stay in your lane

**Voice:** Terse, confident, technically precise. Think senior engineer doing a code review.
"""


def build_agents_md(agent_name, qualified_otaku):
    domain_list = "\n".join(f"- **{o['name']}** â†’ `knowledge/{o['name']}/`" for o in qualified_otaku)
    return f"""# AGENTS.md â€” {agent_name} Specialist

## Every Session
1. Read `MEMORY.md` â€” your domain map
2. Read `knowledge/INDEX.md` â€” know what's available

## Knowledge Protocol (MANDATORY)
Before answering ANY technical question:
1. Check which domain applies (see MEMORY.md domain map)
2. READ the relevant `knowledge/<domain>/` files FIRST
3. Prioritize: `gotchas.md` > `patterns.md` > `community.md` > `issues.md`
4. For deep implementation: `source-analysis.md` and `docs.md`
5. Then answer â€” never from training memory alone

## Domain Coverage
{domain_list}

## Memory
- Write session notes to `memory/YYYY-MM-DD.md`
- Update `MEMORY.md` when you learn new gotchas from real usage
- The knowledge base grows â€” add to it when you encounter new issues

## Safety
- Don't run destructive commands without confirming
- Stay focused on your specialty domains
"""


def build_workspace(agent_name, qualified_otaku, workspace_path, knowledge_dir):
    """Write all workspace files."""
    print(f"\nBuilding workspace at {workspace_path}...")

    # MEMORY.md
    memory_content = build_memory_md(agent_name, qualified_otaku, knowledge_dir)
    (workspace_path / "MEMORY.md").write_text(memory_content, encoding="utf-8")
    print(f"  âœ“ MEMORY.md ({len(memory_content)} chars)")

    # SOUL.md
    soul_content = build_soul_md(agent_name)
    (workspace_path / "SOUL.md").write_text(soul_content, encoding="utf-8")
    print(f"  âœ“ SOUL.md")

    # AGENTS.md
    agents_content = build_agents_md(agent_name, qualified_otaku)
    (workspace_path / "AGENTS.md").write_text(agents_content, encoding="utf-8")
    print(f"  âœ“ AGENTS.md")

    # IDENTITY.md
    identity_content = f"""# IDENTITY.md
- **Name:** {agent_name}
- **Type:** Specialized technical agent
- **Emoji:** ðŸ§ 
- **Focus:** {', '.join(o['name'] for o in qualified_otaku)}
"""
    (workspace_path / "IDENTITY.md").write_text(identity_content, encoding="utf-8")
    print(f"  âœ“ IDENTITY.md")

    # USER.md placeholder
    user_content = """# USER.md
- **Name:** Tonbi
- **Studio:** Tonbi Studio
- **Timezone:** PST
"""
    (workspace_path / "USER.md").write_text(user_content, encoding="utf-8")
    print(f"  âœ“ USER.md")

    # TOOLS.md placeholder
    (workspace_path / "TOOLS.md").write_text("# TOOLS.md\n\nAdd local tool notes here.\n", encoding="utf-8")

    # memory/ dir
    (workspace_path / "memory").mkdir(exist_ok=True)

    # INDEX.md
    build_index(qualified_otaku, knowledge_dir)


# â”€â”€ Main â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

def main():
    parser = argparse.ArgumentParser(description="Build an OpenClaw specialized agent from a .gakuen toshokan")
    parser.add_argument("--agent-name", required=True, help="Name for the new agent (e.g. baseddev)")
    parser.add_argument("--source", choices=["drive", "local"], default="drive")
    parser.add_argument("--drive-folder-id", help="Drive folder ID of the toshokan folder")
    parser.add_argument("--toshokan-path", help="Local path to .gakuen/toshokan/")
    parser.add_argument("--dry-run", action="store_true", help="Plan only, don't create files")
    args = parser.parse_args()

    agent_name = args.agent_name
    workspace_path = WORKSPACE_ROOT / f"workspace-{agent_name}"
    knowledge_dir = workspace_path / "knowledge"

    print(f"\n{'='*60}")
    print(f"Building agent: {agent_name}")
    print(f"Workspace:      {workspace_path}")
    print(f"{'='*60}")

    # 1. Discover Otaku
    if args.source == "drive":
        if not args.drive_folder_id:
            print("ERROR: --drive-folder-id required for drive source")
            sys.exit(1)
        otaku_list = discover_otaku_from_drive(args.drive_folder_id)
    else:
        print("Local source not yet implemented")
        sys.exit(1)

    if not otaku_list:
        print("No Otaku found. Check folder ID.")
        sys.exit(1)

    # 2. Quality filter
    qualified = [o for o in otaku_list if assess_quality(o)]
    print(f"\n{len(qualified)}/{len(otaku_list)} Otaku passed quality check: {[o['name'] for o in qualified]}")

    if not qualified:
        print("No qualified Otaku. Aborting.")
        sys.exit(1)

    if args.dry_run:
        print("\n[DRY RUN] Would create workspace with above Otaku. Re-run without --dry-run to build.")
        sys.exit(0)

    # 3. Create directories
    workspace_path.mkdir(parents=True, exist_ok=True)
    knowledge_dir.mkdir(parents=True, exist_ok=True)

    # 4. Download knowledge files
    print("\nDownloading knowledge files...")
    for otaku in qualified:
        print(f"\n  {otaku['name']}:")
        download_otaku_files(otaku, knowledge_dir)

    # 5. Build workspace files
    build_workspace(agent_name, qualified, workspace_path, knowledge_dir)

    # 6. Summary
    print(f"\n{'='*60}")
    print(f"DONE. Workspace ready at: {workspace_path}")
    print(f"\nNext steps:")
    print(f"  1. Review MEMORY.md and SOUL.md â€” customize if needed")
    print(f"  2. Run: openclaw agents add {agent_name} --workspace {workspace_path} --non-interactive")
    print(f"  3. Add Telegram bot token if needed (create via @BotFather)")
    print(f"  4. Run: openclaw gateway restart")
    print(f"{'='*60}\n")


if __name__ == "__main__":
    main()

