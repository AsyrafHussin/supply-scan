import { join } from 'node:path';
import { readFileSync, readdirSync } from 'node:fs';
import type { Rule, CheckResult } from '../types.js';
import { dirExists, getPkgVersion, isVersionCompromised, escapeRegex } from '../utils.js';

// Pre-compiled regex cache to avoid recompilation in hot loops
const regexCache = new Map<string, RegExp>();

function getMaliciousPkgRegex(pkg: string): RegExp {
  let re = regexCache.get(pkg);
  if (!re) {
    re = new RegExp(`["'/]${escapeRegex(pkg)}["'/@:]`);
    regexCache.set(pkg, re);
  }
  return re;
}

export function checkPackages(
  rules: Rule[],
  projectDirs: string[]
): CheckResult[] {
  const results: CheckResult[] = [];

  // Pre-compile all malicious package regexes before the project loop
  for (const rule of rules) {
    for (const pkg of Object.keys(rule.packages.malicious)) {
      getMaliciousPkgRegex(pkg);
    }
  }

  for (const dir of projectDirs) {
    const lockfileCache = readLockfiles(dir);

    // Cache getPkgVersion results per project to avoid redundant reads across rules
    const versionCache = new Map<string, string | null>();

    for (const rule of rules) {
      // Check compromised packages in node_modules
      for (const [pkg, badVersions] of Object.entries(rule.packages.compromised)) {
        const pkgJsonPath = join(dir, 'node_modules', pkg, 'package.json');
        let version = versionCache.get(pkgJsonPath);
        if (version === undefined) {
          version = getPkgVersion(pkgJsonPath);
          versionCache.set(pkgJsonPath, version);
        }
        if (version && isVersionCompromised(version, badVersions)) {
          results.push({
            type: 'fail',
            rule: rule.id,
            check: 'packages',
            message: `${pkg}@${version} is COMPROMISED`,
            details: `${rule.name} — ${dir}`,
          });
        }
      }

      // Check malicious packages (should not exist at all)
      for (const [pkg] of Object.entries(rule.packages.malicious)) {
        const pkgDir = join(dir, 'node_modules', pkg);
        if (dirExists(pkgDir)) {
          const pkgJsonPath = join(pkgDir, 'package.json');
          let version = versionCache.get(pkgJsonPath);
          if (version === undefined) {
            version = getPkgVersion(pkgJsonPath);
            versionCache.set(pkgJsonPath, version);
          }
          results.push({
            type: 'fail',
            rule: rule.id,
            check: 'packages',
            message: `Malicious package ${pkg}${version ? `@${version}` : ''} found`,
            details: `${rule.name} — ${dir}`,
          });
        }
      }

      checkLockfilesForRule(lockfileCache, dir, rule, results);
    }
  }

  return results;
}

const LOCKFILE_NAMES = ['package-lock.json', 'yarn.lock', 'pnpm-lock.yaml', 'bun.lock', 'bun.lockb'];

function readLockfiles(dir: string): Map<string, string> {
  const cache = new Map<string, string>();

  // Check which files exist first (cheaper than catching ENOENT per file)
  let dirEntries: Set<string>;
  try {
    dirEntries = new Set(readdirSync(dir));
  } catch {
    return cache;
  }

  for (const name of LOCKFILE_NAMES) {
    if (!dirEntries.has(name)) continue;
    try {
      const encoding = name === 'bun.lockb' ? 'latin1' : 'utf-8';
      cache.set(name, readFileSync(join(dir, name), encoding));
    } catch {
      // Read error
    }
  }
  return cache;
}

function checkLockfilesForRule(
  lockfileCache: Map<string, string>,
  dir: string,
  rule: Rule,
  results: CheckResult[]
): void {
  for (const [lockfile, content] of lockfileCache) {
    // Check malicious packages using pre-compiled regex
    for (const pkg of Object.keys(rule.packages.malicious)) {
      if (getMaliciousPkgRegex(pkg).test(content)) {
        results.push({
          type: 'fail',
          rule: rule.id,
          check: 'lockfile',
          message: `${lockfile} references malicious package "${pkg}"`,
          details: `${rule.name} — ${dir}`,
        });
      }
    }

    // Check compromised versions using string matching (no regex needed — exact patterns)
    for (const [pkg, versions] of Object.entries(rule.packages.compromised)) {
      for (const ver of versions) {
        const tied = [
          `"${pkg}": "${ver}"`,
          `${pkg}@${ver}`,
          `"${pkg}","${ver}"`,
        ];
        if (tied.some((p) => content.includes(p))) {
          results.push({
            type: 'warn',
            rule: rule.id,
            check: 'lockfile',
            message: `${lockfile} may reference ${pkg}@${ver}`,
            details: `${rule.name} — ${dir}`,
          });
        }
      }
    }
  }
}
