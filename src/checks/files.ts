import type { Rule, CheckResult } from '../types.js';
import { expandPath, fileExists, getOS } from '../utils.js';

/**
 * Check for known malware artifacts on disk.
 * Checks OS-specific file paths from rule IOCs.
 */
export function checkFiles(rules: Rule[]): CheckResult[] {
  const results: CheckResult[] = [];
  const os = getOS();

  for (const rule of rules) {
    const filePaths = rule.ioc.files?.[os];
    if (!filePaths || filePaths.length === 0) continue;

    for (const rawPath of filePaths) {
      const path = expandPath(rawPath);
      if (fileExists(path)) {
        results.push({
          type: 'fail',
          rule: rule.id,
          check: 'files',
          message: `Malware artifact found: ${path}`,
          details: rule.name,
        });
      }
    }
  }

  return results;
}
