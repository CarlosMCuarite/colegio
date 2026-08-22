'use client';
import DashboardLayout from '@/components/layout/DashboardLayout';
import ChatDirecto from '@/components/ChatDirecto';

export default function ChatPadrePage() {
  return (
    <DashboardLayout title="Mensajes" allowedRoles={['PADRE']}>
      <ChatDirecto />
    </DashboardLayout>
  );
}
