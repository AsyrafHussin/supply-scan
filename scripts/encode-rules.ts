#!/usr/bin/env npx tsx
/**
 * Encode sensitive IOC fields in rule JSON files to Base64.
 * This prevents macOS XProtect from flagging the package as malware
 * when it contains C2 domains, malware paths, and IP addresses.
 *
 * Usage: npx tsx scripts/encode-rules.ts
 *
 * Encoded fields: ioc.domains, ioc.ips, ioc.files, ioc.processes, ioc.strings
 * Encoding marker: rules with "encoded": true are already encoded.
 */

import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const RULES_DIR = join(__dirname, '..', 'rules');

function encodeStr(s: string): string {
  return Buffer.from(s).toString('base64');
}

function encodeArray(arr: string[]): string[] {
  return arr.map(encodeStr);
}

function encodeRecord(rec: Record<string, string[]>): Record<string, string[]> {
  const result: Record<string, string[]> = {};
  for (const [key, vals] of Object.entries(rec)) {
    result[key] = encodeArray(vals);
  }
  return result;
}

const files = readdirSync(RULES_DIR).filter((f) => f.endsWith('.json'));

for (const file of files) {
  const path = join(RULES_DIR, file);
  const rule = JSON.parse(readFileSync(path, 'utf-8'));

  if (rule.encoded) {
    console.log(`  skip: ${file} (already encoded)`);
    continue;
  }

  const ioc = rule.ioc;
  if (!ioc) continue;

  if (ioc.domains) ioc.domains = encodeArray(ioc.domains);
  if (ioc.ips) ioc.ips = encodeArray(ioc.ips);
  if (ioc.processes) ioc.processes = encodeArray(ioc.processes);
  if (ioc.strings) ioc.strings = encodeArray(ioc.strings);
  if (ioc.files) ioc.files = encodeRecord(ioc.files);

  rule.encoded = true;
  writeFileSync(path, JSON.stringify(rule, null, 2) + '\n');
  console.log(`  done: ${file}`);
}

console.log('\nAll rules encoded.');
