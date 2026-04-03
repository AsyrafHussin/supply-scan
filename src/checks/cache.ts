import { join } from 'node:path';
import { homedir } from 'node:os';
import type { Rule, CheckResult } from '../types.js';
import { dirExists, runCommand } from '../utils.js';

interface CacheLocation {
  name: string;
  dir: string;
  cleanCmd: string;
}

function detectCaches(): CacheLocation[] {
  const home = homedir();
  const caches: CacheLocation[] = [];

  // npm
  const npmCache = runCommand('npm config get cache') || join(home, '.npm');
  if (dirExists(npmCache)) {
    caches.push({ name: 'npm', dir: npmCache, cleanCmd: 'npm cache clean --force' });
  }

  // pnpm
  const pnpmStore = runCommand('pnpm store path 2>/dev/null');
  if (pnpmStore && dirExists(pnpmStore)) {
    caches.push({ name: 'pnpm', dir: pnpmStore, cleanCmd: 'pnpm store prune' });
  }

  // yarn v1
  const yarnCache = runCommand('yarn cache dir 2>/dev/null');
  if (yarnCache && dirExists(yarnCache)) {
    caches.push({ name: 'yarn', dir: yarnCache, cleanCmd: 'yarn cache clean' });
  }

  // yarn v2+ (berry) — project-local .yarn/cache
  const yarnBerryCache = join(process.cwd(), '.yarn', 'cache');
  if (dirExists(yarnBerryCache)) {
    caches.push({ name: 'yarn-berry', dir: yarnBerryCache, cleanCmd: 'yarn cache clean --all' });
  }

  // bun
  const bunCache = join(home, '.bun', 'install', 'cache');
  if (dirExists(bunCache)) {
    caches.push({ name: 'bun', dir: bunCache, cleanCmd: 'bun pm cache rm' });
  }

  return caches;
}

/**
 * Scan all package manager caches for malicious packages.
 * Supports: npm, pnpm, yarn (v1 & v2+), bun.
 */
export function checkCache(rules: Rule[]): CheckResult[] {
  const results: CheckResult[] = [];
  const caches = detectCaches();

  if (caches.length === 0) return results;

  // Collect all malicious package names and compromised tarballs
  const maliciousPkgs = new Map<string, string>();
  const compromisedTarballs = new Map<string, string>();

  for (const rule of rules) {
    for (const pkg of Object.keys(rule.packages.malicious)) {
      maliciousPkgs.set(pkg, rule.id);
    }
    for (const [pkg, versions] of Object.entries(rule.packages.compromised)) {
      for (const ver of versions) {
        compromisedTarballs.set(`${pkg}-${ver}.tgz`, rule.id);
      }
    }
  }

  if (maliciousPkgs.size === 0 && compromisedTarballs.size === 0) return results;

  for (const cache of caches) {
    scanCacheDir(cache, maliciousPkgs, compromisedTarballs, results);
  }

  return results;
}

function scanCacheDir(
  cache: CacheLocation,
  maliciousPkgs: Map<string, string>,
  compromisedTarballs: Map<string, string>,
  results: CheckResult[]
): void {
  // Find malicious package directories
  if (maliciousPkgs.size > 0) {
    const nameArgs = Array.from(maliciousPkgs.keys())
      .map((n) => `-name "${n}"`)
      .join(' -o ');
    const found = runCommand(
      `find "${cache.dir}" -maxdepth 4 -type d \\( ${nameArgs} \\) 2>/dev/null`
    );
    if (found) {
      for (const line of found.split('\n').filter(Boolean)) {
        const name = line.split('/').pop() || '';
        const ruleId = maliciousPkgs.get(name);
        if (ruleId) {
          results.push({
            type: 'fail',
            rule: ruleId,
            check: 'cache',
            message: `Malicious package "${name}" found in ${cache.name} cache`,
            details: `Run: ${cache.cleanCmd}`,
          });
        }
      }
    }
  }

  // Find compromised tarballs
  if (compromisedTarballs.size > 0) {
    const nameArgs = Array.from(compromisedTarballs.keys())
      .map((n) => `-name "${n}"`)
      .join(' -o ');
    const found = runCommand(
      `find "${cache.dir}" -maxdepth 4 -type f \\( ${nameArgs} \\) 2>/dev/null`
    );
    if (found) {
      for (const line of found.split('\n').filter(Boolean)) {
        const name = line.split('/').pop() || '';
        const ruleId = compromisedTarballs.get(name);
        if (ruleId) {
          results.push({
            type: 'warn',
            rule: ruleId,
            check: 'cache',
            message: `Compromised tarball ${name} in ${cache.name} cache`,
            details: `Run: ${cache.cleanCmd}`,
          });
        }
      }
    }
  }
}
