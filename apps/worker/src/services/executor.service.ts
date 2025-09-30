import { TaskResult } from '@claude-orchestrator/shared';

// Type definitions for Claude Agent SDK (to be replaced with actual SDK types when available)
type SDKMessage = {
  type: string;
  content?: string;
  [key: string]: any;
};

type QueryOptions = {
  prompt: string;
  options?: {
    maxTurns?: number;
    allowedTools?: string[];
  };
};

// Placeholder for query function - will be replaced with actual SDK implementation
async function* queryPlaceholder(options: QueryOptions): AsyncGenerator<SDKMessage> {
  // This is a placeholder implementation
  // Real implementation will use @anthropic-ai/claude-agent-sdk
  yield {
    type: 'text',
    content: `Placeholder response for: ${options.prompt}`,
  };
}

export class ExecutorService {
  /**
   * Execute a prompt using Claude Agent SDK
   * @param prompt The prompt/task to execute
   * @param timeout Timeout in seconds
   * @returns TaskResult with stdout, stderr, and exitCode
   */
  async executePrompt(prompt: string, timeout: number): Promise<TaskResult> {
    const messages: SDKMessage[] = [];
    let aborted = false;

    // Set timeout
    const timeoutHandle = setTimeout(() => {
      aborted = true;
    }, timeout * 1000);

    try {
      // Execute prompt using Claude Agent SDK placeholder
      for await (const message of queryPlaceholder({
        prompt,
        options: {
          maxTurns: 10,
          allowedTools: ['Read', 'Write', 'Edit', 'Bash', 'Glob', 'Grep'],
        },
      })) {
        if (aborted) break;
        messages.push(message);
      }

      clearTimeout(timeoutHandle);

      // Extract result from messages
      const stdout = this.extractOutput(messages);
      const stderr = this.extractErrors(messages);
      const exitCode = aborted ? 124 : 0; // 124 is timeout exit code

      return { stdout, stderr, exitCode };
    } catch (error) {
      clearTimeout(timeoutHandle);

      return {
        stdout: '',
        stderr: error instanceof Error ? error.message : String(error),
        exitCode: 1,
      };
    }
  }

  /**
   * Extract output text from SDK messages
   */
  private extractOutput(messages: SDKMessage[]): string {
    return messages
      .filter((msg) => msg.type === 'text' || msg.type === 'assistant')
      .map((msg) => ('content' in msg ? msg.content : ''))
      .join('\n');
  }

  /**
   * Extract error messages from SDK messages
   */
  private extractErrors(messages: SDKMessage[]): string {
    return messages
      .filter((msg) => msg.type === 'error')
      .map((msg) => ('content' in msg ? msg.content : ''))
      .join('\n');
  }
}