---
name: gg-ide-sync
description: Use when installing, configuring, running, or porting the GG IDE sync toolchain that materializes canonical skills, agents, workflows, rules, and package submodule sync targets from repository-local sources.
---

# GG → IDE Sync

> **Snapshot age:** live operational guidance. Verify the target repository's `package.json`, canonical source folders, and installed Node tooling before changing sync commands.

## Overview

Use this skill to run and maintain a portable IDE sync toolchain for repositories that keep agent-facing sources in folders such as `canonical-skills/`, `canonical-agents/`, `canonical-workflows/`, and `canonical-rules/`. The skill-owned scripts project those sources into IDE-native surfaces and can be wired to a host repository's `npm run sync` command.

## When to Use This Skill

**TRIGGER when:**
- Wiring a repository's `sync`, `skills:sync`, `agents:sync`, `workflows:sync`, `rules:sync`, or package submodule sync commands to the portable toolchain.
- Running or debugging IDE projection output for skills, agents, workflow commands, rule files, or generated documentation-map rules.
- Moving repository-local IDE sync entrypoints into this skill-owned script surface.
- Adding a new IDE target to the shared sync behavior.

**SKIP when:**
- The task is only to author a skill's `SKILL.md` content without touching generated IDE surfaces.
- A package has its own specialized sync implementation and no request to adopt the portable toolchain.
- The user wants browser/runtime validation unrelated to repository guidance projection.

## Common Misconceptions

| # | Misconception | Correction | Key concept |
|---|---------------|------------|-------------|
| 1 | `npm run sync` is a single generator | It is an ordered set of lanes: skills, agents, workflows, rules, and package submodule sync. | Lane orchestration |
| 2 | Scripts can infer the target repo from their own location | The target repository is always `process.cwd()`; the skill may live as a nested dependency. | CWD contract |
| 3 | Every repository has every source folder | Lanes should be capability-aware and report missing optional surfaces clearly. | Portable adoption |
| 4 | Generated output can be edited by hand | Generated IDE files are projections; edit canonical sources and rerun the relevant lane. | Source of truth |
| 5 | Submodule sync should recurse blindly | Package sync targets are discovered from `.gitmodules` and package-local `sync` scripts. | Explicit target discovery |

## Command Surface

Run from the target repository root:

```bash
# Full sync, matching the composed root contract.
npx tsx canonical-skills/gg-ide-sync/scripts/sync.ts

# Individual lanes.
npx tsx canonical-skills/gg-ide-sync/scripts/sync.ts --lane skills
npx tsx canonical-skills/gg-ide-sync/scripts/sync.ts --lane agents
npx tsx canonical-skills/gg-ide-sync/scripts/sync.ts --lane workflows
npx tsx canonical-skills/gg-ide-sync/scripts/sync.ts --lane rules
npx tsx canonical-skills/gg-ide-sync/scripts/sync.ts --lane submodules

# Preview where supported by the underlying lane scripts.
npx tsx canonical-skills/gg-ide-sync/scripts/sync.ts --lane workflows --dry-run

# Run the skill-owned unit tests.
NODE_OPTIONS='--experimental-vm-modules' npx jest --config canonical-skills/gg-ide-sync/jest.config.ts
```

Recommended `package.json` wiring:

```json
{
  "scripts": {
    "sync": "npx tsx canonical-skills/gg-ide-sync/scripts/sync.ts",
    "skills:sync": "npx tsx canonical-skills/gg-ide-sync/scripts/sync.ts --lane skills",
    "agents:sync": "npx tsx canonical-skills/gg-ide-sync/scripts/sync.ts --lane agents",
    "workflows:sync": "npx tsx canonical-skills/gg-ide-sync/scripts/sync.ts --lane workflows",
    "rules:sync": "npx tsx canonical-skills/gg-ide-sync/scripts/sync.ts --lane rules",
    "sync:submodules": "npx tsx canonical-skills/gg-ide-sync/scripts/sync.ts --lane submodules"
  }
}
```

## Workflow

1. Confirm the target repository root with `pwd` and inspect its `package.json` sync scripts.
2. Inventory source folders: `canonical-skills/`, `canonical-agents/`, `canonical-workflows/`, `canonical-rules/`, and `.gitmodules`.
3. Wire `package.json` scripts to `scripts/sync.ts` or run the desired lane directly.
4. For write-mode sync, run lanes in this order: skills → agents → workflows → rules → submodules.
5. After changing the script surface, run the skill-owned Jest suite and at least one non-mutating lane check where available, then run the full command only when write output is expected.
6. If generated output changes, review it as projection drift; fix canonical sources or script renderers rather than hand-editing generated files.

## Lane Responsibilities

| Lane | Primary scripts | Output family |
|------|-----------------|---------------|
| `skills` | `skill-index/*`, `canonical-agents/skills/*` | Skill indexes, skill icons, IDE skill symlinks |
| `agents` | `canonical-agents/generate.ts`, `agents-guidance/generate.ts` | IDE-native agent definitions and agent guidance stubs |
| `workflows` | `canonical-workflows/*` | NPM shortcuts, skill shortcuts, manual workflows, package workflow wrappers |
| `rules` | `docs-sync/sync-rules-documentation-map.ts`, `canonical-rules/sync-canonical.ts` | Documentation-map rules and canonical IDE rule projections |
| `submodules` | `platform/commands/sync-submodule-packages.ts` | Sequential package-local `npm run sync` execution for `.gitmodules` packages |

## Troubleshooting

| Symptom | Likely cause | Fix |
|---------|--------------|-----|
| Scripts write into the skill folder | Command was run from the wrong CWD | `cd` to the target repository root and rerun. |
| `tsx` cannot resolve imports | Target repo lacks required Node dependencies | Run the repository install command, then retry. |
| A lane reports no source files | The target repo does not expose that canonical source family | Skip that lane or add the missing canonical source directory intentionally. |
| Generated output changes unexpectedly | Canonical sources or renderer logic drifted | Review source diffs first; do not patch generated files manually. |
| Package sync recurses or runs the wrong package | `.gitmodules` or package-local `sync` scripts are misconfigured | Inspect `.gitmodules` paths and each package's `package.json#scripts.sync`. |

## Common Pitfalls

1. Running the scripts from inside `canonical-skills/gg-ide-sync/` instead of the host repository root.
2. Leaving old repository-local entrypoints referenced in `package.json` after wiring the portable command.
3. Treating dry-run support as universal; some skill-index work is intentionally write-oriented.
4. Forgetting that root generated files and package-local generated files may have different target matrices.
5. Editing generated `.claude/`, `.agents/`, `.windsurf/`, `.opencode/`, `.kimi/`, `.cursor/`, or `.ide-rules/` files by hand.
6. Skipping package submodule sync after root workflow/rule changes that affect package-owned surfaces.

## Local Corpus Layout

- `jest.config.ts` — skill-local Jest configuration for the portable sync helper tests.
- `scripts/sync.ts` — lane orchestrator used by host `package.json` scripts.
- `scripts/__tests__/` — unit tests for agent, guidance, rule, and workflow sync helpers.
- `scripts/skill-index/` — skill icon and root skill-index generation.
- `scripts/canonical-agents/` — canonical agent projection and skill registration targets.
- `scripts/agents-guidance/` — agent guidance file projection.
- `scripts/canonical-workflows/` — NPM, skill, package, and manual workflow projection.
- `scripts/canonical-rules/` — canonical rule projection.
- `scripts/docs-sync/` — generated documentation-map rule projection.
- `scripts/platform/` — package submodule sync support.
- `references/quick-reference.md` — concise command and adoption checklist.
