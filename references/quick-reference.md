---
title: GG IDE Sync Quick Reference
---

# GG IDE Sync Quick Reference

Run commands from the target repository root.

## Full sync

```bash
npx tsx canonical-skills/gg-ide-sync/scripts/sync.ts
```

## Lane commands

```bash
npx tsx canonical-skills/gg-ide-sync/scripts/sync.ts --lane skills
npx tsx canonical-skills/gg-ide-sync/scripts/sync.ts --lane agents
npx tsx canonical-skills/gg-ide-sync/scripts/sync.ts --lane workflows
npx tsx canonical-skills/gg-ide-sync/scripts/sync.ts --lane rules
npx tsx canonical-skills/gg-ide-sync/scripts/sync.ts --lane submodules
```

## Host package scripts

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

## Source folders by lane

| Lane | Expected source folders |
|------|-------------------------|
| `skills` | `canonical-skills/` |
| `agents` | `canonical-agents/`, root guidance files |
| `workflows` | `package.json`, `canonical-workflows/`, package workflow opt-ins |
| `rules` | `canonical-rules/`, docs and guidance markdown |
| `submodules` | `.gitmodules`, package-local `package.json#scripts.sync` |

## Verification

```bash
NODE_OPTIONS='--experimental-vm-modules' npx jest --config canonical-skills/gg-ide-sync/jest.config.ts
npx tsx canonical-skills/gg-ide-sync/scripts/sync.ts --lane agents --dry-run
npx tsx canonical-skills/gg-ide-sync/scripts/sync.ts --lane workflows --dry-run
npx tsx canonical-skills/gg-ide-sync/scripts/sync.ts --lane submodules --dry-run
```
