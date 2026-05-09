import { execSync } from "node:child_process";

/** Resolve the target repository root using Git, falling back to `process.cwd()`. */
export function resolveRepoRoot(): string {
  try {
    return execSync("git rev-parse --show-toplevel", {
      encoding: "utf8",
      stdio: ["pipe", "pipe", "ignore"],
    }).trim();
  } catch {
    return process.cwd();
  }
}
