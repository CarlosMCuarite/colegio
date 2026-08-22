'use client';
import DashboardLayout from '@/components/layout/DashboardLayout';
import ChatDirecto from '@/components/ChatDirecto';

export default function ChatDocentePage() {
  return (
    <DashboardLayout title="Mensajes" allowedRoles={['DOCENTE','AUXILIAR','TUTOR','COORDINADOR']}>
      <ChatDirecto />
    </DashboardLayout>
  );
}
