'use client';

import { Card } from '@/components/ui/card';
import { PageHeader } from '@/components/ui/page-header';
import { AdminOnly } from '@/features/common/admin-only';
import { DoctorForm } from '@/features/doctors/doctor-form';

export default function NewDoctorPage() {
  return (
    <AdminOnly backHref="/doctors" what="add doctors">
      <PageHeader title="Add doctor" description="Create a doctor record. Patients can be added afterwards from the doctor's page." breadcrumbs={[{ label: 'Doctors', href: '/doctors' }, { label: 'Add doctor' }]} />
      <Card className="max-w-3xl p-6">
        <DoctorForm />
      </Card>
    </AdminOnly>
  );
}
