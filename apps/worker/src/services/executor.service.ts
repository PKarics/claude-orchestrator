import { query, type SDKMessage } from '@anthropic-ai/claude-agent-sdk';
import { TaskResult } from '@claude-orchestrator/shared';

export class ExecutorService {
  /**
   * Execute a prompt using Claude Agent SDK
   * @param prompt The prompt/task to execute
   * @param timeout Timeout in seconds
   * @returns TaskResult with stdout, stderr, and exitCode
   */
  async executePrompt(prompt: string, timeout: number): Promise<TaskResult> {
    const messages: SDKMessage[] = [];
    const abortController = new AbortController();

    // Set timeout
    const timeoutHandle = setTimeout(() => {
      abortController.abort();
    }, timeout * 1000);

    try {
      // Execute prompt using Claude Agent SDK
      for await (const message of query({
        prompt,
        abortController,
        options: {
          maxTurns: 10,
          allowedTools: ['Read', 'Write', 'Edit', 'Bash', 'Glob', 'Grep'],
        },
      })) {
        messages.push(message);
      }

      clearTimeout(timeoutHandle);

      // Extract result from messages
      const stdout = this.extractOutput(messages);
      const stderr = this.extractErrors(messages);
      const exitCode = abortController.signal.aborted ? 124 : 0; // 124 is timeout exit code

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