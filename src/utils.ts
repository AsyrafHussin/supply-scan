import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { platform, homedir } from 'node:os';
import { execSync } from 'node:child_process';
import { createInterface } from 'node:readline';
import type { Rule, CLIOptions } from './types.js';

// ─── OS Detection ───────────────────────────────────────────────────

export function getOS(): string {
  return platform();
}

export function getHomeDir(): string {
  return homedir();
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

        // Skip irrelevant directories
        const skip = [
          'node_modules', '.git', 'bower_components',
          '.cache', '.Trash', 'Library', '.npm',
        ];
        if (skip.includes(entry.name)) continue;

        walk(join(dir, entry.name), depth + 1);
      }
    } catch {
      // Permission denied or broken symlink
    }
  }

  // Also check base dir itself for package.json
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

// ─── Rule Loader ────────────────────────────────────────────────────

function decodeB64(s: string): string {
  return Buffer.from(s, 'base64').toString('utf-8');
}

function decodeArray(arr?: string[]): string[] | undefined {
  return arr?.map(decodeB64);
}

function decodeRecord(rec?: Record<string, string[]>): Record<string, string[]> | undefined {
  if (!rec) return undefined;
  const result: Record<string, string[]> = {};
  for (const [key, vals] of Object.entries(rec)) {
    result[key] = vals.map(decodeB64);
  }
  return result;
}

function decodeRule(rule: Rule & { encoded?: boolean }): Rule {
  if (!rule.encoded || !rule.ioc) return rule;

  const ioc = rule.ioc;
  ioc.domains = decodeArray(ioc.domains);
  ioc.ips = decodeArray(ioc.ips);
  ioc.processes = decodeArray(ioc.processes);
  ioc.strings = decodeArray(ioc.strings);
  ioc.files = decodeRecord(ioc.files);

  return rule;
}

export function loadRules(rulesDir: string): Rule[] {
  const rules: Rule[] = [];

  try {
    const files = readdirSync(rulesDir).filter((f) => f.endsWith('.json'));
    for (const file of files) {
      const rule = readJSON<Rule & { encoded?: boolean }>(join(rulesDir, file));
      if (rule && rule.id && rule.packages) {
        rules.push(decodeRule(rule));
      }
    }
  } catch {
    // Rules directory not found
  }

  // Sort by date descending (newest first)
  rules.sort((a, b) => b.date.localeCompare(a.date));
  return rules;
}

// ─── CLI Arg Parser ─────────────────────────────────────────────────

export function parseArgs(argv: string[]): CLIOptions {
  const opts: CLIOptions = {
    rules: [],
    all: false,
    list: false,
    path: null,
    ci: false,
    help: false,
    version: false,
  };

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    switch (arg) {
      case '--all':
      case '-a':
        opts.all = true;
        break;
      case '--list':
      case '-l':
        opts.list = true;
        break;
      case '--ci':
        opts.ci = true;
        opts.all = true;
        break;
      case '--help':
      case '-h':
        opts.help = true;
        break;
      case '--version':
      case '-v':
        opts.version = true;
        break;
      case '--rule':
      case '-r':
        if (i + 1 < argv.length) {
          opts.rules.push(argv[++i]);
        }
        break;
      case '--path':
      case '-p':
        if (i + 1 < argv.length) {
          opts.path = resolve(argv[++i]);
        }
        break;
    }
  }

  return opts;
}

// ─── Shell Command Runner ───────────────────────────────────────────

export function runCommand(cmd: string): string {
  try {
    return execSync(cmd, { encoding: 'utf-8', timeout: 10000, stdio: ['pipe', 'pipe', 'pipe'] }).trim();
  } catch {
    return '';
  }
}

// ─── Interactive Prompt ─────────────────────────────────────────────

export function prompt(question: string): Promise<string> {
  const rl = createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
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

