import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import type { Rule } from './types.js';
import { readJSON } from './utils.js';

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

  rules.sort((a, b) => b.date.localeCompare(a.date));
  return rules;
}
