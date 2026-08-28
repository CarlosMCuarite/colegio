'use client';
// app/(dashboard)/docente/permisos/page.tsx
//
// Antes este archivo era `export { default } from '../../secretaria/permisos/page'`,
// cuya allowedRoles es ['SUPERADMIN','ADMINISTRADOR','DIRECTOR','SECRETARIA'] —
// por eso un Docente que entraba a "Permisos Salida" caía directo a
// /unauthorized. El backend YA permitía a Docente crear (isDocente en POST /permisos),
// solo el GET estaba bloqueado (se corrigió en permisosSalida.ts, ahora un
// Docente ve sus PROPIAS solicitudes). Esta página es la vista de Docente:
// solicitar un permiso y ver el estado de lo que ha pedido — sin los botones
// de validar/autorizar/denegar/ejecutar, que siguen siendo solo de Staff.
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import DashboardLayout from '../../../../components/layout/DashboardLayout';
import { useData, useMutation } from '../../../../hooks/useApi';
import api from '../../../../lib/api';
import toast from 'react-hot-toast';

const ESTADO_CONF: Record<string, { bg: string; text: string; icon: string; label: string }> = {
  SOLICITADO:  { bg: '#fef3c7', text: '#92400e', icon: 'bi-clock',         label: 'Solicitado'  },
  VALIDADO:    { bg: '#dbeafe', text: '#1e40af', icon: 'bi-shield-check',  label: 'Validado — llamando al padre' },
  AUTORIZADO:  { bg: '#d1fae5', text: '#065f46', icon: 'bi-check-circle',  label: 'Autorizado'  },
  DENEGADO:    { bg: '#fee2e2', text: '#991b1b', icon: 'bi-x-circle',      label: 'Denegado'    },
  EJECUTADO:   { bg: '#f0fdf4', text: '#166534', icon: 'bi-door-open',     label: 'Estudiante salió' },
};

export default function PermisosDocentePage() {
  const [showModal, setShowModal] = useState(false);
  const { data, isLoading, mutate } = useData<any>('/permisos?limit=50');
  const { loading: saving, mutate: save } = useMutation();
  const permisos = data?.data ?? [];

  const crear = async (estudianteId: string, motivo: string, descripcion: string) => {
    await save(async () => {
      await api.post('/permisos', { estudianteId, motivo, descripcion: descripcion || undefined });
      toast.success('Permiso solicitado — Secretaría lo validará');
      mutate();
      setShowModal(false);
    });
  };

  return (
    <DashboardLayout title="Permisos de Salida" allowedRoles={['DOCENTE','AUXILIAR','TUTOR','COORDINADOR','PSICOLOGO','ENFERMERIA']}>
      <div style={{ display:'flex', justifyContent:'flex-end', marginBottom:'1rem' }}>
        <button className="btn-accent" onClick={() => setShowModal(true)}><i className="bi bi-plus-lg" />Solicitar permiso</button>
      </div>

      <div style={{ display:'flex', flexDirection:'column', gap:'0.75rem' }}>
        {isLoading ? (
          <div style={{ textAlign:'center', padding:'3rem', color:'var(--text-muted)' }}><div className="spinner-border spinner-border-sm" /></div>
        ) : permisos.length === 0 ? (
          <div className="sige-card" style={{ textAlign:'center', padding:'3rem', color:'var(--text-muted)' }}>
            <i className="bi bi-door-open" style={{ fontSize:'2rem', display:'block', marginBottom:8 }} />
            No has solicitado ningún permiso de salida
          </div>
        ) : permisos.map((p: any) => {
          const c = ESTADO_CONF[p.estado] ?? ESTADO_CONF.SOLICITADO;
          return (
            <div key={p.id} className="sige-card" style={{ display:'flex', justifyContent:'space-between', alignItems:'center', gap:'0.75rem', flexWrap:'wrap' }}>
              <div>
                <div style={{ fontWeight:600, fontSize:'0.9rem' }}>{p.estudiante?.nombres} {p.estudiante?.apellidos}</div>
                <div style={{ fontSize:'0.8rem', color:'var(--text-secondary)', marginTop:2 }}>{p.motivo}</div>
                <div style={{ fontSize:'0.75rem', color:'var(--text-muted)', marginTop:2 }}>{new Date(p.fechaSolicitud).toLocaleString('es-PE')}</div>
                {p.observaciones && <div style={{ fontSize:'0.78rem', color:'var(--text-muted)', marginTop:4 }}><strong>Nota:</strong> {p.observaciones}</div>}
              </div>
              <span style={{ fontSize:'0.75rem', fontWeight:700, background:c.bg, color:c.text, padding:'4px 10px', borderRadius:99, whiteSpace:'nowrap' }}>
                <i className={`bi ${c.icon} me-1`} />{c.label}
              </span>
            </div>
          );
        })}
      </div>

      <AnimatePresence>
        {showModal && (
          <motion.div className="sige-modal-overlay" initial={{ opacity:0 }} animate={{ opacity:1 }} exit={{ opacity:0 }}
            onClick={e => { if (e.target === e.currentTarget) setShowModal(false); }}>
            <motion.div className="sige-modal" initial={{ scale:0.94 }} animate={{ scale:1 }} exit={{ scale:0.94 }}>
              <PermisoForm onGuardar={crear} onCancelar={() => setShowModal(false)} saving={saving} />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </DashboardLayout>
  );
}

function PermisoForm({ onGuardar, onCancelar, saving }: any) {
  const [dni, setDni] = useState('');
  const [estudiante, setEstudiante] = useState<any>(null);
  const [buscando, setBuscando] = useState(false);
  const [motivo, setMotivo] = useState('');
  const [descripcion, setDescripcion] = useState('');

  const buscar = async () => {
    setBuscando(true);
    try {
      const res = await api.get(`/estudiantes?q=${dni}&limit=1`);
      const est = res.data.data?.[0];
      if (est) setEstudiante(est);
      else toast.error('Estudiante no encontrado');
    } finally { setBuscando(false); }
  };

  return (
    <form onSubmit={e => { e.preventDefault(); if (!estudiante) { toast.error('Busca al estudiante primero'); return; } if (motivo.trim().length < 5) { toast.error('Describe el motivo (mínimo 5 caracteres)'); return; } onGuardar(estudiante.id, motivo, descripcion); }}>
      <div style={{ display:'flex', justifyContent:'space-between', marginBottom:'1.25rem' }}>
        <h2 style={{ fontSize:'1rem', fontWeight:700, margin:0 }}>Solicitar Permiso de Salida</h2>
        <button type="button" onClick={onCancelar} style={{ background:'none', border:'none', cursor:'pointer', color:'var(--text-muted)', fontSize:'1.1rem' }}><i className="bi bi-x-lg" /></button>
      </div>
      <div style={{ display:'flex', flexDirection:'column', gap:'0.875rem' }}>
        <div>
          <label style={{ fontSize:'0.8rem', fontWeight:600, color:'var(--text-secondary)', display:'block', marginBottom:4 }}>DNI del Estudiante *</label>
          <div style={{ display:'flex', gap:'0.5rem' }}>
            <input type="text" value={dni} onChange={e => setDni(e.target.value)} className="sige-input" placeholder="DNI" />
            <button type="button" onClick={buscar} className="btn-accent" disabled={buscando} style={{ flexShrink:0 }}>
              {buscando ? <span className="spinner-border spinner-border-sm" /> : <i className="bi bi-search" />}
            </button>
          </div>
          {estudiante && <div style={{ marginTop:6, fontSize:'0.82rem', fontWeight:600, color:'#10b981' }}><i className="bi bi-check-circle me-1" />{estudiante.nombres} {estudiante.apellidos}</div>}
        </div>
        <div>
          <label style={{ fontSize:'0.8rem', fontWeight:600, color:'var(--text-secondary)', display:'block', marginBottom:4 }}>Motivo *</label>
          <input type="text" value={motivo} onChange={e => setMotivo(e.target.value)} required className="sige-input" placeholder="Ej: Cita médica" />
        </div>
        <div>
          <label style={{ fontSize:'0.8rem', fontWeight:600, color:'var(--text-secondary)', display:'block', marginBottom:4 }}>Detalle adicional</label>
          <textarea value={descripcion} onChange={e => setDescripcion(e.target.value)} className="sige-input" style={{ minHeight:70, resize:'vertical' }} />
        </div>
      </div>
      <div style={{ display:'flex', gap:'0.75rem', justifyContent:'flex-end', marginTop:'1.25rem' }}>
        <button type="button" onClick={onCancelar} style={{ background:'var(--bg-secondary)', border:'1px solid var(--border-color)', borderRadius:8, padding:'0.5rem 1rem', cursor:'pointer', fontSize:'0.875rem', color:'var(--text-primary)' }}>Cancelar</button>
        <button type="submit" className="btn-accent" disabled={saving}>
          {saving ? <span className="spinner-border spinner-border-sm" /> : <><i className="bi bi-send me-1" />Solicitar</>}
        </button>
      </div>
    </form>
  );
}
