'use client';

import * as React from 'react';
import Link from 'next/link';
import { Plus } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ConfirmDialog } from '@/components/ui/dialog';
import { Field, Select } from '@/components/ui/field';
import { PageHeader } from '@/components/ui/page-header';
import { Pagination } from '@/components/ui/pagination';
import { useListParams } from '@/hooks/use-list-params';
import { describeError } from '@/lib/api-client';
import { useAuth } from '@/providers/auth-provider';
import { CONDITIONS, GENDERS, type Patient } from '@/types/api';
import { DoctorSelect } from '../doctors/doctor-select';
import { useDoctor } from '../doctors/hooks';
import { ActiveFilters, DateRangeFields, FilterGrid, SearchInput, buildChips } from '../common/list-controls';
import { useDeletePatient, usePatients } from './hooks';
import { PatientsEmpty, PatientsTable } from './patients-table';

const SORT_KEYS = ['createdAt', 'fullName', 'condition', 'dateOfBirth'] as const;
const FILTER_KEYS = ['search', 'condition', 'gender', 'doctorId', 'startDate', 'endDate'] as const;
const CHIP_LABELS = { search: 'Search', condition: 'Condition', gender: 'Gender', doctorId: 'Doctor', startDate: 'From', endDate: 'To' };

export function PatientsPage() {
  const { isAdmin } = useAuth();
  const list = useListParams({ defaultSortBy: 'createdAt', defaultSortOrder: 'desc', sortKeys: SORT_KEYS, filterKeys: FILTER_KEYS });
  const { filters, update } = list;
  const rangeInvalid = Boolean(filters.startDate && filters.endDate && filters.startDate > filters.endDate);
  const { data, isPending, isFetching, isPlaceholderData, error, refetch } = usePatients(list.query, !rangeInvalid);
  const onCommitSearch = React.useCallback((v: string) => update({ search: v }), [update]);

  // Chip text for the doctor filter: resolve the id to a name (cached; "Unassigned" needs no lookup).
  const doctorId = filters.doctorId && filters.doctorId !== 'unassigned' ? filters.doctorId : undefined;
  const doctorLookup = useDoctor(doctorId ?? '', Boolean(doctorId));
  const chipFilters = { ...filters, ...(filters.doctorId ? { doctorId: filters.doctorId === 'unassigned' ? 'Unassigned' : (doctorLookup.data?.fullName ?? 'Selected doctor') } : {}) };

  const del = useDeletePatient();
  const [toDelete, setToDelete] = React.useState<Patient | null>(null);
  const [deleteError, setDeleteError] = React.useState<string | null>(null);
  const confirmDelete = async () => {
    if (!toDelete) return;
    setDeleteError(null);
    try {
      await del.mutateAsync(toDelete.id);
      toast.success(`${toDelete.fullName} was deleted.`);
      setToDelete(null);
    } catch (err) {
      setDeleteError(describeError(err));
    }
  };

  return (
    <>
      <PageHeader
        title="Patients"
        description="All patients across every doctor."
        actions={
          isAdmin && (
            <Button asChild>
              <Link href="/patients/new">
                <Plus className="h-4 w-4" aria-hidden />
                Add patient
              </Link>
            </Button>
          )
        }
      />
      <Card>
        <div className="space-y-3 border-b border-line p-4">
          <FilterGrid>
            <div className="sm:col-span-2 lg:col-span-4">
              <SearchInput value={filters.search ?? ''} onCommit={onCommitSearch} label="Search patients" placeholder="Search by name, email, phone or condition" />
            </div>
            <Field id="filter-condition" label="Condition">
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
            <Field id="filter-gender" label="Gender">
              {(p) => (
                <Select {...p} value={filters.gender ?? ''} onChange={(e) => update({ gender: e.target.value })}>
                  <option value="">All</option>
                  {GENDERS.map((g) => (
                    <option key={g} value={g}>
                      {g === 'unspecified' ? 'Prefer not to say' : g[0]!.toUpperCase() + g.slice(1)}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
            <div className="sm:col-span-2">
              <DoctorSelect
                id="filter-doctor"
                label="Doctor"
                value={filters.doctorId ?? ''}
                onChange={(v) => update({ doctorId: v })}
                extraOptions={[
                  { value: '', label: 'All doctors' },
                  { value: 'unassigned', label: 'Unassigned patients' },
                ]}
              />
            </div>
            <DateRangeFields start={filters.startDate ?? ''} end={filters.endDate ?? ''} onChange={update} />
          </FilterGrid>
          <ActiveFilters chips={buildChips(chipFilters, CHIP_LABELS)} onRemove={(k) => update({ [k]: null })} onReset={list.reset} />
        </div>

        <PatientsTable
          rows={rangeInvalid ? [] : data?.data}
          loading={isPending && !rangeInvalid}
          refreshing={isFetching && isPlaceholderData}
          error={error ? describeError(error) : null}
          onRetry={() => void refetch()}
          sortBy={list.sortBy}
          sortOrder={list.sortOrder}
          onSort={list.setSort}
          empty={<PatientsEmpty filtered={list.activeFilterCount > 0} onReset={list.reset} action={isAdmin ? <Button asChild><Link href="/patients/new">Add patient</Link></Button> : undefined} />}
          onDelete={(p) => {
            setDeleteError(null);
            setToDelete(p);
          }}
        />
        {data && !rangeInvalid && data.pagination.total > 0 && <Pagination pagination={data.pagination} onPageChange={(page) => update({ page })} onLimitChange={(limit) => update({ limit })} disabled={isFetching && isPlaceholderData} />}
      </Card>

      <ConfirmDialog
        open={toDelete !== null}
        onOpenChange={(o) => !o && setToDelete(null)}
        title="Delete this patient?"
        description={toDelete ? <>This permanently deletes <strong>{toDelete.fullName}</strong>&apos;s record. This cannot be undone. To keep the record and only detach the patient from a doctor, edit the patient instead.</> : null}
        confirmLabel="Delete patient"
        destructive
        pending={del.isPending}
        error={deleteError}
        onConfirm={confirmDelete}
      />
    </>
  );
}
