import { TaskResult } from '@claude-orchestrator/shared';
import { query } from '@anthropic-ai/claude-agent-sdk';

// Type for SDK messages (inferred from SDK usage)
type SDKMessage = {
  type: string;
  content?: string;
  [key: string]: any;
};

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
    let hasErrors = false;

    // Set timeout
    const timeoutHandle = setTimeout(() => {
      aborted = true;
    }, timeout * 1000);

    try {
      // Execute prompt using Claude Agent SDK
      for await (const message of query({
        prompt,
        options: {
          maxTurns: 10,
          allowedTools: ['Read', 'Write', 'Edit', 'Bash', 'Glob', 'Grep'],
        },
      })) {
        if (aborted) break;
        messages.push(message as SDKMessage);

        // Track if there are any errors
        if (message.type === 'result' && 'error' in message) {
          hasErrors = true;
        }
      }

      clearTimeout(timeoutHandle);

      // Extract result from messages
      const stdout = this.extractOutput(messages);
      const stderr = this.extractErrors(messages);
      const exitCode = aborted ? 124 : (hasErrors || stderr ? 1 : 0); // 124 is timeout exit code

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
      .filter((msg) => msg.type === 'assistant' || msg.type === 'result')
      .map((msg) => {
        if (msg.type === 'assistant' && msg.content) {
          return msg.content;
        }
        if (msg.type === 'result' && 'output' in msg) {
          return String(msg.output);
        }
        return '';
      })
      .filter(Boolean)
      .join('\n');
  }

  /**
   * Extract error messages from SDK messages
   */
  private extractErrors(messages: SDKMessage[]): string {
    const errors: string[] = [];

    for (const msg of messages) {
      if (msg.type === 'result' && 'error' in msg) {
        errors.push(String(msg.error));
      }
    }

    return errors.join('\n');
  }
}