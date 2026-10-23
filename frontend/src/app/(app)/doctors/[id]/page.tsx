'use client';

import { use } from 'react';
import { DoctorDetail } from '@/features/doctors/doctor-detail';

export default function DoctorPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return <DoctorDetail id={id} />;
}
