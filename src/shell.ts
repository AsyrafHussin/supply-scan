import { execSync, execFileSync } from 'node:child_process';

const TIMEOUT = 10000;

export function runCommand(cmd: string): string {
  try {
    return execSync(cmd, { encoding: 'utf-8', timeout: TIMEOUT, stdio: ['pipe', 'pipe', 'pipe'] }).trim();
  } catch {
    return '';
  }
}

export function runSafe(cmd: string, args: string[]): string {
  try {
    return execFileSync(cmd, args, { encoding: 'utf-8', timeout: TIMEOUT, stdio: ['pipe', 'pipe', 'pipe'] }).trim();
  } catch {
    return '';
  }
}
