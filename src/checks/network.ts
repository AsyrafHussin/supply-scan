import { readFileSync } from 'node:fs';
import type { Rule, CheckResult } from '../types.js';
import { getOS, escapeRegex } from '../utils.js';
import { runCommand } from '../shell.js';

export function checkNetwork(rules: Rule[]): CheckResult[] {
  const results: CheckResult[] = [];
  const os = getOS();

  // Collect all C2 IPs and domains — support multiple rules per IOC
  const rulesByIP = new Map<string, string[]>();
  const rulesByDomain = new Map<string, string[]>();

  for (const rule of rules) {
    for (const ip of rule.ioc.ips ?? []) {
      const arr = rulesByIP.get(ip) || [];
      arr.push(rule.id);
      rulesByIP.set(ip, arr);
    }
    for (const domain of rule.ioc.domains ?? []) {
      const arr = rulesByDomain.get(domain) || [];
      arr.push(rule.id);
      rulesByDomain.set(domain, arr);
    }
  }

  if (rulesByIP.size === 0 && rulesByDomain.size === 0) return results;

  // Check active connections line-by-line for exact matches
  const connectionLines = getActiveConnections(os).split('\n');

  for (const [ip, ruleIds] of rulesByIP) {
    // Use word-boundary regex to avoid partial IP matches (e.g., 1.2.3.4 matching 21.2.3.40)
    const pattern = new RegExp(`(?:^|[\\s:])${escapeRegex(ip)}(?:[\\s:]|$)`);
    if (connectionLines.some((line) => pattern.test(line))) {
      results.push({
        type: 'fail',
        rule: ruleIds[0],
        check: 'network',
        message: `Active connection to C2 IP: ${ip}`,
        details: `Rules: ${ruleIds.join(', ')} — Disconnect from network immediately!`,
      });
    }
  }

  for (const [domain, ruleIds] of rulesByDomain) {
    const pattern = new RegExp(`(?:^|[\\s:])${escapeRegex(domain)}(?:[\\s:.]|$)`);
    if (connectionLines.some((line) => pattern.test(line))) {
      results.push({
        type: 'fail',
        rule: ruleIds[0],
        check: 'network',
        message: `Active connection to C2 domain: ${domain}`,
        details: `Rules: ${ruleIds.join(', ')} — Disconnect from network immediately!`,
      });
    }
  }

  checkHostsFile(os, rulesByIP, rulesByDomain, results);

  return results;
}

function getActiveConnections(os: string): string {
  if (os === 'darwin' || os === 'linux') {
    return runCommand('lsof -i -n -P 2>/dev/null || netstat -an 2>/dev/null');
  } else if (os === 'win32') {
    return runCommand('netstat -an');
  }
  return '';
}

function checkHostsFile(
  os: string,
  ips: Map<string, string[]>,
  domains: Map<string, string[]>,
  results: CheckResult[]
): void {
  const hostsPath = os === 'win32'
    ? 'C:\\Windows\\System32\\drivers\\etc\\hosts'
    : '/etc/hosts';

  try {
    const hostsLines = readFileSync(hostsPath, 'utf-8').split('\n');
    for (const [ip, ruleIds] of ips) {
      const pattern = new RegExp(`(?:^|\\s)${escapeRegex(ip)}(?:\\s|$)`);
      if (hostsLines.some((line) => pattern.test(line))) {
        results.push({
          type: 'warn',
          rule: ruleIds[0],
          check: 'network',
          message: `C2 IP ${ip} found in hosts file`,
        });
      }
    }
    for (const [domain, ruleIds] of domains) {
      const pattern = new RegExp(`(?:^|\\s)${escapeRegex(domain)}(?:\\s|$)`);
      if (hostsLines.some((line) => pattern.test(line))) {
        results.push({
          type: 'warn',
          rule: ruleIds[0],
          check: 'network',
          message: `C2 domain ${domain} found in hosts file`,
        });
      }
    }
  } catch {
    // Can't read hosts file
  }
}
