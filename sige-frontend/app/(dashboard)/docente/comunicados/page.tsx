'use client';
// app/(dashboard)/docente/comunicados/page.tsx
// Nueva — antes el Docente no tenía acceso a Comunicados. Puede leer todos
// los del colegio, y crear uno nuevo SOLO para una de sus propias aulas (no
// puede publicar "para todo el colegio" — eso lo valida también el backend).
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { useComunicados, useData, useMutation } from '@/hooks/useApi';
import api from '@/lib/api';
import toast from 'react-hot-toast';

export default function ComunicadosDocentePage() {
  const [showModal, setShowModal] = useState(false);
  const { data, isLoading, mutate } = useComunicados('limit=30');
  const comunicados = (data as any)?.data ?? [];
  const { data: aulasData } = useData<any>('/asistencia/mis-aulas');
  const aulas = aulasData?.data ?? [];
  const { mutate: crear, loading: guardando } = useMutation();

  const guardar = async (payload: { titulo: string; contenido: string; seccionId: string }) => {
    await crear(async () => {
      await api.post('/comunicados', payload);
      toast.success('Comunicado publicado');
      mutate();
      setShowModal(false);
    });
  };

  return (
    <DashboardLayout title="Comunicados" allowedRoles={['DOCENTE','AUXILIAR','TUTOR','COORDINADOR','PSICOLOGO','ENFERMERIA']}>
      {aulas.length > 0 && (
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '1rem' }}>
          <button className="btn-accent" onClick={() => setShowModal(true)}><i className="bi bi-plus-lg me-1" />Nuevo comunicado (mi aula)</button>
        </div>
      )}

      {isLoading ? (
        <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}><div className="spinner-border spinner-border-sm" /></div>
      ) : comunicados.length === 0 ? (
        <div className="sige-card" style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
          <i className="bi bi-megaphone" style={{ fontSize: '2.5rem', display: 'block', marginBottom: 12 }} />Sin comunicados
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {comunicados.map((c: any) => (
            <div key={c.id} className="sige-card">
              <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-start' }}>
                <div style={{ width: 40, height: 40, borderRadius: 10, background: 'var(--accent-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <i className="bi bi-megaphone" style={{ color: 'var(--accent)' }} />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 4 }}>
                    <span style={{ fontWeight: 700, fontSize: '0.9rem' }}>{c.titulo}</span>
                    {c.paraElColegio && <span style={{ fontSize: '0.68rem', fontWeight: 700, background: '#ede9fe', color: '#6d28d9', padding: '2px 7px', borderRadius: 99 }}>Todo el colegio</span>}
                  </div>
                  <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', margin: '0 0 8px' }}>{c.contenido}</p>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                    <span><i className="bi bi-person me-1" />{c.creadoPor?.nombres} {c.creadoPor?.apellidos}</span>
                    <span><i className="bi bi-calendar me-1" />{new Date(c.publicadoEn ?? c.createdAt).toLocaleDateString('es-PE')}</span>
                    {c.adjuntoUrl && <a href={c.adjuntoUrl} target="_blank" rel="noreferrer" style={{ color: 'var(--accent)' }}><i className="bi bi-paperclip me-1" />Adjunto</a>}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <AnimatePresence>
        {showModal && (
          <motion.div className="sige-modal-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={e => { if (e.target === e.currentTarget) setShowModal(false); }}>
            <motion.div className="sige-modal" initial={{ scale: 0.94 }} animate={{ scale: 1 }} exit={{ scale: 0.94 }}>
              <FormularioComunicado aulas={aulas} onGuardar={guardar} onCancelar={() => setShowModal(false)} saving={guardando} />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </DashboardLayout>
  );
}

function FormularioComunicado({ aulas, onGuardar, onCancelar, saving }: any) {
  const [titulo, setTitulo] = useState('');
  const [contenido, setContenido] = useState('');
  const [seccionId, setSeccionId] = useState(aulas[0]?.seccionId ?? '');

  return (
    <form onSubmit={e => {
      e.preventDefault();
      if (!seccionId) { toast.error('Selecciona el aula'); return; }
      onGuardar({ titulo, contenido, seccionId });
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
        <h2 style={{ fontSize: '1rem', fontWeight: 700, margin: 0 }}>Nuevo comunicado</h2>
        <button type="button" onClick={onCancelar} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: '1.1rem' }}><i className="bi bi-x-lg" /></button>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
        <div>
          <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>Aula *</label>
          <select className="sige-input" value={seccionId} onChange={e => setSeccionId(e.target.value)} required>
            {aulas.map((a: any) => <option key={a.id} value={a.seccionId}>{a.nombre}{a.seccion?.nivelGrado?.nombre ? ` — ${a.seccion.nivelGrado.nombre}` : ''}</option>)}
          </select>
          <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Solo lo verán los padres de esta aula.</span>
        </div>
        <div>
          <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>Título *</label>
          <input type="text" value={titulo} onChange={e => setTitulo(e.target.value)} required minLength={3} className="sige-input" placeholder="Ej: No hay tarea para mañana" />
        </div>
        <div>
          <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>Mensaje *</label>
          <textarea value={contenido} onChange={e => setContenido(e.target.value)} required minLength={5} className="sige-input" style={{ minHeight: 100, resize: 'vertical' }} />
        </div>
      </div>
      <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', marginTop: '1.25rem' }}>
        <button type="button" onClick={onCancelar} style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: 8, padding: '0.5rem 1rem', cursor: 'pointer', fontSize: '0.875rem', color: 'var(--text-primary)' }}>Cancelar</button>
        <button type="submit" className="btn-accent" disabled={saving}>
          {saving ? <span className="spinner-border spinner-border-sm" /> : <><i className="bi bi-send me-1" />Publicar</>}
        </button>
      </div>
    </form>
  );
}
