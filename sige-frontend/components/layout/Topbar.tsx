'use client';
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../../lib/auth';
import { useData } from '../../hooks/useApi';
import api from '../../lib/api';
import { useRouter } from 'next/navigation';

interface TopbarProps {
  title?: string;
  colegioNombre?: string;
  onToggleSidebar?: () => void;
}

export default function Topbar({ title, colegioNombre, onToggleSidebar }: TopbarProps) {
  const { user } = useAuth();
  const router = useRouter();
  const [showNotifs, setShowNotifs] = useState(false);
  const { data: notifsData, mutate } = useData<any>(user ? '/dashboard/notificaciones' : null, { refreshInterval: 15000 });

  const notifs = (notifsData as any)?.data?.notificaciones ?? [];
  const unread = notifs.filter((n: any) => !n.leida).length;

  const marcarLeidas = async () => {
    try {
      await api.post('/dashboard/notificaciones/leer');
      mutate();
    } catch {}
  };

  const destinoNotificacion = (notif: any) => {
    const rutaExplicita = notif?.datos?.ruta;
    if (typeof rutaExplicita === 'string' && rutaExplicita.startsWith('/') && !rutaExplicita.startsWith('//')) return rutaExplicita;
    const rol = user?.rol ?? '';
    const destinos: Record<string, Record<string, string>> = {
      SUPERADMIN: { PAGO: '/superadmin/facturacion', SISTEMA: '/superadmin/monitoreo', DOCUMENTO: '/superadmin/auditoria', COMUNICADO: '/superadmin/auditoria' },
      ADMINISTRADOR: { PAGO: '/admin/pagos', COMUNICADO: '/admin/comunicados', DOCUMENTO: '/admin', PERMISO: '/admin/permisos', ASISTENCIA: '/admin/asistencia', EVENTO: '/admin/eventos' },
      DIRECTOR: { PAGO: '/director/pagos', DOCUMENTO: '/director', PERMISO: '/director/permisos', ASISTENCIA: '/director/asistencia' },
      SECRETARIA: { PAGO: '/secretaria/pagos', COMUNICADO: '/secretaria/comunicados', DOCUMENTO: '/secretaria/documentos', PERMISO: '/secretaria/permisos', ASISTENCIA: '/secretaria/asistencia', EVENTO: '/secretaria/eventos' },
      DOCENTE: { MENSAJE: '/docente/chat', COMUNICADO: '/docente/comunicados', OBSERVACION: '/docente/observaciones', ASISTENCIA: '/docente/asistencia', EVENTO: '/docente/eventos' },
      PADRE: { PAGO: '/padre/pagos', COMUNICADO: '/padre/comunicados', DOCUMENTO: '/padre/documentos', PERMISO: '/padre', ASISTENCIA: '/padre/asistencia', OBSERVACION: '/padre', EVENTO: '/padre/eventos', MENSAJE: '/padre/chat' },
    };
    const base = rol === 'ADMINISTRADOR' ? '/admin' : rol === 'SUPERADMIN' ? '/superadmin' : `/${rol.toLowerCase()}`;
    return destinos[rol]?.[notif.tipo] ?? base;
  };

  const abrirNotificacion = async (notif: any) => {
    try {
      if (!notif.leida) await api.patch(`/dashboard/notificaciones/${notif.id}/leer`);
    } catch { /* La navegación sigue disponible aunque falle el marcado. */ }
    setShowNotifs(false);
    mutate();
    router.push(destinoNotificacion(notif));
  };

  const whatsappNum  = user?.colegio?.logoUrl; // placeholder — en prod viene del colegio
  const nombreColegio = colegioNombre ?? user?.colegio?.nombre ?? 'SIGE';

  return (
    <header className="sige-topbar">
      {/* Toggle sidebar móvil */}
      <button onClick={onToggleSidebar}
        style={{ background:'none', border:'none', padding:'0.25rem', cursor:'pointer', color:'var(--text-secondary)', display:'flex', alignItems:'center' }}
        className="d-md-none">
        <i className="bi bi-list" style={{ fontSize:'1.4rem' }} />
      </button>

      {/* Nombre del colegio en desktop */}
      <div className="topbar-school-context d-none d-md-flex">
        <span className="topbar-school-context__mark" aria-hidden="true" />
        <span className="topbar-school-context__name">{nombreColegio}</span>
        {title && <span style={{ color:'var(--border-color)', margin:'0 6px' }}>›</span>}
        {title && <span style={{ color:'var(--text-primary)', fontWeight:600 }}>{title}</span>}
      </div>
      {/* Título en móvil */}
      {title && <h1 className="d-md-none" style={{ fontSize:'0.95rem', fontWeight:600, color:'var(--text-primary)', margin:0 }}>{title}</h1>}

      <div style={{ flex:1 }} />

      {/* Notificaciones */}
      <div style={{ position:'relative' }}>
        <button onClick={() => setShowNotifs(p => !p)} aria-label={unread ? `Notificaciones, ${unread} sin leer` : 'Notificaciones'} aria-expanded={showNotifs}
          style={{ background:'none', border:'none', padding:'0.4rem 0.5rem', cursor:'pointer', color:'var(--text-secondary)', position:'relative', borderRadius:8, display:'flex', alignItems:'center' }}>
          <i className="bi bi-bell" style={{ fontSize:'1.1rem' }} />
          {unread > 0 && (
            <span style={{ position:'absolute', top:2, right:2, background:'var(--danger)', color:'#fff', fontSize:'0.6rem', fontWeight:700, borderRadius:'50%', width:16, height:16, display:'flex', alignItems:'center', justifyContent:'center' }}>
              {unread > 9 ? '9+' : unread}
            </span>
          )}
        </button>

        <AnimatePresence>
          {showNotifs && (
            <motion.div
              initial={{ opacity:0, y:-8, scale:0.96 }} animate={{ opacity:1, y:0, scale:1 }}
              exit={{ opacity:0, y:-8, scale:0.96 }} transition={{ duration:0.15 }}
              style={{ position:'absolute', right:0, top:'100%', marginTop:8, background:'var(--bg-card)', border:'1px solid var(--border-color)', borderRadius:12, width:300, maxHeight:380, overflowY:'auto', boxShadow:'var(--shadow-lg)', zIndex:200 }}>
              <div style={{ padding:'0.75rem 1rem', borderBottom:'1px solid var(--border-color)', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                <span style={{ fontWeight:600, fontSize:'0.875rem' }}>Notificaciones</span>
                {unread > 0 && <button onClick={marcarLeidas} style={{ minHeight:36, border:0, background:'transparent', color:'var(--accent)', fontSize:'.72rem', fontWeight:650, cursor:'pointer' }}>Marcar todas</button>}
              </div>
              {notifs.length === 0 ? (
                <div style={{ padding:'2rem', textAlign:'center', color:'var(--text-muted)', fontSize:'0.875rem' }}>
                  <i className="bi bi-bell-slash" style={{ fontSize:'1.5rem', display:'block', marginBottom:8 }} />Sin notificaciones
                </div>
              ) : notifs.slice(0,15).map((n: any) => (
                <button key={n.id} onClick={() => abrirNotificacion(n)}
                  style={{ width:'100%', minHeight:68, padding:'0.75rem 1rem', border:0, borderBottom:'1px solid var(--border-color)', background:n.leida ? 'transparent' : 'var(--accent-soft)', textAlign:'left', cursor:'pointer', display:'grid', gridTemplateColumns:'1fr auto', gap:10, alignItems:'center' }}>
                  <span style={{ minWidth:0 }}>
                    <span style={{ display:'block', fontWeight:650, fontSize:'0.8rem', color:'var(--text-primary)', overflowWrap:'anywhere' }}>{n.titulo}</span>
                    <span style={{ display:'block', fontSize:'0.72rem', color:'var(--text-muted)', marginTop:3, lineHeight:1.45, overflowWrap:'anywhere' }}>{n.cuerpo}</span>
                  </span>
                  <i className="bi bi-chevron-right" aria-hidden="true" style={{ color:'var(--accent)', fontSize:'.8rem' }} />
                </button>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* WhatsApp institucional */}
      {user?.colegio && (
        <a href={`https://wa.me/${(user.colegio as any).whatsappNumero ?? ''}`}
          target="_blank" rel="noreferrer"
          style={{ color:'#25D366', fontSize:'1.2rem', textDecoration:'none', display:'flex', alignItems:'center' }}
          title="Contactar al colegio vía WhatsApp">
          <i className="bi bi-whatsapp" />
        </a>
      )}
    </header>
  );
}
