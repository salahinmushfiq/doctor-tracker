import { AlertTriangle, Inbox } from 'lucide-react';
import { Button } from './button';

export function EmptyState({ title, description, action, icon }: { title: string; description?: string; action?: React.ReactNode; icon?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 px-6 py-14 text-center">
      <div className="flex h-11 w-11 items-center justify-center rounded-full bg-surface-muted text-ink-muted" aria-hidden>
        {icon ?? <Inbox className="h-5 w-5" />}
      </div>
      <h3 className="text-base font-semibold text-ink">{title}</h3>
      {description && <p className="max-w-sm text-sm text-ink-muted">{description}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

export function ErrorState({ title = 'Something went wrong', message, onRetry, retrying }: { title?: string; message: string; onRetry?: () => void; retrying?: boolean }) {
  return (
    <div role="alert" className="flex flex-col items-center justify-center gap-2 px-6 py-14 text-center">
      <div className="flex h-11 w-11 items-center justify-center rounded-full bg-danger-soft text-danger" aria-hidden>
        <AlertTriangle className="h-5 w-5" />
      </div>
      <h3 className="text-base font-semibold text-ink">{title}</h3>
      <p className="max-w-sm text-sm text-ink-muted">{message}</p>
      {onRetry && (
        <Button variant="secondary" size="sm" className="mt-2" onClick={onRetry} loading={retrying}>
          Try again
        </Button>
      )}
    </div>
  );
}
