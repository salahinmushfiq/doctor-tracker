'use client';

import { Card } from '@/components/ui/card';
import { PageHeader } from '@/components/ui/page-header';
import { AdminOnly } from '@/features/common/admin-only';
import { PatientForm } from '@/features/patients/patient-form';

export default function NewPatientPage() {
  return (
    <AdminOnly backHref="/patients" what="add patients">
      <PageHeader title="Add patient" description="Use synthetic or consented data only. Choose a doctor now or assign one later." breadcrumbs={[{ label: 'Patients', href: '/patients' }, { label: 'Add patient' }]} />
      <Card className="max-w-3xl p-6">
        <PatientForm />
      </Card>
    </AdminOnly>
  );
}
