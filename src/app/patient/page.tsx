import { Suspense } from 'react';
import PatientPageClient from './PatientPageClient';

export default function PatientPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-slate-50" />}>
      <PatientPageClient />
    </Suspense>
  );
}
