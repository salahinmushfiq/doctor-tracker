import { cn } from '@/lib/utils';

export function Card({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('rounded-xl border border-line bg-surface', className)} {...props} />;
}

export function CardHeader({ title, description, action, id }: { title: string; description?: string; action?: React.ReactNode; id?: string }) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-2 border-b border-line px-5 py-4">
      <div>
        <h2 id={id} className="text-base font-semibold text-ink">
          {title}
        </h2>
        {description && <p className="mt-0.5 text-[13px] text-ink-muted">{description}</p>}
      </div>
      {action}
    </div>
  );
}
