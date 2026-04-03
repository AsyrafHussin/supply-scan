import { readFileSync } from 'node:fs';
import type { Rule, CheckResult } from '../types.js';
import { getOS, runCommand } from '../utils.js';

/**
 * Check for active C2 connections and network IOCs.
 */
export function checkNetwork(rules: Rule[]): CheckResult[] {
  const results: CheckResult[] = [];
  const os = getOS();

  // Collect all C2 IPs and domains from rules
  const allIPs = new Set<string>();
  const allDomains = new Set<string>();
  const ruleByIOC = new Map<string, string>();

  for (const rule of rules) {
    for (const ip of rule.ioc.ips ?? []) {
      allIPs.add(ip);
      ruleByIOC.set(ip, rule.id);
    }
    for (const domain of rule.ioc.domains ?? []) {
      allDomains.add(domain);
      ruleByIOC.set(domain, rule.id);
    }
  }

  if (allIPs.size === 0 && allDomains.size === 0) return results;

  // Check active connections
  const connections = getActiveConnections(os);
  for (const ip of allIPs) {
    if (connections.includes(ip)) {
      results.push({
        type: 'fail',
        rule: ruleByIOC.get(ip) || 'unknown',
        check: 'network',
        message: `Active connection to C2 IP: ${ip}`,
        details: 'Disconnect from network immediately!',
      });
    }
  }

  for (const domain of allDomains) {
    if (connections.includes(domain)) {
      results.push({
        type: 'fail',
        rule: ruleByIOC.get(domain) || 'unknown',
        check: 'network',
        message: `Active connection to C2 domain: ${domain}`,
        details: 'Disconnect from network immediately!',
      });
    }
  }

  // Check /etc/hosts
  checkHostsFile(allIPs, allDomains, ruleByIOC, results);

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
  ips: Set<string>,
  domains: Set<string>,
  ruleByIOC: Map<string, string>,
  results: CheckResult[]
): void {
  try {
    const hosts = readFileSync('/etc/hosts', 'utf-8');
    for (const ip of ips) {
      if (hosts.includes(ip)) {
        results.push({
          type: 'warn',
          rule: ruleByIOC.get(ip) || 'unknown',
          check: 'network',
          message: `C2 IP ${ip} found in /etc/hosts`,
        });
      }
    }
    for (const domain of domains) {
      if (hosts.includes(domain)) {
        results.push({
          type: 'warn',
          rule: ruleByIOC.get(domain) || 'unknown',
          check: 'network',
          message: `C2 domain ${domain} found in /etc/hosts`,
        });
      }
    }
  } catch {
    // Can't read hosts file
  }
}
