import { spawn } from 'child_process';
import { writeFileSync, unlinkSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { randomUUID } from 'crypto';

export interface TaskResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

export class ExecutorService {
  async executeCode(code: string, timeout: number): Promise<TaskResult> {
    const tempFile = join(tmpdir(), `task-${randomUUID()}.js`);

    try {
      writeFileSync(tempFile, code);
      return await this.runProcess(tempFile, timeout);
    } finally {
      try {
        unlinkSync(tempFile);
      } catch {
        // Ignore cleanup errors
      }
    }
  }

  private runProcess(file: string, timeout: number): Promise<TaskResult> {
    return new Promise((resolve, reject) => {
      let stdout = '';
      let stderr = '';

      const child = spawn('node', [file], { timeout: timeout * 1000 });
      const timeoutHandle = setTimeout(() => child.kill('SIGKILL'), timeout * 1000);

      child.stdout.on('data', (data) => (stdout += data.toString()));
      child.stderr.on('data', (data) => (stderr += data.toString()));

      child.on('close', (code) => {
        clearTimeout(timeoutHandle);
        resolve({ stdout, stderr, exitCode: code || 0 });
      });

      child.on('error', (err) => {
        clearTimeout(timeoutHandle);
        reject(err);
      });
    });
  }
}