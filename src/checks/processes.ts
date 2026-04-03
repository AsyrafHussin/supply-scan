import type { Rule, CheckResult } from '../types.js';
import { getOS, runCommand, dirExists } from '../utils.js';

/**
 * Check for known malicious processes running on the system.
 */
export function checkProcesses(rules: Rule[]): CheckResult[] {
  const results: CheckResult[] = [];
  const os = getOS();

  // Collect all process patterns from rules
  const processPatterns = new Map<string, string>(); // pattern -> ruleId

  for (const rule of rules) {
    for (const proc of rule.ioc.processes ?? []) {
      processPatterns.set(proc, rule.id);
    }
  }

  if (processPatterns.size === 0) return results;

  // Get running processes
  const processList = getProcessList(os);
  if (!processList) return results;

  for (const [pattern, ruleId] of processPatterns) {
    if (processList.includes(pattern)) {
      results.push({
        type: 'fail',
        rule: ruleId,
        check: 'processes',
        message: `Suspicious process running: ${pattern}`,
        details: 'This may indicate an active compromise',
      });
    }
  }

  // Check macOS persistence mechanisms
  if (os === 'darwin') {
    checkMacOSPersistence(rules, results);
  }

  return results;
}

function getProcessList(os: string): string {
  if (os === 'darwin' || os === 'linux') {
    return runCommand('ps aux 2>/dev/null');
  } else if (os === 'win32') {
    return runCommand('tasklist /v 2>nul');
  }
  return '';
}

function checkMacOSPersistence(rules: Rule[], results: CheckResult[]): void {
  const launchDirs = [
    `${process.env.HOME}/Library/LaunchAgents`,
    '/Library/LaunchAgents',
    '/Library/LaunchDaemons',
  ];

  // Collect all IOC strings to search for
  const searchStrings = new Map<string, string>();
  for (const rule of rules) {
    for (const s of rule.ioc.strings ?? []) {
      searchStrings.set(s, rule.id);
    }
    for (const domain of rule.ioc.domains ?? []) {
      searchStrings.set(domain, rule.id);
    }
    for (const ip of rule.ioc.ips ?? []) {
      searchStrings.set(ip, rule.id);
    }
  }

  const existingDirs = launchDirs.filter(dirExists);
  if (existingDirs.length === 0 || searchStrings.size === 0) return;

  const pattern = Array.from(searchStrings.keys()).join('|');
  const hits = runCommand(
    `grep -rlE "${pattern}" ${existingDirs.map((d) => `"${d}"`).join(' ')} 2>/dev/null`
  );

  if (hits) {
    for (const file of hits.split('\n').filter(Boolean)) {
      // Find which rule matched
      const content = runCommand(`cat "${file}" 2>/dev/null`);
      let matchedRule = 'unknown';
      for (const [s, ruleId] of searchStrings) {
        if (content.includes(s)) { matchedRule = ruleId; break; }
      }
      results.push({
        type: 'fail',
        rule: matchedRule,
        check: 'processes',
        message: `Suspicious LaunchAgent/Daemon: ${file}`,
        details: 'May indicate malware persistence',
      });
    }
  }
}
