import { join } from 'node:path';
import { readFileSync } from 'node:fs';
import type { Rule, CheckResult } from '../types.js';
import { dirExists, getPkgVersion, isVersionCompromised } from '../utils.js';

export function checkPackages(
  rules: Rule[],
  projectDirs: string[]
): CheckResult[] {
  const results: CheckResult[] = [];

  for (const dir of projectDirs) {
    // Cache lockfile contents per project (read once, check all rules)
    const lockfileCache = readLockfiles(dir);

    for (const rule of rules) {
      // Check compromised packages in node_modules
      for (const [pkg, badVersions] of Object.entries(rule.packages.compromised)) {
        const version = getPkgVersion(join(dir, 'node_modules', pkg, 'package.json'));
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
          const version = getPkgVersion(join(pkgDir, 'package.json'));
          results.push({
            type: 'fail',
            rule: rule.id,
            check: 'packages',
            message: `Malicious package ${pkg}${version ? `@${version}` : ''} found`,
            details: `${rule.name} — ${dir}`,
          });
        }
      }

      // Check lockfiles for references
      checkLockfilesForRule(lockfileCache, dir, rule, results);
    }
  }

  return results;
}

function readLockfiles(dir: string): Map<string, string> {
  const cache = new Map<string, string>();
  // All supported lockfile formats: npm, yarn, pnpm, bun
  const lockfiles = [
    'package-lock.json',
    'yarn.lock',
    'pnpm-lock.yaml',
    'bun.lock',     // bun text-based lockfile (bun v1.2+)
    'bun.lockb',    // bun binary lockfile (older bun)
  ];
  for (const name of lockfiles) {
    try {
      // bun.lockb is binary — read as latin1 so string search still works on package names
      const encoding = name === 'bun.lockb' ? 'latin1' : 'utf-8';
      cache.set(name, readFileSync(join(dir, name), encoding));
    } catch {
      // File doesn't exist
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
    // Check for malicious package names
    for (const pkg of Object.keys(rule.packages.malicious)) {
      if (content.includes(pkg)) {
        results.push({
          type: 'fail',
          rule: rule.id,
          check: 'lockfile',
          message: `${lockfile} references malicious package "${pkg}"`,
          details: `${rule.name} — ${dir}`,
        });
      }
    }

    // Check for compromised versions using specific patterns
    for (const [pkg, versions] of Object.entries(rule.packages.compromised)) {
      for (const ver of versions) {
        // Only match patterns that tie the package name to the version
        const tied = [
          `"${pkg}": "${ver}"`,    // package-lock.json / bun.lock
          `${pkg}@${ver}`,         // yarn.lock / pnpm-lock.yaml
          `"${pkg}","${ver}"`,     // bun.lockb binary format
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
