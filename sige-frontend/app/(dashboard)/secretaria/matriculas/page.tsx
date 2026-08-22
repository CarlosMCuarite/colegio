'use client';
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { useMatriculas, useNivelesGrados, useMutation } from '@/hooks/useApi';
import api from '@/lib/api';
import toast from 'react-hot-toast';

export default function MatriculasPage() {
  const [nivelGradoId, setNivelGradoId] = useState('');
  const [page, setPage]                 = useState(1);
  const [showModal, setShowModal]       = useState(false);

  const params = new URLSearchParams({ nivelGradoId, page: String(page), limit: '30', activa: 'true' }).toString();
  const { data, isLoading, mutate }   = useMatriculas(params);
  const { data: nivelesData }         = useNivelesGrados();
  const { loading: saving, mutate: save } = useMutation();

  const matriculas = (data as any)?.data ?? [];
  const meta       = (data as any)?.meta ?? {};
  const niveles    = (nivelesData as any)?.data ?? [];

  const guardar = async (form: any) => {
    await save(async () => {
      await api.post('/matriculas', { ...form, anoEscolar: new Date().getFullYear() });
      toast.success('Matrícula registrada');
      mutate(); setShowModal(false);
    });
  };

  return (
    <DashboardLayout title="Matrículas" allowedRoles={['SUPERADMIN','ADMINISTRADOR','DIRECTOR','SECRETARIA']}>
      <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1rem', flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <div style={{ minWidth: 220 }}>
          <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Filtrar por grado</label>
          <select value={nivelGradoId} onChange={e => { setNivelGradoId(e.target.value); setPage(1); }} className="sige-input">
            <option value="">Todos los grados</option>
            {niveles.map((n: any) => <option key={n.id} value={n.id}>{n.nombre}</option>)}
          </select>
        </div>
        <button className="btn-accent" onClick={() => setShowModal(true)}>
          <i className="bi bi-plus-lg" />Nueva Matrícula
        </button>
      </div>

      {/* Resumen rápido */}
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
        {niveles.slice(0, 6).map((n: any) => (
          <button key={n.id} onClick={() => setNivelGradoId(nivelGradoId === n.id ? '' : n.id)}
            style={{
              padding: '0.3rem 0.875rem', borderRadius: 99, border: 'none', cursor: 'pointer', fontSize: '0.78rem', fontWeight: 600,
              background: nivelGradoId === n.id ? 'var(--accent)' : 'var(--bg-card)',
              color: nivelGradoId === n.id ? '#fff' : 'var(--text-secondary)',
              border: nivelGradoId !== n.id ? '1px solid var(--border-color)' : 'none',
            } as any}>
            {n.nombre}
          </button>
        ))}
      </div>

      <div className="sige-card" style={{ padding: 0, overflow: 'hidden' }}>
        {isLoading ? (
          <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}><div className="spinner-border spinner-border-sm me-2" />Cargando...</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="sige-table">
              <thead><tr><th>Estudiante</th><th>DNI</th><th>Nivel / Grado</th><th>Sección</th><th>Año</th><th>Estado</th></tr></thead>
              <tbody>
                {matriculas.length === 0 ? (
                  <tr><td colSpan={6} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>Sin matrículas encontradas</td></tr>
                ) : matriculas.map((m: any, i: number) => (
                  <motion.tr key={m.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.02 }}>
                    <td>
                      <div style={{ fontWeight: 600, fontSize: '0.875rem' }}>{m.estudiante?.apellidos}, {m.estudiante?.nombres}</div>
                    </td>
                    <td style={{ fontFamily: 'monospace', fontSize: '0.82rem' }}>{m.estudiante?.dni}</td>
                    <td style={{ fontSize: '0.82rem' }}>{m.nivelGrado?.nombre}</td>
                    <td style={{ fontSize: '0.82rem' }}>{m.seccion ? `Sección ${m.seccion.nombre}` : '—'}</td>
                    <td style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--accent)' }}>{m.anoEscolar}</td>
                    <td>
                      <span className="estado-badge" style={{ background: m.activa ? '#d1fae5' : '#fee2e2', color: m.activa ? '#065f46' : '#991b1b' }}>
                        {m.activa ? 'Activa' : 'Inactiva'}
                      </span>
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {meta.total > 30 && (
          <div style={{ padding: '0.875rem 1rem', borderTop: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{meta.total} matrículas</span>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button disabled={page <= 1} onClick={() => setPage(p => p-1)} className="btn-accent" style={{ padding: '0.3rem 0.7rem', opacity: page <= 1 ? 0.4 : 1 }}><i className="bi bi-chevron-left" /></button>
              <span style={{ padding: '0.3rem 0.5rem', fontSize: '0.875rem', color: 'var(--text-secondary)', lineHeight: 1.8 }}>Pág. {page}</span>
              <button disabled={page * 30 >= meta.total} onClick={() => setPage(p => p+1)} className="btn-accent" style={{ padding: '0.3rem 0.7rem', opacity: page * 30 >= meta.total ? 0.4 : 1 }}><i className="bi bi-chevron-right" /></button>
            </div>
          </div>
        )}
      </div>

      <AnimatePresence>
        {showModal && (
          <motion.div className="sige-modal-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={e => { if (e.target === e.currentTarget) setShowModal(false); }}>
            <motion.div className="sige-modal" initial={{ scale: 0.94 }} animate={{ scale: 1 }} exit={{ scale: 0.94 }}>
              <MatriculaForm niveles={niveles} onGuardar={guardar} onCancelar={() => setShowModal(false)} saving={saving} />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </DashboardLayout>
  );
}

function MatriculaForm({ niveles, onGuardar, onCancelar, saving }: any) {
  const [form, setForm] = useState({ estudianteDni: '', nivelGradoId: '', seccionId: '', observaciones: '' });
  const [buscando, setBuscando] = useState(false);
  const [estudiante, setEstudiante] = useState<any>(null);
  const set = (k: string) => (e: any) => setForm(p => ({ ...p, [k]: e.target.value }));
  const selectedNivel = niveles.find((n: any) => n.id === form.nivelGradoId);

  const buscarEstudiante = async () => {
    if (!form.estudianteDni.trim()) return;
    setBuscando(true);
    try {
      const res = await api.get(`/estudiantes?q=${form.estudianteDni}&limit=1`);
      const est = res.data.data?.[0];
      if (est) { setEstudiante(est); toast.success(`Encontrado: ${est.nombres} ${est.apellidos}`); }
      else { toast.error('No se encontró ningún estudiante con ese DNI'); setEstudiante(null); }
    } finally { setBuscando(false); }
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!estudiante) { toast.error('Busca primero al estudiante'); return; }
    onGuardar({ estudianteId: estudiante.id, nivelGradoId: form.nivelGradoId, seccionId: form.seccionId || null, observaciones: form.observaciones });
  };

  return (
    <form onSubmit={submit}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
        <h2 style={{ fontSize: '1rem', fontWeight: 700, margin: 0 }}>Nueva Matrícula — {new Date().getFullYear()}</h2>
        <button type="button" onClick={onCancelar} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: '1.1rem' }}><i className="bi bi-x-lg" /></button>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
        <div>
          <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>DNI del Estudiante *</label>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <input type="text" value={form.estudianteDni} onChange={set('estudianteDni')} onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), buscarEstudiante())} className="sige-input" placeholder="Ingresa el DNI" />
            <button type="button" onClick={buscarEstudiante} className="btn-accent" disabled={buscando} style={{ flexShrink: 0 }}>
              {buscando ? <span className="spinner-border spinner-border-sm" /> : <i className="bi bi-search" />}
            </button>
          </div>
        </div>
        {estudiante && (
          <div style={{ background: '#d1fae5', border: '1px solid #10b981', borderRadius: 8, padding: '0.75rem', fontSize: '0.875rem', color: '#065f46', fontWeight: 600 }}>
            <i className="bi bi-check-circle me-2" />{estudiante.nombres} {estudiante.apellidos} — DNI: {estudiante.dni}
          </div>
        )}
        <div>
          <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>Grado *</label>
          <select value={form.nivelGradoId} onChange={set('nivelGradoId')} required className="sige-input">
            <option value="">Seleccionar grado</option>
            {niveles.map((n: any) => <option key={n.id} value={n.id}>{n.nombre}</option>)}
          </select>
        </div>
        <div>
          <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>Sección</label>
          <select value={form.seccionId} onChange={set('seccionId')} className="sige-input" disabled={!form.nivelGradoId}>
            <option value="">Sin sección</option>
            {selectedNivel?.secciones?.map((s: any) => <option key={s.id} value={s.id}>Sección {s.nombre}</option>)}
          </select>
        </div>
        <div>
          <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>Observaciones</label>
          <textarea value={form.observaciones} onChange={set('observaciones')} className="sige-input" style={{ minHeight: 60, resize: 'vertical' }} />
        </div>
      </div>
      <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', marginTop: '1.25rem' }}>
        <button type="button" onClick={onCancelar} style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: 8, padding: '0.5rem 1.1rem', cursor: 'pointer', color: 'var(--text-primary)', fontSize: '0.875rem' }}>Cancelar</button>
        <button type="submit" className="btn-accent" disabled={saving || !estudiante}>
          {saving ? <><span className="spinner-border spinner-border-sm me-1" />Registrando...</> : <><i className="bi bi-check2 me-1" />Registrar Matrícula</>}
        </button>
      </div>
    </form>
  );
}
