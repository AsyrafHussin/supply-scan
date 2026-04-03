import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { platform, homedir } from 'node:os';

// Re-export for test backward compatibility
export { parseArgs } from './args.js';
export { loadRules } from './rules.js';

export function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function getOS(): string {
  return platform();
}

// ─── JSON Reader ────────────────────────────────────────────────────

export function readJSON<T>(path: string): T | null {
  try {
    const content = readFileSync(path, 'utf-8');
    return JSON.parse(content) as T;
  } catch {
    return null;
  }
}

// ─── Version Matching ───────────────────────────────────────────────

export function getPkgVersion(pkgJsonPath: string): string | null {
  const pkg = readJSON<{ version?: string }>(pkgJsonPath);
  return pkg?.version ?? null;
}

export function isVersionCompromised(
  version: string | null,
  badVersions: string[]
): boolean {
  if (!version) return false;
  return badVersions.includes(version);
}

// ─── Path Expansion ─────────────────────────────────────────────────

export function expandPath(p: string): string {
  let result = p;
  if (result.startsWith('~')) {
    result = join(homedir(), result.slice(1));
  }
  if (result.includes('%PROGRAMDATA%')) {
    result = result.replace('%PROGRAMDATA%', process.env.PROGRAMDATA || 'C:\\ProgramData');
  }
  if (result.includes('%TEMP%')) {
    result = result.replace('%TEMP%', process.env.TEMP || '/tmp');
  }
  if (result.includes('%USERPROFILE%')) {
    result = result.replace('%USERPROFILE%', homedir());
  }
  return result;
}

// ─── Project Discovery ──────────────────────────────────────────────

const SKIP_DIRS = new Set([
  'node_modules', '.git', 'bower_components',
  '.cache', '.Trash', 'Library', '.npm',
]);

export function findProjects(baseDirs: string[], maxDepth = 8): string[] {
  const projects: Set<string> = new Set();

  function walk(dir: string, depth: number): void {
    if (depth > maxDepth) return;

    try {
      const entries = readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        if (!entry.isDirectory()) {
          if (entry.name === 'package.json' && depth > 0) {
            projects.add(dir);
          }
          continue;
        }
        if (SKIP_DIRS.has(entry.name)) continue;
        walk(join(dir, entry.name), depth + 1);
      }
    } catch {
      // Permission denied or broken symlink
    }
  }

  for (const base of baseDirs) {
    if (!existsSync(base)) continue;
    if (existsSync(join(base, 'package.json'))) {
      projects.add(base);
    }
    walk(base, 0);
  }

  return Array.from(projects);
}

// ─── Common Project Directories ─────────────────────────────────────

export function getCommonProjectDirs(): string[] {
  const home = homedir();
  const candidates = [
    'Desktop', 'Documents', 'Projects', 'projects',
    'Developer', 'dev', 'code', 'Code',
    'Sites', 'sites', 'www', 'Work', 'work',
    'workspace', 'Workspace', 'repos', 'Repos',
    'src', 'github', 'GitHub',
  ];
  return candidates
    .map((d) => join(home, d))
    .filter((d) => existsSync(d));
}

// ─── File Exists Check ──────────────────────────────────────────────

export function fileExists(path: string): boolean {
  try {
    return statSync(path).isFile();
  } catch {
    return false;
  }
}

export function dirExists(path: string): boolean {
  try {
    return statSync(path).isDirectory();
  } catch {
    return false;
  }
}
