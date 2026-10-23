'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Pencil, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardHeader } from '@/components/ui/card';
import { ConfirmDialog } from '@/components/ui/dialog';
import { PageHeader } from '@/components/ui/page-header';
import { Skeleton } from '@/components/ui/skeleton';
import { ErrorState } from '@/components/ui/states';
import { ApiError, describeError } from '@/lib/api-client';
import { ageFrom, formatDate, formatDateTime } from '@/lib/utils';
import { useAuth } from '@/providers/auth-provider';
import { useDeletePatient, usePatient } from './hooks';

const GENDER_LABEL: Record<string, string> = { female: 'Female', male: 'Male', other: 'Other', unspecified: 'Prefer not to say' };

function Item({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-[13px] text-ink-muted">{label}</dt>
      <dd className="mt-0.5 text-sm font-medium text-ink">{children}</dd>
    </div>
  );
}

export function PatientDetail({ id }: { id: string }) {
  const { isAdmin } = useAuth();
  const router = useRouter();
  const { data: p, isPending, error, refetch } = usePatient(id);
  const del = useDeletePatient();
  const [confirm, setConfirm] = React.useState(false);
  const [deleteError, setDeleteError] = React.useState<string | null>(null);

  if (isPending) {
    return (
      <div className="space-y-4" aria-busy="true" aria-label="Loading patient">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-56 w-full" />
      </div>
    );
  }
  if (error || !p) {
    const notFound = error instanceof ApiError && error.status === 404;
    return (
      <Card>
        <ErrorState title={notFound ? 'Patient not found' : undefined} message={notFound ? 'This patient may have been deleted.' : describeError(error)} onRetry={notFound ? undefined : () => void refetch()} />
      </Card>
    );
  }

  const onDelete = async () => {
    setDeleteError(null);
    try {
      await del.mutateAsync(p.id);
      toast.success(`${p.fullName} was deleted.`);
      router.replace('/patients');
    } catch (err) {
      setDeleteError(describeError(err));
    }
  };

  return (
    <>
      <PageHeader
        title={p.fullName}
        description={`${ageFrom(p.dateOfBirth)} years old · ${p.condition}`}
        breadcrumbs={[{ label: 'Patients', href: '/patients' }, { label: p.fullName }]}
        actions={
          isAdmin && (
            <>
              <Button asChild variant="secondary">
                <Link href={`/patients/${p.id}/edit`}>
                  <Pencil className="h-4 w-4" aria-hidden /> Edit
                </Link>
              </Button>
              <Button variant="secondary" className="text-danger" onClick={() => setConfirm(true)}>
                <Trash2 className="h-4 w-4" aria-hidden /> Delete
              </Button>
            </>
          )
        }
      />
      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader title="Patient details" />
          <dl className="grid gap-x-6 gap-y-5 p-5 sm:grid-cols-2">
            <Item label="Full name">{p.fullName}</Item>
            <Item label="Date of birth">
              {formatDate(p.dateOfBirth)} ({ageFrom(p.dateOfBirth)} yrs)
            </Item>
            <Item label="Gender">{GENDER_LABEL[p.gender] ?? p.gender}</Item>
            <Item label="Condition category">
              <Badge>{p.condition}</Badge>
            </Item>
            <Item label="Phone">{p.phone}</Item>
            <Item label="Email">{p.email ?? <span className="font-normal text-ink-muted">Not provided</span>}</Item>
          </dl>
        </Card>
        <div className="space-y-6">
          <Card>
            <CardHeader title="Assigned doctor" />
            <div className="p-5 text-sm">
              {p.doctor ? (
                <>
                  <Link href={`/doctors/${p.doctor.id}`} className="font-medium text-accent hover:underline">
                    {p.doctor.fullName}
                  </Link>
                  <p className="mt-0.5 text-ink-muted">{p.doctor.specialization}</p>
                </>
              ) : (
                <>
                  <Badge tone="warning">Unassigned</Badge>
                  <p className="mt-2 text-ink-muted">{isAdmin ? 'Edit this patient to assign a doctor.' : 'No doctor is assigned yet.'}</p>
                </>
              )}
            </div>
          </Card>
          <Card>
            <CardHeader title="Record" />
            <dl className="space-y-3 p-5">
              <Item label="Created">{formatDateTime(p.createdAt)}</Item>
              <Item label="Last updated">{formatDateTime(p.updatedAt)}</Item>
            </dl>
          </Card>
        </div>
      </div>

      <ConfirmDialog
        open={confirm}
        onOpenChange={setConfirm}
        title="Delete this patient?"
        description={<>This permanently deletes <strong>{p.fullName}</strong>&apos;s record. This cannot be undone.</>}
        confirmLabel="Delete patient"
        destructive
        pending={del.isPending}
        error={deleteError}
        onConfirm={onDelete}
      />
    </>
  );
}
