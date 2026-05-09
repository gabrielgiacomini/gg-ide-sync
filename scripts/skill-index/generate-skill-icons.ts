#!/usr/bin/env tsx
/**
 * @fileoverview Generates lightweight fallback SVG icon assets for repo-local canonical skills.
 *
 * Flow: discover canonical skill folders with `SKILL.md` files -> ensure `assets/icon-small.svg` and
 * `assets/icon-large.svg` exist -> patch `agents/openai.yaml` icon fields when present. The script
 * is intentionally generic and does not encode project-specific skill names or categories.
 *
 * @testing CLI: npx tsx canonical-skills/gg-ide-sync/scripts/skill-index/generate-skill-icons.ts
 * @see canonical-skills/gg-ide-sync/scripts/sync.ts - Orchestrates this script in the `skills` lane.
 * @documentation reviewed=2026-05-09 standard=FILE_OVERVIEW_STANDARDS_TYPESCRIPT@3
 */

import fs from "node:fs/promises";
import path from "node:path";
import yaml from "js-yaml";

type Options = {
  skills: string[];
};

type YamlMapping = Record<string, unknown>;

const REPO_ROOT = process.cwd();
const SKILLS_ROOT = path.join(REPO_ROOT, "canonical-skills");
const ICON_SMALL_RELATIVE_PATH = "./assets/icon-small.svg";
const ICON_LARGE_RELATIVE_PATH = "./assets/icon-large.svg";
const DEFAULT_BRAND_COLOR = "#6366f1";

function isRecord(value: unknown): value is YamlMapping {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseOptions(argv: string[]): Options {
  const skills: string[] = [];
  for (const token of argv) {
    if (token.startsWith("--skill=")) {
      skills.push(...token.slice("--skill=".length).split(",").map((value) => value.trim()).filter(Boolean));
    }
  }
  return { skills };
}

async function pathExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

function buildMonogram(skillName: string): string {
  const tokens = skillName.split("-").filter((token) => token.length > 0 && token !== "skill" && token !== "skills");
  const first = tokens[0]?.charAt(0).toUpperCase() ?? "S";
  const second = tokens[1]?.charAt(0).toUpperCase() ?? "K";
  return `${first}${second}`;
}

function buildSvgIcon(options: { label: string; size: number }): string {
  const fontSize = Math.round(options.size * 0.34);
  const radius = Math.round(options.size * 0.22);
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${options.size} ${options.size}" role="img" aria-label="Skill icon">`,
    "  <defs>",
    "    <linearGradient id=\"g\" x1=\"0\" y1=\"0\" x2=\"1\" y2=\"1\">",
    "      <stop offset=\"0\" stop-color=\"#4f46e5\"/>",
    "      <stop offset=\"1\" stop-color=\"#9333ea\"/>",
    "    </linearGradient>",
    "  </defs>",
    `  <rect width="${options.size}" height="${options.size}" rx="${radius}" fill="url(#g)"/>`,
    `  <text x="50%" y="54%" dominant-baseline="middle" text-anchor="middle" font-family="Inter, ui-sans-serif, system-ui, sans-serif" font-size="${fontSize}" font-weight="800" fill="#ffffff">${options.label}</text>`,
    "</svg>",
    "",
  ].join("\n");
}

async function collectSkillDirectories(requestedSkills: string[]): Promise<string[]> {
  const entries = await fs.readdir(SKILLS_ROOT, { withFileTypes: true });
  const allSkillDirectories = entries
    .filter((entry) => entry.isDirectory() && !entry.name.startsWith("."))
    .map((entry) => entry.name)
    .sort((left, right) => left.localeCompare(right));

  if (requestedSkills.length === 0) {
    return allSkillDirectories;
  }

  const knownSkillSet = new Set(allSkillDirectories);
  const missingSkills = requestedSkills.filter((skillName) => !knownSkillSet.has(skillName));
  if (missingSkills.length > 0) {
    throw new Error(`Requested skills not found: ${missingSkills.join(", ")}`);
  }
  return requestedSkills;
}

async function readYamlFile(filePath: string): Promise<YamlMapping | null> {
  if (!(await pathExists(filePath))) {
    return null;
  }
  const rawContent = await fs.readFile(filePath, "utf8");
  const parsed = yaml.load(rawContent);
  return isRecord(parsed) ? parsed : null;
}

async function readOpenAiInterface(skillRoot: string): Promise<YamlMapping | null> {
  const openAiYamlPath = path.join(skillRoot, "agents", "openai.yaml");
  const openAiYaml = await readYamlFile(openAiYamlPath);
  return openAiYaml && isRecord(openAiYaml.interface) ? openAiYaml.interface : null;
}

async function writeOpenAiYamlIfPresent(skillRoot: string): Promise<"missing" | "updated" | "unchanged"> {
  const openAiYamlPath = path.join(skillRoot, "agents", "openai.yaml");
  const openAiYaml = await readYamlFile(openAiYamlPath);
  if (openAiYaml === null) {
    return "missing";
  }

  const interfaceValue = isRecord(openAiYaml.interface) ? openAiYaml.interface : {};
  const hasRequiredMetadata =
    typeof interfaceValue.brand_color === "string" &&
    typeof interfaceValue.icon_large === "string" &&
    typeof interfaceValue.icon_small === "string";
  if (hasRequiredMetadata) {
    return "unchanged";
  }

  const nextYaml: YamlMapping = {
    ...openAiYaml,
    interface: {
      ...interfaceValue,
      brand_color: typeof interfaceValue.brand_color === "string" ? interfaceValue.brand_color : DEFAULT_BRAND_COLOR,
      icon_large: typeof interfaceValue.icon_large === "string" ? interfaceValue.icon_large : ICON_LARGE_RELATIVE_PATH,
      icon_small: typeof interfaceValue.icon_small === "string" ? interfaceValue.icon_small : ICON_SMALL_RELATIVE_PATH,
    },
  };
  await fs.writeFile(openAiYamlPath, yaml.dump(nextYaml, { lineWidth: 100, noRefs: true, sortKeys: false }), "utf8");
  return "updated";
}

async function ensureSkillIcons(skillName: string): Promise<void> {
  const skillRoot = path.join(SKILLS_ROOT, skillName);
  const skillFilePath = path.join(skillRoot, "SKILL.md");
  if (!(await pathExists(skillFilePath))) {
    return;
  }

  const assetsDirectoryPath = path.join(skillRoot, "assets");
  await fs.mkdir(assetsDirectoryPath, { recursive: true });
  const label = buildMonogram(skillName);
  const openAiInterface = await readOpenAiInterface(skillRoot);
  const smallIconRelativePath = typeof openAiInterface?.icon_small === "string" ? openAiInterface.icon_small : ICON_SMALL_RELATIVE_PATH;
  const largeIconRelativePath = typeof openAiInterface?.icon_large === "string" ? openAiInterface.icon_large : ICON_LARGE_RELATIVE_PATH;
  const iconTargets = [
    { relativePath: smallIconRelativePath, size: 64 },
    { relativePath: largeIconRelativePath, size: 160 },
  ];
  for (const iconTarget of iconTargets) {
    if (!iconTarget.relativePath.endsWith(".svg")) {
      continue;
    }
    const iconPath = path.join(skillRoot, iconTarget.relativePath);
    if (!(await pathExists(iconPath))) {
      await fs.mkdir(path.dirname(iconPath), { recursive: true });
      await fs.writeFile(iconPath, buildSvgIcon({ label, size: iconTarget.size }), "utf8");
    }
  }
  const yamlStatus = await writeOpenAiYamlIfPresent(skillRoot);
  console.log(`[skills:sync:icons] ${skillName} ✓ icons refreshed${yamlStatus === "updated" ? ", openai metadata updated" : ""}`);
}

async function main(): Promise<void> {
  const options = parseOptions(process.argv.slice(2));
  if (!(await pathExists(SKILLS_ROOT))) {
    console.log("[skills:sync:icons] canonical-skills directory not found; skipping icon generation");
    return;
  }
  const skillDirectories = await collectSkillDirectories(options.skills);
  for (const skillName of skillDirectories) {
    await ensureSkillIcons(skillName);
  }
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`[skills:sync:icons] ${message}`);
  process.exit(1);
});
