import fs from "node:fs";
import path from "node:path";
import yaml from "js-yaml";

export type SkillIndexEntry = {
  description: string;
  name: string;
  partition: string;
  section: string;
};

export type GeneratedSkillIndexFile = {
  partition: string;
  relativeFilePath: string;
};

type YamlMapping = Record<string, unknown>;

function isRecord(value: unknown): value is YamlMapping {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readSkillFrontmatter(skillFilePath: string): YamlMapping | null {
  const content = fs.readFileSync(skillFilePath, "utf8");
  const match = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/u.exec(content);
  if (!match || typeof match[1] !== "string") {
    return null;
  }
  const parsed = yaml.load(match[1]);
  return isRecord(parsed) ? parsed : null;
}

function titleCaseToken(value: string): string {
  return value
    .split("-")
    .filter(Boolean)
    .map((token) => `${token.charAt(0).toUpperCase()}${token.slice(1)}`)
    .join(" ");
}

function resolvePartitionAndSection(skillName: string): { partition: string; section: string } {
  if (skillName.startsWith("skills-")) {
    const namespace = skillName.slice("skills-".length) || "general";
    return { partition: namespace, section: "Managers" };
  }

  if (skillName.startsWith("skill-")) {
    const tokens = skillName.slice("skill-".length).split("-").filter(Boolean);
    const namespace = tokens[0] ?? "general";
    const sectionToken = tokens[1] ?? "general";
    return { partition: namespace, section: titleCaseToken(sectionToken) };
  }

  const firstToken = skillName.split("-").filter(Boolean)[0] ?? "general";
  return { partition: firstToken, section: "General" };
}

export function collectSkillIndexEntries(repoRoot: string): SkillIndexEntry[] {
  const skillsRoot = path.join(repoRoot, "canonical-skills");
  if (!fs.existsSync(skillsRoot)) {
    return [];
  }

  return fs.readdirSync(skillsRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && !entry.name.startsWith("."))
    .flatMap((entry): SkillIndexEntry[] => {
      const skillFilePath = path.join(skillsRoot, entry.name, "SKILL.md");
      if (!fs.existsSync(skillFilePath)) {
        return [];
      }
      const frontmatter = readSkillFrontmatter(skillFilePath);
      const description = typeof frontmatter?.description === "string"
        ? frontmatter.description.trim()
        : "No description provided.";
      const { partition, section } = resolvePartitionAndSection(entry.name);
      return [{ description, name: entry.name, partition, section }];
    })
    .sort((left, right) => left.name.localeCompare(right.name));
}

export function getGeneratedSkillIndexFiles(entries: SkillIndexEntry[]): GeneratedSkillIndexFile[] {
  return Array.from(new Set(entries.map((entry) => entry.partition)))
    .sort((left, right) => left.localeCompare(right))
    .map((partition) => ({ partition, relativeFilePath: `SKILLS.${partition}.md` }));
}

export function renderGeneratedSkillIndexFile(options: {
  entries: SkillIndexEntry[];
  partition: string;
}): string {
  const entries = options.entries.filter((entry) => entry.partition === options.partition);
  const lines = [
    `# ${titleCaseToken(options.partition)} Skills Index`,
    "",
    "Generated from `canonical-skills/*/SKILL.md`. Do not edit manually.",
    "",
  ];

  const sections = Array.from(new Set(entries.map((entry) => entry.section))).sort((left, right) => left.localeCompare(right));
  for (const section of sections) {
    lines.push(`## ${section}`, "");
    for (const entry of entries.filter((candidate) => candidate.section === section)) {
      lines.push(`- \`${entry.name}\` — ${entry.description}`);
    }
    lines.push("");
  }

  return `${lines.join("\n").trimEnd()}\n`;
}
