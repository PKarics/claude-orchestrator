import { useState } from 'react';
import type { CreateTaskDto } from '../types';

interface CreateTaskFormProps {
  onSubmit: (task: CreateTaskDto) => Promise<void>;
}

export function CreateTaskForm({ onSubmit }: CreateTaskFormProps) {
  const [code, setCode] = useState('');
  const [prompt, setPrompt] = useState('');
  const [timeout, setTimeout] = useState('60');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      await onSubmit({
        prompt,
        code: code || undefined,
        timeout: parseInt(timeout),
      });
      // Reset form on success
      setCode('');
      setPrompt('');
      setTimeout('60');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create task');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="section">
      <h2>Create Task</h2>
      {error && <div className="error-message">{error}</div>}
      <form className="form" onSubmit={handleSubmit}>
        <div className="form-group">
          <label htmlFor="prompt">Prompt (required)</label>
          <textarea
            id="prompt"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Enter task prompt for Claude Code"
            required
            rows={3}
          />
        </div>
        <div className="form-group">
          <label htmlFor="code">Code (optional)</label>
          <textarea
            id="code"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="Optional code to execute"
            rows={5}
          />
        </div>
        <div className="form-group">
          <label htmlFor="timeout">Timeout (seconds)</label>
          <input
            type="number"
            id="timeout"
            value={timeout}
            onChange={(e) => setTimeout(e.target.value)}
            placeholder="60"
            min="1"
          />
        </div>
        <button
          type="submit"
          className="btn btn-primary"
          disabled={isSubmitting}
        >
          {isSubmitting ? 'Creating...' : 'Create Task'}
        </button>
      </form>
    </div>
  );
}
