import type { Rule, CheckResult, ScanSummary } from './types.js';
import { checkPackages } from './checks/packages.js';
import { checkFiles } from './checks/files.js';
import { checkNetwork } from './checks/network.js';
import { checkProcesses } from './checks/processes.js';
import { checkCache } from './checks/cache.js';
import * as ui from './ui.js';

interface ScanOptions {
  rules: Rule[];
  projectDirs: string[];
  ci: boolean;
}

interface CheckDef {
  title: string;
  icon: string;
  passMessage: string;
  run: () => CheckResult[];
}

export async function scan(options: ScanOptions): Promise<ScanSummary> {
  const { rules, projectDirs, ci } = options;
  const allResults: CheckResult[] = [];

  const checks: CheckDef[] = [
    {
      title: 'COMPROMISED PACKAGES',
      icon: '\uD83D\uDCE6',
      passMessage: `All ${projectDirs.length} projects clean — no compromised packages`,
      run: () => checkPackages(rules, projectDirs),
    },
    {
      title: 'MALWARE FILES',
      icon: '\uD83D\uDC80',
      passMessage: 'No malware artifacts found on disk',
      run: () => checkFiles(rules),
    },
    {
      title: 'NETWORK CONNECTIONS',
      icon: '\uD83C\uDF10',
      passMessage: 'No active C2 connections detected',
      run: () => checkNetwork(rules),
    },
    {
      title: 'SUSPICIOUS PROCESSES',
      icon: '\u2699\uFE0F ',
      passMessage: 'No suspicious processes detected',
      run: () => checkProcesses(rules),
    },
    {
      title: 'PACKAGE MANAGER CACHES',
      icon: '\uD83D\uDCC1',
      passMessage: 'All package manager caches are clean',
      run: () => checkCache(rules),
    },
  ];

  const totalChecks = checks.length;

  for (let i = 0; i < checks.length; i++) {
    const check = checks[i];

    if (!ci) ui.sectionHeader(i + 1, totalChecks, check.title, check.icon);
    if (!ci) ui.spinnerStart(`Running ${check.title.toLowerCase()} check...`);

    const results = check.run();
    allResults.push(...results);

    if (!ci) ui.spinnerStop();
    if (!ci) displayResults(results, check.passMessage);
  }

  return buildSummary(allResults, projectDirs.length, rules.length, totalChecks);
}

function displayResults(results: CheckResult[], passMessage: string): void {
  if (results.filter((r) => r.type === 'fail' || r.type === 'warn').length === 0) {
    ui.result('pass', passMessage);
  }
  for (const r of results) {
    ui.result(r.type, r.message);
    if (r.details) ui.resultDetail(r.details);
  }
}

function buildSummary(
  results: CheckResult[],
  projectsScanned: number,
  rulesChecked: number,
  totalChecks: number
): ScanSummary {
  const compromisedProjects = new Set<string>();
  let failCount = 0;
  let warnCount = 0;
  let passCount = 0;

  for (const r of results) {
    if (r.type === 'fail') {
      failCount++;
      if (r.details) {
        const match = r.details.match(/— (.+)$/);
        if (match) compromisedProjects.add(match[1]);
      }
    } else if (r.type === 'warn') {
      warnCount++;
    } else if (r.type === 'pass') {
      passCount++;
    }
  }

  return {
    projectsScanned,
    rulesChecked,
    totalChecks: results.length || totalChecks,
    passed: results.length === 0 ? totalChecks : passCount,
    failed: failCount,
    warnings: warnCount,
    results,
    compromisedProjects: Array.from(compromisedProjects),
  };
}
