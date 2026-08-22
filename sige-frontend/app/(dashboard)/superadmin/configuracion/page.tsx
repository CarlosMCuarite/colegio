'use client';
import DashboardLayout from '@/components/layout/DashboardLayout';
import PerfilYPassword from '@/components/PerfilYPassword';

// Antes esta página tenía su propio formulario duplicado y más limitado
// (sin foto de perfil, sin DNI/dirección). Ahora reusa el mismo componente
// que ya usan Secretaría/Docente/Padre, así el SuperAdmin tiene los mismos
// datos completos y la subida de foto de perfil (con conversión a WebP en
// el backend) sin mantener dos formularios distintos.
export default function ConfiguracionSuperadminPage() {
  return (
    <DashboardLayout title="Configuración" allowedRoles={['SUPERADMIN']}>
      <PerfilYPassword />
    </DashboardLayout>
  );
}
