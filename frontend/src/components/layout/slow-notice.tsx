'use client';

import * as React from 'react';
import { Loader2 } from 'lucide-react';

function SlowMessage({ afterMs }: { afterMs: number }) {
  const [slow, setSlow] = React.useState(false);
  React.useEffect(() => {
    const t = setTimeout(() => setSlow(true), afterMs);
    return () => clearTimeout(t);
  }, [afterMs]);
  if (!slow) return null;
  return (
    <p role="status" className="flex items-center justify-center gap-2 text-[13px] text-ink-muted">
      <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
      Waking up the server - on free hosting the first request can take up to a minute.
    </p>
  );
}

/**
 * Free hosting spins the API down when idle; after a few seconds of waiting we say why instead of looking frozen.
 * The timer lives in a child that only exists while `active`, so its state resets by unmounting.
 */
export function SlowNotice({ active, afterMs = 4000 }: { active: boolean; afterMs?: number }) {
  return active ? <SlowMessage afterMs={afterMs} /> : null;
}
