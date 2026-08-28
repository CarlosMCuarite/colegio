'use client';
// Página de Configuración propia de Docente: solo Mi Perfil + Contraseña.
import DashboardLayout from '../../../../components/layout/DashboardLayout';
import PerfilYPassword from '../../../../components/PerfilYPassword';

export default function ConfiguracionDocentePage() {
  return (
    <DashboardLayout title="Configuración" allowedRoles={['SUPERADMIN','ADMINISTRADOR','DIRECTOR','DOCENTE','AUXILIAR','TUTOR','COORDINADOR','PSICOLOGO','ENFERMERIA','CONTADOR']}>
      <PerfilYPassword />
    </DashboardLayout>
  );
}
