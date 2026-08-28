'use client';
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import DashboardLayout from '../../../../components/layout/DashboardLayout';
import { useData, useMutation } from '../../../../hooks/useApi';
import api from '../../../../lib/api';
import toast from 'react-hot-toast';

export default function ObservacionesDocentePage() {
  const { data, isLoading, mutate } = useData<any>('/observaciones?limit=50');
  const { loading: saving, mutate: save } = useMutation();
  const [showModal, setShowModal] = useState(false);
  const obs = (data as any)?.data ?? [];

  const guardar = async (form: any) => {
    await save(async () => {
      await api.post('/observaciones', form);
      toast.success('Observación registrada');
      mutate(); setShowModal(false);
    });
  };

  const TIPO_COLOR: Record<string,string> = { DISCIPLINARIA:'#ef4444', ACADEMICA:'#3b82f6', CONDUCTUAL:'#f59e0b', POSITIVA:'#10b981', OTRO:'#64748b' };

  return (
    <DashboardLayout title="Observaciones" allowedRoles={['DOCENTE','AUXILIAR','TUTOR','COORDINADOR','PSICOLOGO','ENFERMERIA','SUPERADMIN','ADMINISTRADOR','DIRECTOR','SECRETARIA']}>
      <div style={{ display:'flex', justifyContent:'flex-end', marginBottom:'1rem' }}>
        <button className="btn-accent" onClick={() => setShowModal(true)}><i className="bi bi-plus-lg" />Nueva Observación</button>
      </div>
      <div style={{ display:'flex', flexDirection:'column', gap:'0.75rem' }}>
        {isLoading ? <div style={{ textAlign:'center', padding:'3rem', color:'var(--text-muted)' }}><div className="spinner-border spinner-border-sm" /></div>
          : obs.length === 0 ? (
            <div className="sige-card" style={{ textAlign:'center', padding:'3rem', color:'var(--text-muted)' }}>Sin observaciones registradas</div>
          ) : obs.map((o: any) => {
            const color = TIPO_COLOR[o.tipo] ?? '#64748b';
            return (
              <div key={o.id} className="sige-card" style={{ borderLeft:`3px solid ${color}` }}>
                <div style={{ display:'flex', justifyContent:'space-between', marginBottom:6 }}>
                  <div style={{ display:'flex', gap:'0.5rem', alignItems:'center' }}>
                    <span style={{ fontSize:'0.75rem', fontWeight:700, background:`${color}18`, color, padding:'2px 8px', borderRadius:99 }}>{o.tipo}</span>
                    <span style={{ fontWeight:600, fontSize:'0.875rem' }}>{o.estudiante?.nombres} {o.estudiante?.apellidos}</span>
                  </div>
                  <span style={{ fontSize:'0.75rem', color:'var(--text-muted)' }}>{new Date(o.fecha).toLocaleDateString('es-PE')}</span>
                </div>
                <p style={{ fontSize:'0.82rem', color:'var(--text-secondary)', margin:'0 0 4px' }}>{o.descripcion}</p>
                {o.accionTomada && <p style={{ fontSize:'0.78rem', color:'var(--text-muted)', margin:0 }}><strong>Acción:</strong> {o.accionTomada}</p>}
              </div>
            );
          })}
      </div>
      <AnimatePresence>
        {showModal && (
          <motion.div className="sige-modal-overlay" initial={{ opacity:0 }} animate={{ opacity:1 }} exit={{ opacity:0 }}
            onClick={e => { if (e.target === e.currentTarget) setShowModal(false); }}>
            <motion.div className="sige-modal" initial={{ scale:0.94 }} animate={{ scale:1 }} exit={{ scale:0.94 }}>
              <ObsForm onGuardar={guardar} onCancelar={() => setShowModal(false)} saving={saving} />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </DashboardLayout>
  );
}

function ObsForm({ onGuardar, onCancelar, saving }: any) {
  const [form, setForm] = useState({ estudianteDni:'', tipo:'DISCIPLINARIA', descripcion:'', accionTomada:'', notificarPadre:true });
  const [estudiante, setEstudiante] = useState<any>(null);
  const [buscando, setBuscando] = useState(false);
  const set = (k: string) => (e: any) => setForm(p => ({ ...p, [k]: e.target.type==='checkbox' ? e.target.checked : e.target.value }));

  const buscar = async () => {
    setBuscando(true);
    try {
      const res = await api.get(`/estudiantes?q=${form.estudianteDni}&limit=1`);
      const est = res.data.data?.[0];
      if (est) setEstudiante(est);
      else toast.error('Estudiante no encontrado');
    } finally { setBuscando(false); }
  };

  return (
    <form onSubmit={e => { e.preventDefault(); if (!estudiante) { toast.error('Busca al estudiante primero'); return; } onGuardar({ ...form, estudianteId: estudiante.id }); }}>
      <div style={{ display:'flex', justifyContent:'space-between', marginBottom:'1.25rem' }}>
        <h2 style={{ fontSize:'1rem', fontWeight:700, margin:0 }}>Nueva Observación</h2>
        <button type="button" onClick={onCancelar} style={{ background:'none', border:'none', cursor:'pointer', color:'var(--text-muted)', fontSize:'1.1rem' }}><i className="bi bi-x-lg" /></button>
      </div>
      <div style={{ display:'flex', flexDirection:'column', gap:'0.875rem' }}>
        <div>
          <label style={{ fontSize:'0.8rem', fontWeight:600, color:'var(--text-secondary)', display:'block', marginBottom:4 }}>DNI del Estudiante *</label>
          <div style={{ display:'flex', gap:'0.5rem' }}>
            <input type="text" value={form.estudianteDni} onChange={set('estudianteDni')} className="sige-input" placeholder="DNI" />
            <button type="button" onClick={buscar} className="btn-accent" disabled={buscando} style={{ flexShrink:0 }}>
              {buscando ? <span className="spinner-border spinner-border-sm" /> : <i className="bi bi-search" />}
            </button>
          </div>
          {estudiante && <div style={{ marginTop:6, fontSize:'0.82rem', fontWeight:600, color:'#10b981' }}><i className="bi bi-check-circle me-1" />{estudiante.nombres} {estudiante.apellidos}</div>}
        </div>
        <div>
          <label style={{ fontSize:'0.8rem', fontWeight:600, color:'var(--text-secondary)', display:'block', marginBottom:4 }}>Tipo *</label>
          <select value={form.tipo} onChange={set('tipo')} className="sige-input">
            {['DISCIPLINARIA','ACADEMICA','CONDUCTUAL','POSITIVA','OTRO'].map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
        <div>
          <label style={{ fontSize:'0.8rem', fontWeight:600, color:'var(--text-secondary)', display:'block', marginBottom:4 }}>Descripción *</label>
          <textarea value={form.descripcion} onChange={set('descripcion')} required className="sige-input" style={{ minHeight:80, resize:'vertical' }} />
        </div>
        <div>
          <label style={{ fontSize:'0.8rem', fontWeight:600, color:'var(--text-secondary)', display:'block', marginBottom:4 }}>Acción tomada</label>
          <input type="text" value={form.accionTomada} onChange={set('accionTomada')} className="sige-input" />
        </div>
        <label style={{ display:'flex', alignItems:'center', gap:'0.5rem', cursor:'pointer' }}>
          <input type="checkbox" checked={form.notificarPadre} onChange={set('notificarPadre')} />
          <span style={{ fontSize:'0.875rem' }}>Notificar al padre por push</span>
        </label>
      </div>
      <div style={{ display:'flex', gap:'0.75rem', justifyContent:'flex-end', marginTop:'1.25rem' }}>
        <button type="button" onClick={onCancelar} style={{ background:'var(--bg-secondary)', border:'1px solid var(--border-color)', borderRadius:8, padding:'0.5rem 1rem', cursor:'pointer', fontSize:'0.875rem', color:'var(--text-primary)' }}>Cancelar</button>
        <button type="submit" className="btn-accent" disabled={saving}>
          {saving ? <span className="spinner-border spinner-border-sm" /> : <><i className="bi bi-check2 me-1" />Registrar</>}
        </button>
      </div>
    </form>
  );
}
