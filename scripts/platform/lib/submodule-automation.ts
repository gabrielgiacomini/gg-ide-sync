/**
 * @fileoverview Generic submodule automation discovery for canonical workflow and rule sync.
 *
 * Flow: root `.gitmodules` -> configured submodule paths -> package folders with canonical source
 * directories -> generated sync targets and root discovery prefixes.
 *
 * @testing manual — run `npx tsx canonical-skills/gg-ide-sync/scripts/canonical-workflows/sync-submodule-discovery.ts` and confirm each submodule with canonical workflows appears in generated prompts.
 * @see canonical-skills/gg-ide-sync/scripts/canonical-workflows/sync-submodule-discovery.ts - Root workflow generator that consumes workflow-enabled package discovery.
 * @documentation reviewed=2026-05-09 standard=FILE_OVERVIEW_STANDARDS_TYPESCRIPT@3
 */

import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

export type PlatformSubmoduleAutomation_Feature = "canonicalRules" | "canonicalWorkflows";

export type PlatformSubmoduleAutomation_Manifest = {
  canonicalRules: boolean;
  canonicalWorkflows: boolean;
};

export type PlatformSubmoduleAutomation_Package = {
  automation: PlatformSubmoduleAutomation_Manifest;
  discoveryWorkflowPrefix: string;
  packageDir: string;
  packageDisplayName: string;
  packageJsonPath: string;
  packageRoot: string;
};

export type PlatformSubmoduleAutomation_DiscoverPackages_Options = {
  feature?: PlatformSubmoduleAutomation_Feature;
  log?: (message: string) => void;
  rootDir: string;
};

export type PlatformSubmoduleAutomation_BuildDiscoveryWorkflowPrefixes_Options = {
  rootDir: string;
};

export type PlatformSubmoduleAutomation_BuildGeneratedSyncTargets_Options = {
  rootDir: string;
};

export type PlatformSubmoduleAutomation_GeneratedSyncTarget = {
  commandArgs: string[];
  cwd: string;
  errorLabel: string;
  label: string;
  logLabel: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function toPosixPath(value: string): string {
  return value.split(path.sep).join("/");
}

function readJsonObject(filePath: string): Record<string, unknown> | null {
  if (!fs.existsSync(filePath)) {
    return null;
  }

  try {
    const parsed: unknown = JSON.parse(fs.readFileSync(filePath, "utf8"));
    return isRecord(parsed) ? parsed : null;
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn(`[submodule-automation] Unable to parse JSON at ${filePath}: ${message}`);
    return null;
  }
}

function readPackageName(packageJsonPath: string, fallbackName: string): string {
  const packageJson = readJsonObject(packageJsonPath);
  const packageName = packageJson?.name;
  return typeof packageName === "string" && packageName.trim().length > 0
    ? packageName.trim()
    : fallbackName;
}

function hasDirectory(rootDir: string, relativePath: string): boolean {
  const absolutePath = path.join(rootDir, relativePath);
  return fs.existsSync(absolutePath) && fs.statSync(absolutePath).isDirectory();
}

function listConfiguredSubmodulePaths(rootDir: string): string[] {
  const gitmodulesPath = path.join(rootDir, ".gitmodules");
  if (!fs.existsSync(gitmodulesPath)) {
    return [];
  }

  const result = spawnSync(
    "git",
    [
      "config",
      "--file",
      gitmodulesPath,
      "--get-regexp",
      "^submodule\\..*\\.path$",
    ],
    {
      cwd: rootDir,
      encoding: "utf8",
    },
  );

  if (result.status !== 0) {
    return [];
  }

  return result.stdout
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .flatMap((line) => {
      const parts = line.split(/\s+/u);
      const submodulePath = parts[1];
      return typeof submodulePath === "string" && submodulePath.length > 0
        ? [toPosixPath(submodulePath)]
        : [];
    });
}

function packageMatchesFeature(
  pkg: PlatformSubmoduleAutomation_Package,
  feature: PlatformSubmoduleAutomation_Feature | undefined,
): boolean {
  if (!feature) {
    return pkg.automation.canonicalRules || pkg.automation.canonicalWorkflows;
  }

  return pkg.automation[feature];
}

export function PlatformSubmoduleAutomation_listConfiguredSubmodulePaths(rootDir: string): string[] {
  return listConfiguredSubmodulePaths(rootDir);
}

export function PlatformSubmoduleAutomation_discoverPackages(
  options: PlatformSubmoduleAutomation_DiscoverPackages_Options,
): PlatformSubmoduleAutomation_Package[] {
  const configuredSubmodulePaths = listConfiguredSubmodulePaths(options.rootDir);

  return configuredSubmodulePaths.flatMap((packageDir) => {
    const packageRoot = path.join(options.rootDir, packageDir);
    const packageJsonPath = path.join(packageRoot, "package.json");
    if (!fs.existsSync(packageRoot)) {
      options.log?.(`Skipping ${packageDir}: submodule directory is missing`);
      return [];
    }

    const automation: PlatformSubmoduleAutomation_Manifest = {
      canonicalRules: hasDirectory(packageRoot, "canonical-rules"),
      canonicalWorkflows: hasDirectory(packageRoot, "canonical-workflows"),
    };
    const pkg: PlatformSubmoduleAutomation_Package = {
      automation,
      discoveryWorkflowPrefix: `${packageDir.replace(/[^A-Za-z0-9_-]+/gu, "-")}-`,
      packageDir,
      packageDisplayName: readPackageName(packageJsonPath, packageDir),
      packageJsonPath,
      packageRoot,
    };

    return packageMatchesFeature(pkg, options.feature) ? [pkg] : [];
  });
}

export function PlatformSubmoduleAutomation_buildDiscoveryWorkflowPrefixes(
  options: PlatformSubmoduleAutomation_BuildDiscoveryWorkflowPrefixes_Options,
): string[] {
  return PlatformSubmoduleAutomation_discoverPackages({
    feature: "canonicalWorkflows",
    rootDir: options.rootDir,
  }).map((pkg) => pkg.discoveryWorkflowPrefix);
}

export function PlatformSubmoduleAutomation_buildGeneratedSyncTargets(
  options: PlatformSubmoduleAutomation_BuildGeneratedSyncTargets_Options,
): PlatformSubmoduleAutomation_GeneratedSyncTarget[] {
  const packages = PlatformSubmoduleAutomation_discoverPackages({
    rootDir: options.rootDir,
  });
  const targets: PlatformSubmoduleAutomation_GeneratedSyncTarget[] = [
    {
      commandArgs: ["run", "workflows:sync"],
      cwd: options.rootDir,
      errorLabel: "Root workflow command projection synchronization",
      label: "Root workflow command projection sync",
      logLabel: "root generated workflow commands with npm run workflows:sync",
    },
  ];

  for (const pkg of packages) {
    if (pkg.automation.canonicalWorkflows) {
      targets.push({
        commandArgs: ["run", "workflows:sync"],
        cwd: pkg.packageRoot,
        errorLabel: `${pkg.packageDisplayName} workflow synchronization`,
        label: `${pkg.packageDisplayName} workflow sync`,
        logLabel: `${pkg.packageDisplayName} workflow targets with npm run workflows:sync`,
      });
    }

    if (pkg.automation.canonicalRules) {
      targets.push({
        commandArgs: ["run", "rules:sync"],
        cwd: pkg.packageRoot,
        errorLabel: `${pkg.packageDisplayName} rule synchronization`,
        label: `${pkg.packageDisplayName} rule sync`,
        logLabel: `${pkg.packageDisplayName} rule targets with npm run rules:sync`,
      });
    }
  }

  return targets;
}
