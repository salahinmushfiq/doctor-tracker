'use client';

import * as React from 'react';
import { Field, Input, Select } from '@/components/ui/field';
import { useDebouncedValue } from '@/hooks/use-debounced-value';
import { useDoctorOptions } from './hooks';
import type { DoctorRef } from '@/types/api';

export interface ExtraOption {
  value: string;
  label: string;
}

interface Props {
  id: string;
  label: string;
  value: string;
  onChange: (doctorId: string) => void;
  /** options shown before the doctors, e.g. "Unassigned" (value "") or "All doctors" */
  extraOptions?: ExtraOption[];
  /** The doctor currently selected (so edit forms can show them before the search results load). */
  current?: DoctorRef | null;
  error?: string;
  hint?: string;
  required?: boolean;
  disabled?: boolean;
}

const labelOf = (d: { fullName: string; specialization: string }) => `${d.fullName} - ${d.specialization}`;

/**
 * Doctor picker that scales: instead of loading every doctor, a small search box queries the API (first 25 matches)
 * and the select shows those. The chosen doctor is remembered so it never disappears when the search changes.
 */
export function DoctorSelect({ id, label, value, onChange, extraOptions = [], current, error, hint, required, disabled }: Props) {
  const [search, setSearch] = React.useState('');
  const debounced = useDebouncedValue(search.trim(), 300);
  const { data, isFetching, isError } = useDoctorOptions(debounced);
  const [chosen, setChosen] = React.useState<{ id: string; label: string } | null>(current ? { id: current.id, label: labelOf(current) } : null);

  const results = data?.data ?? [];
  const extraValues = new Set(extraOptions.map((o) => o.value));
  const showChosen = chosen && value === chosen.id && !results.some((d) => d.id === chosen.id);
  const total = data?.pagination.total ?? 0;

  return (
    <div className="flex flex-col gap-2">
      <Field id={id} label={label} error={error} hint={hint} required={required}>
        {(p) => (
          <Select
            {...p}
            disabled={disabled}
            value={value}
            onChange={(e) => {
              const v = e.target.value;
              const found = results.find((d) => d.id === v);
              if (found) setChosen({ id: found.id, label: labelOf(found) });
              onChange(v);
            }}
          >
            {extraOptions.map((o) => (
              <option key={o.value || '__none'} value={o.value}>
                {o.label}
              </option>
            ))}
            {showChosen && <option value={chosen.id}>{chosen.label}</option>}
            {results
              .filter((d) => !extraValues.has(d.id))
              .map((d) => (
                <option key={d.id} value={d.id}>
                  {labelOf(d)}
                </option>
              ))}
          </Select>
        )}
      </Field>
      <div>
        <label htmlFor={`${id}-search`} className="sr-only">
          Search doctors to choose from
        </label>
        <Input id={`${id}-search`} type="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search doctors by name, specialization, hospital..." className="h-9 text-[13px]" disabled={disabled} maxLength={100} />
        <p role="status" className="mt-1 text-xs text-ink-muted">
          {isError ? 'Could not load doctors.' : isFetching ? 'Searching...' : total > results.length ? `Showing ${results.length} of ${total} doctors - refine the search to narrow down.` : `${total} doctor${total === 1 ? '' : 's'} available`}
        </p>
      </div>
    </div>
  );
}
