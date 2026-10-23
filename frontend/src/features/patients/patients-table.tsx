'use client';

import * as React from 'react';
import Link from 'next/link';
import { MoreHorizontal, Pencil, Trash2, Eye, UserMinus, Users } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DataTable, type Column } from '@/components/ui/data-table';
import { EmptyState } from '@/components/ui/states';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { ageFrom, formatDate } from '@/lib/utils';
import { useAuth } from '@/providers/auth-provider';
import type { Patient, SortOrder } from '@/types/api';

interface Props {
  rows: Patient[] | undefined;
  loading: boolean;
  refreshing: boolean;
  error: string | null;
  onRetry: () => void;
  sortBy: string;
  sortOrder: SortOrder;
  onSort: (key: string) => void;
  empty: React.ReactNode;
  /** hide the doctor column (on a doctor's own page) */
  showDoctor?: boolean;
  onDelete?: (p: Patient) => void;
  onRemoveFromDoctor?: (p: Patient) => void;
}

function RowActions({ patient, onDelete, onRemoveFromDoctor }: { patient: Patient; onDelete?: (p: Patient) => void; onRemoveFromDoctor?: (p: Patient) => void }) {
  const { isAdmin } = useAuth();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="h-8 w-8" aria-label={`Actions for ${patient.fullName}`}>
          <MoreHorizontal className="h-4 w-4" aria-hidden />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuItem asChild>
          <Link href={`/patients/${patient.id}`}>
            <Eye className="h-4 w-4" aria-hidden /> View details
          </Link>
        </DropdownMenuItem>
        {isAdmin && (
          <DropdownMenuItem asChild>
            <Link href={`/patients/${patient.id}/edit`}>
              <Pencil className="h-4 w-4" aria-hidden /> Edit
            </Link>
          </DropdownMenuItem>
        )}
        {isAdmin && onRemoveFromDoctor && (
          <DropdownMenuItem onSelect={() => onRemoveFromDoctor(patient)}>
            <UserMinus className="h-4 w-4" aria-hidden /> Remove from this doctor
          </DropdownMenuItem>
        )}
        {isAdmin && onDelete && (
          <DropdownMenuItem danger onSelect={() => onDelete(patient)}>
            <Trash2 className="h-4 w-4" aria-hidden /> Delete patient
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function PatientsTable({ rows, loading, refreshing, error, onRetry, sortBy, sortOrder, onSort, empty, showDoctor = true, onDelete, onRemoveFromDoctor }: Props) {
  const columns: Column<Patient>[] = [
    {
      key: 'name',
      header: 'Patient',
      sortKey: 'fullName',
      cell: (p) => (
        <Link href={`/patients/${p.id}`} className="group block">
          <span className="font-medium text-ink group-hover:text-accent group-hover:underline">{p.fullName}</span>
          <span className="block text-[13px] text-ink-muted">{p.email ?? p.phone}</span>
        </Link>
      ),
    },
    { key: 'age', header: 'Age', sortKey: 'dateOfBirth', cell: (p) => <span className="tabular">{ageFrom(p.dateOfBirth)}</span> },
    { key: 'condition', header: 'Condition', sortKey: 'condition', cell: (p) => <Badge>{p.condition}</Badge> },
    ...(showDoctor
      ? [
          {
            key: 'doctor',
            header: 'Doctor',
            cell: (p: Patient) =>
              p.doctor ? (
                <Link href={`/doctors/${p.doctor.id}`} className="hover:text-accent hover:underline">
                  {p.doctor.fullName}
                </Link>
              ) : (
                <Badge tone="warning">Unassigned</Badge>
              ),
          } satisfies Column<Patient>,
        ]
      : []),
    { key: 'added', header: 'Added', sortKey: 'createdAt', cell: (p) => <span className="whitespace-nowrap">{formatDate(p.createdAt)}</span> },
    { key: 'actions', header: 'Actions', srOnlyHeader: true, className: 'w-12 text-right', cell: (p) => <RowActions patient={p} onDelete={onDelete} onRemoveFromDoctor={onRemoveFromDoctor} /> },
  ];

  return (
    <DataTable
      caption="Patients"
      columns={columns}
      rows={rows}
      rowKey={(p) => p.id}
      loading={loading}
      refreshing={refreshing}
      error={error}
      onRetry={onRetry}
      sortBy={sortBy}
      sortOrder={sortOrder}
      onSort={onSort}
      empty={empty}
      renderCard={(p) => (
        <div className="space-y-2">
          <div className="flex items-start justify-between gap-2">
            <Link href={`/patients/${p.id}`} className="min-w-0">
              <span className="block font-medium text-ink">{p.fullName}</span>
              <span className="block truncate text-[13px] text-ink-muted">
                {ageFrom(p.dateOfBirth)} yrs · {p.email ?? p.phone}
              </span>
            </Link>
            <RowActions patient={p} onDelete={onDelete} onRemoveFromDoctor={onRemoveFromDoctor} />
          </div>
          <div className="flex flex-wrap items-center gap-2 text-[13px]">
            <Badge>{p.condition}</Badge>
            {showDoctor && (p.doctor ? <span className="text-ink-muted">{p.doctor.fullName}</span> : <Badge tone="warning">Unassigned</Badge>)}
            <span className="ml-auto text-ink-muted">Added {formatDate(p.createdAt)}</span>
          </div>
        </div>
      )}
    />
  );
}

/** Shared empty state for patient lists. */
export function PatientsEmpty({ filtered, onReset, action }: { filtered: boolean; onReset: () => void; action?: React.ReactNode }) {
  return (
    <EmptyState
      icon={<Users className="h-5 w-5" />}
      title={filtered ? 'No patients match your search' : 'No patients yet'}
      description={filtered ? 'Try different keywords or clear some filters.' : 'Patients you add will appear here.'}
      action={
        filtered ? (
          <Button variant="secondary" onClick={onReset}>
            Reset filters
          </Button>
        ) : (
          action
        )
      }
    />
  );
}
