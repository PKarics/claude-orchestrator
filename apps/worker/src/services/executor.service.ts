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

        // Log message type for debugging
        console.log(`[Executor] Received message type: ${message.type}`);

        messages.push(message as SDKMessage);

        // Track if there are any errors
        if (message.type === 'result' && 'error' in message) {
          hasErrors = true;
        }
      }

      clearTimeout(timeoutHandle);

      // Log all message types for debugging
      console.log('[Executor] Total messages received:', messages.length);
      console.log('[Executor] Message types:', messages.map(m => m.type).join(', '));

      // Log full message structure for ALL messages
      messages.forEach((msg, idx) => {
        console.log(`[Executor] Message ${idx} (${msg.type}):`, JSON.stringify(msg, null, 2));
      });

      // Extract result from messages
      const stdout = this.extractOutput(messages);
      const stderr = this.extractErrors(messages);
      const exitCode = aborted ? 124 : (hasErrors || stderr ? 1 : 0); // 124 is timeout exit code

      console.log('[Executor] Extracted stdout length:', stdout.length);
      console.log('[Executor] Extracted stderr length:', stderr.length);

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
    // First, check if there's a result message (final summary)
    // If so, use only that to avoid duplication
    const resultMessage = messages.find(msg => msg.type === 'result');
    if (resultMessage && resultMessage.result) {
      return String(resultMessage.result);
    }

    // Fallback: extract from assistant messages if no result message
    const outputs: string[] = [];
    for (const msg of messages) {
      if (msg.type === 'assistant' && msg.message?.content) {
        const content = msg.message.content;
        if (Array.isArray(content)) {
          for (const item of content) {
            if (item.type === 'text' && item.text) {
              outputs.push(String(item.text));
            }
          }
        }
      }
    }

    return outputs.filter(Boolean).join('\n\n');
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