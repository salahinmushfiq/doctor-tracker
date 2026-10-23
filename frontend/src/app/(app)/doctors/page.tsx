import type { Metadata } from 'next';
import { DoctorsPage } from '@/features/doctors/doctors-page';

export const metadata: Metadata = { title: 'Doctors' };

export default function Page() {
  return <DoctorsPage />;
}
