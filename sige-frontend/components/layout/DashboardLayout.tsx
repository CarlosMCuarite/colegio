'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { AuthProvider, useAuth } from '@/lib/auth';
import Sidebar from './Sidebar';
import Topbar from './Topbar';
import ChatbotWidget from '@/components/chatbot/ChatbotWidget';

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
    <div style={{ height:'100vh', display:'flex', alignItems:'center', justifyContent:'center', background:'var(--bg-secondary)' }}>
      <div style={{ textAlign:'center' }}>
        <div style={{ width:40, height:40, borderRadius:'50%', border:'3px solid var(--accent)', borderTopColor:'transparent', animation:'spin 0.7s linear infinite', margin:'0 auto 12px' }} />
        <div style={{ color:'var(--text-muted)', fontSize:'0.875rem' }}>Cargando sistema...</div>
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
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
