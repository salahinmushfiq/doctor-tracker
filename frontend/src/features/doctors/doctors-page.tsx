'use client';

import * as React from 'react';
import Link from 'next/link';
import { Plus, Stethoscope } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { DataTable, type Column } from '@/components/ui/data-table';
import { Field, Select } from '@/components/ui/field';
import { PageHeader } from '@/components/ui/page-header';
import { Pagination } from '@/components/ui/pagination';
import { EmptyState } from '@/components/ui/states';
import { useListParams } from '@/hooks/use-list-params';
import { describeError } from '@/lib/api-client';
import { formatDate } from '@/lib/utils';
import { useAuth } from '@/providers/auth-provider';
import type { Doctor } from '@/types/api';
import { ActiveFilters, DateRangeFields, FilterGrid, SearchInput, buildChips } from '../common/list-controls';
import { useDoctorFilterOptions, useDoctors } from './hooks';

const SORT_KEYS = ['createdAt', 'fullName', 'specialization', 'hospital'] as const;
const FILTER_KEYS = ['search', 'specialization', 'hospital', 'startDate', 'endDate'] as const;
const CHIP_LABELS = { search: 'Search', specialization: 'Specialization', hospital: 'Hospital', startDate: 'From', endDate: 'To' };

export function DoctorsPage() {
  const { isAdmin } = useAuth();
  const list = useListParams({ defaultSortBy: 'createdAt', defaultSortOrder: 'desc', sortKeys: SORT_KEYS, filterKeys: FILTER_KEYS });
  const { filters, update } = list;
  const rangeInvalid = Boolean(filters.startDate && filters.endDate && filters.startDate > filters.endDate);
  const { data, isPending, isFetching, isPlaceholderData, error, refetch } = useDoctors(list.query, !rangeInvalid);
  const options = useDoctorFilterOptions();
  const onCommitSearch = React.useCallback((v: string) => update({ search: v }), [update]);

  const columns: Column<Doctor>[] = [
    {
      key: 'name',
      header: 'Doctor',
      sortKey: 'fullName',
      cell: (d) => (
        <Link href={`/doctors/${d.id}`} className="group block">
          <span className="font-medium text-ink group-hover:text-accent group-hover:underline">{d.fullName}</span>
          <span className="block text-[13px] text-ink-muted">{d.email}</span>
        </Link>
      ),
    },
    { key: 'spec', header: 'Specialization', sortKey: 'specialization', cell: (d) => <Badge tone="accent">{d.specialization}</Badge> },
    { key: 'hospital', header: 'Hospital', sortKey: 'hospital', cell: (d) => d.hospital },
    { key: 'phone', header: 'Phone', cell: (d) => <span className="tabular whitespace-nowrap">{d.phone}</span> },
    { key: 'patients', header: 'Patients', className: 'text-right', cell: (d) => <span className="tabular">{d.patientCount ?? 0}</span> },
    { key: 'added', header: 'Added', sortKey: 'createdAt', cell: (d) => <span className="whitespace-nowrap">{formatDate(d.createdAt)}</span> },
    {
      key: 'actions',
      header: 'Actions',
      srOnlyHeader: true,
      className: 'text-right',
      cell: (d) => (
        <Button asChild variant="secondary" size="sm">
          <Link href={`/doctors/${d.id}`} aria-label={`View ${d.fullName}`}>
            View
          </Link>
        </Button>
      ),
    },
  ];

  const hasFilters = list.activeFilterCount > 0;
  const rows = data?.data;

  return (
    <>
      <PageHeader
        title="Doctors"
        description="Search, filter and open any doctor to see their patients."
        actions={
          isAdmin && (
            <Button asChild>
              <Link href="/doctors/new">
                <Plus className="h-4 w-4" aria-hidden />
                Add doctor
              </Link>
            </Button>
          )
        }
      />
      <Card>
        <div className="space-y-3 border-b border-line p-4">
          <FilterGrid>
            <div className="sm:col-span-2 lg:col-span-4">
              <SearchInput value={filters.search ?? ''} onCommit={onCommitSearch} label="Search doctors" placeholder="Search by name, specialization, hospital, email or phone" />
            </div>
            <Field id="filter-spec" label="Specialization">
              {(p) => (
                <Select {...p} value={filters.specialization ?? ''} onChange={(e) => update({ specialization: e.target.value })}>
                  <option value="">All specializations</option>
                  {options.data?.specializations.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
            <Field id="filter-hospital" label="Hospital">
              {(p) => (
                <Select {...p} value={filters.hospital ?? ''} onChange={(e) => update({ hospital: e.target.value })}>
                  <option value="">All hospitals</option>
                  {options.data?.hospitals.map((h) => (
                    <option key={h} value={h}>
                      {h}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
            <DateRangeFields start={filters.startDate ?? ''} end={filters.endDate ?? ''} onChange={update} />
          </FilterGrid>
          <ActiveFilters chips={buildChips(filters, CHIP_LABELS)} onRemove={(k) => update({ [k]: null })} onReset={list.reset} />
        </div>

        <DataTable
          caption="Doctors"
          columns={columns}
          rows={rangeInvalid ? [] : rows}
          rowKey={(d) => d.id}
          loading={isPending && !rangeInvalid}
          refreshing={isFetching && isPlaceholderData}
          error={error ? describeError(error) : null}
          onRetry={() => void refetch()}
          sortBy={list.sortBy}
          sortOrder={list.sortOrder}
          onSort={list.setSort}
          empty={
            <EmptyState
              icon={<Stethoscope className="h-5 w-5" />}
              title={hasFilters ? 'No doctors match your search' : 'No doctors yet'}
              description={hasFilters ? 'Try different keywords or clear some filters.' : 'Add the first doctor to start tracking patients.'}
              action={
                hasFilters ? (
                  <Button variant="secondary" onClick={list.reset}>
                    Reset filters
                  </Button>
                ) : isAdmin ? (
                  <Button asChild>
                    <Link href="/doctors/new">Add doctor</Link>
                  </Button>
                ) : undefined
              }
            />
          }
          renderCard={(d) => (
            <div className="space-y-2">
              <div className="flex items-start justify-between gap-3">
                <Link href={`/doctors/${d.id}`} className="min-w-0">
                  <span className="block font-medium text-ink">{d.fullName}</span>
                  <span className="block truncate text-[13px] text-ink-muted">{d.email}</span>
                </Link>
                <Badge tone="accent">{d.specialization}</Badge>
              </div>
              <p className="text-[13px] text-ink-muted">
                {d.hospital} · {d.phone}
              </p>
              <div className="flex items-center justify-between text-[13px]">
                <span className="tabular text-ink-muted">
                  {d.patientCount ?? 0} patient{d.patientCount === 1 ? '' : 's'} · added {formatDate(d.createdAt)}
                </span>
                <Button asChild variant="secondary" size="sm">
                  <Link href={`/doctors/${d.id}`}>View</Link>
                </Button>
              </div>
            </div>
          )}
        />
        {data && !rangeInvalid && data.pagination.total > 0 && <Pagination pagination={data.pagination} onPageChange={(page) => update({ page })} onLimitChange={(limit) => update({ limit })} disabled={isFetching && isPlaceholderData} />}
      </Card>
    </>
  );
}
