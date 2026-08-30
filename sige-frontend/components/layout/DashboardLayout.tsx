'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { AuthProvider, useAuth } from '../../lib/auth';
import Sidebar from './Sidebar';
import Topbar from './Topbar';
import ChatbotWidget from '../chatbot/ChatbotWidget';
import SigeOwl from '../brand/SigeOwl';

interface Props {
  children: React.ReactNode;
  title?: string;
  allowedRoles?: string[];
}

function InnerLayout({ children, title, allowedRoles }: Props) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    if (!loading && !user) {
      const slug = typeof window !== 'undefined' ? localStorage.getItem('sige-colegio-slug') : null;
      router.push(slug ? `/colegio/${slug}/login` : '/auth/login');
    }
    if (!loading && user && allowedRoles && !allowedRoles.includes(user.rol)) {
      router.push('/unauthorized');
    }
  }, [user, loading, allowedRoles, router]);

  if (loading) return (
    <div className="sige-loading-state">
      <div className="sige-loading-state__content">
        <SigeOwl mood="thinking" size="md" label="Búho SIGE preparando el sistema" />
        <strong>Preparando tu espacio</strong>
        <span style={{ color:'var(--text-muted)', fontSize:'0.82rem' }}>Organizando la información de tu rol…</span>
      </div>
    </div>
  );

  if (!user) return null;

  return (
    <div className="sige-layout">
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <main className="sige-main">
        <Topbar
          title={title}
          colegioNombre={user.colegio?.nombre}
          onToggleSidebar={() => setSidebarOpen(p => !p)}
        />
        <motion.div
          className="sige-content"
          initial={{ opacity:0, y:12 }}
          animate={{ opacity:1, y:0 }}
          transition={{ duration:0.25 }}
        >
          {children}
        </motion.div>
      </main>
      {['PADRE','ADMINISTRADOR','DIRECTOR','SECRETARIA'].includes(user.rol) && (
        <ChatbotWidget />
      )}
    </div>
  );
}

export default function DashboardLayout(props: Props) {
  return (
    <AuthProvider>
      <InnerLayout {...props} />
    </AuthProvider>
  );
}
