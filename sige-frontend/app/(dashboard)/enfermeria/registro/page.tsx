'use client';
import DashboardLayout from '@/components/layout/DashboardLayout';
import RegistroClinico from '@/components/RegistroClinico';

export default function RegistroEnfermeriaPage() {
  return (
    <DashboardLayout title="Registro de Enfermería" allowedRoles={['ENFERMERIA']}>
      <RegistroClinico
        tipo="SALUD"
        titulo="Nueva atención de enfermería"
        icono="bi-heart-pulse"
        colorAcento="#0ea5e9"
        labelMotivo="Motivo de la atención"
        labelAtencion="Atención brindada"
        placeholderMotivo="Ej: Dolor de cabeza, golpe en el recreo, fiebre..."
        placeholderAtencion="Ej: Se aplicó paño frío, se avisó al padre, se derivó a posta..."
      />
    </DashboardLayout>
  );
}
