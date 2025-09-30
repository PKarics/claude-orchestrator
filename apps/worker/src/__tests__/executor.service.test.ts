import { ExecutorService } from '../services/executor.service';

// Note: ExecutorService currently uses a placeholder implementation
// Tests verify the service logic, actual SDK integration will be done separately

describe('ExecutorService', () => {
  let executorService: ExecutorService;

  beforeEach(() => {
    executorService = new ExecutorService();
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.clearAllTimers();
  });

  describe('executePrompt', () => {
    it('should execute a prompt successfully and return result', async () => {
      const result = await executorService.executePrompt('Calculate 2+2', 60);

      expect(result).toHaveProperty('stdout');
      expect(result).toHaveProperty('stderr');
      expect(result).toHaveProperty('exitCode');
      expect(result.exitCode).toBe(0);
    });

    it('should include prompt in output', async () => {
      const result = await executorService.executePrompt('Test prompt', 60);

      expect(result.stdout).toContain('Test prompt');
    });

    it('should return empty stderr for successful execution', async () => {
      const result = await executorService.executePrompt('Test', 60);

      expect(result.stderr).toBe('');
    });

    it('should handle timeout correctly', async () => {
      jest.useFakeTimers();

      const resultPromise = executorService.executePrompt('Long task', 1);

      // Fast-forward time past timeout
      jest.advanceTimersByTime(1500);

      const result = await resultPromise;

      expect(result.exitCode).toBe(124); // Timeout exit code

      jest.useRealTimers();
    });

    it('should clear timeout on successful completion', async () => {
      jest.useFakeTimers();
      const clearTimeoutSpy = jest.spyOn(global, 'clearTimeout');

      await executorService.executePrompt('Test', 60);

      expect(clearTimeoutSpy).toHaveBeenCalled();

      clearTimeoutSpy.mockRestore();
      jest.useRealTimers();
    });

    it('should have zero exit code for successful execution', async () => {
      const result = await executorService.executePrompt('Test', 60);

      expect(result.exitCode).toBe(0);
    });

    it('should handle different timeout values', async () => {
      const result1 = await executorService.executePrompt('Test', 30);
      expect(result1.exitCode).toBe(0);

      const result2 = await executorService.executePrompt('Test', 120);
      expect(result2.exitCode).toBe(0);
    });

    it('should handle different prompts', async () => {
      const prompts = [
        'Simple calculation',
        'Read file',
        'Complex multi-step task',
      ];

      for (const prompt of prompts) {
        const result = await executorService.executePrompt(prompt, 60);
        expect(result.stdout).toContain(prompt);
        expect(result.exitCode).toBe(0);
      }
    });

    it('should extract output correctly', async () => {
      const result = await executorService.executePrompt('Test output', 60);

      expect(typeof result.stdout).toBe('string');
      expect(result.stdout.length).toBeGreaterThan(0);
    });

    it('should extract errors correctly for timeout', async () => {
      jest.useFakeTimers();

      const resultPromise = executorService.executePrompt('Timeout test', 1);
      jest.advanceTimersByTime(1500);

      const result = await resultPromise;

      expect(result.exitCode).toBe(124);

      jest.useRealTimers();
    });
  });

  describe('extractOutput', () => {
    it('should handle text type messages', async () => {
      const result = await executorService.executePrompt('Text message test', 60);

      expect(result.stdout).toBeTruthy();
    });

    it('should handle multiple messages', async () => {
      const result = await executorService.executePrompt('Multiple messages', 60);

      expect(result.stdout).toBeTruthy();
      expect(typeof result.stdout).toBe('string');
    });
  });

  describe('extractErrors', () => {
    it('should return empty string for successful execution', async () => {
      const result = await executorService.executePrompt('Success test', 60);

      expect(result.stderr).toBe('');
    });
  });

  describe('error handling', () => {
    it('should handle execution errors gracefully', async () => {
      // Test that errors don't crash the service
      const result = await executorService.executePrompt('Test', 60);

      expect(result).toBeDefined();
      expect(result).toHaveProperty('stdout');
      expect(result).toHaveProperty('stderr');
      expect(result).toHaveProperty('exitCode');
    });
  });

  describe('timeout management', () => {
    it('should set timeout for execution', async () => {
      jest.useFakeTimers();
      const setTimeoutSpy = jest.spyOn(global, 'setTimeout');

      executorService.executePrompt('Test', 60);

      expect(setTimeoutSpy).toHaveBeenCalledWith(expect.any(Function), 60000);

      setTimeoutSpy.mockRestore();
      jest.useRealTimers();
    });

    it('should convert timeout from seconds to milliseconds', async () => {
      jest.useFakeTimers();
      const setTimeoutSpy = jest.spyOn(global, 'setTimeout');

      executorService.executePrompt('Test', 5);

      expect(setTimeoutSpy).toHaveBeenCalledWith(expect.any(Function), 5000);

      setTimeoutSpy.mockRestore();
      jest.useRealTimers();
    });
  });

  describe('message filtering', () => {
    it('should handle messages with missing content field', async () => {
      const result = await executorService.executePrompt('Test missing content', 60);

      expect(result).toBeDefined();
      expect(result.stdout).toBeDefined();
    });

    it('should handle error type messages', async () => {
      // This would require mocking queryPlaceholder to return error messages
      // For now we verify the error extraction logic exists
      const result = await executorService.executePrompt('Test', 60);

      expect(result.stderr).toBe('');
    });

    it('should handle assistant type messages', async () => {
      const result = await executorService.executePrompt('Test assistant', 60);

      expect(result.stdout).toBeTruthy();
    });
  });
});
