'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Field, Input, Select } from '@/components/ui/field';
import { ApiError, describeError } from '@/lib/api-client';
import { toDateInput, utcDay } from '@/lib/utils';
import { CONDITIONS, GENDERS, type Patient } from '@/types/api';
import { DoctorSelect } from '../doctors/doctor-select';
import { useCreatePatient, useUpdatePatient } from './hooks';
import { patientFormSchema, type PatientFormValues } from './schemas';

const GENDER_LABEL: Record<(typeof GENDERS)[number], string> = { female: 'Female', male: 'Male', other: 'Other', unspecified: 'Prefer not to say' };

interface Props {
  /** edit mode when provided */
  patient?: Patient;
  /** create mode with the doctor fixed (e.g. from a doctor's page) - the picker is hidden */
  lockedDoctorId?: string;
  onDone?: (patient: Patient) => void;
  onCancel?: () => void;
}

export function PatientForm({ patient, lockedDoctorId, onDone, onCancel }: Props) {
  const router = useRouter();
  const create = useCreatePatient();
  const update = useUpdatePatient(patient?.id ?? '');
  const pending = create.isPending || update.isPending;
  const [formError, setFormError] = React.useState<string | null>(null);

  const { register, control, handleSubmit, setError, formState } = useForm<PatientFormValues>({
    resolver: zodResolver(patientFormSchema),
    mode: 'onTouched',
    defaultValues: patient
      ? { fullName: patient.fullName, dateOfBirth: toDateInput(patient.dateOfBirth), gender: patient.gender, phone: patient.phone, email: patient.email ?? '', condition: patient.condition, doctorId: patient.doctor?.id ?? '' }
      : { fullName: '', dateOfBirth: '', gender: 'unspecified', phone: '', email: '', condition: undefined as unknown as PatientFormValues['condition'], doctorId: lockedDoctorId ?? '' },
  });
  const { errors } = formState;

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    try {
      const saved = patient ? await update.mutateAsync(values) : await create.mutateAsync({ ...values, doctorId: lockedDoctorId ?? values.doctorId });
      toast.success(patient ? 'Patient updated.' : `${saved.fullName} was added.`);
      if (onDone) onDone(saved);
      else router.push(`/patients/${saved.id}`);
    } catch (err) {
      if (err instanceof ApiError && err.fieldIssues.length > 0) {
        const unmapped: string[] = [];
        for (const issue of err.fieldIssues) {
          if (issue.path in values) setError(issue.path as keyof PatientFormValues, { message: issue.message });
          else if (issue.path === 'doctorId') setError('doctorId', { message: issue.message });
          else unmapped.push(issue.message);
        }
        if (unmapped.length) setFormError(unmapped.join(' '));
      } else {
        setFormError(describeError(err));
      }
    }
  });

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-5">
      {formError && (
        <div role="alert" className="rounded-lg bg-danger-soft px-3 py-2.5 text-sm text-danger">
          {formError}
        </div>
      )}
      <div className="grid gap-5 sm:grid-cols-2">
        <Field id="p-fullName" label="Full name" error={errors.fullName?.message} required className="sm:col-span-2">
          {(p) => <Input {...p} autoComplete="off" {...register('fullName')} />}
        </Field>
        <Field id="p-dob" label="Date of birth" error={errors.dateOfBirth?.message} required>
          {(p) => <Input {...p} type="date" min="1900-01-01" max={utcDay()} {...register('dateOfBirth')} />}
        </Field>
        <Field id="p-gender" label="Gender" error={errors.gender?.message}>
          {(p) => (
            <Select {...p} {...register('gender')}>
              {GENDERS.map((g) => (
                <option key={g} value={g}>
                  {GENDER_LABEL[g]}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Field id="p-phone" label="Phone" error={errors.phone?.message} required>
          {(p) => <Input {...p} type="tel" inputMode="tel" autoComplete="off" {...register('phone')} />}
        </Field>
        <Field id="p-email" label="Email (optional)" error={errors.email?.message}>
          {(p) => <Input {...p} type="email" inputMode="email" autoComplete="off" {...register('email')} />}
        </Field>
        <Field id="p-condition" label="Condition category" error={errors.condition?.message} hint="A broad category only - do not enter detailed diagnoses." required className="sm:col-span-2">
          {(p) => (
            <Select {...p} defaultValue={patient?.condition ?? ''} {...register('condition')}>
              <option value="" disabled>
                Select a category
              </option>
              {CONDITIONS.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </Select>
          )}
        </Field>
        {!lockedDoctorId && (
          <div className="sm:col-span-2">
            <Controller
              control={control}
              name="doctorId"
              render={({ field }) => (
                <DoctorSelect id="p-doctor" label="Assigned doctor" value={field.value} onChange={field.onChange} current={patient?.doctor} extraOptions={[{ value: '', label: 'Unassigned' }]} error={errors.doctorId?.message} />
              )}
            />
          </div>
        )}
      </div>
      <div className="flex justify-end gap-2 border-t border-line pt-4">
        <Button variant="secondary" onClick={onCancel ?? (() => router.back())} disabled={pending}>
          Cancel
        </Button>
        <Button type="submit" loading={pending}>
          {patient ? 'Save changes' : 'Add patient'}
        </Button>
      </div>
    </form>
  );
}
