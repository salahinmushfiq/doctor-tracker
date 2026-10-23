'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Field, Input } from '@/components/ui/field';
import { ApiError, describeError } from '@/lib/api-client';
import { useCreateDoctor } from './hooks';
import { doctorFormSchema, type DoctorFormValues } from './schemas';

export function DoctorForm() {
  const router = useRouter();
  const create = useCreateDoctor();
  const [formError, setFormError] = React.useState<string | null>(null);
  const { register, handleSubmit, setError, setFocus, formState } = useForm<DoctorFormValues>({
    resolver: zodResolver(doctorFormSchema),
    defaultValues: { fullName: '', specialization: '', hospital: '', phone: '', email: '' },
    mode: 'onTouched',
  });
  const { errors } = formState;

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    try {
      const doctor = await create.mutateAsync(values);
      toast.success(`${doctor.fullName} was added.`);
      router.push(`/doctors/${doctor.id}`);
    } catch (err) {
      if (err instanceof ApiError && err.code === 'CONFLICT') {
        setError('email', { message: 'A doctor with this email already exists' });
        setFocus('email');
      } else if (err instanceof ApiError && err.fieldIssues.length > 0) {
        // Map server-side validation back onto the fields; anything unmapped goes in the banner.
        const unmapped: string[] = [];
        for (const issue of err.fieldIssues) {
          if (issue.path in values) setError(issue.path as keyof DoctorFormValues, { message: issue.message });
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
        <Field id="fullName" label="Full name" error={errors.fullName?.message} required className="sm:col-span-2">
          {(p) => <Input {...p} autoComplete="off" placeholder="Dr. Amina Rahman" {...register('fullName')} />}
        </Field>
        <Field id="specialization" label="Specialization" error={errors.specialization?.message} required>
          {(p) => <Input {...p} autoComplete="off" placeholder="Cardiology" {...register('specialization')} />}
        </Field>
        <Field id="hospital" label="Hospital or workplace" error={errors.hospital?.message} required>
          {(p) => <Input {...p} autoComplete="off" placeholder="Northgate Clinic" {...register('hospital')} />}
        </Field>
        <Field id="phone" label="Phone" error={errors.phone?.message} hint="Include the country code, e.g. +880 1712 345678" required>
          {(p) => <Input {...p} type="tel" autoComplete="off" inputMode="tel" {...register('phone')} />}
        </Field>
        <Field id="email" label="Email" error={errors.email?.message} required>
          {(p) => <Input {...p} type="email" autoComplete="off" inputMode="email" {...register('email')} />}
        </Field>
      </div>
      <div className="flex justify-end gap-2 border-t border-line pt-4">
        <Button variant="secondary" onClick={() => router.back()} disabled={create.isPending}>
          Cancel
        </Button>
        <Button type="submit" loading={create.isPending}>
          Add doctor
        </Button>
      </div>
    </form>
  );
}
