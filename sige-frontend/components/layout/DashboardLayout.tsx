'use client';
import { useState, useEffect, useMemo } from 'react';
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
  const schoolTheme = useMemo(() => {
    if (!user?.colegio || user.rol === 'SUPERADMIN') return null;
    const primary = user.colegio.colorPrimario || '#2563eb';
    const secondary = user.colegio.colorSecundario || '#16a8e4';
    const normalized = primary.toLowerCase();
    const key = normalized === '#d34242' || normalized === '#dc2626' || normalized === '#ef4444' ? 'red'
      : normalized === '#168a55' || normalized === '#16a34a' || normalized === '#22c55e' ? 'green'
      : normalized === '#d99000' || normalized === '#ca8a04' || normalized === '#eab308' ? 'yellow' : 'blue';
    return { primary, secondary, key };
  }, [user]);

  useEffect(() => {
    if (!schoolTheme) return;
    const root = document.documentElement;
    root.style.setProperty('--school-primary', schoolTheme.primary);
    root.style.setProperty('--school-secondary', schoolTheme.secondary);
    root.style.setProperty('--accent', schoolTheme.primary);
    root.style.setProperty('--accent-hover', schoolTheme.primary);
    root.style.setProperty('--accent-soft', `color-mix(in srgb, ${schoolTheme.primary} 12%, transparent)`);
    root.dataset.schoolTheme = schoolTheme.key;
    return () => {
      root.style.removeProperty('--school-primary');
      root.style.removeProperty('--school-secondary');
      root.style.removeProperty('--accent');
      root.style.removeProperty('--accent-hover');
      root.style.removeProperty('--accent-soft');
      delete root.dataset.schoolTheme;
    };
  }, [schoolTheme]);

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
        <div className="sige-loading-state__visual">
          <span className="sige-loading-state__orbit" aria-hidden="true" />
          <SigeOwl mood="thinking" size="md" priority label="Búho SIGE preparando el sistema" />
        </div>
        <strong>Preparando tu espacio</strong>
        <span>Organizando la información de tu rol…</span>
        <div className="sige-loading-state__dots" aria-label="Cargando"><i /><i /><i /></div>
      </div>
    </div>
  );

  if (!user) return null;

  return (
    <div className="sige-layout" data-school-theme={schoolTheme?.key ?? undefined}
      style={schoolTheme ? ({ '--school-primary': schoolTheme.primary, '--school-secondary': schoolTheme.secondary } as React.CSSProperties) : undefined}>
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
