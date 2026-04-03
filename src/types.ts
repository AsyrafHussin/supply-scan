// ─── Rule Schema ────────────────────────────────────────────────────

export interface Rule {
  id: string;
  name: string;
  date: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  description: string;
  references: string[];
  packages: {
    compromised: Record<string, string[]>;
    malicious: Record<string, string[]>;
  };
  ioc: {
    files?: Record<string, string[]>;
    domains?: string[];
    ips?: string[];
    ports?: number[];
    processes?: string[];
    strings?: string[];
  };
}

// ─── Scan Results ───────────────────────────────────────────────────

export type ResultType = 'pass' | 'fail' | 'warn' | 'info';

export interface CheckResult {
  type: ResultType;
  rule: string;
  check: string;
  message: string;
  details?: string;
}

export interface ScanSummary {
  projectsScanned: number;
  rulesChecked: number;
  totalChecks: number;
  passed: number;
  failed: number;
  warnings: number;
  results: CheckResult[];
  compromisedProjects: string[];
}

// ─── CLI Options ────────────────────────────────────────────────────

export interface CLIOptions {
  rules: string[];
  all: boolean;
  list: boolean;
  path: string | null;
  ci: boolean;
  help: boolean;
  version: boolean;
}

