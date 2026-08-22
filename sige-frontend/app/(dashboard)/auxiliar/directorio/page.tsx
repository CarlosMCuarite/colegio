'use client';
import DashboardLayout from '@/components/layout/DashboardLayout';
import DirectorioEstudiantes from '@/components/DirectorioEstudiantes';

export default function DirectorioAuxiliarPage() {
  return (
    <DashboardLayout title="Directorio de Estudiantes" allowedRoles={['AUXILIAR']}>
      <DirectorioEstudiantes />
    </DashboardLayout>
  );
}
