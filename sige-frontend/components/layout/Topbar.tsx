'use client';
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../../lib/auth';
import { useData } from '../../hooks/useApi';
import api from '../../lib/api';

interface TopbarProps {
  title?: string;
  colegioNombre?: string;
  onToggleSidebar?: () => void;
}

export default function Topbar({ title, colegioNombre, onToggleSidebar }: TopbarProps) {
  const { user } = useAuth();
  const [showNotifs, setShowNotifs] = useState(false);
  const { data: notifsData, mutate } = useData<any>(
    user?.rol === 'PADRE' ? '/dashboard/padre' : null
  );

  const notifs = (notifsData as any)?.data?.notificaciones ?? [];
  const unread = notifs.filter((n: any) => !n.leida).length;

  const marcarLeidas = async () => {
    try {
      await api.post('/dashboard/notificaciones/leer');
      mutate();
    } catch {}
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
        <button onClick={() => { setShowNotifs(p => !p); if (!showNotifs && unread > 0) marcarLeidas(); }}
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
                {unread > 0 && <span style={{ fontSize:'0.72rem', color:'var(--text-muted)' }}>{unread} nuevas</span>}
              </div>
              {notifs.length === 0 ? (
                <div style={{ padding:'2rem', textAlign:'center', color:'var(--text-muted)', fontSize:'0.875rem' }}>
                  <i className="bi bi-bell-slash" style={{ fontSize:'1.5rem', display:'block', marginBottom:8 }} />Sin notificaciones
                </div>
              ) : notifs.slice(0,15).map((n: any) => (
                <div key={n.id} style={{ padding:'0.75rem 1rem', borderBottom:'1px solid var(--border-color)', background: n.leida ? 'transparent' : 'var(--accent-soft)' }}>
                  <div style={{ fontWeight:600, fontSize:'0.8rem', color:'var(--text-primary)' }}>{n.titulo}</div>
                  <div style={{ fontSize:'0.72rem', color:'var(--text-muted)', marginTop:2 }}>{n.cuerpo}</div>
                </div>
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
