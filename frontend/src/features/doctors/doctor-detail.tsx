'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Mail, MapPin, Phone, Plus, Trash2, UserPlus } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardHeader } from '@/components/ui/card';
import { ConfirmDialog, Dialog, DialogContent } from '@/components/ui/dialog';
import { Field, Select } from '@/components/ui/field';
import { PageHeader } from '@/components/ui/page-header';
import { Pagination } from '@/components/ui/pagination';
import { Skeleton } from '@/components/ui/skeleton';
import { ErrorState } from '@/components/ui/states';
import { useListParams } from '@/hooks/use-list-params';
import { ApiError, describeError } from '@/lib/api-client';
import { formatDateTime, plural } from '@/lib/utils';
import { useAuth } from '@/providers/auth-provider';
import { CONDITIONS, type Patient } from '@/types/api';
import { ActiveFilters, SearchInput, buildChips } from '../common/list-controls';
import { useDeletePatient } from '../patients/hooks';
import { PatientForm } from '../patients/patient-form';
import { PatientsEmpty, PatientsTable } from '../patients/patients-table';
import { useDeleteDoctor, useDoctor, useDoctorPatients, useUnassignPatient } from './hooks';

const SORT_KEYS = ['createdAt', 'fullName', 'condition', 'dateOfBirth'] as const;
const FILTER_KEYS = ['search', 'condition'] as const;

export function DoctorDetail({ id }: { id: string }) {
  const { isAdmin } = useAuth();
  const router = useRouter();
  const doctor = useDoctor(id);
  const list = useListParams({ defaultSortBy: 'createdAt', defaultSortOrder: 'desc', sortKeys: SORT_KEYS, filterKeys: FILTER_KEYS });
  const { filters, update } = list;
  const patients = useDoctorPatients(id, list.query);
  const onCommitSearch = React.useCallback((v: string) => update({ search: v }), [update]);

  const [addOpen, setAddOpen] = React.useState(false);
  const [toRemove, setToRemove] = React.useState<Patient | null>(null);
  const [toDelete, setToDelete] = React.useState<Patient | null>(null);
  const [deleteStage, setDeleteStage] = React.useState<'closed' | 'confirm' | 'unassign'>('closed');
  const [dialogError, setDialogError] = React.useState<string | null>(null);

  const unassign = useUnassignPatient(id);
  const deletePatient = useDeletePatient();
  const deleteDoctor = useDeleteDoctor();

  if (doctor.isPending) {
    return (
      <div className="space-y-4" aria-busy="true" aria-label="Loading doctor">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }
  if (doctor.error || !doctor.data) {
    const notFound = doctor.error instanceof ApiError && doctor.error.status === 404;
    return (
      <Card>
        <ErrorState title={notFound ? 'Doctor not found' : undefined} message={notFound ? 'This doctor may have been deleted.' : describeError(doctor.error)} onRetry={notFound ? undefined : () => void doctor.refetch()} />
      </Card>
    );
  }
  const d = doctor.data;
  const count = d.patientCount ?? 0;

  const confirmRemove = async () => {
    if (!toRemove) return;
    setDialogError(null);
    try {
      await unassign.mutateAsync(toRemove.id);
      toast.success(`${toRemove.fullName} was removed from ${d.fullName}'s patients.`);
      setToRemove(null);
    } catch (err) {
      setDialogError(describeError(err));
    }
  };

  const confirmDeletePatient = async () => {
    if (!toDelete) return;
    setDialogError(null);
    try {
      await deletePatient.mutateAsync(toDelete.id);
      toast.success(`${toDelete.fullName} was deleted.`);
      setToDelete(null);
    } catch (err) {
      setDialogError(describeError(err));
    }
  };

  const runDeleteDoctor = async (unassignPatients: boolean) => {
    setDialogError(null);
    try {
      await deleteDoctor.mutateAsync({ id: d.id, unassignPatients });
      toast.success(`${d.fullName} was deleted.`);
      router.replace('/doctors');
    } catch (err) {
      if (err instanceof ApiError && err.code === 'DOCTOR_HAS_PATIENTS') {
        setDeleteStage('unassign'); // second, explicit confirmation: patients are kept but become unassigned
        setDialogError(null);
      } else {
        setDialogError(describeError(err));
      }
    }
  };

  return (
    <>
      <PageHeader
        title={d.fullName}
        description={`${d.specialization} · ${d.hospital}`}
        breadcrumbs={[{ label: 'Doctors', href: '/doctors' }, { label: d.fullName }]}
        actions={
          isAdmin && (
            <>
              <Button onClick={() => setAddOpen(true)}>
                <UserPlus className="h-4 w-4" aria-hidden /> Add patient
              </Button>
              <Button
                variant="secondary"
                className="text-danger"
                onClick={() => {
                  setDialogError(null);
                  setDeleteStage('confirm');
                }}
              >
                <Trash2 className="h-4 w-4" aria-hidden /> Delete doctor
              </Button>
            </>
          )
        }
      />

      <Card className="mb-6">
        <dl className="grid gap-5 p-5 sm:grid-cols-2 lg:grid-cols-4">
          <div className="flex items-start gap-3">
            <Phone className="mt-0.5 h-4 w-4 text-ink-muted" aria-hidden />
            <div>
              <dt className="text-[13px] text-ink-muted">Phone</dt>
              <dd className="font-medium">{d.phone}</dd>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <Mail className="mt-0.5 h-4 w-4 text-ink-muted" aria-hidden />
            <div className="min-w-0">
              <dt className="text-[13px] text-ink-muted">Email</dt>
              <dd className="truncate font-medium">{d.email}</dd>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <MapPin className="mt-0.5 h-4 w-4 text-ink-muted" aria-hidden />
            <div>
              <dt className="text-[13px] text-ink-muted">Workplace</dt>
              <dd className="font-medium">{d.hospital}</dd>
            </div>
          </div>
          <div>
            <dt className="text-[13px] text-ink-muted">Patients</dt>
            <dd className="tabular text-2xl font-semibold">{count}</dd>
          </div>
          <div className="sm:col-span-2 lg:col-span-4">
            <p className="text-xs text-ink-muted">
              Added {formatDateTime(d.createdAt)} · Updated {formatDateTime(d.updatedAt)}
            </p>
          </div>
        </dl>
      </Card>

      <Card>
        <CardHeader title="Patients" description={`${plural(count, 'patient')} assigned to this doctor`} />
        <div className="space-y-3 border-b border-line p-4">
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="sm:col-span-2">
              <SearchInput value={filters.search ?? ''} onCommit={onCommitSearch} label="Search this doctor's patients" placeholder="Search patients by name, email, phone or condition" />
            </div>
            <Field id="dp-condition" label="Condition">
              {(p) => (
                <Select {...p} value={filters.condition ?? ''} onChange={(e) => update({ condition: e.target.value })}>
                  <option value="">All conditions</option>
                  {CONDITIONS.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
          </div>
          <ActiveFilters chips={buildChips(filters, { search: 'Search', condition: 'Condition' })} onRemove={(k) => update({ [k]: null })} onReset={list.reset} />
        </div>
        <PatientsTable
          rows={patients.data?.data}
          loading={patients.isPending}
          refreshing={patients.isFetching && patients.isPlaceholderData}
          error={patients.error ? describeError(patients.error) : null}
          onRetry={() => void patients.refetch()}
          sortBy={list.sortBy}
          sortOrder={list.sortOrder}
          onSort={list.setSort}
          showDoctor={false}
          empty={
            <PatientsEmpty
              filtered={list.activeFilterCount > 0}
              onReset={list.reset}
              action={isAdmin ? <Button onClick={() => setAddOpen(true)}><Plus className="h-4 w-4" aria-hidden /> Add the first patient</Button> : undefined}
            />
          }
          onRemoveFromDoctor={(p) => {
            setDialogError(null);
            setToRemove(p);
          }}
          onDelete={(p) => {
            setDialogError(null);
            setToDelete(p);
          }}
        />
        {patients.data && patients.data.pagination.total > 0 && (
          <Pagination pagination={patients.data.pagination} onPageChange={(page) => update({ page })} onLimitChange={(limit) => update({ limit })} disabled={patients.isFetching && patients.isPlaceholderData} />
        )}
      </Card>

      {/* Add patient (assigned to this doctor) */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent title={`Add patient to ${d.fullName}`} description="The patient will be assigned to this doctor." className="max-w-2xl">
          <PatientForm lockedDoctorId={d.id} onCancel={() => setAddOpen(false)} onDone={() => setAddOpen(false)} />
        </DialogContent>
      </Dialog>

      {/* Remove from doctor = UNASSIGN only */}
      <ConfirmDialog
        open={toRemove !== null}
        onOpenChange={(o) => !o && setToRemove(null)}
        title="Remove patient from this doctor?"
        description={toRemove ? <>This removes <strong>{toRemove.fullName}</strong> from {d.fullName}&apos;s patient list. <strong>The patient record is kept</strong> and becomes unassigned; you can assign another doctor later.</> : null}
        confirmLabel="Remove from doctor"
        pending={unassign.isPending}
        error={dialogError}
        onConfirm={confirmRemove}
      />

      {/* Permanent delete of the patient */}
      <ConfirmDialog
        open={toDelete !== null}
        onOpenChange={(o) => !o && setToDelete(null)}
        title="Delete this patient?"
        description={toDelete ? <>This permanently deletes <strong>{toDelete.fullName}</strong>&apos;s record. This cannot be undone.</> : null}
        confirmLabel="Delete patient"
        destructive
        pending={deletePatient.isPending}
        error={dialogError}
        onConfirm={confirmDeletePatient}
      />

      {/* Delete doctor: stage 1 plain confirm; stage 2 only if the API says patients are still assigned */}
      <ConfirmDialog
        open={deleteStage === 'confirm'}
        onOpenChange={(o) => !o && setDeleteStage('closed')}
        title="Delete this doctor?"
        description={<>This permanently deletes <strong>{d.fullName}</strong>. Patients are never deleted by this action.</>}
        confirmLabel="Delete doctor"
        destructive
        pending={deleteDoctor.isPending}
        error={dialogError}
        onConfirm={() => runDeleteDoctor(false)}
      />
      <ConfirmDialog
        open={deleteStage === 'unassign'}
        onOpenChange={(o) => !o && setDeleteStage('closed')}
        title={`${d.fullName} still has patients`}
        description={<>{plural(count, 'patient')} {count === 1 ? 'is' : 'are'} assigned to this doctor. If you continue, they will be <strong>kept but become unassigned</strong>, and then the doctor will be deleted.</>}
        confirmLabel={`Unassign ${plural(count, 'patient')} and delete doctor`}
        destructive
        pending={deleteDoctor.isPending}
        error={dialogError}
        onConfirm={() => runDeleteDoctor(true)}
      />
    </>
  );
}
