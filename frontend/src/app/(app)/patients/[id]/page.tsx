'use client';

import { use } from 'react';
import { PatientDetail } from '@/features/patients/patient-detail';

export default function PatientPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return <PatientDetail id={id} />;
}
