'use client';
import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { AuthProvider, useAuth } from '../../lib/auth';
import Sidebar from './Sidebar';
import Topbar from './Topbar';
import ChatbotWidget from '../chatbot/ChatbotWidget';
import SigeOwl from '../brand/SigeOwl';
import BackgroundLocalBackup from '../BackgroundLocalBackup';
import { BLUE_SCHOOL_THEME, getSchoolTheme, SchoolThemeProvider } from './SchoolThemeContext';

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
    const globalSuperAdmin = user?.rol === 'SUPERADMIN' && !user.supportMode;
    if (!user?.colegio || globalSuperAdmin) {
      if (!user && typeof window !== 'undefined') {
        const cachedKey = localStorage.getItem('sige-school-theme');
        if (cachedKey) return getSchoolTheme(cachedKey);
      }
      return BLUE_SCHOOL_THEME;
    }
    return getSchoolTheme(user.colegio.colorPrimario, user.colegio.colorSecundario);
  }, [user]);

  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty('--school-primary', schoolTheme.primary);
    root.style.setProperty('--school-secondary', schoolTheme.secondary);
    root.style.setProperty('--accent', schoolTheme.primary);
    root.style.setProperty('--accent-hover', schoolTheme.hover);
    root.style.setProperty('--accent-soft', schoolTheme.soft);
    root.style.setProperty('--accent-strong', schoolTheme.strong);
    root.style.setProperty('--accent-cyan', schoolTheme.secondary);
    root.style.setProperty('--accent-contrast', schoolTheme.contrast);
    root.style.setProperty('--action-primary', schoolTheme.action);
    root.style.setProperty('--action-hover', schoolTheme.actionHover);
    root.style.setProperty('--action-contrast', schoolTheme.actionContrast);
    root.style.setProperty('--bg-sidebar', schoolTheme.sidebar);
    root.dataset.schoolTheme = schoolTheme.key;
    localStorage.setItem('sige-school-theme', schoolTheme.primary);
    return () => {
      root.style.removeProperty('--school-primary');
      root.style.removeProperty('--school-secondary');
      root.style.removeProperty('--accent');
      root.style.removeProperty('--accent-hover');
      root.style.removeProperty('--accent-soft');
      root.style.removeProperty('--accent-strong');
      root.style.removeProperty('--accent-cyan');
      root.style.removeProperty('--accent-contrast');
      root.style.removeProperty('--action-primary');
      root.style.removeProperty('--action-hover');
      root.style.removeProperty('--action-contrast');
      root.style.removeProperty('--bg-sidebar');
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
    <SchoolThemeProvider value={schoolTheme}>
    <div className="sige-loading-state" data-school-theme={schoolTheme.key}
      style={({ '--school-primary': schoolTheme.primary, '--school-secondary': schoolTheme.secondary, '--accent': schoolTheme.primary, '--accent-soft': schoolTheme.soft, '--accent-cyan': schoolTheme.secondary } as React.CSSProperties)}>
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
    </SchoolThemeProvider>
  );

  if (!user) return null;

  return (
    <SchoolThemeProvider value={schoolTheme}>
      <div className="sige-layout" data-school-theme={schoolTheme.key}
        style={({ '--school-primary': schoolTheme.primary, '--school-secondary': schoolTheme.secondary } as React.CSSProperties)}>
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
        <BackgroundLocalBackup rol={user.rol} colegioId={user.colegio?.id} />
      </div>
    </SchoolThemeProvider>
  );
}

export default function DashboardLayout(props: Props) {
  return (
    <AuthProvider>
      <InnerLayout {...props} />
    </AuthProvider>
  );
}
