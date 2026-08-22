'use client';
// Página de Configuración propia de Secretaría: solo Mi Perfil + Contraseña.
// La gestión del colegio (Institución) vive aparte, en /admin/configuracion,
// exclusiva de Admin/Director/SuperAdmin.
import DashboardLayout from '@/components/layout/DashboardLayout';
import PerfilYPassword from '@/components/PerfilYPassword';

export default function ConfiguracionSecretariaPage() {
  return (
    <DashboardLayout title="Configuración" allowedRoles={['SUPERADMIN','ADMINISTRADOR','DIRECTOR','SECRETARIA']}>
      <PerfilYPassword />
    </DashboardLayout>
  );
}
