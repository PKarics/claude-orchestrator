import type { TaskStats, Task, Worker, CreateTaskDto } from '../types';

export class ApiService {
  constructor(private baseUrl: string) {}

  async getStats(): Promise<TaskStats> {
    const response = await fetch(`${this.baseUrl}/tasks/stats`);
    if (!response.ok) throw new Error('Failed to fetch stats');
    return response.json();
  }

  async getTasks(limit = 10): Promise<{ tasks: Task[] }> {
    const response = await fetch(`${this.baseUrl}/tasks?limit=${limit}`);
    if (!response.ok) throw new Error('Failed to fetch tasks');
    return response.json();
  }

  async getWorkers(): Promise<{ workers: Worker[] }> {
    const response = await fetch(`${this.baseUrl}/workers`);
    if (!response.ok) throw new Error('Failed to fetch workers');
    return response.json();
  }

  async createTask(task: CreateTaskDto): Promise<Task> {
    const response = await fetch(`${this.baseUrl}/tasks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(task),
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to create task');
    }
    return response.json();
  }

  async healthCheck(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/health`);
      return response.ok;
    } catch {
      return false;
    }
  }
}
