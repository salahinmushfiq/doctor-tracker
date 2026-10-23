'use client';

import { use } from 'react';
import { Card } from '@/components/ui/card';
import { PageHeader } from '@/components/ui/page-header';
import { Skeleton } from '@/components/ui/skeleton';
import { ErrorState } from '@/components/ui/states';
import { AdminOnly } from '@/features/common/admin-only';
import { PatientForm } from '@/features/patients/patient-form';
import { usePatient } from '@/features/patients/hooks';
import { ApiError, describeError } from '@/lib/api-client';

export default function EditPatientPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { data, isPending, error, refetch } = usePatient(id);

  return (
    <AdminOnly backHref={`/patients/${id}`} what="edit patients">
      <PageHeader title="Edit patient" breadcrumbs={[{ label: 'Patients', href: '/patients' }, { label: data?.fullName ?? 'Patient', href: `/patients/${id}` }, { label: 'Edit' }]} />
      <Card className="max-w-3xl p-6">
        {isPending ? (
          <div className="space-y-4" aria-busy="true">
            <Skeleton className="h-10" />
            <Skeleton className="h-10" />
            <Skeleton className="h-10" />
          </div>
        ) : error ? (
          <ErrorState title={error instanceof ApiError && error.status === 404 ? 'Patient not found' : undefined} message={describeError(error)} onRetry={error instanceof ApiError && error.status === 404 ? undefined : () => void refetch()} />
        ) : (
          <PatientForm patient={data} />
        )}
      </Card>
    </AdminOnly>
  );
}
