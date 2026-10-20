import { AlertTriangle, X } from 'lucide-react';
import type { ImportIssue } from '../types/image';

interface ImportIssuesProps {
  issues: ImportIssue[];
  onDismiss: (id: string) => void;
  onClear: () => void;
}

export function ImportIssues({ issues, onDismiss, onClear }: ImportIssuesProps) {
  if (issues.length === 0) return null;

  return (
    <section className="import-issues" aria-labelledby="import-issues-title">
      <div className="import-issues-head">
        <div>
          <AlertTriangle size={18} aria-hidden="true" />
          <h2 id="import-issues-title">Upload notices</h2>
          <span className="count-badge">{issues.length}</span>
        </div>
        <button type="button" className="text-button" onClick={onClear}>
          Clear all
        </button>
      </div>
      <ul>
        {issues.map((issue) => (
          <li key={issue.id}>
            <span>
              <strong>{issue.filename}</strong>
              {issue.message}
            </span>
            <button
              type="button"
              className="icon-button tiny"
              onClick={() => onDismiss(issue.id)}
              aria-label={`Dismiss notice for ${issue.filename}`}
            >
              <X size={15} />
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
