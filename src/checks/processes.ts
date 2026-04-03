import type { Rule, CheckResult } from '../types.js';
import { getOS, dirExists, escapeRegex } from '../utils.js';
import { runCommand, runSafe } from '../shell.js';

export function checkProcesses(rules: Rule[]): CheckResult[] {
  const results: CheckResult[] = [];
  const os = getOS();

  // Collect process patterns — support multiple rules per pattern
  const rulesByProcess = new Map<string, string[]>();

  for (const rule of rules) {
    for (const proc of rule.ioc.processes ?? []) {
      const arr = rulesByProcess.get(proc) || [];
      arr.push(rule.id);
      rulesByProcess.set(proc, arr);
    }
  }

  if (rulesByProcess.size === 0) return results;

  const processLines = getProcessList(os).split('\n');
  if (processLines.length === 0) return results;

  for (const [pattern, ruleIds] of rulesByProcess) {
    // Use word-boundary regex to avoid partial matches
    // e.g., "ld.py" should not match "/usr/build.py"
    const regex = new RegExp(`(?:^|[\\s/])${escapeRegex(pattern)}(?:\\s|$)`);
    if (processLines.some((line) => regex.test(line))) {
      results.push({
        type: 'fail',
        rule: ruleIds[0],
        check: 'processes',
        message: `Suspicious process running: ${pattern}`,
        details: `Rules: ${ruleIds.join(', ')} — May indicate active compromise`,
      });
    }
  }

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
  const hits = runSafe('grep', ['-rlE', pattern, ...existingDirs]);

  if (hits) {
    for (const file of hits.split('\n').filter(Boolean)) {
      const content = runSafe('cat', [file]);
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
