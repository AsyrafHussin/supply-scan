import { join } from 'node:path';
import { homedir } from 'node:os';
import type { Rule, CheckResult } from '../types.js';
import { dirExists } from '../utils.js';
import { runCommand, runSafe } from '../shell.js';

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

function findInCache(
  cacheDir: string,
  names: Map<string, string>,
  type: 'd' | 'f'
): Map<string, string> {
  const hits = new Map<string, string>();
  if (names.size === 0) return hits;

  const nameExprs = Array.from(names.keys()).flatMap((n, i) =>
    i === 0 ? ['-name', n] : ['-o', '-name', n]
  );
  const found = runSafe('find', [cacheDir, '-maxdepth', '4', '-type', type, '(', ...nameExprs, ')']);
  if (found) {
    for (const line of found.split('\n').filter(Boolean)) {
      const name = line.split('/').pop() || '';
      const ruleId = names.get(name);
      if (ruleId) hits.set(name, ruleId);
    }
  }
  return hits;
}

function scanCacheDir(
  cache: CacheLocation,
  maliciousPkgs: Map<string, string>,
  compromisedTarballs: Map<string, string>,
  results: CheckResult[]
): void {
  for (const [name, ruleId] of findInCache(cache.dir, maliciousPkgs, 'd')) {
    results.push({
      type: 'fail',
      rule: ruleId,
      check: 'cache',
      message: `Malicious package "${name}" found in ${cache.name} cache`,
      details: `Run: ${cache.cleanCmd}`,
    });
  }

  for (const [name, ruleId] of findInCache(cache.dir, compromisedTarballs, 'f')) {
    results.push({
      type: 'warn',
      rule: ruleId,
      check: 'cache',
      message: `Compromised tarball ${name} in ${cache.name} cache`,
      details: `Run: ${cache.cleanCmd}`,
    });
  }
}
