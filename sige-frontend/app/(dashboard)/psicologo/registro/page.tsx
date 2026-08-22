'use client';
import DashboardLayout from '@/components/layout/DashboardLayout';
import RegistroClinico from '@/components/RegistroClinico';

export default function RegistroPsicologoPage() {
  return (
    <DashboardLayout title="Seguimiento Psicológico" allowedRoles={['PSICOLOGO']}>
      <RegistroClinico
        tipo="PSICOLOGICA"
        titulo="Nuevo registro de seguimiento"
        icono="bi-journal-medical"
        colorAcento="#8b5cf6"
        labelMotivo="Motivo de la sesión / observación"
        labelAtencion="Intervención / recomendación"
        placeholderMotivo="Ej: Dificultad de socialización, bajo rendimiento, conducta en aula..."
        placeholderAtencion="Ej: Sesión individual, se recomienda seguimiento con tutor, se citó al padre..."
      />
    </DashboardLayout>
  );
}
