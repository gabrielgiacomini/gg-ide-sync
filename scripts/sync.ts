#!/usr/bin/env tsx
/**
 * @fileoverview Portable IDE sync orchestrator for repository guidance, skills, workflows, rules, and package submodule sync lanes.
 *
 * Flow: resolve the target repository from `process.cwd()` -> select one or more sync lanes -> run the
 * skill-owned projection scripts in the same order as the root `npm run sync` contract -> stop on the
 * first failing command with the child exit code.
 *
 * @testing CLI: npx tsx canonical-skills/gg-ide-sync/scripts/sync.ts --dry-run
 * @testing CLI: npx tsx canonical-skills/gg-ide-sync/scripts/sync.ts --lane skills
 * @see canonical-skills/gg-ide-sync/SKILL.md - Operator workflow and lane descriptions.
 * @documentation reviewed=2026-05-09 standard=FILE_OVERVIEW_STANDARDS_TYPESCRIPT@3
 */

import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

type SyncLane = "skills" | "agents" | "workflows" | "rules" | "submodules";

type SyncCommand = {
  args: string[];
  command: string;
  env?: NodeJS.ProcessEnv;
  label: string;
  optionalWhenMissing?: string;
};

const ALL_LANES: SyncLane[] = ["skills", "agents", "workflows", "rules", "submodules"];
const CURRENT_FILE_PATH = fileURLToPath(import.meta.url);
const SCRIPT_DIRECTORY_PATH = path.dirname(CURRENT_FILE_PATH);

function parseLanes(argv: string[]): SyncLane[] {
  const selectedLanes: SyncLane[] = [];
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === "--lane") {
      const lane = argv[index + 1];
      if (isSyncLane(lane)) {
        selectedLanes.push(lane);
        index += 1;
        continue;
      }
      throw new Error(`Unknown sync lane after --lane: ${lane ?? "<missing>"}`);
    }

    if (typeof token === "string" && token.startsWith("--lane=")) {
      const lane = token.slice("--lane=".length);
      if (isSyncLane(lane)) {
        selectedLanes.push(lane);
        continue;
      }
      throw new Error(`Unknown sync lane: ${lane}`);
    }
  }

  return selectedLanes.length > 0 ? selectedLanes : ALL_LANES;
}

function isSyncLane(value: unknown): value is SyncLane {
  return typeof value === "string" && ALL_LANES.includes(value as SyncLane);
}

function scriptPath(relativePath: string): string {
  return path.join(SCRIPT_DIRECTORY_PATH, relativePath);
}

function targetPath(repoRoot: string, candidatePath: string): string {
  return path.isAbsolute(candidatePath) ? candidatePath : path.join(repoRoot, candidatePath);
}

function exists(repoRoot: string, candidatePath: string): boolean {
  return fs.existsSync(targetPath(repoRoot, candidatePath));
}

function tsxCommand(label: string, relativeScriptPath: string, args: string[] = []): SyncCommand {
  return {
    args: ["tsx", scriptPath(relativeScriptPath), ...args],
    command: "npx",
    label,
  };
}

function buildCommandsForLane(options: { dryRun: boolean; lane: SyncLane; repoRoot: string }): SyncCommand[] {
  const writeFlag = options.dryRun ? [] : ["--write"];

  switch (options.lane) {
    case "skills":
      return [
        tsxCommand("skills icons", "skill-index/generate-skill-icons.ts"),
        tsxCommand("skills indexes", "skill-index/generate-skill-indexes.ts"),
        tsxCommand("skills register .agents", "canonical-agents/skills/register-dot-agents-project.ts"),
        tsxCommand("skills register Claude", "canonical-agents/skills/register-claude-project.ts"),
        tsxCommand("skills register Auggie", "canonical-agents/skills/register-auggie.ts"),
        tsxCommand("skills register pi", "canonical-agents/skills/register-pi.ts"),
        tsxCommand("skills register Verdent", "canonical-agents/skills/register-verdent.ts"),
      ];

    case "agents":
      return [
        tsxCommand("canonical agents", "canonical-agents/generate.ts", options.dryRun ? [] : ["--write"]),
        tsxCommand("agents guidance", "agents-guidance/generate.ts", options.dryRun ? [] : ["--write"]),
      ];

    case "workflows":
      return [
        tsxCommand("workflows npm", "canonical-workflows/sync-npm.ts", writeFlag),
        tsxCommand("workflows skills", "canonical-workflows/sync-skills.ts", writeFlag),
        tsxCommand("workflows submodule discovery", "canonical-workflows/sync-submodule-discovery.ts", writeFlag),
        tsxCommand("workflows IDE", "canonical-workflows/sync-ide.ts", writeFlag),
      ];

    case "rules":
      return [
        tsxCommand("rules documentation map", "docs-sync/sync-rules-documentation-map.ts", writeFlag),
        tsxCommand("rules canonical", "canonical-rules/sync-canonical.ts", writeFlag),
        {
          args: [
            "jest",
            "--config",
            scriptPath("../jest.config.ts"),
            scriptPath("__tests__/canonical-rules.unit.test.ts"),
          ],
          command: "npx",
          env: { ...process.env, NODE_OPTIONS: "--experimental-vm-modules" },
          label: "rules unit test",
          optionalWhenMissing: scriptPath("__tests__/canonical-rules.unit.test.ts"),
        },
      ];

    case "submodules":
      return exists(options.repoRoot, ".gitmodules")
        ? [tsxCommand("submodule package sync", "platform/commands/sync-submodule-packages.ts", options.dryRun ? ["--dry-run"] : [])]
        : [];
  }
}

function runCommand(command: SyncCommand, repoRoot: string): number {
  if (command.optionalWhenMissing && !exists(repoRoot, command.optionalWhenMissing)) {
    console.log(`[ide-sync] skip ${command.label}: ${command.optionalWhenMissing} not found`);
    return 0;
  }

  console.log(`[ide-sync] run ${command.label}`);
  const result = spawnSync(command.command, command.args, {
    cwd: repoRoot,
    env: command.env ?? process.env,
    stdio: "inherit",
  });

  if (result.signal) {
    console.error(`[ide-sync] ${command.label} stopped by signal ${result.signal}`);
    return 1;
  }

  return result.status ?? 0;
}

function main(): number {
  const argv = process.argv.slice(2);
  const dryRun = argv.includes("--dry-run") || argv.includes("--check");
  const repoRoot = process.cwd();
  const lanes = parseLanes(argv);

  console.log(`[ide-sync] target repo: ${repoRoot}`);
  console.log(`[ide-sync] lanes: ${lanes.join(", ")}${dryRun ? " (dry-run)" : ""}`);

  for (const lane of lanes) {
    const commands = buildCommandsForLane({ dryRun, lane, repoRoot });
    if (commands.length === 0) {
      console.log(`[ide-sync] skip ${lane}: no matching source files`);
      continue;
    }

    for (const command of commands) {
      const status = runCommand(command, repoRoot);
      if (status !== 0) {
        console.error(`[ide-sync] failed: ${command.label}`);
        return status;
      }
    }
  }

  console.log("[ide-sync] complete");
  return 0;
}

try {
  process.exit(main());
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`[ide-sync] ${message}`);
  process.exit(1);
}
