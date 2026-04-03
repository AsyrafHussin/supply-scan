import { describe, it, expect, vi, beforeEach } from 'vitest';
import { FIXTURE_RULES } from './helpers.js';
import { loadRules } from '../src/utils.js';
import type { Rule } from '../src/types.js';

let testRule: Rule;

beforeEach(() => {
  vi.restoreAllMocks();
  const rules = loadRules(FIXTURE_RULES);
  testRule = rules[0];
});

// ─── files.ts ───────────────────────────────────────────────────────

describe('checkFiles', () => {
  it('returns empty when no malware files exist', async () => {
    const { checkFiles } = await import('../src/checks/files.js');
    const results = checkFiles([testRule]);
    // Test rule uses /tmp/__supply-scan-test-malware__ which shouldn't exist
    expect(results).toEqual([]);
  });

  it('returns empty when rule has no file IOCs for this OS', async () => {
    const { checkFiles } = await import('../src/checks/files.js');
    const ruleNoFiles: Rule = {
      ...testRule,
      ioc: { ...testRule.ioc, files: {} },
    };
    expect(checkFiles([ruleNoFiles])).toEqual([]);
  });

  it('returns empty for empty rules', async () => {
    const { checkFiles } = await import('../src/checks/files.js');
    expect(checkFiles([])).toEqual([]);
  });
});

// ─── network.ts ─────────────────────────────────────────────────────

describe('checkNetwork', () => {
  it('returns empty when no C2 connections found', async () => {
    // Mock runCommand to return no connections
    vi.doMock('../src/utils.js', async (importOriginal) => {
      const orig = await importOriginal<typeof import('../src/utils.js')>();
      return { ...orig, runCommand: () => '' };
    });
    const { checkNetwork } = await import('../src/checks/network.js');
    const results = checkNetwork([testRule]);
    // No active connections to test IOC IPs
    const fails = results.filter((r) => r.type === 'fail');
    expect(fails).toEqual([]);
  });

  it('returns empty for rules with no network IOCs', async () => {
    const { checkNetwork } = await import('../src/checks/network.js');
    const ruleNoNet: Rule = {
      ...testRule,
      ioc: { ...testRule.ioc, domains: undefined, ips: undefined },
    };
    expect(checkNetwork([ruleNoNet])).toEqual([]);
  });

  it('returns empty for empty rules', async () => {
    const { checkNetwork } = await import('../src/checks/network.js');
    expect(checkNetwork([])).toEqual([]);
  });
});

// ─── processes.ts ───────────────────────────────────────────────────

describe('checkProcesses', () => {
  it('returns empty when no suspicious processes found', async () => {
    const { checkProcesses } = await import('../src/checks/processes.js');
    const results = checkProcesses([testRule]);
    // Test rule uses __supply-scan-test-evil__ which shouldn't be running
    const fails = results.filter((r) => r.type === 'fail');
    expect(fails).toEqual([]);
  });

  it('returns empty for rules with no process IOCs', async () => {
    const { checkProcesses } = await import('../src/checks/processes.js');
    const ruleNoProc: Rule = {
      ...testRule,
      ioc: { ...testRule.ioc, processes: undefined },
    };
    expect(checkProcesses([ruleNoProc])).toEqual([]);
  });

  it('returns empty for empty rules', async () => {
    const { checkProcesses } = await import('../src/checks/processes.js');
    expect(checkProcesses([])).toEqual([]);
  });
});

// ─── cache.ts ───────────────────────────────────────────────────────

describe('checkCache', () => {
  it('returns empty when cache is clean', async () => {
    const { checkCache } = await import('../src/checks/cache.js');
    const results = checkCache([testRule]);
    // Test rule uses evil-pkg/bad-pkg which shouldn't be in cache
    const fails = results.filter((r) => r.type === 'fail');
    expect(fails).toEqual([]);
  });

  it('returns empty for empty rules', async () => {
    const { checkCache } = await import('../src/checks/cache.js');
    expect(checkCache([])).toEqual([]);
  });
});
