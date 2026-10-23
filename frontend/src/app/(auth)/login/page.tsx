'use client';

import * as React from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { AlertCircle, CheckCircle2, Info, Stethoscope } from 'lucide-react';
import { SlowNotice } from '@/components/layout/slow-notice';
import { Button } from '@/components/ui/button';
import { Field, Input } from '@/components/ui/field';
import { ApiError, describeError } from '@/lib/api-client';
import { safeNext } from '@/lib/utils';
import { useAuth } from '@/providers/auth-provider';

const schema = z.object({
  email: z.string().trim().min(1, 'Enter your email address').pipe(z.email('Enter a valid email address')),
  password: z.string().min(1, 'Enter your password'),
});
type FormValues = z.infer<typeof schema>;

const NOTICES = {
  expired: { tone: 'warning', text: 'Your session has expired. Please sign in again.' },
  signedout: { tone: 'success', text: 'You have been signed out.' },
  denied: { tone: 'warning', text: 'You do not have access to that page.' },
} as const;

function LoginForm() {
  const auth = useAuth();
  const router = useRouter();
  const params = useSearchParams();
  const reason = params.get('reason') as keyof typeof NOTICES | null;
  const next = safeNext(params.get('next'));
  const [formError, setFormError] = React.useState<string | null>(null);

  const { register, handleSubmit, formState } = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: { email: '', password: '' } });
  const { errors, isSubmitting } = formState;

  // Already signed in (e.g. opened /login in a second tab): skip the form.
  React.useEffect(() => {
    if (auth.status === 'authenticated') router.replace(next);
  }, [auth.status, next, router]);

  const onSubmit = handleSubmit(async ({ email, password }) => {
    setFormError(null);
    try {
      await auth.login(email, password);
      router.replace(next);
    } catch (err) {
      setFormError(err instanceof ApiError && err.code === 'INVALID_CREDENTIALS' ? 'Invalid email or password.' : describeError(err));
    }
  });

  const notice = reason && reason in NOTICES ? NOTICES[reason] : null;

  return (
    <div className="w-full max-w-sm">
      <div className="mb-8 flex flex-col items-center gap-3 text-center">
        <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-accent text-white" aria-hidden>
          <Stethoscope className="h-6 w-6" />
        </span>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-ink">Sign in to Doctor Tracker</h1>
          <p className="mt-1 text-sm text-ink-muted">Use the account provided by your administrator.</p>
        </div>
      </div>

      <div className="rounded-xl border border-line bg-surface p-6">
        {notice && (
          <div role="status" className={`mb-4 flex items-start gap-2 rounded-lg px-3 py-2.5 text-sm ${notice.tone === 'success' ? 'bg-success-soft text-success' : 'bg-warning-soft text-warning'}`}>
            {notice.tone === 'success' ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" aria-hidden /> : <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />}
            {notice.text}
          </div>
        )}
        {formError && (
          <div role="alert" className="mb-4 flex items-start gap-2 rounded-lg bg-danger-soft px-3 py-2.5 text-sm text-danger">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
            {formError}
          </div>
        )}
        <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
          <Field id="email" label="Email" error={errors.email?.message} required>
            {(p) => <Input {...p} type="email" autoComplete="username" inputMode="email" autoFocus {...register('email')} />}
          </Field>
          <Field id="password" label="Password" error={errors.password?.message} required>
            {(p) => <Input {...p} type="password" autoComplete="current-password" {...register('password')} />}
          </Field>
          <Button type="submit" loading={isSubmitting} className="mt-1 w-full">
            {isSubmitting ? 'Signing in...' : 'Sign in'}
          </Button>
          <SlowNotice active={isSubmitting} />
        </form>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <main id="main" className="flex min-h-screen items-center justify-center px-4 py-10">
      <React.Suspense fallback={null}>
        <LoginForm />
      </React.Suspense>
    </main>
  );
}
