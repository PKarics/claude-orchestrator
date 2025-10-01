import { TaskStatus } from '@claude-orchestrator/shared';

export interface QueueJobData {
  taskId: string;
  prompt: string;
}

export interface QueueJobResult {
  taskId: string;
  workerId: string;
  status: 'completed' | 'failed';
  result?: string;
  errorMessage?: string;
  executionTime?: number;
}

export interface QueueStats {
  waiting: number;
  active: number;
  completed: number;
  failed: number;
  delayed?: number;
}