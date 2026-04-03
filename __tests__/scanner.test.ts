import { describe, it, expect, vi, beforeEach } from 'vitest';
import { FIXTURE_RULES } from './helpers.js';
import { loadRules } from '../src/utils.js';

vi.mock('../src/ui.js', () => ({
  c: { red: '', green: '', yellow: '', cyan: '', white: '', dim: '', bold: '', reset: '', bgRed: '', bgGreen: '', bgYellow: '', bgBlue: '' },
  severityColors: {},
  sectionHeader: vi.fn(),
  divider: vi.fn(),
  result: vi.fn(),
  resultDetail: vi.fn(),
  spinnerStart: vi.fn(),
  spinnerStop: vi.fn(),
  progressBar: vi.fn(),
  progressClear: vi.fn(),
  banner: vi.fn(),
  printRuleList: vi.fn(),
  printSummary: vi.fn(),
}));

vi.mock('../src/checks/files.js', () => ({
  checkFiles: vi.fn(() => []),
}));
vi.mock('../src/checks/network.js', () => ({
  checkNetwork: vi.fn(() => []),
}));
vi.mock('../src/checks/processes.js', () => ({
  checkProcesses: vi.fn(() => []),
}));
vi.mock('../src/checks/cache.js', () => ({
  checkCache: vi.fn(() => []),
}));

import { scan } from '../src/scanner.js';
import { checkFiles } from '../src/checks/files.js';
import { checkNetwork } from '../src/checks/network.js';
import * as ui from '../src/ui.js';

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(checkFiles).mockReturnValue([]);
  vi.mocked(checkNetwork).mockReturnValue([]);
});

describe('scan', () => {
  it('returns clean summary when no issues found', async () => {
    const rules = loadRules(FIXTURE_RULES);
    const summary = await scan({ rules, projectDirs: [], ci: false });

    expect(summary.failed).toBe(0);
    expect(summary.warnings).toBe(0);
    expect(summary.rulesChecked).toBe(rules.length);
    expect(summary.compromisedProjects).toEqual([]);
  });

  it('counts failures from check modules', async () => {
    const rules = loadRules(FIXTURE_RULES);
    vi.mocked(checkFiles).mockReturnValue([{
      type: 'fail',
      rule: 'test-rule-2024',
      check: 'files',
      message: 'Malware found: /tmp/test',
      details: 'Test Rule — /some/project',
    }]);

    const summary = await scan({ rules, projectDirs: [], ci: false });
    expect(summary.failed).toBe(1);
    expect(summary.compromisedProjects).toContain('/some/project');
  });

  it('counts warnings separately from failures', async () => {
    const rules = loadRules(FIXTURE_RULES);
    vi.mocked(checkNetwork).mockReturnValue([{
      type: 'warn',
      rule: 'test-rule-2024',
      check: 'network',
      message: 'C2 domain in /etc/hosts',
    }]);

    const summary = await scan({ rules, projectDirs: [], ci: false });
    expect(summary.warnings).toBe(1);
    expect(summary.failed).toBe(0);
  });

  it('suppresses UI in CI mode', async () => {
    const rules = loadRules(FIXTURE_RULES);
    await scan({ rules, projectDirs: [], ci: true });

    expect(ui.sectionHeader).not.toHaveBeenCalled();
    expect(ui.spinnerStart).not.toHaveBeenCalled();
    expect(ui.result).not.toHaveBeenCalled();
  });

  it('calls UI in non-CI mode', async () => {
    const rules = loadRules(FIXTURE_RULES);
    await scan({ rules, projectDirs: [], ci: false });
    expect(ui.sectionHeader).toHaveBeenCalled();
  });
});
