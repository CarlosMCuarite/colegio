'use client';
import DashboardLayout from '../../../../components/layout/DashboardLayout';
import DirectorioEstudiantes from '../../../../components/DirectorioEstudiantes';

export default function DirectorioPsicologoPage() {
  return (
    <DashboardLayout title="Directorio de Estudiantes" allowedRoles={['PSICOLOGO']}>
      <DirectorioEstudiantes />
    </DashboardLayout>
  );
}
