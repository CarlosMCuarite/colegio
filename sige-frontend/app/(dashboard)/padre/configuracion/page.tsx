'use client';
// Página de Configuración propia de Padre: solo Mi Perfil + Contraseña.
// (Antes esto re-exportaba por error la página de SUPERADMIN, lo que
// expulsaba a cualquier padre a /unauthorized. Ahora tiene su propia página.)
import DashboardLayout from '../../../../components/layout/DashboardLayout';
import PerfilYPassword from '../../../../components/PerfilYPassword';

export default function ConfiguracionPadrePage() {
  return (
    <DashboardLayout title="Configuración" allowedRoles={['PADRE']}>
      <PerfilYPassword />
    </DashboardLayout>
  );
}
